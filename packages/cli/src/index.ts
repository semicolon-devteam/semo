#!/usr/bin/env node
/**
 * SEMO CLI v2.0
 *
 * Gemini 하이브리드 전략 기반 AI Agent Orchestration Framework
 *
 * 사용법:
 *   npx @team-semicolon/semo-cli init          # 기본 설치
 *   npx @team-semicolon/semo-cli add next      # 패키지 추가
 *   npx @team-semicolon/semo-cli list          # 패키지 목록
 *
 * 구조:
 *   - Standard: semo-core + semo-skills (필수)
 *   - Extensions: packages/next, packages/backend 등 (선택)
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  getPackages,
  getStandardPackages,
  getExtensionPackages,
  resolvePackageName,
  getPackageVersion,
  getPackagesByGroup,
  getDetectablePackages,
  buildExtensionPackagesFromDb,
  buildShortnameMappingFromDb,
  PackageDefinition,
  toExtensionPackageFormat,
} from "./supabase";

const PACKAGE_NAME = "@team-semicolon/semo-cli";

// package.json에서 버전 동적 로드
function getCliVersion(): string {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

const VERSION = getCliVersion();

// === 버전 비교 유틸리티 ===

/**
 * npm registry에서 최신 버전을 가져옴
 */
async function getLatestVersion(): Promise<string | null> {
  try {
    const result = execSync(`npm view ${PACKAGE_NAME} version`, {
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 10000, // 10초 타임아웃
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * 시맨틱 버전 비교 (v1이 v2보다 낮으면 true)
 * 예: isVersionLower("1.0.0", "1.0.1") => true
 */
function isVersionLower(current: string, latest: string): boolean {
  // alpha, beta 등 pre-release 태그 제거 후 비교
  const cleanVersion = (v: string) => v.replace(/-.*$/, "");

  const currentParts = cleanVersion(current).split(".").map(Number);
  const latestParts = cleanVersion(latest).split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (c < l) return true;
    if (c > l) return false;
  }

  // 숫자가 같으면 pre-release 여부 확인
  // current가 pre-release이고 latest가 정식이면 낮은 버전
  const currentIsPrerelease = current.includes("-");
  const latestIsPrerelease = latest.includes("-");

  if (currentIsPrerelease && !latestIsPrerelease) return true;

  return false;
}

/**
 * GitHub raw URL에서 패키지 버전 가져오기
 */
async function getRemotePackageVersion(packagePath: string): Promise<string | null> {
  try {
    const url = `https://raw.githubusercontent.com/semicolon-devteam/semo/main/packages/${packagePath}/VERSION`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const version = await response.text();
    return version.trim();
  } catch {
    return null;
  }
}

/**
 * semo-core/semo-skills 원격 버전 가져오기 (semo-system/ 하위 경로)
 */
async function getRemoteCoreVersion(type: "semo-core" | "semo-skills" | "semo-agents" | "semo-scripts"): Promise<string | null> {
  try {
    // v5.0: semo-system/ 하위에 Standard 패키지가 위치
    const url = `https://raw.githubusercontent.com/semicolon-devteam/semo/main/semo-system/${type}/VERSION`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const version = await response.text();
    return version.trim();
  } catch {
    return null;
  }
}

/**
 * init/update 시작 시 버전 비교 결과 출력
 */
async function showVersionComparison(cwd: string): Promise<void> {
  console.log(chalk.cyan("📊 버전 확인\n"));

  const spinner = ora("  버전 정보 조회 중...").start();

  try {
    // 1. CLI 버전 비교
    const currentCliVersion = VERSION;
    const latestCliVersion = await getLatestVersion();

    // 2. semo-core, semo-skills 버전 비교
    const semoSystemDir = path.join(cwd, "semo-system");
    const hasSemoSystem = fs.existsSync(semoSystemDir);

    interface VersionInfo {
      name: string;
      local: string | null;
      remote: string | null;
      needsUpdate: boolean;
      level: number; // 0: root, 1: group, 2: sub-package
      group?: string; // 상위 그룹명
    }

    const versionInfos: VersionInfo[] = [];

    // CLI
    versionInfos.push({
      name: "semo-cli (npm)",
      local: currentCliVersion,
      remote: latestCliVersion,
      needsUpdate: latestCliVersion ? isVersionLower(currentCliVersion, latestCliVersion) : false,
      level: 0,
    });

    // 레거시 환경 경고 (루트에 semo-core/semo-skills가 있는 경우)
    const hasLegacyCore = fs.existsSync(path.join(cwd, "semo-core"));
    const hasLegacySkills = fs.existsSync(path.join(cwd, "semo-skills"));
    if (hasLegacyCore || hasLegacySkills) {
      spinner.warn("레거시 환경 감지됨");
      console.log(chalk.yellow("\n  ⚠️  구버전 SEMO 구조가 감지되었습니다."));
      console.log(chalk.gray("     루트에 semo-core/ 또는 semo-skills/가 있습니다."));
      console.log(chalk.cyan("\n  💡 마이그레이션 방법:"));
      console.log(chalk.gray("     1. 기존 semo-core/, semo-skills/ 폴더 삭제"));
      console.log(chalk.gray("     2. .claude/ 폴더 삭제"));
      console.log(chalk.gray("     3. semo init 다시 실행\n"));
      console.log(chalk.gray("     또는: semo migrate --force\n"));
      return;
    }

    // semo-core (semo-system/ 내부만 확인)
    const corePathSystem = path.join(semoSystemDir, "semo-core", "VERSION");

    if (fs.existsSync(corePathSystem)) {
      const localCore = fs.readFileSync(corePathSystem, "utf-8").trim();
      const remoteCore = await getRemoteCoreVersion("semo-core");
      versionInfos.push({
        name: "semo-core",
        local: localCore,
        remote: remoteCore,
        needsUpdate: remoteCore ? isVersionLower(localCore, remoteCore) : false,
        level: 0,
      });
    }

    // semo-skills (semo-system/ 내부만 확인)
    const skillsPathSystem = path.join(semoSystemDir, "semo-skills", "VERSION");

    if (fs.existsSync(skillsPathSystem)) {
      const localSkills = fs.readFileSync(skillsPathSystem, "utf-8").trim();
      const remoteSkills = await getRemoteCoreVersion("semo-skills");
      versionInfos.push({
        name: "semo-skills",
        local: localSkills,
        remote: remoteSkills,
        needsUpdate: remoteSkills ? isVersionLower(localSkills, remoteSkills) : false,
        level: 0,
      });
    }

    // semo-agents (semo-system/ 내부)
    const agentsPathSystem = path.join(semoSystemDir, "semo-agents", "VERSION");
    if (fs.existsSync(agentsPathSystem)) {
      const localAgents = fs.readFileSync(agentsPathSystem, "utf-8").trim();
      const remoteAgents = await getRemoteCoreVersion("semo-agents");
      versionInfos.push({
        name: "semo-agents",
        local: localAgents,
        remote: remoteAgents,
        needsUpdate: remoteAgents ? isVersionLower(localAgents, remoteAgents) : false,
        level: 0,
      });
    }

    // semo-scripts (semo-system/ 내부)
    const scriptsPathSystem = path.join(semoSystemDir, "semo-scripts", "VERSION");
    if (fs.existsSync(scriptsPathSystem)) {
      const localScripts = fs.readFileSync(scriptsPathSystem, "utf-8").trim();
      const remoteScripts = await getRemoteCoreVersion("semo-scripts");
      versionInfos.push({
        name: "semo-scripts",
        local: localScripts,
        remote: remoteScripts,
        needsUpdate: remoteScripts ? isVersionLower(localScripts, remoteScripts) : false,
        level: 0,
      });
    }

    // 그룹 패키지 (eng, biz, ops) 및 하위 Extension - semo-system 내부
    // 그룹별로 묶어서 계층 구조로 출력
    if (hasSemoSystem) {
      for (const group of PACKAGE_GROUPS) {
        const groupVersionPath = path.join(semoSystemDir, group, "VERSION");
        const hasGroupVersion = fs.existsSync(groupVersionPath);

        // 해당 그룹의 하위 패키지 찾기
        const groupExtensions = Object.keys(EXTENSION_PACKAGES).filter(key => key.startsWith(`${group}/`));
        const installedGroupExtensions = groupExtensions.filter(key =>
          fs.existsSync(path.join(semoSystemDir, key, "VERSION"))
        );

        // 그룹 버전이 있거나 하위 패키지가 설치된 경우에만 표시
        if (hasGroupVersion || installedGroupExtensions.length > 0) {
          // 그룹 패키지 버전 추가
          if (hasGroupVersion) {
            const localGroup = fs.readFileSync(groupVersionPath, "utf-8").trim();
            const remoteGroup = await getRemotePackageVersion(group);

            versionInfos.push({
              name: group,
              local: localGroup,
              remote: remoteGroup,
              needsUpdate: remoteGroup ? isVersionLower(localGroup, remoteGroup) : false,
              level: 1,
            });
          }

          // 하위 Extension 패키지들 추가
          for (const key of installedGroupExtensions) {
            const extVersionPath = path.join(semoSystemDir, key, "VERSION");
            const localExt = fs.readFileSync(extVersionPath, "utf-8").trim();
            const remoteExt = await getRemotePackageVersion(key);

            versionInfos.push({
              name: key,
              local: localExt,
              remote: remoteExt,
              needsUpdate: remoteExt ? isVersionLower(localExt, remoteExt) : false,
              level: 2,
              group: group,
            });
          }
        }
      }

      // 그룹에 속하지 않는 Extension (meta 등)
      const nonGroupExtensions = Object.keys(EXTENSION_PACKAGES).filter(key =>
        !PACKAGE_GROUPS.some(g => key.startsWith(`${g}/`))
      );

      for (const key of nonGroupExtensions) {
        const extVersionPath = path.join(semoSystemDir, key, "VERSION");
        if (fs.existsSync(extVersionPath)) {
          const localExt = fs.readFileSync(extVersionPath, "utf-8").trim();
          const remoteExt = await getRemotePackageVersion(key);

          versionInfos.push({
            name: key,
            local: localExt,
            remote: remoteExt,
            needsUpdate: remoteExt ? isVersionLower(localExt, remoteExt) : false,
            level: 1,
          });
        }
      }
    }

    // packages/ 디렉토리의 설치된 패키지들 (로컬 버전만 표시) - 개발 환경용
    const packagesDir = path.join(cwd, "packages");
    if (fs.existsSync(packagesDir)) {
      // 그룹별 패키지 매핑
      const packageGroups: Record<string, { level: number; packages: Array<{ name: string; path: string }> }> = {
        "packages/core": { level: 0, packages: [{ name: "packages/core", path: "core" }] },
        "packages/meta": { level: 0, packages: [{ name: "packages/meta", path: "meta" }] },
        "packages/eng": {
          level: 1,
          packages: [
            { name: "packages/eng/nextjs", path: "eng/nextjs" },
            { name: "packages/eng/spring", path: "eng/spring" },
            { name: "packages/eng/ms", path: "eng/ms" },
            { name: "packages/eng/infra", path: "eng/infra" },
          ],
        },
        "packages/biz": {
          level: 1,
          packages: [
            { name: "packages/biz/discovery", path: "biz/discovery" },
            { name: "packages/biz/management", path: "biz/management" },
            { name: "packages/biz/design", path: "biz/design" },
            { name: "packages/biz/poc", path: "biz/poc" },
          ],
        },
        "packages/ops": {
          level: 1,
          packages: [
            { name: "packages/ops/qa", path: "ops/qa" },
            { name: "packages/ops/monitor", path: "ops/monitor" },
            { name: "packages/ops/improve", path: "ops/improve" },
          ],
        },
      };

      for (const [groupKey, groupData] of Object.entries(packageGroups)) {
        for (const pkg of groupData.packages) {
          const pkgVersionPath = path.join(packagesDir, pkg.path, "VERSION");
          if (fs.existsSync(pkgVersionPath)) {
            const localPkg = fs.readFileSync(pkgVersionPath, "utf-8").trim();
            const remotePkg = await getRemotePackageVersion(`packages/${pkg.path}`);
            const isSubPackage = pkg.path.includes("/");

            versionInfos.push({
              name: pkg.name,
              local: localPkg,
              remote: remotePkg,
              needsUpdate: remotePkg ? isVersionLower(localPkg, remotePkg) : false,
              level: isSubPackage ? 2 : groupData.level,
              group: isSubPackage ? pkg.path.split("/")[0] : undefined,
            });
          }
        }
      }
    }

    spinner.stop();

    // 결과 출력
    const needsUpdateCount = versionInfos.filter(v => v.needsUpdate).length;

    console.log(chalk.gray("  ┌────────────────────────┬──────────┬──────────┬────────┐"));
    console.log(chalk.gray("  │ 패키지                 │ 설치됨   │ 최신     │ 상태   │"));
    console.log(chalk.gray("  ├────────────────────────┼──────────┼──────────┼────────┤"));

    for (const info of versionInfos) {
      // 계층 구조 표시를 위한 접두사
      let prefix = "";
      let displayName = info.name;

      if (info.level === 1) {
        // 그룹 패키지 (eng, biz, ops)
        prefix = "📦 ";
      } else if (info.level === 2) {
        // 하위 패키지
        prefix = "  └─ ";
        // 그룹명 제거하고 하위 이름만 표시 (예: biz/discovery → discovery)
        displayName = info.name.includes("/") ? info.name.split("/").pop() || info.name : info.name;
      }

      const name = (prefix + displayName).padEnd(22);
      const local = (info.local || "-").padEnd(8);
      const remote = (info.remote || "-").padEnd(8);
      const status = info.needsUpdate
        ? chalk.yellow("⬆ 업데이트")
        : chalk.green("✓ 최신");

      if (info.needsUpdate) {
        console.log(chalk.yellow(`  │ ${name} │ ${local} │ ${remote} │ ${status} │`));
      } else {
        console.log(chalk.gray(`  │ ${name} │ ${local} │ ${remote} │ `) + status + chalk.gray(" │"));
      }
    }

    console.log(chalk.gray("  └────────────────────────┴──────────┴──────────┴────────┘"));

    if (needsUpdateCount > 0) {
      console.log(chalk.yellow(`\n  ⚠ ${needsUpdateCount}개 패키지 업데이트 가능`));
    } else {
      console.log(chalk.green("\n  ✓ 모든 패키지가 최신 버전입니다"));
    }

    console.log("");
  } catch (error) {
    spinner.fail("  버전 정보 조회 실패");
    console.log(chalk.gray(`     ${error}`));
    console.log("");
  }
}

// === Windows 지원 유틸리티 ===
// Git Bash, WSL 등에서도 Windows로 인식하도록 확장
const isWindows = os.platform() === "win32" ||
  process.env.OSTYPE?.includes("msys") ||
  process.env.OSTYPE?.includes("cygwin") ||
  process.env.TERM_PROGRAM === "mintty";

/**
 * Windows에서 Junction 링크를 생성하거나, Unix에서 심볼릭 링크를 생성
 * Junction은 관리자 권한 없이 디렉토리 링크를 생성할 수 있음
 *
 * Windows 환경 (Git Bash, PowerShell, CMD 포함):
 * 1. Junction 시도 (폴더만 가능)
 * 2. 실패 시 xcopy로 복사
 *
 * Unix/Mac 환경:
 * - 상대 경로 심볼릭 링크
 */
function createSymlinkOrJunction(targetPath: string, linkPath: string): void {
  // 이미 존재하는 링크/파일 제거 (깨진 심볼릭 링크도 처리)
  try {
    const stats = fs.lstatSync(linkPath);
    if (stats.isSymbolicLink() || stats.isFile() || stats.isDirectory()) {
      try {
        fs.unlinkSync(linkPath);
      } catch {
        removeRecursive(linkPath);
      }
    }
  } catch {
    // 파일이 존재하지 않음 - 정상
  }

  if (isWindows) {
    // Windows: Junction 사용 (절대 경로, Windows 형식 필요)
    // path.resolve는 Git Bash에서도 Windows 경로를 반환
    const absoluteTarget = path.resolve(targetPath);
    const absoluteLink = path.resolve(linkPath);

    // 타겟이 파일인지 폴더인지 확인
    const targetStats = fs.statSync(targetPath);
    const isDirectory = targetStats.isDirectory();

    if (isDirectory) {
      // 폴더: Junction 시도
      let success = false;

      try {
        // mklink /J 사용 (관리자 권한 불필요)
        execSync(`cmd /c mklink /J "${absoluteLink}" "${absoluteTarget}"`, {
          stdio: "pipe",
          windowsHide: true,
        });
        success = true;
      } catch {
        // Junction 실패 - xcopy로 복사
        success = false;
      }

      if (!success) {
        // fallback: 디렉토리 복사
        console.log(chalk.yellow(`  ⚠ Junction 생성 실패, 복사로 대체: ${path.basename(linkPath)}`));
        console.log(chalk.gray(`     💡 업데이트 시 semo update 명령으로 동기화하세요.`));
        fs.mkdirSync(absoluteLink, { recursive: true });
        execSync(`xcopy /E /I /Q /Y "${absoluteTarget}" "${absoluteLink}"`, {
          stdio: "pipe",
          windowsHide: true,
        });
      }
    } else {
      // 파일: 직접 복사 (Junction은 폴더만 지원)
      fs.copyFileSync(absoluteTarget, absoluteLink);
    }
  } else {
    // Unix: 상대 경로 심볼릭 링크
    const relativeTarget = path.relative(path.dirname(linkPath), targetPath);
    fs.symlinkSync(relativeTarget, linkPath);
  }
}

/**
 * 심볼릭 링크가 유효한지 확인 (타겟 존재 여부)
 */
function isSymlinkValid(linkPath: string): boolean {
  try {
    const stats = fs.lstatSync(linkPath);
    if (!stats.isSymbolicLink()) return true; // 일반 파일/디렉토리

    // 심볼릭 링크인 경우 타겟 존재 확인
    const target = fs.readlinkSync(linkPath);
    const absoluteTarget = path.isAbsolute(target)
      ? target
      : path.resolve(path.dirname(linkPath), target);

    return fs.existsSync(absoluteTarget);
  } catch {
    return false;
  }
}

// === 레거시 환경 감지 및 마이그레이션 ===

interface LegacyDetectionResult {
  hasLegacy: boolean;
  legacyPaths: string[];
  hasSemoSystem: boolean;
}

/**
 * 레거시 SEMO 환경을 감지합니다.
 * 레거시: 프로젝트 루트에 semo-core/, semo-skills/ 가 직접 있는 경우
 * 신규: semo-system/ 하위에 있는 경우
 */
function detectLegacyEnvironment(cwd: string): LegacyDetectionResult {
  const legacyPaths: string[] = [];

  // 루트에 직접 있는 레거시 디렉토리 확인
  const legacyDirs = ["semo-core", "semo-skills", "sax-core", "sax-skills"];
  for (const dir of legacyDirs) {
    const dirPath = path.join(cwd, dir);
    if (fs.existsSync(dirPath) && !fs.lstatSync(dirPath).isSymbolicLink()) {
      legacyPaths.push(dir);
    }
  }

  // semo-system/ 내부의 레거시 Extension 구조 확인
  // 구버전: semo-system/biz/, semo-system/eng/, semo-system/ops/ (그룹 디렉토리)
  // 신버전: semo-system/biz/design/, semo-system/eng/nextjs/ 등 (개별 패키지)
  const semoSystemDir = path.join(cwd, "semo-system");
  if (fs.existsSync(semoSystemDir)) {
    const legacyExtGroups = ["biz", "eng", "ops"];
    for (const group of legacyExtGroups) {
      const groupDir = path.join(semoSystemDir, group);
      if (fs.existsSync(groupDir) && fs.statSync(groupDir).isDirectory()) {
        // VERSION 파일이 그룹 디렉토리에 직접 있으면 레거시 구조
        const groupVersionFile = path.join(groupDir, "VERSION");
        if (fs.existsSync(groupVersionFile)) {
          legacyPaths.push(`semo-system/${group} (레거시 그룹 구조)`);
        }
      }
    }
  }

  // .claude/ 내부의 레거시 구조 확인
  const claudeDir = path.join(cwd, ".claude");
  if (fs.existsSync(claudeDir)) {
    // 심볼릭 링크가 레거시 경로를 가리키는지 확인
    const checkLegacyLink = (linkName: string) => {
      const linkPath = path.join(claudeDir, linkName);
      if (fs.existsSync(linkPath) && fs.lstatSync(linkPath).isSymbolicLink()) {
        try {
          const target = fs.readlinkSync(linkPath);
          // 레거시 경로 패턴: ../semo-core, ../sax-core 등
          if (target.match(/^\.\.\/(semo|sax)-(core|skills)/)) {
            legacyPaths.push(`.claude/${linkName} → ${target}`);
          }
        } catch {
          // 읽기 실패 무시
        }
      }
    };
    checkLegacyLink("agents");
    checkLegacyLink("skills");
    checkLegacyLink("commands");
  }

  return {
    hasLegacy: legacyPaths.length > 0,
    legacyPaths,
    hasSemoSystem: fs.existsSync(path.join(cwd, "semo-system")),
  };
}

/**
 * 레거시 환경을 새 환경으로 마이그레이션합니다.
 */
async function migrateLegacyEnvironment(cwd: string): Promise<boolean> {
  const detection = detectLegacyEnvironment(cwd);

  if (!detection.hasLegacy) {
    return true; // 마이그레이션 불필요
  }

  console.log(chalk.yellow("\n⚠️  레거시 SEMO 환경이 감지되었습니다.\n"));
  console.log(chalk.gray("   감지된 레거시 경로:"));
  detection.legacyPaths.forEach(p => {
    console.log(chalk.gray(`     - ${p}`));
  });
  console.log();

  // 사용자 확인
  const { shouldMigrate } = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldMigrate",
      message: "레거시 환경을 새 구조(semo-system/)로 마이그레이션하시겠습니까?",
      default: true,
    },
  ]);

  if (!shouldMigrate) {
    console.log(chalk.yellow("\n마이그레이션이 취소되었습니다."));
    console.log(chalk.gray("💡 수동 마이그레이션 방법:"));
    console.log(chalk.gray("   1. 기존 semo-core/, semo-skills/ 폴더 삭제"));
    console.log(chalk.gray("   2. .claude/ 폴더 삭제"));
    console.log(chalk.gray("   3. semo init 다시 실행\n"));
    return false;
  }

  const spinner = ora("레거시 환경 마이그레이션 중...").start();

  try {
    // 1. 루트의 레거시 디렉토리 삭제
    const legacyDirs = ["semo-core", "semo-skills", "sax-core", "sax-skills"];
    for (const dir of legacyDirs) {
      const dirPath = path.join(cwd, dir);
      if (fs.existsSync(dirPath) && !fs.lstatSync(dirPath).isSymbolicLink()) {
        removeRecursive(dirPath);
        console.log(chalk.gray(`     ✓ ${dir}/ 삭제됨`));
      }
    }

    // 2. .claude/ 내부의 레거시 심볼릭 링크 삭제
    const claudeDir = path.join(cwd, ".claude");
    if (fs.existsSync(claudeDir)) {
      const linksToCheck = ["agents", "skills", "commands"];
      for (const linkName of linksToCheck) {
        const linkPath = path.join(claudeDir, linkName);
        if (fs.existsSync(linkPath)) {
          removeRecursive(linkPath);
        }
      }
    }

    // 3. semo-system/ 내부의 레거시 Extension 그룹 삭제
    const semoSystemDir = path.join(cwd, "semo-system");
    if (fs.existsSync(semoSystemDir)) {
      const legacyExtGroups = ["biz", "eng", "ops"];
      for (const group of legacyExtGroups) {
        const groupDir = path.join(semoSystemDir, group);
        const groupVersionFile = path.join(groupDir, "VERSION");
        // VERSION 파일이 그룹 디렉토리에 직접 있으면 레거시 구조이므로 삭제
        if (fs.existsSync(groupVersionFile)) {
          removeRecursive(groupDir);
          console.log(chalk.gray(`     ✓ semo-system/${group}/ 삭제됨 (레거시 그룹 구조)`));
        }
      }
    }

    // 4. 기존 semo-system이 완전히 레거시인 경우에만 삭제
    // (Standard 패키지가 없는 경우)
    if (fs.existsSync(semoSystemDir)) {
      const hasStandard = fs.existsSync(path.join(semoSystemDir, "semo-core"));
      if (!hasStandard) {
        removeRecursive(semoSystemDir);
        console.log(chalk.gray(`     ✓ semo-system/ 삭제됨 (완전 재설치)`));
      }
    }

    spinner.succeed("레거시 환경 정리 완료");
    console.log(chalk.green("   → 새 환경으로 설치를 진행합니다.\n"));

    return true;
  } catch (error) {
    spinner.fail("마이그레이션 실패");
    console.error(chalk.red(`   ${error}`));
    return false;
  }
}

/**
 * 플랫폼에 맞는 rm -rf 실행
 */
function removeRecursive(targetPath: string): void {
  if (!fs.existsSync(targetPath)) return;

  if (isWindows) {
    try {
      const stats = fs.lstatSync(targetPath);
      if (stats.isSymbolicLink()) {
        // Junction/Symlink는 rmdir로 제거 (내용물 보존)
        execSync(`cmd /c "rmdir "${targetPath}""`, { stdio: "pipe" });
      } else {
        execSync(`cmd /c "rd /s /q "${targetPath}""`, { stdio: "pipe" });
      }
    } catch {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  } else {
    execSync(`rm -rf "${targetPath}"`, { stdio: "pipe" });
  }
}

/**
 * 플랫폼에 맞는 cp -r 실행
 */
function copyRecursive(src: string, dest: string): void {
  if (isWindows) {
    execSync(`xcopy /E /I /Q "${src}" "${dest}"`, { stdio: "pipe" });
  } else {
    execSync(`cp -r "${src}" "${dest}"`, { stdio: "pipe" });
  }
}

const SEMO_REPO = "https://github.com/semicolon-devteam/semo.git";

// ============================================================
// DB 기반 패키지 관리 (v3.10+)
// ============================================================

// 캐시된 패키지 데이터 (DB에서 조회 후 캐시)
let cachedExtensionPackages: Record<string, { name: string; desc: string; detect: string[]; layer: string }> | null = null;
let cachedShortnameMappings: Record<string, string> | null = null;
let cachedPackageDefinitions: PackageDefinition[] | null = null;

// 패키지 데이터 초기화 (DB에서 조회)
async function initPackageData(): Promise<void> {
  if (cachedExtensionPackages && cachedShortnameMappings) return;

  try {
    cachedExtensionPackages = await buildExtensionPackagesFromDb();
    cachedShortnameMappings = await buildShortnameMappingFromDb();
    cachedPackageDefinitions = await getExtensionPackages();
  } catch {
    // 폴백: 하드코딩된 데이터 사용
    cachedExtensionPackages = EXTENSION_PACKAGES_FALLBACK;
    cachedShortnameMappings = SHORTNAME_MAPPING_FALLBACK;
    cachedPackageDefinitions = null;
  }
}

// EXTENSION_PACKAGES 동기 접근용 (초기화 후 사용)
function getExtensionPackagesSync(): Record<string, { name: string; desc: string; detect: string[]; layer: string }> {
  return cachedExtensionPackages || EXTENSION_PACKAGES_FALLBACK;
}

// SHORTNAME_MAPPING 동기 접근용
function getShortnameMappingSync(): Record<string, string> {
  return cachedShortnameMappings || SHORTNAME_MAPPING_FALLBACK;
}

// 폴백용 하드코딩 데이터 (DB 연결 실패 시 사용)
const EXTENSION_PACKAGES_FALLBACK: Record<string, { name: string; desc: string; detect: string[]; layer: string }> = {
  // Business Layer
  "biz/discovery": { name: "Discovery", desc: "아이템 발굴, 시장 조사, Epic/Task", layer: "biz", detect: [] },
  "biz/design": { name: "Design", desc: "컨셉 설계, 목업, UX", layer: "biz", detect: [] },
  "biz/management": { name: "Management", desc: "일정/인력/스프린트 관리", layer: "biz", detect: [] },
  "biz/poc": { name: "PoC", desc: "빠른 PoC, 패스트트랙", layer: "biz", detect: [] },

  // Engineering Layer
  "eng/nextjs": { name: "Next.js", desc: "Next.js 프론트엔드 개발", layer: "eng", detect: ["next.config.js", "next.config.mjs", "next.config.ts"] },
  "eng/spring": { name: "Spring", desc: "Spring Boot 백엔드 개발", layer: "eng", detect: ["pom.xml", "build.gradle"] },
  "eng/ms": { name: "Microservice", desc: "마이크로서비스 아키텍처", layer: "eng", detect: [] },
  "eng/infra": { name: "Infra", desc: "인프라/배포 관리", layer: "eng", detect: ["docker-compose.yml", "Dockerfile"] },

  // Operations Layer
  "ops/qa": { name: "QA", desc: "테스트/품질 관리", layer: "ops", detect: [] },
  "ops/monitor": { name: "Monitor", desc: "서비스 현황 모니터링", layer: "ops", detect: [] },
  "ops/improve": { name: "Improve", desc: "개선 제안", layer: "ops", detect: [] },

  // Meta
  meta: { name: "Meta", desc: "SEMO 프레임워크 자체 개발/관리", layer: "meta", detect: ["semo-core", "semo-skills"] },

  // System (semo-system 하위 패키지)
  "semo-hooks": { name: "Hooks", desc: "Claude Code Hooks 기반 로깅 시스템", layer: "system", detect: [] },
  "semo-remote": { name: "Remote", desc: "Claude Code 원격 제어 (모바일 PWA)", layer: "system", detect: [] },
};

// 단축명 → 전체 패키지 경로 매핑 (폴백)
const SHORTNAME_MAPPING_FALLBACK: Record<string, string> = {
  // 하위 패키지명 단축 (discovery → biz/discovery)
  discovery: "biz/discovery",
  design: "biz/design",
  management: "biz/management",
  poc: "biz/poc",
  nextjs: "eng/nextjs",
  spring: "eng/spring",
  ms: "eng/ms",
  infra: "eng/infra",
  qa: "ops/qa",
  monitor: "ops/monitor",
  improve: "ops/improve",
  // 추가 별칭
  next: "eng/nextjs",
  backend: "eng/spring",
  mvp: "biz/poc",
  // System 패키지 단축명
  hooks: "semo-hooks",
  remote: "semo-remote",
};

// 호환성을 위한 상수 별칭 (기존 코드에서 사용)
const EXTENSION_PACKAGES = EXTENSION_PACKAGES_FALLBACK;
const SHORTNAME_MAPPING = SHORTNAME_MAPPING_FALLBACK;

// 그룹 이름 목록 (biz, eng, ops, meta, system)
const PACKAGE_GROUPS = ["biz", "eng", "ops", "meta", "system"] as const;
type PackageGroup = typeof PACKAGE_GROUPS[number];

// 그룹명 → 해당 그룹의 모든 패키지 반환 (DB 기반)
async function getPackagesByGroupAsync(group: PackageGroup): Promise<string[]> {
  const packages = await getPackagesByGroup(group);
  return packages.map(p => p.name);
}

// 그룹명 → 해당 그룹의 모든 패키지 반환 (동기, 폴백)
function getPackagesByGroupSync(group: PackageGroup): string[] {
  const extPkgs = getExtensionPackagesSync();
  return Object.entries(extPkgs)
    .filter(([, pkg]) => pkg.layer === group)
    .map(([key]) => key);
}

// 패키지 입력을 해석 (그룹, 레거시, 쉼표 구분 모두 처리)
function resolvePackageInput(input: string): { packages: string[]; isGroup: boolean; groupName?: string } {
  // 쉼표로 구분된 여러 패키지 처리
  const parts = input.split(",").map(p => p.trim()).filter(p => p);
  const resolvedPackages: string[] = [];
  let isGroup = false;
  let groupName: string | undefined;

  // DB에서 로드된 데이터 또는 폴백 사용
  const extPkgs = getExtensionPackagesSync();
  const shortnames = getShortnameMappingSync();

  for (const part of parts) {
    // 1. 그룹명인지 확인 (biz, eng, ops, meta)
    if (PACKAGE_GROUPS.includes(part as PackageGroup)) {
      const groupPackages = getPackagesByGroupSync(part as PackageGroup);
      resolvedPackages.push(...groupPackages);
      isGroup = true;
      groupName = part;
      continue;
    }

    // 2. 단축명 매핑 확인 (discovery → biz/discovery 등)
    if (part in shortnames) {
      resolvedPackages.push(shortnames[part]);
      continue;
    }

    // 3. 직접 패키지명 확인
    if (part in extPkgs) {
      resolvedPackages.push(part);
      continue;
    }

    // 4. 유효하지 않은 패키지명
    // (빈 배열 대신 null을 추가하여 나중에 에러 처리)
  }

  // 중복 제거
  return {
    packages: [...new Set(resolvedPackages)],
    isGroup,
    groupName
  };
}

const program = new Command();

program
  .name("semo")
  .description("SEMO CLI - AI Agent Orchestration Framework")
  .version(VERSION, "-V, --version-simple", "버전 번호만 출력");

// === version 명령어 (상세 버전 정보) ===
program
  .command("version")
  .description("버전 정보 및 업데이트 확인")
  .action(async () => {
    await showVersionInfo();
  });

/**
 * 상세 버전 정보 표시 및 업데이트 확인
 */
async function showVersionInfo(): Promise<void> {
  const cwd = process.cwd();

  console.log(chalk.cyan.bold("\n📦 SEMO 버전 정보\n"));

  // 버전 정보 수집
  interface VersionInfo {
    name: string;
    local: string | null;
    remote: string | null;
    needsUpdate: boolean;
    level: number;
    group?: string;
  }

  const versionInfos: VersionInfo[] = [];

  // 1. CLI 버전
  const latestCliVersion = await getLatestVersion();
  versionInfos.push({
    name: "semo-cli",
    local: VERSION,
    remote: latestCliVersion,
    needsUpdate: latestCliVersion ? isVersionLower(VERSION, latestCliVersion) : false,
    level: 0,
  });

  // 2. semo-core 버전 (루트 또는 semo-system 내부)
  const corePathRoot = path.join(cwd, "semo-core", "VERSION");
  const corePathSystem = path.join(cwd, "semo-system", "semo-core", "VERSION");
  const corePath = fs.existsSync(corePathRoot) ? corePathRoot : corePathSystem;

  if (fs.existsSync(corePath)) {
    const localCore = fs.readFileSync(corePath, "utf-8").trim();
    const remoteCore = await getRemoteCoreVersion("semo-core");
    versionInfos.push({
      name: "semo-core",
      local: localCore,
      remote: remoteCore,
      needsUpdate: remoteCore ? isVersionLower(localCore, remoteCore) : false,
      level: 0,
    });
  }

  // 3. semo-skills 버전 (루트 또는 semo-system 내부)
  const skillsPathRoot = path.join(cwd, "semo-skills", "VERSION");
  const skillsPathSystem = path.join(cwd, "semo-system", "semo-skills", "VERSION");
  const skillsPath = fs.existsSync(skillsPathRoot) ? skillsPathRoot : skillsPathSystem;

  if (fs.existsSync(skillsPath)) {
    const localSkills = fs.readFileSync(skillsPath, "utf-8").trim();
    const remoteSkills = await getRemoteCoreVersion("semo-skills");
    versionInfos.push({
      name: "semo-skills",
      local: localSkills,
      remote: remoteSkills,
      needsUpdate: remoteSkills ? isVersionLower(localSkills, remoteSkills) : false,
      level: 0,
    });
  }

  // 4. 그룹 패키지 (eng, biz, ops) 및 하위 Extension - semo-system 내부
  const semoSystemDir = path.join(cwd, "semo-system");
  if (fs.existsSync(semoSystemDir)) {
    for (const group of PACKAGE_GROUPS) {
      const groupVersionPath = path.join(semoSystemDir, group, "VERSION");
      const hasGroupVersion = fs.existsSync(groupVersionPath);

      // 해당 그룹의 하위 패키지 찾기
      const groupExtensions = Object.keys(EXTENSION_PACKAGES).filter(key => key.startsWith(`${group}/`));
      const installedGroupExtensions = groupExtensions.filter(key =>
        fs.existsSync(path.join(semoSystemDir, key, "VERSION"))
      );

      if (hasGroupVersion || installedGroupExtensions.length > 0) {
        // 그룹 패키지 버전 추가
        if (hasGroupVersion) {
          const localGroup = fs.readFileSync(groupVersionPath, "utf-8").trim();
          const remoteGroup = await getRemotePackageVersion(group);
          versionInfos.push({
            name: group,
            local: localGroup,
            remote: remoteGroup,
            needsUpdate: remoteGroup ? isVersionLower(localGroup, remoteGroup) : false,
            level: 1,
          });
        }

        // 하위 Extension 패키지들 추가
        for (const key of installedGroupExtensions) {
          const extVersionPath = path.join(semoSystemDir, key, "VERSION");
          const localExt = fs.readFileSync(extVersionPath, "utf-8").trim();
          const remoteExt = await getRemotePackageVersion(key);
          versionInfos.push({
            name: key,
            local: localExt,
            remote: remoteExt,
            needsUpdate: remoteExt ? isVersionLower(localExt, remoteExt) : false,
            level: 2,
            group: group,
          });
        }
      }
    }

    // 그룹에 속하지 않는 Extension (meta 등)
    const nonGroupExtensions = Object.keys(EXTENSION_PACKAGES).filter(key =>
      !PACKAGE_GROUPS.some(g => key.startsWith(`${g}/`))
    );

    for (const key of nonGroupExtensions) {
      const extVersionPath = path.join(semoSystemDir, key, "VERSION");
      if (fs.existsSync(extVersionPath)) {
        const localExt = fs.readFileSync(extVersionPath, "utf-8").trim();
        const remoteExt = await getRemotePackageVersion(key);
        versionInfos.push({
          name: key,
          local: localExt,
          remote: remoteExt,
          needsUpdate: remoteExt ? isVersionLower(localExt, remoteExt) : false,
          level: 1,
        });
      }
    }
  }

  // 5. packages/ 디렉토리의 설치된 패키지들 - 개발 환경용
  const packagesDir = path.join(cwd, "packages");
  if (fs.existsSync(packagesDir)) {
    const packageGroups: Record<string, { level: number; packages: Array<{ name: string; path: string }> }> = {
      "packages/core": { level: 0, packages: [{ name: "packages/core", path: "core" }] },
      "packages/meta": { level: 0, packages: [{ name: "packages/meta", path: "meta" }] },
      "packages/eng": {
        level: 1,
        packages: [
          { name: "packages/eng/nextjs", path: "eng/nextjs" },
          { name: "packages/eng/spring", path: "eng/spring" },
          { name: "packages/eng/ms", path: "eng/ms" },
          { name: "packages/eng/infra", path: "eng/infra" },
        ],
      },
      "packages/biz": {
        level: 1,
        packages: [
          { name: "packages/biz/discovery", path: "biz/discovery" },
          { name: "packages/biz/management", path: "biz/management" },
          { name: "packages/biz/design", path: "biz/design" },
          { name: "packages/biz/poc", path: "biz/poc" },
        ],
      },
      "packages/ops": {
        level: 1,
        packages: [
          { name: "packages/ops/qa", path: "ops/qa" },
          { name: "packages/ops/monitor", path: "ops/monitor" },
          { name: "packages/ops/improve", path: "ops/improve" },
        ],
      },
    };

    for (const [, groupData] of Object.entries(packageGroups)) {
      for (const pkg of groupData.packages) {
        const pkgVersionPath = path.join(packagesDir, pkg.path, "VERSION");
        if (fs.existsSync(pkgVersionPath)) {
          const localPkg = fs.readFileSync(pkgVersionPath, "utf-8").trim();
          const remotePkg = await getRemotePackageVersion(`packages/${pkg.path}`);
          const isSubPackage = pkg.path.includes("/");

          versionInfos.push({
            name: pkg.name,
            local: localPkg,
            remote: remotePkg,
            needsUpdate: remotePkg ? isVersionLower(localPkg, remotePkg) : false,
            level: isSubPackage ? 2 : groupData.level,
            group: isSubPackage ? pkg.path.split("/")[0] : undefined,
          });
        }
      }
    }
  }

  // 결과 출력
  const needsUpdateCount = versionInfos.filter(v => v.needsUpdate).length;

  if (versionInfos.length === 1) {
    // CLI만 있는 경우 (SEMO 미설치)
    const cli = versionInfos[0];
    console.log(chalk.white(`  semo-cli: ${chalk.green.bold(cli.local)}`));
    if (cli.remote) {
      console.log(chalk.gray(`            (최신: ${cli.remote})`));
    }
    if (cli.needsUpdate) {
      console.log();
      console.log(chalk.yellow.bold("  ⚠️  CLI 업데이트 가능"));
      console.log(chalk.cyan(`    npm install -g ${PACKAGE_NAME}@latest`));
    } else {
      console.log();
      console.log(chalk.green("  ✓ 최신 버전"));
    }
  } else {
    // 테이블 형식으로 출력
    console.log(chalk.gray("  ┌────────────────────────┬──────────┬──────────┬────────┐"));
    console.log(chalk.gray("  │ 패키지                 │ 설치됨   │ 최신     │ 상태   │"));
    console.log(chalk.gray("  ├────────────────────────┼──────────┼──────────┼────────┤"));

    for (const info of versionInfos) {
      // 계층 구조 표시를 위한 접두사
      let prefix = "";
      let displayName = info.name;

      if (info.level === 1) {
        // 그룹 패키지 (eng, biz, ops)
        prefix = "📦 ";
      } else if (info.level === 2) {
        // 하위 패키지
        prefix = "  └─ ";
        // 그룹명 제거하고 하위 이름만 표시
        displayName = info.name.includes("/") ? info.name.split("/").pop() || info.name : info.name;
      }

      const name = (prefix + displayName).padEnd(22);
      const local = (info.local || "-").padEnd(8);
      const remote = (info.remote || "-").padEnd(8);
      const status = info.needsUpdate ? "⬆ 업데이트" : "✓ 최신  ";
      const statusColor = info.needsUpdate ? chalk.yellow : chalk.green;

      console.log(
        chalk.gray("  │ ") +
          chalk.white(name) +
          chalk.gray(" │ ") +
          chalk.green(local) +
          chalk.gray(" │ ") +
          chalk.blue(remote) +
          chalk.gray(" │ ") +
          statusColor(status) +
          chalk.gray(" │")
      );
    }

    console.log(chalk.gray("  └────────────────────────┴──────────┴──────────┴────────┘"));

    // CLI와 다른 패키지 업데이트 가이드 분리
    const cliNeedsUpdate = versionInfos[0]?.needsUpdate;
    const otherNeedsUpdateCount = versionInfos.slice(1).filter((v) => v.needsUpdate).length;

    if (cliNeedsUpdate || otherNeedsUpdateCount > 0) {
      console.log();
      if (cliNeedsUpdate) {
        console.log(chalk.yellow.bold("  ⚠️  CLI 업데이트 가능"));
        console.log(chalk.cyan(`    npm install -g ${PACKAGE_NAME}@latest`));
      }
      if (otherNeedsUpdateCount > 0) {
        if (cliNeedsUpdate) console.log();
        console.log(chalk.yellow.bold(`  ⚠️  ${otherNeedsUpdateCount}개 패키지 업데이트 가능`));
        console.log(chalk.gray("    semo update 명령으로 업데이트하세요."));
      }
    } else {
      console.log();
      console.log(chalk.green("  ✓ 모든 패키지가 최신 버전입니다."));
    }
  }

  console.log();
}

// === 유틸리티 함수들 ===

async function confirmOverwrite(itemName: string, itemPath: string): Promise<boolean> {
  if (!fs.existsSync(itemPath)) {
    return true;
  }

  const { shouldOverwrite } = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldOverwrite",
      message: chalk.yellow(`${itemName} 이미 존재합니다. SEMO 기준으로 덮어쓰시겠습니까?`),
      default: true,
    },
  ]);

  return shouldOverwrite;
}

function detectProjectType(cwd: string): string[] {
  const detected: string[] = [];

  for (const [key, pkg] of Object.entries(EXTENSION_PACKAGES)) {
    for (const file of pkg.detect) {
      if (fs.existsSync(path.join(cwd, file))) {
        detected.push(key);
        break;
      }
    }
  }

  return detected;
}

// === 설치된 Extension 패키지 스캔 ===
function getInstalledExtensions(cwd: string): string[] {
  const semoSystemDir = path.join(cwd, "semo-system");
  const installed: string[] = [];

  for (const key of Object.keys(EXTENSION_PACKAGES)) {
    const pkgPath = path.join(semoSystemDir, key);
    if (fs.existsSync(pkgPath)) {
      installed.push(key);
    }
  }

  return installed;
}

// === 필수 도구 확인 ===
interface ToolCheckResult {
  name: string;
  installed: boolean;
  version?: string;
  installCmd: string;
  description: string;
  windowsAltCmds?: string[];
}

function checkRequiredTools(): ToolCheckResult[] {
  const tools: ToolCheckResult[] = [
    {
      name: "GitHub CLI (gh)",
      installed: false,
      installCmd: isWindows ? "winget install GitHub.cli" : "brew install gh",
      description: "GitHub API 연동 (이슈, PR, 배포)",
    },
    {
      name: "Supabase CLI",
      installed: false,
      installCmd: isWindows ? "winget install Supabase.CLI" : "brew install supabase/tap/supabase",
      description: "Supabase 데이터베이스 연동",
      windowsAltCmds: isWindows ? [
        "scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase",
        "choco install supabase"
      ] : undefined,
    },
  ];

  // GitHub CLI 확인
  try {
    const ghVersion = execSync("gh --version", { stdio: "pipe", encoding: "utf-8" });
    tools[0].installed = true;
    tools[0].version = ghVersion.split("\n")[0].replace("gh version ", "").trim();
  } catch {
    // gh not installed
  }

  // Supabase CLI 확인
  try {
    const supabaseVersion = execSync("supabase --version", { stdio: "pipe", encoding: "utf-8" });
    tools[1].installed = true;
    tools[1].version = supabaseVersion.trim();
  } catch {
    // supabase not installed
  }

  return tools;
}

async function showToolsStatus(): Promise<boolean> {
  console.log(chalk.cyan("\n🔍 필수 도구 확인"));

  const tools = checkRequiredTools();
  const missingTools = tools.filter(t => !t.installed);

  for (const tool of tools) {
    if (tool.installed) {
      console.log(chalk.green(`  ✓ ${tool.name} ${tool.version ? `(${tool.version})` : ""}`));
    } else {
      console.log(chalk.yellow(`  ✗ ${tool.name} - 미설치`));
      console.log(chalk.gray(`      ${tool.description}`));
    }
  }

  if (missingTools.length > 0) {
    console.log(chalk.yellow("\n⚠ 일부 도구가 설치되어 있지 않습니다."));
    console.log(chalk.gray("  SEMO의 일부 기능이 제한될 수 있습니다.\n"));

    console.log(chalk.cyan("📋 설치 명령어:"));
    for (const tool of missingTools) {
      console.log(chalk.white(`   ${tool.installCmd}`));
      if (tool.windowsAltCmds && tool.windowsAltCmds.length > 0) {
        console.log(chalk.gray("   (대체 방법)"));
        for (const altCmd of tool.windowsAltCmds) {
          console.log(chalk.gray(`   ${altCmd}`));
        }
      }
    }
    console.log();

    const { continueWithout } = await inquirer.prompt([
      {
        type: "confirm",
        name: "continueWithout",
        message: "도구 없이 계속 설치를 진행할까요?",
        default: true,
      },
    ]);

    return continueWithout;
  }

  return true;
}

// === init 명령어 ===
program
  .command("init")
  .description("현재 프로젝트에 SEMO를 설치합니다")
  .option("-f, --force", "기존 설정 덮어쓰기")
  .option("--skip-mcp", "MCP 설정 생략")
  .option("--no-gitignore", ".gitignore 수정 생략")
  .option("--with <packages>", "추가 설치할 패키지 (쉼표 구분: next,backend)")
  .option("--migrate", "레거시 환경 강제 마이그레이션")
  .action(async (options) => {
    console.log(chalk.cyan.bold("\n🚀 SEMO 설치 시작\n"));
    console.log(chalk.gray("Gemini 하이브리드 전략: White Box + Black Box\n"));

    // 0. 패키지 데이터 초기화 (DB에서 조회)
    await initPackageData();

    const cwd = process.cwd();

    // 0.1. 버전 비교
    await showVersionComparison(cwd);

    // 0.5. 레거시 환경 감지 및 마이그레이션
    const legacyCheck = detectLegacyEnvironment(cwd);
    if (legacyCheck.hasLegacy || options.migrate) {
      const migrationSuccess = await migrateLegacyEnvironment(cwd);
      if (!migrationSuccess) {
        process.exit(0);
      }
    }

    // 1. 필수 도구 확인
    const shouldContinue = await showToolsStatus();
    if (!shouldContinue) {
      console.log(chalk.yellow("\n설치가 취소되었습니다. 필수 도구 설치 후 다시 시도하세요.\n"));
      process.exit(0);
    }

    // 1.5. Git 레포지토리 확인
    const spinner = ora("Git 레포지토리 확인 중...").start();
    try {
      execSync("git rev-parse --git-dir", { cwd, stdio: "pipe" });
      spinner.succeed("Git 레포지토리 확인됨");
    } catch {
      spinner.fail("Git 레포지토리가 아닙니다. 'git init'을 먼저 실행하세요.");
      process.exit(1);
    }

    // 2. Extension 패키지 처리 (--with 옵션만 지원, 인터랙션 없음)
    let extensionsToInstall: string[] = [];
    const extPkgs = getExtensionPackagesSync();
    const shortnames = getShortnameMappingSync();

    if (options.with) {
      // --with 옵션으로 명시적 패키지 지정 시에만 Extension 설치
      extensionsToInstall = options.with.split(",").map((p: string) => p.trim()).filter((p: string) => p in extPkgs || p in shortnames);
      // 별칭 처리
      extensionsToInstall = extensionsToInstall.map((p: string) => shortnames[p] || p);
    }

    // 프로젝트 유형 감지는 정보 제공용으로만 사용 (자동 설치 안 함)
    const detected = detectProjectType(cwd);
    if (detected.length > 0 && !options.with) {
      console.log(chalk.cyan("\n💡 감지된 프로젝트 유형:"));
      detected.forEach(pkg => {
        const pkgInfo = extPkgs[pkg];
        if (pkgInfo) {
          console.log(chalk.gray(`   - ${pkgInfo.name}: ${pkgInfo.desc}`));
        }
      });
      console.log(chalk.gray(`\n   추가 패키지가 필요하면: semo add ${detected[0].split("/")[1] || detected[0]}`));
    }

    // 3. .claude 디렉토리 생성
    const claudeDir = path.join(cwd, ".claude");
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
      console.log(chalk.green("\n✓ .claude/ 디렉토리 생성됨"));
    }

    // 4. Standard 설치 (semo-core + semo-skills)
    await setupStandard(cwd, options.force);

    // 5. Extensions 다운로드 (심볼릭 링크는 아직)
    if (extensionsToInstall.length > 0) {
      await downloadExtensions(cwd, extensionsToInstall, options.force);
    }

    // 6. MCP 설정 (Extension 설정 병합 포함)
    if (!options.skipMcp) {
      await setupMCP(cwd, extensionsToInstall, options.force);
    }

    // 7. Context Mesh 초기화
    await setupContextMesh(cwd);

    // 8. .gitignore 업데이트
    if (options.gitignore !== false) {
      updateGitignore(cwd);
    }

    // 9. Hooks 설치 (대화 로깅)
    await setupHooks(cwd, false);

    // 10. CLAUDE.md 생성
    await setupClaudeMd(cwd, extensionsToInstall, options.force);

    // 11. Extensions 심볼릭 링크 (agents/skills 병합)
    if (extensionsToInstall.length > 0) {
      await setupExtensionSymlinks(cwd, extensionsToInstall);
    }

    // 12. 설치 검증
    const verificationResult = verifyInstallation(cwd, extensionsToInstall);
    printVerificationResult(verificationResult);

    // 완료 메시지
    if (verificationResult.success) {
      console.log(chalk.green.bold("\n✅ SEMO 설치 완료!\n"));
    } else {
      console.log(chalk.yellow.bold("\n⚠️ SEMO 설치 완료 (일부 문제 발견)\n"));
    }

    console.log(chalk.cyan("설치된 구성:"));
    console.log(chalk.gray("  [Standard]"));
    console.log(chalk.gray("    ✓ semo-core (원칙, 오케스트레이터)"));
    console.log(chalk.gray("    ✓ semo-skills (13개 통합 스킬)"));
    console.log(chalk.gray("    ✓ semo-agents (14개 페르소나 Agent)"));
    console.log(chalk.gray("    ✓ semo-scripts (자동화 스크립트)"));

    if (extensionsToInstall.length > 0) {
      console.log(chalk.gray("  [Extensions]"));
      extensionsToInstall.forEach(pkg => {
        console.log(chalk.gray(`    ✓ ${EXTENSION_PACKAGES[pkg].name}`));
      });
    }

    console.log(chalk.cyan("\n다음 단계:"));
    console.log(chalk.gray("  1. Claude Code에서 프로젝트 열기"));
    console.log(chalk.gray("  2. 자연어로 요청하기 (예: \"댓글 기능 구현해줘\")"));
    console.log(chalk.gray("  3. /SEMO:help로 도움말 확인"));

    if (extensionsToInstall.length === 0) {
      console.log(chalk.gray("\n💡 추가 패키지가 필요하면: semo add <package> (예: semo add next)"));
    }
    console.log();
  });

// === Standard 설치 (semo-core + semo-skills) ===
async function setupStandard(cwd: string, force: boolean) {
  const semoSystemDir = path.join(cwd, "semo-system");

  console.log(chalk.cyan("\n📚 Standard 설치 (White Box)"));
  console.log(chalk.gray("   semo-core: 원칙, 오케스트레이터"));
  console.log(chalk.gray("   semo-skills: 13개 통합 스킬"));
  console.log(chalk.gray("   semo-agents: 14개 페르소나 Agent"));
  console.log(chalk.gray("   semo-scripts: 자동화 스크립트\n"));

  // 기존 디렉토리 확인
  if (fs.existsSync(semoSystemDir) && !force) {
    const shouldOverwrite = await confirmOverwrite("semo-system/", semoSystemDir);
    if (!shouldOverwrite) {
      console.log(chalk.gray("  → semo-system/ 건너뜀"));
      return;
    }
    removeRecursive(semoSystemDir);
    console.log(chalk.green("  ✓ 기존 semo-system/ 삭제됨"));
  }

  const spinner = ora("semo-core, semo-skills, semo-agents, semo-scripts 다운로드 중...").start();

  try {
    const tempDir = path.join(cwd, ".semo-temp");
    removeRecursive(tempDir);
    execSync(`git clone --depth 1 ${SEMO_REPO} "${tempDir}"`, { stdio: "pipe" });

    fs.mkdirSync(semoSystemDir, { recursive: true });

    // Standard 패키지 목록 (semo-system/ 하위에 있는 것들)
    const standardPackages = ["semo-core", "semo-skills", "semo-agents", "semo-scripts"];

    for (const pkg of standardPackages) {
      const srcPath = path.join(tempDir, "semo-system", pkg);
      const destPath = path.join(semoSystemDir, pkg);

      if (fs.existsSync(srcPath)) {
        copyRecursive(srcPath, destPath);
      }
    }

    removeRecursive(tempDir);

    spinner.succeed("Standard 설치 완료");

    // 심볼릭 링크 생성
    await createStandardSymlinks(cwd);

  } catch (error) {
    spinner.fail("Standard 설치 실패");
    console.error(chalk.red(`   ${error}`));
  }
}

// === Standard 심볼릭 링크 ===
async function createStandardSymlinks(cwd: string) {
  const claudeDir = path.join(cwd, ".claude");
  const semoSystemDir = path.join(cwd, "semo-system");

  // agents 디렉토리 생성 및 개별 링크 (Extension 병합 지원)
  const claudeAgentsDir = path.join(claudeDir, "agents");
  const coreAgentsDir = path.join(semoSystemDir, "semo-core", "agents");

  if (fs.existsSync(coreAgentsDir)) {
    // 기존 심볼릭 링크면 삭제 (디렉토리로 변경)
    if (fs.existsSync(claudeAgentsDir) && fs.lstatSync(claudeAgentsDir).isSymbolicLink()) {
      fs.unlinkSync(claudeAgentsDir);
    }
    fs.mkdirSync(claudeAgentsDir, { recursive: true });

    const agents = fs.readdirSync(coreAgentsDir).filter(f =>
      fs.statSync(path.join(coreAgentsDir, f)).isDirectory()
    );
    for (const agent of agents) {
      const agentLink = path.join(claudeAgentsDir, agent);
      const agentTarget = path.join(coreAgentsDir, agent);
      if (!fs.existsSync(agentLink)) {
        createSymlinkOrJunction(agentTarget, agentLink);
      }
    }
    console.log(chalk.green(`  ✓ .claude/agents/ (${agents.length}개 agent 링크됨)`));
  }

  // skills 디렉토리 생성 및 개별 링크 (Extension 병합 지원)
  const claudeSkillsDir = path.join(claudeDir, "skills");
  const coreSkillsDir = path.join(semoSystemDir, "semo-skills");

  if (fs.existsSync(coreSkillsDir)) {
    // 기존 심볼릭 링크면 삭제 (디렉토리로 변경)
    if (fs.existsSync(claudeSkillsDir) && fs.lstatSync(claudeSkillsDir).isSymbolicLink()) {
      removeRecursive(claudeSkillsDir);
    }
    fs.mkdirSync(claudeSkillsDir, { recursive: true });

    const skills = fs.readdirSync(coreSkillsDir).filter(f =>
      fs.statSync(path.join(coreSkillsDir, f)).isDirectory()
    );
    for (const skill of skills) {
      const skillLink = path.join(claudeSkillsDir, skill);
      const skillTarget = path.join(coreSkillsDir, skill);
      if (!fs.existsSync(skillLink)) {
        createSymlinkOrJunction(skillTarget, skillLink);
      }
    }
    console.log(chalk.green(`  ✓ .claude/skills/ (${skills.length}개 skill 링크됨)`));
  }

  // commands 링크
  const commandsDir = path.join(claudeDir, "commands");
  fs.mkdirSync(commandsDir, { recursive: true });

  const semoCommandsLink = path.join(commandsDir, "SEMO");
  const commandsTarget = path.join(semoSystemDir, "semo-core", "commands", "SEMO");

  // 기존 링크가 있으면 삭제 후 재생성 (업데이트 시에도 최신 반영)
  if (fs.existsSync(semoCommandsLink)) {
    if (fs.lstatSync(semoCommandsLink).isSymbolicLink()) {
      fs.unlinkSync(semoCommandsLink);
    } else {
      removeRecursive(semoCommandsLink);
    }
  }

  if (fs.existsSync(commandsTarget)) {
    createSymlinkOrJunction(commandsTarget, semoCommandsLink);
    console.log(chalk.green("  ✓ .claude/commands/SEMO → semo-system/semo-core/commands/SEMO"));
  }
}

// === 설치 검증 ===
interface VerificationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    agents: { expected: number; linked: number; broken: number };
    skills: { expected: number; linked: number; broken: number };
    commands: { exists: boolean; valid: boolean };
    extensions: { name: string; valid: boolean; issues: string[] }[];
  };
}

/**
 * 설치 상태를 검증하고 문제점을 리포트
 */
function verifyInstallation(cwd: string, installedExtensions: string[] = []): VerificationResult {
  const claudeDir = path.join(cwd, ".claude");
  const semoSystemDir = path.join(cwd, "semo-system");

  const result: VerificationResult = {
    success: true,
    errors: [],
    warnings: [],
    stats: {
      agents: { expected: 0, linked: 0, broken: 0 },
      skills: { expected: 0, linked: 0, broken: 0 },
      commands: { exists: false, valid: false },
      extensions: [],
    },
  };

  // 1. semo-system 기본 구조 검증
  if (!fs.existsSync(semoSystemDir)) {
    result.errors.push("semo-system 디렉토리가 없습니다");
    result.success = false;
    return result;
  }

  const coreDir = path.join(semoSystemDir, "semo-core");
  const skillsDir = path.join(semoSystemDir, "semo-skills");

  if (!fs.existsSync(coreDir)) {
    result.errors.push("semo-core가 설치되지 않았습니다");
    result.success = false;
  }
  if (!fs.existsSync(skillsDir)) {
    result.errors.push("semo-skills가 설치되지 않았습니다");
    result.success = false;
  }

  // 2. agents 링크 검증 (isSymlinkValid 사용)
  const claudeAgentsDir = path.join(claudeDir, "agents");
  const coreAgentsDir = path.join(coreDir, "agents");

  if (fs.existsSync(coreAgentsDir)) {
    const expectedAgents = fs.readdirSync(coreAgentsDir).filter(f =>
      fs.statSync(path.join(coreAgentsDir, f)).isDirectory()
    );
    result.stats.agents.expected = expectedAgents.length;

    if (fs.existsSync(claudeAgentsDir)) {
      for (const agent of expectedAgents) {
        const linkPath = path.join(claudeAgentsDir, agent);
        if (fs.existsSync(linkPath) || fs.lstatSync(linkPath).isSymbolicLink()) {
          if (isSymlinkValid(linkPath)) {
            result.stats.agents.linked++;
          } else {
            result.stats.agents.broken++;
            result.warnings.push(`깨진 링크: .claude/agents/${agent}`);
          }
        }
      }
    }
  }

  // 3. skills 링크 검증 (isSymlinkValid 사용)
  if (fs.existsSync(skillsDir)) {
    const expectedSkills = fs.readdirSync(skillsDir).filter(f =>
      fs.statSync(path.join(skillsDir, f)).isDirectory()
    );
    result.stats.skills.expected = expectedSkills.length;

    const claudeSkillsDir = path.join(claudeDir, "skills");
    if (fs.existsSync(claudeSkillsDir)) {
      for (const skill of expectedSkills) {
        const linkPath = path.join(claudeSkillsDir, skill);
        try {
          if (fs.existsSync(linkPath) || fs.lstatSync(linkPath).isSymbolicLink()) {
            if (isSymlinkValid(linkPath)) {
              result.stats.skills.linked++;
            } else {
              result.stats.skills.broken++;
              result.warnings.push(`깨진 링크: .claude/skills/${skill}`);
            }
          }
        } catch {
          // 링크가 존재하지 않음
        }
      }
    }
  }

  // 4. commands 검증 (isSymlinkValid 사용)
  const semoCommandsLink = path.join(claudeDir, "commands", "SEMO");
  try {
    const linkExists = fs.existsSync(semoCommandsLink) || fs.lstatSync(semoCommandsLink).isSymbolicLink();
    result.stats.commands.exists = linkExists;
    if (linkExists) {
      result.stats.commands.valid = isSymlinkValid(semoCommandsLink);
      if (!result.stats.commands.valid) {
        result.warnings.push("깨진 링크: .claude/commands/SEMO");
      }
    }
  } catch {
    result.stats.commands.exists = false;
    result.stats.commands.valid = false;
  }

  // 5. Extensions 검증
  for (const ext of installedExtensions) {
    const extDir = path.join(semoSystemDir, ext);
    const extResult = { name: ext, valid: true, issues: [] as string[] };

    if (!fs.existsSync(extDir)) {
      extResult.valid = false;
      extResult.issues.push("디렉토리 없음");
    } else {
      // Extension agents 검증
      const extAgentsDir = path.join(extDir, "agents");
      if (fs.existsSync(extAgentsDir)) {
        const extAgents = fs.readdirSync(extAgentsDir).filter(f =>
          fs.statSync(path.join(extAgentsDir, f)).isDirectory()
        );
        for (const agent of extAgents) {
          const linkPath = path.join(claudeAgentsDir, agent);
          if (!fs.existsSync(linkPath)) {
            extResult.issues.push(`agent 링크 누락: ${agent}`);
          }
        }
      }

      // Extension skills 검증
      const extSkillsDir = path.join(extDir, "skills");
      if (fs.existsSync(extSkillsDir)) {
        const extSkills = fs.readdirSync(extSkillsDir).filter(f =>
          fs.statSync(path.join(extSkillsDir, f)).isDirectory()
        );
        const claudeSkillsDir = path.join(claudeDir, "skills");
        for (const skill of extSkills) {
          const linkPath = path.join(claudeSkillsDir, skill);
          if (!fs.existsSync(linkPath)) {
            extResult.issues.push(`skill 링크 누락: ${skill}`);
          }
        }
      }
    }

    if (extResult.issues.length > 0) {
      extResult.valid = false;
    }
    result.stats.extensions.push(extResult);
  }

  // 6. 최종 성공 여부 판단
  if (result.stats.agents.expected > 0 && result.stats.agents.linked === 0) {
    result.errors.push("agents가 하나도 링크되지 않았습니다");
    result.success = false;
  }
  if (result.stats.skills.expected > 0 && result.stats.skills.linked === 0) {
    result.errors.push("skills가 하나도 링크되지 않았습니다");
    result.success = false;
  }
  if (!result.stats.commands.exists) {
    result.errors.push("commands/SEMO가 설치되지 않았습니다");
    result.success = false;
  }

  // 부분 누락 경고
  if (result.stats.agents.linked < result.stats.agents.expected) {
    const missing = result.stats.agents.expected - result.stats.agents.linked;
    result.warnings.push(`${missing}개 agent 링크 누락`);
  }
  if (result.stats.skills.linked < result.stats.skills.expected) {
    const missing = result.stats.skills.expected - result.stats.skills.linked;
    result.warnings.push(`${missing}개 skill 링크 누락`);
  }

  return result;
}

/**
 * 검증 결과를 콘솔에 출력
 */
function printVerificationResult(result: VerificationResult) {
  console.log(chalk.cyan("\n🔍 설치 검증"));

  // Stats
  const agentStatus = result.stats.agents.linked === result.stats.agents.expected
    ? chalk.green("✓")
    : (result.stats.agents.linked > 0 ? chalk.yellow("△") : chalk.red("✗"));
  const skillStatus = result.stats.skills.linked === result.stats.skills.expected
    ? chalk.green("✓")
    : (result.stats.skills.linked > 0 ? chalk.yellow("△") : chalk.red("✗"));
  const cmdStatus = result.stats.commands.valid ? chalk.green("✓") : chalk.red("✗");

  console.log(`  ${agentStatus} agents: ${result.stats.agents.linked}/${result.stats.agents.expected}` +
    (result.stats.agents.broken > 0 ? chalk.red(` (깨진 링크: ${result.stats.agents.broken})`) : ""));
  console.log(`  ${skillStatus} skills: ${result.stats.skills.linked}/${result.stats.skills.expected}` +
    (result.stats.skills.broken > 0 ? chalk.red(` (깨진 링크: ${result.stats.skills.broken})`) : ""));
  console.log(`  ${cmdStatus} commands/SEMO`);

  // Extensions
  for (const ext of result.stats.extensions) {
    const extStatus = ext.valid ? chalk.green("✓") : chalk.yellow("△");
    console.log(`  ${extStatus} ${ext.name}` +
      (ext.issues.length > 0 ? chalk.gray(` (${ext.issues.length}개 이슈)`) : ""));
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log(chalk.yellow("\n  ⚠️  경고:"));
    result.warnings.forEach(w => console.log(chalk.yellow(`     - ${w}`)));
  }

  // Errors
  if (result.errors.length > 0) {
    console.log(chalk.red("\n  ❌ 오류:"));
    result.errors.forEach(e => console.log(chalk.red(`     - ${e}`)));
  }

  // Final status
  if (result.success && result.warnings.length === 0) {
    console.log(chalk.green.bold("\n  ✅ 설치 검증 완료 - 모든 항목 정상"));
  } else if (result.success) {
    console.log(chalk.yellow.bold("\n  ⚠️  설치 완료 - 일부 경고 확인 필요"));
  } else {
    console.log(chalk.red.bold("\n  ❌ 설치 검증 실패 - 오류 확인 필요"));
    console.log(chalk.gray("     'semo init --force'로 재설치하거나 수동으로 문제를 해결하세요."));
  }
}

// === Extensions 다운로드 (심볼릭 링크 제외) ===
async function downloadExtensions(cwd: string, packages: string[], force: boolean) {
  console.log(chalk.cyan("\n📦 Extensions 다운로드"));
  packages.forEach(pkg => {
    console.log(chalk.gray(`   - ${EXTENSION_PACKAGES[pkg].name}`));
  });
  console.log();

  const spinner = ora("Extension 패키지 다운로드 중...").start();

  try {
    const tempDir = path.join(cwd, ".semo-temp");

    // 이미 temp가 없으면 clone
    if (!fs.existsSync(tempDir)) {
      execSync(`git clone --depth 1 ${SEMO_REPO} "${tempDir}"`, { stdio: "pipe" });
    }

    const semoSystemDir = path.join(cwd, "semo-system");

    // 그룹 추출 (중복 제거) - 그룹 레벨 CLAUDE.md 복사용
    const groups = [...new Set(
      packages.map(pkg => pkg.split("/")[0]).filter(g => ["biz", "eng", "ops"].includes(g))
    )];

    // 그룹 레벨 파일 복사 (CLAUDE.md, VERSION 등)
    for (const group of groups) {
      const groupSrcDir = path.join(tempDir, "packages", group);
      const groupDestDir = path.join(semoSystemDir, group);

      // 그룹 디렉토리의 루트 파일만 복사 (CLAUDE.md, VERSION)
      if (fs.existsSync(groupSrcDir)) {
        fs.mkdirSync(groupDestDir, { recursive: true });
        const groupFiles = fs.readdirSync(groupSrcDir);
        for (const file of groupFiles) {
          const srcFile = path.join(groupSrcDir, file);
          const destFile = path.join(groupDestDir, file);
          if (fs.statSync(srcFile).isFile()) {
            fs.copyFileSync(srcFile, destFile);
          }
        }
        console.log(chalk.green(`  ✓ ${group}/ 그룹 파일 복사 (CLAUDE.md 등)`));
      }
    }

    // 개별 패키지 복사
    for (const pkg of packages) {
      const srcPath = path.join(tempDir, "packages", pkg);
      const destPath = path.join(semoSystemDir, pkg);

      if (fs.existsSync(srcPath)) {
        if (fs.existsSync(destPath) && !force) {
          console.log(chalk.yellow(`  ⚠ ${pkg}/ 이미 존재 (건너뜀)`));
          continue;
        }
        removeRecursive(destPath);
        // 상위 디렉토리 생성 (biz/discovery -> biz/ 먼저 생성)
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        copyRecursive(srcPath, destPath);
      }
    }

    removeRecursive(tempDir);

    spinner.succeed(`Extensions 다운로드 완료 (${packages.length}개)`);

  } catch (error) {
    spinner.fail("Extensions 다운로드 실패");
    console.error(chalk.red(`   ${error}`));
  }
}

// === Orchestrator 병합 파일 생성 ===
function createMergedOrchestrator(
  claudeAgentsDir: string,
  orchestratorSources: Array<{ pkg: string; path: string }>
): void {
  const orchestratorDir = path.join(claudeAgentsDir, "orchestrator");
  fs.mkdirSync(orchestratorDir, { recursive: true });

  // _packages 디렉토리 생성 (원본 참조용)
  const packagesDir = path.join(orchestratorDir, "_packages");
  fs.mkdirSync(packagesDir, { recursive: true });

  // 각 패키지의 orchestrator 내용 수집
  const routingTables: string[] = [];
  const availableAgents: string[] = [];
  const availableSkills: string[] = [];
  const crossPackageRouting: string[] = [];

  for (const source of orchestratorSources) {
    const orchestratorMdPath = path.join(source.path, "orchestrator.md");
    if (!fs.existsSync(orchestratorMdPath)) continue;

    const content = fs.readFileSync(orchestratorMdPath, "utf-8");
    const pkgShortName = source.pkg.replace(/\//g, "-");

    // 원본 파일 복사 (참조용)
    fs.writeFileSync(path.join(packagesDir, `${pkgShortName}.md`), content);

    // Quick Routing Table 추출
    const routingMatch = content.match(/## 🔴 Quick Routing Table[\s\S]*?\n\n([\s\S]*?)(?=\n## |$)/);
    if (routingMatch) {
      routingTables.push(`### ${EXTENSION_PACKAGES[source.pkg]?.name || source.pkg}\n\n${routingMatch[1].trim()}`);
    }

    // Available Agents 추출
    const agentsMatch = content.match(/## Available Agents[\s\S]*?\n\n([\s\S]*?)(?=\n## |$)/);
    if (agentsMatch) {
      availableAgents.push(`### ${EXTENSION_PACKAGES[source.pkg]?.name || source.pkg}\n\n${agentsMatch[1].trim()}`);
    }

    // Available Skills 추출
    const skillsMatch = content.match(/## Available Skills[\s\S]*?\n\n([\s\S]*?)(?=\n## |$)/);
    if (skillsMatch) {
      availableSkills.push(`### ${EXTENSION_PACKAGES[source.pkg]?.name || source.pkg}\n\n${skillsMatch[1].trim()}`);
    }

    // Cross-Package Routing 추출
    const crossMatch = content.match(/## 🔄 Cross-Package Routing[\s\S]*?\n\n([\s\S]*?)(?=\n## |$)/);
    if (crossMatch) {
      crossPackageRouting.push(crossMatch[1].trim());
    }

    // references 폴더가 있으면 복사
    const refsDir = path.join(source.path, "references");
    if (fs.existsSync(refsDir)) {
      const mergedRefsDir = path.join(orchestratorDir, "references");
      fs.mkdirSync(mergedRefsDir, { recursive: true });
      const refs = fs.readdirSync(refsDir);
      for (const ref of refs) {
        const srcRef = path.join(refsDir, ref);
        const destRef = path.join(mergedRefsDir, `${pkgShortName}-${ref}`);
        if (fs.statSync(srcRef).isFile()) {
          fs.copyFileSync(srcRef, destRef);
        }
      }
    }
  }

  // 병합된 orchestrator.md 생성
  const mergedContent = `---
name: orchestrator
description: |
  SEMO Merged Orchestrator - Routes all user requests to appropriate agents/skills.
  This orchestrator combines routing tables from ${orchestratorSources.length} packages.
  PROACTIVELY delegate on ALL requests. Never process directly.
tools:
  - read_file
  - list_dir
  - run_command
  - glob
  - grep
  - task
  - skill
model: inherit
---

# SEMO Merged Orchestrator

> 이 파일은 **자동 생성**되었습니다. 직접 수정하지 마세요.
> 원본 파일: \`_packages/\` 디렉토리 참조

모든 사용자 요청을 분석하고 적절한 Agent 또는 Skill로 라우팅하는 **Primary Router**입니다.

## 🔴 설치된 패키지

${orchestratorSources.map(s => `- **${EXTENSION_PACKAGES[s.pkg]?.name || s.pkg}**: \`semo-system/${s.pkg}\``).join("\n")}

## �� Quick Routing Table (Merged)

> 키워드 매칭 시 **첫 번째 매칭된 패키지**로 라우팅됩니다.

${routingTables.join("\n\n---\n\n")}

## SEMO 메시지 포맷

### Agent 위임

\`\`\`markdown
[SEMO] Orchestrator: 의도 분석 완료 → {intent_category}

[SEMO] Agent 위임: {agent_name} (사유: {reason})
\`\`\`

### Skill 호출

\`\`\`markdown
[SEMO] Orchestrator: 의도 분석 완료 → {intent_category}

[SEMO] Skill 호출: {skill_name}
\`\`\`

### 라우팅 실패

\`\`\`markdown
[SEMO] Orchestrator: 라우팅 실패 → 적절한 Agent/Skill 없음

⚠️ 직접 처리 필요
\`\`\`

## Critical Rules

1. **Routing-Only**: 직접 작업 수행 금지
2. **SEMO 메시지 필수**: 모든 위임에 SEMO 메시지 포함
3. **Package Priority**: 라우팅 충돌 시 설치 순서대로 우선순위 적용
4. **Cross-Package**: 다른 패키지 전문 영역 요청 시 인계 권유

${crossPackageRouting.length > 0 ? `## 🔄 Cross-Package Routing

${crossPackageRouting[0]}` : ""}

${availableAgents.length > 0 ? `## Available Agents (All Packages)

${availableAgents.join("\n\n")}` : ""}

${availableSkills.length > 0 ? `## Available Skills (All Packages)

${availableSkills.join("\n\n")}` : ""}

## References

- 원본 Orchestrator: \`_packages/\` 디렉토리
- 병합된 References: \`references/\` 디렉토리
`;

  fs.writeFileSync(path.join(orchestratorDir, "orchestrator.md"), mergedContent);
}

// === Extensions 심볼릭 링크 설정 (agents/skills 병합) ===
async function setupExtensionSymlinks(cwd: string, packages: string[]) {
  console.log(chalk.cyan("\n🔗 Extensions 연결"));

  const claudeDir = path.join(cwd, ".claude");
  const semoSystemDir = path.join(cwd, "semo-system");

  // .claude/agents, .claude/skills 디렉토리 생성 (없으면)
  const claudeAgentsDir = path.join(claudeDir, "agents");
  const claudeSkillsDir = path.join(claudeDir, "skills");
  fs.mkdirSync(claudeAgentsDir, { recursive: true });
  fs.mkdirSync(claudeSkillsDir, { recursive: true });

  // Orchestrator 소스 수집 (병합용)
  const orchestratorSources: Array<{ pkg: string; path: string }> = [];

  for (const pkg of packages) {
    const pkgPath = path.join(semoSystemDir, pkg);
    if (!fs.existsSync(pkgPath)) continue;

    // 1. Extension의 agents를 .claude/agents/에 개별 링크
    const extAgentsDir = path.join(pkgPath, "agents");
    if (fs.existsSync(extAgentsDir)) {
      const agents = fs.readdirSync(extAgentsDir).filter(f =>
        fs.statSync(path.join(extAgentsDir, f)).isDirectory()
      );
      for (const agent of agents) {
        const agentLink = path.join(claudeAgentsDir, agent);
        const agentTarget = path.join(extAgentsDir, agent);

        // Orchestrator는 특별 처리 (병합 필요)
        if (agent === "orchestrator") {
          orchestratorSources.push({ pkg, path: agentTarget });
          continue; // 심볼릭 링크 생성 안 함
        }

        if (!fs.existsSync(agentLink)) {
          createSymlinkOrJunction(agentTarget, agentLink);
          console.log(chalk.green(`  ✓ .claude/agents/${agent} → semo-system/${pkg}/agents/${agent}`));
        }
      }
    }

    // 2. Extension의 skills를 .claude/skills/에 개별 링크
    const extSkillsDir = path.join(pkgPath, "skills");
    if (fs.existsSync(extSkillsDir)) {
      const skills = fs.readdirSync(extSkillsDir).filter(f =>
        fs.statSync(path.join(extSkillsDir, f)).isDirectory()
      );
      for (const skill of skills) {
        const skillLink = path.join(claudeSkillsDir, skill);
        const skillTarget = path.join(extSkillsDir, skill);
        if (!fs.existsSync(skillLink)) {
          createSymlinkOrJunction(skillTarget, skillLink);
          console.log(chalk.green(`  ✓ .claude/skills/${skill} → semo-system/${pkg}/skills/${skill}`));
        }
      }
    }
  }

  // 3. Orchestrator 병합 처리
  if (orchestratorSources.length > 0) {
    // 기존 orchestrator 링크/디렉토리 제거
    const orchestratorPath = path.join(claudeAgentsDir, "orchestrator");
    if (fs.existsSync(orchestratorPath)) {
      removeRecursive(orchestratorPath);
    }

    if (orchestratorSources.length === 1) {
      // 단일 패키지: 심볼릭 링크
      createSymlinkOrJunction(orchestratorSources[0].path, orchestratorPath);
      console.log(chalk.green(`  ✓ .claude/agents/orchestrator → semo-system/${orchestratorSources[0].pkg}/agents/orchestrator`));
    } else {
      // 다중 패키지: 병합 파일 생성
      createMergedOrchestrator(claudeAgentsDir, orchestratorSources);
      console.log(chalk.green(`  ✓ .claude/agents/orchestrator (${orchestratorSources.length}개 패키지 병합)`));
      for (const source of orchestratorSources) {
        console.log(chalk.gray(`    - semo-system/${source.pkg}/agents/orchestrator`));
      }
    }
  }
}

// === MCP 서버 정의 ===
interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

const BASE_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: "semo-integrations",
    command: "npx",
    args: ["-y", "@team-semicolon/semo-mcp"],
    env: {
      // Slack/GitHub/DB 토큰은 패키지에 암호화 포함됨 (설정 불필요)
      SUPABASE_URL: "${SUPABASE_URL}",
      SUPABASE_KEY: "${SUPABASE_KEY}",
    },
  },
  {
    name: "context7",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
  },
  {
    name: "sequential-thinking",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
  },
  {
    name: "playwright",
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-playwright"],
  },
  {
    name: "github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
  },
];

// === Claude MCP 서버 존재 여부 확인 ===
function isMCPServerRegistered(serverName: string): boolean {
  try {
    const result = execSync("claude mcp list", { stdio: "pipe", encoding: "utf-8" });
    return result.includes(serverName);
  } catch {
    return false;
  }
}

// === Claude MCP 등록 함수 ===
function registerMCPServer(server: MCPServerConfig): { success: boolean; skipped?: boolean; error?: string } {
  try {
    // 이미 등록된 서버인지 확인
    if (isMCPServerRegistered(server.name)) {
      return { success: true, skipped: true };
    }

    // claude mcp add 명령어 구성
    // 형식: claude mcp add <name> [-e KEY=value...] -- <command> [args...]
    const args: string[] = ["mcp", "add", server.name];

    // 환경변수가 있는 경우 -e 옵션 추가
    if (server.env) {
      for (const [key, value] of Object.entries(server.env)) {
        args.push("-e", `${key}=${value}`);
      }
    }

    // -- 구분자 후 명령어와 인자 추가
    args.push("--", server.command, ...server.args);

    execSync(`claude ${args.join(" ")}`, { stdio: "pipe" });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// === MCP 설정 ===
async function setupMCP(cwd: string, extensions: string[], force: boolean) {
  console.log(chalk.cyan("\n🔧 Black Box 설정 (MCP Server)"));
  console.log(chalk.gray("   토큰이 격리된 외부 연동 도구\n"));

  const settingsPath = path.join(cwd, ".claude", "settings.json");

  if (fs.existsSync(settingsPath) && !force) {
    const shouldOverwrite = await confirmOverwrite(".claude/settings.json", settingsPath);
    if (!shouldOverwrite) {
      console.log(chalk.gray("  → settings.json 건너뜀"));
      return;
    }
  }

  // Base settings (Standard)
  const settings: {
    permissions?: { allow?: string[]; deny?: string[] };
    mcpServers: Record<string, unknown>;
  } = {
    mcpServers: {},
  };

  // MCP 서버 목록 수집
  const allServers: MCPServerConfig[] = [...BASE_MCP_SERVERS];

  // Extension settings 병합
  const semoSystemDir = path.join(cwd, "semo-system");
  for (const pkg of extensions) {
    const extSettingsPath = path.join(semoSystemDir, pkg, "settings.local.json");
    if (fs.existsSync(extSettingsPath)) {
      try {
        const extSettings = JSON.parse(fs.readFileSync(extSettingsPath, "utf-8"));

        // mcpServers 병합
        if (extSettings.mcpServers) {
          for (const [name, config] of Object.entries(extSettings.mcpServers)) {
            const serverConfig = config as { command: string; args: string[]; env?: Record<string, string> };
            allServers.push({
              name,
              command: serverConfig.command,
              args: serverConfig.args,
              env: serverConfig.env,
            });
          }
          console.log(chalk.gray(`  + ${pkg} MCP 설정 수집됨`));
        }

        // permissions 병합
        if (extSettings.permissions) {
          if (!settings.permissions) {
            settings.permissions = { allow: [], deny: [] };
          }
          if (extSettings.permissions.allow) {
            settings.permissions.allow = [
              ...(settings.permissions.allow || []),
              ...extSettings.permissions.allow,
            ];
          }
          if (extSettings.permissions.deny) {
            settings.permissions.deny = [
              ...(settings.permissions.deny || []),
              ...extSettings.permissions.deny,
            ];
          }
          console.log(chalk.gray(`  + ${pkg} permissions 병합됨`));
        }
      } catch (error) {
        console.log(chalk.yellow(`  ⚠ ${pkg} settings.local.json 파싱 실패`));
      }
    }
  }

  // settings.json에 mcpServers 저장 (백업용)
  for (const server of allServers) {
    const serverConfig: Record<string, unknown> = {
      command: server.command,
      args: server.args,
    };
    if (server.env) {
      serverConfig.env = server.env;
    }
    settings.mcpServers[server.name] = serverConfig;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log(chalk.green("✓ .claude/settings.json 생성됨 (MCP 설정 백업)"));

  // Claude Code에 MCP 서버 등록 시도
  console.log(chalk.cyan("\n🔌 Claude Code에 MCP 서버 등록 중..."));

  const successServers: string[] = [];
  const skippedServers: string[] = [];
  const failedServers: MCPServerConfig[] = [];

  for (const server of allServers) {
    const spinner = ora(`  ${server.name} 등록 중...`).start();
    const result = registerMCPServer(server);

    if (result.success) {
      if (result.skipped) {
        spinner.info(`  ${server.name} 이미 등록됨 (건너뜀)`);
        skippedServers.push(server.name);
      } else {
        spinner.succeed(`  ${server.name} 등록 완료`);
        successServers.push(server.name);
      }
    } else {
      spinner.fail(`  ${server.name} 등록 실패`);
      failedServers.push(server);
    }
  }

  // 결과 요약
  if (successServers.length > 0) {
    console.log(chalk.green(`\n✓ ${successServers.length}개 MCP 서버 새로 등록 완료`));
  }
  if (skippedServers.length > 0) {
    console.log(chalk.gray(`  (${skippedServers.length}개 이미 등록됨)`));
  }

  // 실패한 서버가 있으면 수동 등록 안내
  if (failedServers.length > 0) {
    console.log(chalk.yellow(`\n⚠ ${failedServers.length}개 MCP 서버 자동 등록 실패`));
    console.log(chalk.cyan("\n📋 수동 등록 명령어:"));
    console.log(chalk.gray("   다음 명령어를 터미널에서 실행하세요:\n"));

    for (const server of failedServers) {
      const envArgs = server.env
        ? Object.entries(server.env).map(([k, v]) => `-e ${k}="${v}"`).join(" ")
        : "";
      const cmd = `claude mcp add ${server.name} ${envArgs} -- ${server.command} ${server.args.join(" ")}`.trim();
      console.log(chalk.white(`   ${cmd}`));
    }
    console.log();
  }
}

// === Extension settings 병합 (add 명령어용) ===
async function mergeExtensionSettings(cwd: string, packages: string[]) {
  const settingsPath = path.join(cwd, ".claude", "settings.json");
  const semoSystemDir = path.join(cwd, "semo-system");

  if (!fs.existsSync(settingsPath)) {
    console.log(chalk.yellow("  ⚠ settings.json이 없습니다. 'semo init'을 먼저 실행하세요."));
    return;
  }

  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  const newServers: MCPServerConfig[] = [];

  for (const pkg of packages) {
    const extSettingsPath = path.join(semoSystemDir, pkg, "settings.local.json");
    if (fs.existsSync(extSettingsPath)) {
      try {
        const extSettings = JSON.parse(fs.readFileSync(extSettingsPath, "utf-8"));

        // mcpServers 병합
        if (extSettings.mcpServers) {
          settings.mcpServers = settings.mcpServers || {};
          for (const [name, config] of Object.entries(extSettings.mcpServers)) {
            const serverConfig = config as { command: string; args: string[]; env?: Record<string, string> };
            settings.mcpServers[name] = serverConfig;
            newServers.push({
              name,
              command: serverConfig.command,
              args: serverConfig.args,
              env: serverConfig.env,
            });
          }
          console.log(chalk.gray(`  + ${pkg} MCP 설정 병합됨`));
        }

        // permissions 병합
        if (extSettings.permissions) {
          settings.permissions = settings.permissions || { allow: [], deny: [] };
          if (extSettings.permissions.allow) {
            settings.permissions.allow = [
              ...(settings.permissions.allow || []),
              ...extSettings.permissions.allow,
            ];
          }
          if (extSettings.permissions.deny) {
            settings.permissions.deny = [
              ...(settings.permissions.deny || []),
              ...extSettings.permissions.deny,
            ];
          }
          console.log(chalk.gray(`  + ${pkg} permissions 병합됨`));
        }
      } catch (error) {
        console.log(chalk.yellow(`  ⚠ ${pkg} settings.local.json 파싱 실패`));
      }
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  // 새 MCP 서버 Claude Code에 등록
  if (newServers.length > 0) {
    console.log(chalk.cyan("\n🔌 Claude Code에 MCP 서버 등록 중..."));

    const successServers: string[] = [];
    const skippedServers: string[] = [];
    const failedServers: MCPServerConfig[] = [];

    for (const server of newServers) {
      const spinner = ora(`  ${server.name} 등록 중...`).start();
      const result = registerMCPServer(server);

      if (result.success) {
        if (result.skipped) {
          spinner.info(`  ${server.name} 이미 등록됨 (건너뜀)`);
          skippedServers.push(server.name);
        } else {
          spinner.succeed(`  ${server.name} 등록 완료`);
          successServers.push(server.name);
        }
      } else {
        spinner.fail(`  ${server.name} 등록 실패`);
        failedServers.push(server);
      }
    }

    if (successServers.length > 0) {
      console.log(chalk.green(`\n✓ ${successServers.length}개 MCP 서버 새로 등록 완료`));
    }
    if (skippedServers.length > 0) {
      console.log(chalk.gray(`  (${skippedServers.length}개 이미 등록됨)`));
    }

    if (failedServers.length > 0) {
      console.log(chalk.yellow(`\n⚠ ${failedServers.length}개 MCP 서버 자동 등록 실패`));
      console.log(chalk.cyan("\n📋 수동 등록 명령어:"));
      for (const server of failedServers) {
        const envArgs = server.env
          ? Object.entries(server.env).map(([k, v]) => `-e ${k}="${v}"`).join(" ")
          : "";
        const cmd = `claude mcp add ${server.name} ${envArgs} -- ${server.command} ${server.args.join(" ")}`.trim();
        console.log(chalk.white(`   ${cmd}`));
      }
      console.log();
    }
  }
}

// === .gitignore 업데이트 ===
function updateGitignore(cwd: string) {
  console.log(chalk.cyan("\n📝 .gitignore 업데이트"));

  const gitignorePath = path.join(cwd, ".gitignore");

  const semoIgnoreBlock = `
# === SEMO ===
.claude/*
!.claude/memory/
!.claude/memory/**
semo-system/
`;

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");

    // 이미 SEMO 블록이 있으면 스킵
    if (content.includes("# === SEMO ===")) {
      console.log(chalk.gray("  → SEMO 블록 이미 존재 (건너뜀)"));
      return;
    }

    // 기존 파일에 추가
    fs.appendFileSync(gitignorePath, semoIgnoreBlock);
    console.log(chalk.green("✓ .gitignore에 SEMO 규칙 추가됨"));
  } else {
    // 새로 생성
    fs.writeFileSync(gitignorePath, semoIgnoreBlock.trim() + "\n");
    console.log(chalk.green("✓ .gitignore 생성됨 (SEMO 규칙 포함)"));
  }
}

// === Hooks 설치/업데이트 ===
async function setupHooks(cwd: string, isUpdate: boolean = false) {
  const action = isUpdate ? "업데이트" : "설치";
  console.log(chalk.cyan(`\n🪝 Claude Code Hooks ${action}`));
  console.log(chalk.gray("   전체 대화 로깅 시스템\n"));

  const hooksDir = path.join(cwd, "semo-system", "semo-hooks");

  // semo-hooks 디렉토리 확인
  if (!fs.existsSync(hooksDir)) {
    console.log(chalk.yellow("  ⚠ semo-hooks 디렉토리 없음 (건너뜀)"));
    return;
  }

  // 1. npm install
  console.log(chalk.gray("  → 의존성 설치 중..."));
  try {
    execSync("npm install", {
      cwd: hooksDir,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    console.log(chalk.yellow("  ⚠ npm install 실패 (건너뜀)"));
    return;
  }

  // 2. 빌드
  console.log(chalk.gray("  → 빌드 중..."));
  try {
    execSync("npm run build", {
      cwd: hooksDir,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    console.log(chalk.yellow("  ⚠ 빌드 실패 (건너뜀)"));
    return;
  }

  // 3. settings.local.json 설정
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const settingsPath = path.join(homeDir, ".claude", "settings.local.json");
  const hooksCmd = `node ${path.join(hooksDir, "dist", "index.js")}`;

  // hooks 설정 객체
  const hooksConfig = {
    SessionStart: [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: `${hooksCmd} session-start`,
            timeout: 10,
          },
        ],
      },
    ],
    UserPromptSubmit: [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: `${hooksCmd} user-prompt`,
            timeout: 5,
          },
        ],
      },
    ],
    Stop: [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: `${hooksCmd} stop`,
            timeout: 10,
          },
        ],
      },
    ],
    SessionEnd: [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: `${hooksCmd} session-end`,
            timeout: 10,
          },
        ],
      },
    ],
  };

  // 기존 설정 로드 또는 새로 생성
  let existingSettings: Record<string, unknown> = {};
  const claudeConfigDir = path.join(homeDir, ".claude");

  if (!fs.existsSync(claudeConfigDir)) {
    fs.mkdirSync(claudeConfigDir, { recursive: true });
  }

  if (fs.existsSync(settingsPath)) {
    try {
      existingSettings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    } catch {
      existingSettings = {};
    }
  }

  // hooks 설정 병합
  existingSettings.hooks = hooksConfig;

  // 설정 저장
  fs.writeFileSync(settingsPath, JSON.stringify(existingSettings, null, 2));

  console.log(chalk.green(`  ✓ Hooks ${action} 완료`));
  console.log(chalk.gray(`    설정: ${settingsPath}`));
}

// === Context Mesh 초기화 ===
async function setupContextMesh(cwd: string) {
  console.log(chalk.cyan("\n🧠 Context Mesh 초기화"));
  console.log(chalk.gray("   세션 간 컨텍스트 영속화\n"));

  const memoryDir = path.join(cwd, ".claude", "memory");
  fs.mkdirSync(memoryDir, { recursive: true });

  // context.md
  const contextPath = path.join(memoryDir, "context.md");
  if (!fs.existsSync(contextPath)) {
    const contextContent = `# Project Context

> 세션 간 영속화되는 프로젝트 컨텍스트
> SEMO의 memory 스킬이 이 파일을 자동으로 업데이트합니다.

---

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **이름** | ${path.basename(cwd)} |
| **SEMO 버전** | ${VERSION} |
| **설치일** | ${new Date().toISOString().split("T")[0]} |

---

## 현재 작업 상태

_아직 작업 기록이 없습니다._

---

## 기술 스택

_프로젝트 분석 후 자동으로 채워집니다._

---

*마지막 업데이트: ${new Date().toISOString().split("T")[0]}*
`;
    fs.writeFileSync(contextPath, contextContent);
    console.log(chalk.green("✓ .claude/memory/context.md 생성됨"));
  }

  // decisions.md
  const decisionsPath = path.join(memoryDir, "decisions.md");
  if (!fs.existsSync(decisionsPath)) {
    const decisionsContent = `# Architecture Decisions

> 프로젝트 아키텍처 결정 기록 (ADR)
> 중요한 기술적 결정을 여기에 기록합니다.

---

## 결정 목록

_아직 기록된 결정이 없습니다._

---

## 템플릿

\`\`\`markdown
### ADR-XXX: 결정 제목

**날짜**: YYYY-MM-DD
**상태**: Proposed | Accepted | Deprecated

#### 배경
결정이 필요한 이유

#### 결정
선택한 방안

#### 근거
선택 이유
\`\`\`
`;
    fs.writeFileSync(decisionsPath, decisionsContent);
    console.log(chalk.green("✓ .claude/memory/decisions.md 생성됨"));
  }

  // projects.md
  const projectsPath = path.join(memoryDir, "projects.md");
  if (!fs.existsSync(projectsPath)) {
    const projectsContent = `# 프로젝트 별칭 매핑

> 외부 프로젝트 배포 및 GitHub Projects 상태 관리
> SEMO의 deployer, project-status 스킬이 이 파일을 참조합니다.

---

## GitHub Projects 설정

> **⚠️ 프로젝트 상태 관리 시 이 설정을 참조합니다.**

### 기본 프로젝트

| 프로젝트 | 번호 | Project ID | 용도 |
|---------|------|------------|------|
| 이슈관리 | #1 | \`PVT_xxx\` | 메인 태스크 관리 (기본값) |

### Status 옵션

| Status | 설명 |
|--------|------|
| 백로그 | 초기 상태 |
| 작업중 | 개발 진행 중 |
| 리뷰요청 | 코드 리뷰 대기 |
| 테스트중 | QA 테스트 단계 |
| 완료 | 작업 완료 |

### 🔴 상태값 Alias (한글 ↔ 영문)

> **SEMO는 아래 키워드를 자동으로 Status 필드값으로 매핑합니다.**

| 사용자 입력 | → Status 값 | 비고 |
|------------|-------------|------|
| 리뷰요청, 리뷰 요청, review | 리뷰요청 | 코드 리뷰 대기 |
| 테스트중, 테스트 중, testing, qa | 테스트중 | QA 단계 |
| 작업중, 작업 중, 진행중, in progress, wip | 작업중 | 개발 중 |
| 완료, done, closed | 완료 | 완료 처리 |
| 백로그, 대기, pending, backlog | 백로그 | 초기 상태 |

**예시:**
\`\`\`
"리뷰요청 이슈들 테스트중으로 바꿔줘"
→ Status == "리뷰요청" 인 항목들을 Status = "테스트중" 으로 변경
\`\`\`

---

## 프로젝트 별칭

| 별칭 | 레포지토리 | 환경 | 배포 방법 |
|------|-----------|------|----------|
| 예시 | owner/repo | stg | Milestone close |

---

*마지막 업데이트: ${new Date().toISOString().split("T")[0]}*
`;
    fs.writeFileSync(projectsPath, projectsContent);
    console.log(chalk.green("✓ .claude/memory/projects.md 생성됨"));
  }

  // rules 디렉토리
  const rulesDir = path.join(memoryDir, "rules");
  fs.mkdirSync(rulesDir, { recursive: true });

  const rulesPath = path.join(rulesDir, "project-specific.md");
  if (!fs.existsSync(rulesPath)) {
    const rulesContent = `# Project-Specific Rules

> 이 프로젝트에만 적용되는 규칙

---

## 코딩 규칙

_프로젝트별 코딩 규칙을 여기에 추가하세요._

---

## 예외 사항

_SEMO 기본 규칙의 예외 사항을 여기에 추가하세요._
`;
    fs.writeFileSync(rulesPath, rulesContent);
    console.log(chalk.green("✓ .claude/memory/rules/project-specific.md 생성됨"));
  }
}

// === CLAUDE.md 중복 섹션 감지 ===
// "Core Rules (상속)" 패턴을 사용하는 Extension은 고유 섹션만 추출
function extractUniqueContent(content: string, pkgName: string): string {
  // "Core Rules (상속)" 섹션이 있는지 확인
  const hasCoreRulesRef = /## Core Rules \(상속\)/i.test(content);

  if (hasCoreRulesRef) {
    // "고유:" 패턴이 포함된 섹션만 추출
    const uniqueSectionPattern = /## [^\n]* 고유:/g;
    const sections: string[] = [];

    // 섹션별로 분리
    const allSections = content.split(/(?=^## )/gm);
    for (const section of allSections) {
      // "고유:" 키워드가 있는 섹션만 포함
      if (/고유:/i.test(section)) {
        sections.push(section.trim());
      }
      // References 섹션도 포함
      if (/^## References/i.test(section)) {
        sections.push(section.trim());
      }
      // 패키지 구조, Keywords 섹션 포함
      if (/^## (패키지 구조|Keywords|Routing)/i.test(section)) {
        sections.push(section.trim());
      }
    }

    if (sections.length > 0) {
      return sections.join("\n\n");
    }
  }

  // 공유 규칙 패턴 감지 (이 패턴이 있으면 중복 가능성 높음)
  const sharedPatterns = [
    /Orchestrator-First Policy/i,
    /Quality Gate|Pre-Commit/i,
    /세션 초기화|Session Init/i,
    /버저닝 규칙|Versioning/i,
    /패키지 접두사|PREFIX_ROUTING/i,
    /SEMO Core 필수 참조/i,
    /NON-NEGOTIABLE.*Orchestrator/i,
  ];

  // 공유 패턴이 많이 발견되면 간소화된 참조만 반환
  let sharedPatternCount = 0;
  for (const pattern of sharedPatterns) {
    if (pattern.test(content)) {
      sharedPatternCount++;
    }
  }

  // 3개 이상의 공유 패턴이 발견되면 중복이 많은 것으로 판단
  if (sharedPatternCount >= 3) {
    // 기본 헤더와 References만 추출
    const headerMatch = content.match(/^# .+\n\n>[^\n]+/);
    const referencesMatch = content.match(/## References[\s\S]*$/);

    let simplified = headerMatch ? headerMatch[0] : `# ${pkgName}`;
    simplified += "\n\n> Core Rules는 semo-core/principles/를 참조합니다.";

    if (referencesMatch) {
      simplified += "\n\n" + referencesMatch[0];
    }

    return simplified;
  }

  // 그 외에는 전체 내용 반환
  return content;
}

// === CLAUDE.md 생성 (패키지 CLAUDE.md 병합 지원 + 중복 제거) ===
async function setupClaudeMd(cwd: string, extensions: string[], force: boolean) {
  console.log(chalk.cyan("\n📄 CLAUDE.md 설정"));

  const claudeMdPath = path.join(cwd, ".claude", "CLAUDE.md");

  if (fs.existsSync(claudeMdPath) && !force) {
    const shouldOverwrite = await confirmOverwrite("CLAUDE.md", claudeMdPath);
    if (!shouldOverwrite) {
      console.log(chalk.gray("  → CLAUDE.md 건너뜀"));
      return;
    }
  }

  const semoSystemDir = path.join(cwd, "semo-system");
  const extensionsList = extensions.length > 0
    ? extensions.map(pkg => `├── ${pkg}/              # ${EXTENSION_PACKAGES[pkg].name}`).join("\n")
    : "";

  // 그룹 및 패키지별 CLAUDE.md 병합 섹션 생성
  let packageClaudeMdSections = "";

  // 0. meta 패키지가 설치된 경우 먼저 확인 (meta는 특별 처리)
  const isMetaInstalled = extensions.includes("meta") ||
    fs.existsSync(path.join(semoSystemDir, "meta", "VERSION"));

  // 1. 설치된 패키지에서 그룹 추출 (중복 제거)
  const installedGroups = [...new Set(
    extensions.map(pkg => pkg.split("/")[0]).filter(g => PACKAGE_GROUPS.includes(g as PackageGroup))
  )] as PackageGroup[];

  // 2. 그룹 레벨 CLAUDE.md 먼저 병합 (biz, eng, ops) - 중복 제거 적용
  for (const group of installedGroups) {
    const groupClaudeMdPath = path.join(semoSystemDir, group, "CLAUDE.md");
    if (fs.existsSync(groupClaudeMdPath)) {
      const groupContent = fs.readFileSync(groupClaudeMdPath, "utf-8");
      // 중복 제거 후 고유 콘텐츠만 추출
      const uniqueContent = extractUniqueContent(groupContent, group);
      // 헤더 레벨 조정 (# → ##, ## → ###)
      const adjustedContent = uniqueContent
        .replace(/^# /gm, "## ")
        .replace(/^## /gm, "### ")
        .replace(/^### /gm, "#### ");
      packageClaudeMdSections += `\n\n---\n\n${adjustedContent}`;
      console.log(chalk.green(`  + ${group}/ 그룹 CLAUDE.md 병합됨 (고유 섹션만)`));
    }
  }

  // 3. 개별 패키지 CLAUDE.md 병합 - 중복 제거 적용
  for (const pkg of extensions) {
    // meta 패키지는 별도 처리 (아래에서 전체 내용 병합)
    if (pkg === "meta") continue;

    const pkgClaudeMdPath = path.join(semoSystemDir, pkg, "CLAUDE.md");
    if (fs.existsSync(pkgClaudeMdPath)) {
      const pkgContent = fs.readFileSync(pkgClaudeMdPath, "utf-8");
      const pkgName = EXTENSION_PACKAGES[pkg]?.name || pkg;
      // 중복 제거 후 고유 콘텐츠만 추출
      const uniqueContent = extractUniqueContent(pkgContent, pkgName);
      // 헤더 레벨 조정
      const adjustedContent = uniqueContent
        .replace(/^# /gm, "### ")
        .replace(/^## /gm, "#### ");
      packageClaudeMdSections += `\n\n---\n\n## ${pkgName} 패키지 컨텍스트\n\n${adjustedContent}`;
      console.log(chalk.gray(`  + ${pkg}/CLAUDE.md 병합됨 (고유 섹션만)`));
    }
  }

  // 3.5. meta 패키지 CLAUDE.md 병합 (전체 내용 - Meta 환경 규칙 포함)
  if (isMetaInstalled) {
    const metaClaudeMdPath = path.join(semoSystemDir, "meta", "CLAUDE.md");
    if (fs.existsSync(metaClaudeMdPath)) {
      const metaContent = fs.readFileSync(metaClaudeMdPath, "utf-8");
      const pkgName = EXTENSION_PACKAGES["meta"]?.name || "Meta";
      // meta는 중복 제거 없이 전체 내용 유지 (Core Rules가 중요)
      // 헤더 레벨만 조정 (# → ###, ## → ####)
      const adjustedContent = metaContent
        .replace(/^# /gm, "### ")
        .replace(/^## /gm, "#### ");
      packageClaudeMdSections += `\n\n---\n\n## ${pkgName} 패키지 컨텍스트\n\n${adjustedContent}`;
      console.log(chalk.green(`  + meta/CLAUDE.md 병합됨 (전체 내용 - Meta 환경 규칙 포함)`));
    }
  }

  // 4. Orchestrator 참조 경로 결정 (Extension 패키지 우선, meta 포함)
  // Extension 패키지 중 orchestrator가 있는 첫 번째 패키지를 Primary로 설정
  let primaryOrchestratorPath = "semo-core/agents/orchestrator/orchestrator.md";
  const orchestratorPaths: string[] = [];

  // meta 패키지 orchestrator 먼저 확인 (meta가 설치되어 있으면 최우선)
  if (isMetaInstalled) {
    const metaOrchestratorPath = path.join(semoSystemDir, "meta", "agents/orchestrator/orchestrator.md");
    if (fs.existsSync(metaOrchestratorPath)) {
      orchestratorPaths.push("semo-system/meta/agents/orchestrator/orchestrator.md");
      primaryOrchestratorPath = "meta/agents/orchestrator/orchestrator.md";
    }
  }

  // 나머지 Extension 패키지 orchestrator 확인
  for (const pkg of extensions) {
    if (pkg === "meta") continue; // meta는 위에서 이미 처리

    const pkgOrchestratorPath = path.join(semoSystemDir, pkg, "agents/orchestrator/orchestrator.md");
    if (fs.existsSync(pkgOrchestratorPath)) {
      orchestratorPaths.push(`semo-system/${pkg}/agents/orchestrator/orchestrator.md`);
      // Primary가 아직 semo-core이면 이 패키지를 Primary로 설정
      if (primaryOrchestratorPath === "semo-core/agents/orchestrator/orchestrator.md") {
        primaryOrchestratorPath = `${pkg}/agents/orchestrator/orchestrator.md`;
      }
    }
  }

  // semo-core orchestrator는 항상 마지막에 포함 (fallback)
  orchestratorPaths.push("semo-system/semo-core/agents/orchestrator/orchestrator.md");

  // Orchestrator 참조 섹션 생성
  const orchestratorRefSection = orchestratorPaths.length > 1
    ? `**Primary Orchestrator**: \`semo-system/${primaryOrchestratorPath}\`

> Extension 패키지가 설치되어 해당 패키지의 Orchestrator를 우선 참조합니다.

**모든 Orchestrator 파일** (라우팅 테이블 병합됨):
${orchestratorPaths.map(p => `- \`${p}\``).join("\n")}

이 파일들에서 라우팅 테이블, 의도 분류, 메시지 포맷을 확인하세요.`
    : `**반드시 읽어야 할 파일**: \`semo-system/semo-core/agents/orchestrator/orchestrator.md\`

이 파일에서 라우팅 테이블, 의도 분류, 메시지 포맷을 확인하세요.`;

  const claudeMdContent = `# SEMO Project Configuration

> SEMO (Semicolon Orchestrate) - AI Agent Orchestration Framework v${VERSION}

---

## 🔴 MANDATORY: Orchestrator-First Execution

> **⚠️ 이 규칙은 모든 사용자 요청에 적용됩니다. 예외 없음.**

### 실행 흐름 (필수)

\`\`\`
1. 사용자 요청 수신
2. Orchestrator가 의도 분석 후 적절한 Agent/Skill 라우팅
3. Agent/Skill이 작업 수행
4. 실행 결과 반환
\`\`\`

### Orchestrator 참조

${orchestratorRefSection}

---

## 🔴 NON-NEGOTIABLE RULES

### 1. Orchestrator-First Policy

> **모든 요청은 반드시 Orchestrator를 통해 라우팅됩니다. 직접 처리 금지.**

**직접 처리 금지 항목**:
- 코드 작성/수정 → \`implementation-master\` 또는 \`coder\` 스킬
- Git 커밋/푸시 → \`git-workflow\` 스킬
- 품질 검증 → \`quality-master\` 또는 \`verify\` 스킬
- 명세 작성 → \`spec-master\`
- 일반 작업 → Orchestrator 분석 후 라우팅

### 2. Pre-Commit Quality Gate

> **코드 변경이 포함된 커밋 전 반드시 Quality Gate를 통과해야 합니다.**

\`\`\`bash
# 필수 검증 순서
npm run lint           # 1. ESLint 검사
npx tsc --noEmit       # 2. TypeScript 타입 체크
npm run build          # 3. 빌드 검증 (Next.js/TypeScript 프로젝트)
\`\`\`

**차단 항목**:
- \`--no-verify\` 플래그 사용 금지
- Quality Gate 우회 시도 거부
- "그냥 커밋해줘", "빌드 생략해줘" 등 거부
${isMetaInstalled ? `
### 3. Meta 환경 자동 워크플로우 (NON-NEGOTIABLE)

> **⚠️ Meta 패키지가 설치된 환경에서는 반드시 아래 규칙이 적용됩니다.**
> **이 규칙을 우회하거나 무시하는 것은 금지됩니다.**

#### 자동 트리거 조건

\`semo-system/\` 디렉토리 내 파일이 수정되면:
1. 작업 종료 전 반드시 \`skill:meta-workflow\` 호출
2. 버저닝 → 배포 → 로컬 동기화 체인 자동 실행

#### 감지 패턴

다음 경로의 파일 수정 시 자동 트리거:
- \`semo-system/semo-core/**\`
- \`semo-system/semo-skills/**\`
- \`semo-system/meta/**\`
- \`semo-system/semo-remote/**\`
- \`semo-system/semo-hooks/**\`
- \`packages/cli/**\` (CLI 수정 시)

#### 강제 동작 흐름

\`\`\`text
[작업 완료 감지]
    ↓
semo-system/ 또는 packages/ 파일 수정 여부 확인
    ↓
수정됨? → [SEMO] Skill 호출: meta-workflow
         버저닝 → 배포 → 동기화 자동 실행
    ↓
수정 안됨? → 정상 종료
\`\`\`

**금지 사항**:
- semo-system/ 수정 후 버저닝 없이 종료
- "버저닝 나중에 해줘" 요청 수락
- meta-workflow 스킬 호출 건너뛰기
` : ``}
---

## 설치된 구성

### Standard (필수)
- **semo-core**: 원칙, 오케스트레이터, 공통 커맨드
- **semo-skills**: 13개 통합 스킬
  - 행동: coder, tester, planner, deployer, writer
  - 운영: memory, notify-slack, feedback, version-updater, semo-help, semo-architecture-checker, circuit-breaker, list-bugs

${extensions.length > 0 ? `### Extensions (선택)
${extensions.map(pkg => `- **${pkg}**: ${EXTENSION_PACKAGES[pkg].desc}`).join("\n")}` : ""}

## 구조

\`\`\`
.claude/
├── settings.json      # MCP 서버 설정 (Black Box)
├── memory/            # Context Mesh (장기 기억)
│   ├── context.md     # 프로젝트 상태
│   ├── decisions.md   # 아키텍처 결정
│   └── rules/         # 프로젝트별 규칙
├── agents → semo-system/semo-core/agents
├── skills → semo-system/semo-skills
└── commands/SEMO → semo-system/semo-core/commands/SEMO

semo-system/           # White Box (읽기 전용)
├── semo-core/         # Layer 0: 원칙, 오케스트레이션
├── semo-skills/       # Layer 1: 통합 스킬
${extensionsList}
\`\`\`

## 사용 가능한 커맨드

| 커맨드 | 설명 |
|--------|------|
| \`/SEMO:help\` | 도움말 |
| \`/SEMO:feedback\` | 피드백 제출 |
| \`/SEMO:update\` | SEMO 업데이트 |
| \`/SEMO:onboarding\` | 온보딩 가이드 |
| \`/SEMO:dry-run {프롬프트}\` | 명령 검증 (라우팅 시뮬레이션) |

## Context Mesh 사용

SEMO는 \`.claude/memory/\`를 통해 세션 간 컨텍스트를 유지합니다:

- **context.md**: 프로젝트 상태, 진행 중인 작업
- **decisions.md**: 아키텍처 결정 기록 (ADR)
- **rules/**: 프로젝트별 커스텀 규칙

memory 스킬이 자동으로 이 파일들을 관리합니다.

## References

- [SEMO Principles](semo-system/semo-core/principles/PRINCIPLES.md)
- [SEMO Skills](semo-system/semo-skills/)
${extensions.length > 0 ? extensions.map(pkg => `- [${EXTENSION_PACKAGES[pkg].name} Package](semo-system/${pkg}/)`).join("\n") : ""}
${packageClaudeMdSections}
`;

  fs.writeFileSync(claudeMdPath, claudeMdContent);
  console.log(chalk.green("✓ .claude/CLAUDE.md 생성됨"));

  if (packageClaudeMdSections) {
    console.log(chalk.green(`  + ${extensions.length}개 패키지 CLAUDE.md 병합 완료`));
  }
}

// === add 명령어 ===
program
  .command("add <packages>")
  .description("Extension 패키지를 추가로 설치합니다 (그룹: biz, eng, ops, system / 개별: biz/discovery, eng/nextjs, semo-hooks)")
  .option("-f, --force", "기존 설정 덮어쓰기")
  .action(async (packagesInput: string, options) => {
    // 패키지 데이터 초기화 (DB에서 조회)
    await initPackageData();

    const cwd = process.cwd();
    const semoSystemDir = path.join(cwd, "semo-system");

    if (!fs.existsSync(semoSystemDir)) {
      console.log(chalk.red("\nSEMO가 설치되어 있지 않습니다. 'semo init'을 먼저 실행하세요.\n"));
      process.exit(1);
    }

    // 패키지 입력 해석 (그룹, 레거시, 쉼표 구분 모두 처리)
    const { packages, isGroup, groupName } = resolvePackageInput(packagesInput);
    const extPkgs = getExtensionPackagesSync();
    const shortnames = getShortnameMappingSync();

    if (packages.length === 0) {
      console.log(chalk.red(`\n알 수 없는 패키지: ${packagesInput}`));
      console.log(chalk.gray(`사용 가능한 그룹: ${PACKAGE_GROUPS.join(", ")}`));
      console.log(chalk.gray(`사용 가능한 패키지: ${Object.keys(extPkgs).join(", ")}`));
      console.log(chalk.gray(`단축명: ${Object.keys(shortnames).join(", ")}\n`));
      process.exit(1);
    }

    // 그룹 설치인 경우 안내
    if (isGroup) {
      console.log(chalk.cyan.bold(`\n📦 ${groupName?.toUpperCase()} 그룹 패키지 일괄 설치\n`));
      console.log(chalk.gray("   포함된 패키지:"));
      for (const pkg of packages) {
        const pkgInfo = extPkgs[pkg];
        console.log(chalk.gray(`   - ${pkg} (${pkgInfo?.name || pkg})`));
      }
      console.log();
    } else if (packages.length === 1) {
      // 단일 패키지
      const pkg = packages[0];
      const pkgInfo = extPkgs[pkg];
      console.log(chalk.cyan(`\n📦 ${pkgInfo?.name || pkg} 패키지 설치\n`));
      console.log(chalk.gray(`   ${pkgInfo?.desc || ""}\n`));
    } else {
      // 여러 패키지 (쉼표 구분)
      console.log(chalk.cyan.bold(`\n📦 ${packages.length}개 패키지 설치\n`));
      for (const pkg of packages) {
        const pkgInfo = extPkgs[pkg];
        console.log(chalk.gray(`   - ${pkg} (${pkgInfo?.name || pkg})`));
      }
      console.log();
    }

    // 기존에 설치된 모든 Extension 패키지 스캔
    const previouslyInstalled = getInstalledExtensions(cwd);

    // 요청한 패키지 중 이미 설치된 것과 새로 설치할 것 분류
    const alreadyInstalled: string[] = [];
    const toInstall: string[] = [];

    for (const pkg of packages) {
      const pkgPath = path.join(semoSystemDir, pkg);
      if (fs.existsSync(pkgPath) && !options.force) {
        alreadyInstalled.push(pkg);
      } else {
        toInstall.push(pkg);
      }
    }

    if (alreadyInstalled.length > 0) {
      console.log(chalk.yellow("⚠ 이미 설치된 패키지 (건너뜀):"));
      for (const pkg of alreadyInstalled) {
        console.log(chalk.yellow(`   - ${pkg}`));
      }
      console.log(chalk.gray("   강제 재설치: semo add " + packagesInput + " --force\n"));
    }

    if (toInstall.length === 0) {
      console.log(chalk.yellow("\n모든 패키지가 이미 설치되어 있습니다.\n"));
      return;
    }

    // 1. 다운로드
    await downloadExtensions(cwd, toInstall, options.force);

    // 2. settings.json 병합
    await mergeExtensionSettings(cwd, toInstall);

    // 3. 심볼릭 링크 설정 (기존 + 새로 설치한 모든 패키지 포함)
    const allInstalledPackages = [...new Set([...previouslyInstalled, ...toInstall])];
    await setupExtensionSymlinks(cwd, allInstalledPackages);

    // 4. CLAUDE.md 재생성 (모든 설치된 패키지 반영)
    await setupClaudeMd(cwd, allInstalledPackages, options.force);

    if (toInstall.length === 1) {
      const pkgInfo = extPkgs[toInstall[0]];
      console.log(chalk.green.bold(`\n✅ ${pkgInfo?.name || toInstall[0]} 패키지 설치 완료!\n`));
    } else {
      console.log(chalk.green.bold(`\n✅ ${toInstall.length}개 패키지 설치 완료!`));
      for (const pkg of toInstall) {
        const pkgInfo = extPkgs[pkg];
        console.log(chalk.green(`   ✓ ${pkgInfo?.name || pkg}`));
      }
      console.log();
    }
  });

// === list 명령어 ===
program
  .command("list")
  .description("사용 가능한 모든 패키지를 표시합니다")
  .action(async () => {
    // 패키지 데이터 초기화 (DB에서 조회)
    await initPackageData();

    const cwd = process.cwd();
    const semoSystemDir = path.join(cwd, "semo-system");
    const extPkgs = getExtensionPackagesSync();

    console.log(chalk.cyan.bold("\n📦 SEMO 패키지 목록 (v3.10 - DB 기반)\n"));

    // Standard
    console.log(chalk.white.bold("Standard (필수)"));
    const coreInstalled = fs.existsSync(path.join(semoSystemDir, "semo-core"));
    const skillsInstalled = fs.existsSync(path.join(semoSystemDir, "semo-skills"));

    console.log(`  ${coreInstalled ? chalk.green("✓") : chalk.gray("○")} semo-core - 원칙, 오케스트레이터`);
    console.log(`  ${skillsInstalled ? chalk.green("✓") : chalk.gray("○")} semo-skills - 통합 스킬`);
    console.log();

    // Extensions - 레이어별 그룹화
    const layers: Record<string, { title: string; emoji: string }> = {
      biz: { title: "Business Layer", emoji: "💼" },
      eng: { title: "Engineering Layer", emoji: "⚙️" },
      ops: { title: "Operations Layer", emoji: "📊" },
      meta: { title: "Meta", emoji: "🔧" },
      system: { title: "System", emoji: "🔩" },
    };

    for (const [layerKey, layerInfo] of Object.entries(layers)) {
      const layerPackages = Object.entries(extPkgs).filter(
        ([, pkg]) => pkg.layer === layerKey
      );

      if (layerPackages.length === 0) continue;

      console.log(chalk.white.bold(`${layerInfo.emoji} ${layerInfo.title}`));
      for (const [key, pkg] of layerPackages) {
        const isInstalled = fs.existsSync(path.join(semoSystemDir, key));
        const status = isInstalled ? chalk.green("✓") : chalk.gray("○");
        const displayKey = key.includes("/") ? key.split("/")[1] : key;
        console.log(`  ${status} ${chalk.cyan(displayKey)} - ${pkg.desc}`);
        console.log(chalk.gray(`      semo add ${key}`));
      }
      console.log();
    }

    // 그룹 설치 안내
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.white.bold("📦 그룹 일괄 설치"));
    console.log(chalk.gray("  semo add biz      → Business 전체 (discovery, design, management, poc)"));
    console.log(chalk.gray("  semo add eng      → Engineering 전체 (nextjs, spring, ms, infra)"));
    console.log(chalk.gray("  semo add ops      → Operations 전체 (qa, monitor, improve)"));
    console.log(chalk.gray("  semo add system   → System 전체 (hooks, remote)"));
    console.log();

    // 단축명 안내
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.white.bold("⚡ 단축명 지원"));
    console.log(chalk.gray("  semo add discovery  → biz/discovery"));
    console.log(chalk.gray("  semo add qa         → ops/qa"));
    console.log(chalk.gray("  semo add nextjs     → eng/nextjs\n"));
  });

// === status 명령어 ===
program
  .command("status")
  .description("SEMO 설치 상태를 확인합니다")
  .action(() => {
    console.log(chalk.cyan.bold("\n📊 SEMO 설치 상태\n"));

    const cwd = process.cwd();
    const semoSystemDir = path.join(cwd, "semo-system");

    // Standard 확인
    console.log(chalk.white.bold("Standard:"));
    const standardChecks = [
      { name: "semo-core", path: path.join(semoSystemDir, "semo-core") },
      { name: "semo-skills", path: path.join(semoSystemDir, "semo-skills") },
    ];

    let standardOk = true;
    for (const check of standardChecks) {
      const exists = fs.existsSync(check.path);
      console.log(`  ${exists ? chalk.green("✓") : chalk.red("✗")} ${check.name}`);
      if (!exists) standardOk = false;
    }

    // Extensions 확인
    const installedExtensions: string[] = [];
    for (const key of Object.keys(EXTENSION_PACKAGES)) {
      if (fs.existsSync(path.join(semoSystemDir, key))) {
        installedExtensions.push(key);
      }
    }

    if (installedExtensions.length > 0) {
      console.log(chalk.white.bold("\nExtensions:"));
      for (const pkg of installedExtensions) {
        console.log(chalk.green(`  ✓ ${pkg}`));
      }
    }

    // 구조 확인
    console.log(chalk.white.bold("\n구조:"));
    const structureChecks = [
      { name: ".claude/", path: path.join(cwd, ".claude") },
      { name: ".claude/settings.json", path: path.join(cwd, ".claude", "settings.json") },
      { name: ".claude/memory/", path: path.join(cwd, ".claude", "memory") },
      { name: ".claude/memory/context.md", path: path.join(cwd, ".claude", "memory", "context.md") },
    ];

    let structureOk = true;
    for (const check of structureChecks) {
      const exists = fs.existsSync(check.path);
      console.log(`  ${exists ? chalk.green("✓") : chalk.red("✗")} ${check.name}`);
      if (!exists) structureOk = false;
    }

    console.log();
    if (standardOk && structureOk) {
      console.log(chalk.green.bold("SEMO가 정상적으로 설치되어 있습니다."));
    } else {
      console.log(chalk.yellow("일부 구성 요소가 누락되었습니다. 'semo init'을 실행하세요."));
    }
    console.log();
  });

// === update 명령어 ===
program
  .command("update")
  .description("SEMO를 최신 버전으로 업데이트합니다")
  .option("--self", "CLI만 업데이트")
  .option("--system", "semo-system만 업데이트")
  .option("--skip-cli", "CLI 업데이트 건너뛰기")
  .option("--only <packages>", "특정 패키지만 업데이트 (쉼표 구분: semo-core,semo-skills,biz/management)")
  .option("--migrate", "레거시 환경 강제 마이그레이션")
  .action(async (options) => {
    console.log(chalk.cyan.bold("\n🔄 SEMO 업데이트\n"));

    // 패키지 데이터 초기화 (DB에서 조회)
    await initPackageData();

    const cwd = process.cwd();
    const semoSystemDir = path.join(cwd, "semo-system");
    const claudeDir = path.join(cwd, ".claude");

    // 0. 버전 비교
    await showVersionComparison(cwd);

    // 0.5. 레거시 환경 감지 및 마이그레이션
    const legacyCheck = detectLegacyEnvironment(cwd);
    if (legacyCheck.hasLegacy || options.migrate) {
      console.log(chalk.yellow("\n⚠️  레거시 환경이 감지되어 업데이트 전 마이그레이션이 필요합니다.\n"));
      const migrationSuccess = await migrateLegacyEnvironment(cwd);
      if (migrationSuccess) {
        console.log(chalk.cyan("마이그레이션 완료. 'semo init'으로 새 환경을 설치하세요.\n"));
      }
      process.exit(0);
    }

    // --only 옵션 파싱
    const onlyPackages: string[] = options.only
      ? options.only.split(",").map((p: string) => p.trim())
      : [];
    const isSelectiveUpdate = onlyPackages.length > 0;

    // === 1. CLI 자체 업데이트 ===
    if (options.self || (!options.system && !options.skipCli && !isSelectiveUpdate)) {
      console.log(chalk.cyan("📦 CLI 업데이트"));
      const cliSpinner = ora("  @team-semicolon/semo-cli 업데이트 중...").start();

      try {
        execSync("npm update -g @team-semicolon/semo-cli", { stdio: "pipe" });
        cliSpinner.succeed("  CLI 업데이트 완료");
      } catch (error) {
        cliSpinner.fail("  CLI 업데이트 실패");
        const errorMsg = String(error);
        if (errorMsg.includes("EACCES") || errorMsg.includes("permission")) {
          console.log(chalk.yellow("\n  💡 권한 오류: 다음 명령어로 재시도하세요:"));
          console.log(chalk.white("     sudo npm update -g @team-semicolon/semo-cli\n"));
        } else {
          console.error(chalk.gray(`     ${errorMsg}`));
        }
      }

      // --self 옵션만 있으면 여기서 종료
      if (options.self) {
        console.log(chalk.green.bold("\n✅ CLI 업데이트 완료!\n"));
        return;
      }
    }

    // === 2. semo-system 업데이트 ===
    if (!fs.existsSync(semoSystemDir)) {
      console.log(chalk.red("SEMO가 설치되어 있지 않습니다. 'semo init'을 먼저 실행하세요."));
      process.exit(1);
    }

    // 설치된 Extensions 확인
    const installedExtensions: string[] = [];
    const extPkgs = getExtensionPackagesSync();
    for (const key of Object.keys(extPkgs)) {
      if (fs.existsSync(path.join(semoSystemDir, key))) {
        installedExtensions.push(key);
      }
    }

    // 업데이트 대상 결정
    const updateSemoCore = !isSelectiveUpdate || onlyPackages.includes("semo-core");
    const updateSemoSkills = !isSelectiveUpdate || onlyPackages.includes("semo-skills");
    const updateSemoAgents = !isSelectiveUpdate || onlyPackages.includes("semo-agents");
    const updateSemoScripts = !isSelectiveUpdate || onlyPackages.includes("semo-scripts");
    const extensionsToUpdate = isSelectiveUpdate
      ? installedExtensions.filter(ext => onlyPackages.includes(ext))
      : installedExtensions;

    console.log(chalk.cyan("\n📚 semo-system 업데이트"));
    console.log(chalk.gray("  대상:"));
    if (updateSemoCore) console.log(chalk.gray("    - semo-core"));
    if (updateSemoSkills) console.log(chalk.gray("    - semo-skills"));
    if (updateSemoAgents) console.log(chalk.gray("    - semo-agents"));
    if (updateSemoScripts) console.log(chalk.gray("    - semo-scripts"));
    extensionsToUpdate.forEach(pkg => {
      console.log(chalk.gray(`    - ${pkg}`));
    });

    if (!updateSemoCore && !updateSemoSkills && !updateSemoAgents && !updateSemoScripts && extensionsToUpdate.length === 0) {
      console.log(chalk.yellow("\n  ⚠️ 업데이트할 패키지가 없습니다."));
      console.log(chalk.gray("     설치된 패키지: semo-core, semo-skills, semo-agents, semo-scripts" +
        (installedExtensions.length > 0 ? ", " + installedExtensions.join(", ") : "")));
      return;
    }

    const spinner = ora("\n  최신 버전 다운로드 중...").start();

    try {
      const tempDir = path.join(cwd, ".semo-temp");
      removeRecursive(tempDir);
      execSync(`git clone --depth 1 ${SEMO_REPO} "${tempDir}"`, { stdio: "pipe" });

      // Standard 업데이트 (선택적) - semo-system/ 하위에서 복사
      const standardUpdates = [
        { flag: updateSemoCore, name: "semo-core" },
        { flag: updateSemoSkills, name: "semo-skills" },
        { flag: updateSemoAgents, name: "semo-agents" },
        { flag: updateSemoScripts, name: "semo-scripts" },
      ];

      for (const { flag, name } of standardUpdates) {
        if (flag) {
          const srcPath = path.join(tempDir, "semo-system", name);
          const destPath = path.join(semoSystemDir, name);
          if (fs.existsSync(srcPath)) {
            removeRecursive(destPath);
            copyRecursive(srcPath, destPath);
          }
        }
      }

      // Extensions 업데이트 (선택적)
      for (const pkg of extensionsToUpdate) {
        const srcPath = path.join(tempDir, "packages", pkg);
        const destPath = path.join(semoSystemDir, pkg);
        if (fs.existsSync(srcPath)) {
          removeRecursive(destPath);
          copyRecursive(srcPath, destPath);
        }
      }

      removeRecursive(tempDir);
      spinner.succeed("  semo-system 업데이트 완료");
    } catch (error) {
      spinner.fail("  semo-system 업데이트 실패");
      console.error(chalk.red(`     ${error}`));
      return;
    }

    // === 3. 심볼릭 링크 재생성 ===
    console.log(chalk.cyan("\n🔗 심볼릭 링크 재생성"));

    // 기존 링크 정리
    const claudeAgentsDir = path.join(claudeDir, "agents");
    const claudeSkillsDir = path.join(claudeDir, "skills");

    if (fs.existsSync(claudeAgentsDir)) {
      const existingLinks = fs.readdirSync(claudeAgentsDir);
      for (const link of existingLinks) {
        const linkPath = path.join(claudeAgentsDir, link);
        if (fs.lstatSync(linkPath).isSymbolicLink()) {
          fs.unlinkSync(linkPath);
        }
      }
    }

    if (fs.existsSync(claudeSkillsDir)) {
      const existingLinks = fs.readdirSync(claudeSkillsDir);
      for (const link of existingLinks) {
        const linkPath = path.join(claudeSkillsDir, link);
        if (fs.lstatSync(linkPath).isSymbolicLink()) {
          fs.unlinkSync(linkPath);
        }
      }
    }

    // commands 링크도 정리 (신규 commands 반영 위해)
    const claudeCommandsDir = path.join(claudeDir, "commands");
    const semoCommandsLink = path.join(claudeCommandsDir, "SEMO");
    if (fs.existsSync(semoCommandsLink)) {
      if (fs.lstatSync(semoCommandsLink).isSymbolicLink()) {
        fs.unlinkSync(semoCommandsLink);
      } else {
        removeRecursive(semoCommandsLink);
      }
    }

    // Standard 심볼릭 링크 재생성 (agents, skills, commands 포함)
    await createStandardSymlinks(cwd);

    // Extensions 심볼릭 링크 재생성
    if (installedExtensions.length > 0) {
      await setupExtensionSymlinks(cwd, installedExtensions);
    }

    // === 4. CLAUDE.md 재생성 ===
    console.log(chalk.cyan("\n📄 CLAUDE.md 재생성"));
    await setupClaudeMd(cwd, installedExtensions, true);

    // === 5. MCP 서버 동기화 ===
    console.log(chalk.cyan("\n🔧 MCP 서버 동기화"));

    // Extension의 MCP 설정 확인 및 병합
    const allServers: MCPServerConfig[] = [...BASE_MCP_SERVERS];
    for (const pkg of installedExtensions) {
      const extSettingsPath = path.join(semoSystemDir, pkg, "settings.local.json");
      if (fs.existsSync(extSettingsPath)) {
        try {
          const extSettings = JSON.parse(fs.readFileSync(extSettingsPath, "utf-8"));
          if (extSettings.mcpServers) {
            for (const [name, config] of Object.entries(extSettings.mcpServers)) {
              const serverConfig = config as { command: string; args: string[]; env?: Record<string, string> };
              allServers.push({
                name,
                command: serverConfig.command,
                args: serverConfig.args,
                env: serverConfig.env,
              });
            }
          }
        } catch {
          // 파싱 실패 무시
        }
      }
    }

    // MCP 서버 등록 상태 확인
    const missingServers: MCPServerConfig[] = [];
    for (const server of allServers) {
      if (!isMCPServerRegistered(server.name)) {
        missingServers.push(server);
      }
    }

    if (missingServers.length === 0) {
      console.log(chalk.green("  ✓ 모든 MCP 서버가 등록되어 있습니다"));
    } else {
      console.log(chalk.yellow(`  ${missingServers.length}개 MCP 서버 미등록`));
      for (const server of missingServers) {
        const result = registerMCPServer(server);
        if (result.success) {
          console.log(chalk.green(`    ✓ ${server.name} 등록 완료`));
        } else {
          console.log(chalk.red(`    ✗ ${server.name} 등록 실패`));
        }
      }
    }

    // === 6. Hooks 업데이트 ===
    await setupHooks(cwd, true);

    // === 7. 설치 검증 ===
    const verificationResult = verifyInstallation(cwd, installedExtensions);
    printVerificationResult(verificationResult);

    if (verificationResult.success) {
      console.log(chalk.green.bold("\n✅ SEMO 업데이트 완료!\n"));
    } else {
      console.log(chalk.yellow.bold("\n⚠️ SEMO 업데이트 완료 (일부 문제 발견)\n"));
    }
  });

// === migrate 명령어 ===
program
  .command("migrate")
  .description("레거시 SEMO 환경을 새 구조(semo-system/)로 마이그레이션")
  .option("-f, --force", "확인 없이 강제 마이그레이션")
  .action(async (options) => {
    console.log(chalk.cyan.bold("\n🔄 SEMO 마이그레이션\n"));

    const cwd = process.cwd();
    const detection = detectLegacyEnvironment(cwd);

    if (!detection.hasLegacy) {
      console.log(chalk.green("✅ 레거시 환경이 감지되지 않았습니다."));

      if (detection.hasSemoSystem) {
        console.log(chalk.gray("   현재 환경: semo-system/ (정상)"));
      } else {
        console.log(chalk.gray("   SEMO가 설치되지 않았습니다. 'semo init'을 실행하세요."));
      }
      console.log();
      return;
    }

    console.log(chalk.yellow("⚠️  레거시 SEMO 환경이 감지되었습니다.\n"));
    console.log(chalk.gray("   감지된 레거시 경로:"));
    detection.legacyPaths.forEach(p => {
      console.log(chalk.gray(`     - ${p}`));
    });
    console.log();

    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: "레거시 환경을 삭제하고 새 구조로 마이그레이션하시겠습니까?",
          default: true,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow("\n마이그레이션이 취소되었습니다.\n"));
        return;
      }
    }

    const migrationSuccess = await migrateLegacyEnvironment(cwd);

    if (migrationSuccess) {
      console.log(chalk.cyan("\n새 환경 설치를 위해 'semo init'을 실행하세요.\n"));
    }
  });

// === doctor 명령어 (설치 상태 진단) ===
program
  .command("doctor")
  .description("SEMO 설치 상태를 진단하고 문제를 리포트")
  .action(async () => {
    console.log(chalk.cyan.bold("\n🩺 SEMO 진단\n"));

    const cwd = process.cwd();
    const semoSystemDir = path.join(cwd, "semo-system");
    const claudeDir = path.join(cwd, ".claude");

    // 1. 레거시 환경 확인
    console.log(chalk.cyan("1. 레거시 환경 확인"));
    const legacyCheck = detectLegacyEnvironment(cwd);
    if (legacyCheck.hasLegacy) {
      console.log(chalk.yellow("   ⚠️ 레거시 환경 감지됨"));
      legacyCheck.legacyPaths.forEach(p => {
        console.log(chalk.gray(`      - ${p}`));
      });
      console.log(chalk.gray("   💡 해결: semo migrate 실행"));
    } else {
      console.log(chalk.green("   ✅ 레거시 환경 없음"));
    }

    // 2. semo-system 확인
    console.log(chalk.cyan("\n2. semo-system 구조 확인"));
    if (!fs.existsSync(semoSystemDir)) {
      console.log(chalk.red("   ❌ semo-system/ 없음"));
      console.log(chalk.gray("   💡 해결: semo init 실행"));
    } else {
      const packages = ["semo-core", "semo-skills", "semo-agents", "semo-scripts"];
      for (const pkg of packages) {
        const pkgPath = path.join(semoSystemDir, pkg);
        if (fs.existsSync(pkgPath)) {
          const versionPath = path.join(pkgPath, "VERSION");
          const version = fs.existsSync(versionPath)
            ? fs.readFileSync(versionPath, "utf-8").trim()
            : "?";
          console.log(chalk.green(`   ✅ ${pkg} v${version}`));
        } else {
          console.log(chalk.yellow(`   ⚠️ ${pkg} 없음`));
        }
      }
    }

    // 3. 심볼릭 링크 확인
    console.log(chalk.cyan("\n3. 심볼릭 링크 상태"));
    if (fs.existsSync(claudeDir)) {
      const linksToCheck = [
        { name: "agents", dir: path.join(claudeDir, "agents") },
        { name: "skills", dir: path.join(claudeDir, "skills") },
        { name: "commands/SEMO", dir: path.join(claudeDir, "commands", "SEMO") },
      ];

      for (const { name, dir } of linksToCheck) {
        if (fs.existsSync(dir)) {
          if (fs.lstatSync(dir).isSymbolicLink()) {
            if (isSymlinkValid(dir)) {
              console.log(chalk.green(`   ✅ .claude/${name} (심볼릭 링크)`));
            } else {
              console.log(chalk.red(`   ❌ .claude/${name} (깨진 링크)`));
              console.log(chalk.gray("      💡 해결: semo update 실행"));
            }
          } else {
            console.log(chalk.green(`   ✅ .claude/${name} (복사본)`));
          }
        } else {
          console.log(chalk.yellow(`   ⚠️ .claude/${name} 없음`));
        }
      }
    } else {
      console.log(chalk.red("   ❌ .claude/ 디렉토리 없음"));
    }

    // 4. 설치 검증
    console.log(chalk.cyan("\n4. 전체 설치 검증"));
    const verificationResult = verifyInstallation(cwd, []);
    if (verificationResult.success) {
      console.log(chalk.green("   ✅ 설치 상태 정상"));
    } else {
      console.log(chalk.yellow("   ⚠️ 문제 발견"));
      verificationResult.errors.forEach(err => {
        console.log(chalk.red(`      ❌ ${err}`));
      });
      verificationResult.warnings.forEach(warn => {
        console.log(chalk.yellow(`      ⚠️ ${warn}`));
      });
    }

    console.log();
  });

// === -v 옵션 처리 (program.parse 전에 직접 처리) ===
async function main() {
  const args = process.argv.slice(2);

  // semo -v 또는 semo --version-info 처리
  if (args.length === 1 && (args[0] === "-v" || args[0] === "--version-info")) {
    await showVersionInfo();
    process.exit(0);
  }

  program.parse();
}

main();

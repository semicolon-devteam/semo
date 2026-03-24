#!/usr/bin/env node
/**
 * SEMO CLI v4.0
 *
 * Core DB 기반 컨텍스트 동기화 시스템
 *
 * 사용법:
 *   npx @team-semicolon/semo-cli init          # 기본 설치 (훅 등록 포함)
 *   npx @team-semicolon/semo-cli context sync  # DB → .claude/memory/
 *   npx @team-semicolon/semo-cli bots status   # 봇 상태 조회
 *   npx @team-semicolon/semo-cli get kb        # KB 실시간 쿼리
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parseEnvContent } from "./env-parser";
import {
  getActiveSkills,
  getActiveSkillNames,
  getCommands,
  getAgents,
  getPackages,
  Skill,
  SemoCommand,
  Agent,
  Package as SemoPackage,
  closeConnection,
  isDbConnected,
  getSkillCountByCategory,
  getPool,
} from "./database";
import { registerContextCommands } from "./commands/context";
import { registerBotsCommands } from "./commands/bots";
import { registerGetCommands } from "./commands/get";
import { registerSessionsCommands } from "./commands/sessions";
import { registerDbCommands } from "./commands/db";
import { registerMemoryCommands } from "./commands/memory";
import { registerTestCommands } from "./commands/test";
import { syncGlobalCache } from "./global-cache";

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
 * semo-core 등 원격 버전 가져오기 (semo-system/ 하위 경로)
 */
async function getRemoteCoreVersion(type: "semo-core" | "semo-agents" | "semo-scripts"): Promise<string | null> {
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

    // 2. semo-core 버전 비교
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

    // 레거시 환경 경고 (루트에 semo-core가 있는 경우)
    const hasLegacyCore = fs.existsSync(path.join(cwd, "semo-core"));
    if (hasLegacyCore) {
      spinner.warn("레거시 환경 감지됨");
      console.log(chalk.yellow("\n  ⚠️  구버전 SEMO 구조가 감지되었습니다."));
      console.log(chalk.gray("     루트에 semo-core/가 있습니다."));
      console.log(chalk.cyan("\n  💡 마이그레이션 방법:"));
      console.log(chalk.gray("     1. 기존 semo-core/ 폴더 삭제"));
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

    // semo-skills 제거됨 — 중앙 DB 단일 SoT

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
 * 레거시: 프로젝트 루트에 semo-core/ 가 직접 있는 경우
 * 신규: semo-system/ 하위에 있는 경우
 */
function detectLegacyEnvironment(cwd: string): LegacyDetectionResult {
  const legacyPaths: string[] = [];

  // 루트에 직접 있는 레거시 디렉토리 확인
  const legacyDirs = ["semo-core", "sax-core", "sax-skills"];
  for (const dir of legacyDirs) {
    const dirPath = path.join(cwd, dir);
    if (fs.existsSync(dirPath) && !fs.lstatSync(dirPath).isSymbolicLink()) {
      legacyPaths.push(dir);
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
    console.log(chalk.gray("   1. 기존 레거시 폴더 삭제"));
    console.log(chalk.gray("   2. .claude/ 폴더 삭제"));
    console.log(chalk.gray("   3. semo init 다시 실행\n"));
    return false;
  }

  const spinner = ora("레거시 환경 마이그레이션 중...").start();

  try {
    // 1. 루트의 레거시 디렉토리 삭제
    const legacyDirs = ["semo-core", "sax-core", "sax-skills"];
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

    // 3. 기존 semo-system이 완전히 레거시인 경우에만 삭제
    // (Standard 패키지가 없는 경우)
    const semoSystemDir = path.join(cwd, "semo-system");
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

// === 글로벌 설정 체크 ===
function isGlobalSetupDone(): boolean {
  const home = os.homedir();
  return (
    fs.existsSync(path.join(home, ".semo.env")) &&
    fs.existsSync(path.join(home, ".claude", "skills"))
  );
}

// === onboarding 명령어 (글로벌 1회 설정) ===
program
  .command("onboarding")
  .description("글로벌 SEMO 설정 (머신당 1회) — ~/.claude/, ~/.semo.env")
  .option("--credentials-gist <gistId>", "Private GitHub Gist에서 DB 접속정보 가져오기")
  .option("-f, --force", "기존 설정 덮어쓰기")
  .option("--skip-mcp", "MCP 설정 생략")
  .action(async (options) => {
    console.log(chalk.cyan.bold("\n🏠 SEMO 글로벌 온보딩\n"));
    console.log(chalk.gray("  대상: ~/.claude/, ~/.semo.env (머신당 1회)\n"));

    // 1. ~/.semo.env DB 접속 설정
    await setupSemoEnv(options.credentialsGist, options.force);

    // 2. DB health check
    const spinner = ora("DB 연결 확인 중...").start();
    const connected = await isDbConnected();
    if (connected) {
      spinner.succeed("DB 연결 확인됨");
    } else {
      spinner.warn("DB 연결 실패 — 스킬/커맨드/에이전트 설치를 건너뜁니다");
      console.log(chalk.gray("  ~/.semo.env를 확인하고 다시 시도하세요: semo onboarding\n"));
      await closeConnection();
      return;
    }

    // 3. Standard 설치 (DB → ~/.claude/skills, commands, agents)
    await setupStandardGlobal();

    // 4. Hooks 설치 (프로젝트 무관)
    await setupHooks(false);

    // 5. MCP 설정 (글로벌 공통 서버)
    if (!options.skipMcp) {
      await setupMCP(os.homedir(), [], options.force || false);
    }

    // 6. 글로벌 CLAUDE.md에 KB-First 규칙 주입
    await injectKbFirstToGlobalClaudeMd();

    await closeConnection();

    // 결과 요약
    console.log(chalk.green.bold("\n✅ SEMO 글로벌 온보딩 완료!\n"));

    console.log(chalk.cyan("설치된 구성:"));
    console.log(chalk.gray("  ~/.semo.env              DB 접속정보 (권한 600)"));
    console.log(chalk.gray("  ~/.claude/skills/        팀 스킬 (DB 기반)"));
    console.log(chalk.gray("  ~/.claude/commands/      팀 커맨드 (DB 기반)"));
    console.log(chalk.gray("  ~/.claude/agents/        팀 에이전트 (DB 기반, dedup)"));
    console.log(chalk.gray("  ~/.claude/settings.local.json  SessionStart/Stop 훅"));
    console.log(chalk.gray("  ~/.claude/settings.json  Claude Code 설정 (유저레벨)"));

    console.log(chalk.cyan("\n다음 단계:"));
    console.log(chalk.gray("  프로젝트 디렉토리에서 'semo init'을 실행하세요."));
    console.log();
  });

// === init 명령어 (프로젝트별 설정) ===
program
  .command("init")
  .description("현재 프로젝트에 SEMO 프로젝트 설정을 합니다 (글로벌: semo onboarding)")
  .option("-f, --force", "기존 설정 덮어쓰기")
  .option("--no-gitignore", ".gitignore 수정 생략")
  .action(async (options) => {
    console.log(chalk.cyan.bold("\n📁 SEMO 프로젝트 설정\n"));

    const cwd = process.cwd();

    // 0. 글로벌 설정 확인
    if (!isGlobalSetupDone()) {
      console.log(chalk.yellow("⚠ 글로벌 설정이 완료되지 않았습니다."));
      console.log(chalk.gray("  먼저 'semo onboarding'을 실행하세요.\n"));
      console.log(chalk.gray("  이 머신에서 처음 SEMO를 사용하시나요?"));
      console.log(chalk.cyan("  → semo onboarding --credentials-gist <GIST_ID>\n"));
      process.exit(1);
    }

    // 1. Git 레포지토리 확인
    const spinner = ora("Git 레포지토리 확인 중...").start();
    try {
      execSync("git rev-parse --git-dir", { cwd, stdio: "pipe" });
      spinner.succeed("Git 레포지토리 확인됨");
    } catch {
      spinner.fail("Git 레포지토리가 아닙니다. 'git init'을 먼저 실행하세요.");
      process.exit(1);
    }

    // 2. .claude 디렉토리 생성
    const claudeDir = path.join(cwd, ".claude");
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
      console.log(chalk.green("\n✓ .claude/ 디렉토리 생성됨"));
    }

    // 3. 로컬 스킬 경고 (기존 프로젝트 호환)
    const localSkillsDir = path.join(claudeDir, "skills");
    if (fs.existsSync(localSkillsDir)) {
      try {
        const localSkills = fs.readdirSync(localSkillsDir).filter(f =>
          fs.statSync(path.join(localSkillsDir, f)).isDirectory()
        );
        if (localSkills.length > 0) {
          console.log(chalk.yellow(`\nℹ 프로젝트 로컬 스킬이 감지되었습니다 (${localSkills.length}개).`));
          console.log(chalk.gray("  글로벌 스킬(~/.claude/skills/)이 우선 적용됩니다."));
          console.log(chalk.gray("  로컬 스킬을 제거하려면: rm -rf .claude/skills/ .claude/commands/ .claude/agents/\n"));
        }
      } catch {
        // ignore
      }
    }

    // 4. Context Mesh 초기화
    await setupContextMesh(cwd);

    // 5. CLAUDE.md 생성 (프로젝트 규칙만, 스킬 목록 없음)
    await setupClaudeMd(cwd, [], options.force || false);

    // 6. .gitignore 업데이트
    if (options.gitignore !== false) {
      updateGitignore(cwd);
    }

    // 완료 메시지
    console.log(chalk.green.bold("\n✅ SEMO 프로젝트 설정 완료!\n"));

    console.log(chalk.cyan("생성된 파일:"));
    console.log(chalk.gray("  {cwd}/.claude/CLAUDE.md          프로젝트 규칙"));
    console.log(chalk.gray("  {cwd}/.claude/memory/context.md   프로젝트 상태"));
    console.log(chalk.gray("  {cwd}/.claude/memory/decisions.md ADR"));
    console.log(chalk.gray("  {cwd}/.claude/memory/projects.md  프로젝트 맵"));

    console.log(chalk.cyan("\n다음 단계:"));
    console.log(chalk.gray("  1. Claude Code에서 프로젝트 열기 (SessionStart 훅이 자동 sync)"));
    console.log(chalk.gray("  2. 자연어로 요청하기 (예: \"댓글 기능 구현해줘\")"));
    console.log(chalk.gray("  3. /SEMO:help로 도움말 확인"));
    console.log();
  });

// === Standard 설치 (DB 기반, 글로벌 ~/.claude/) ===
async function setupStandardGlobal() {
  console.log(chalk.cyan("\n📚 Standard 설치 (DB → ~/.claude/)"));
  console.log(chalk.gray("   스킬/커맨드/에이전트를 글로벌에 설치\n"));

  const spinner = ora("DB에서 스킬/커맨드/에이전트 조회 중...").start();

  try {
    const connected = await isDbConnected();
    if (connected) {
      spinner.text = "DB 연결 성공, 데이터 조회 중...";
    } else {
      spinner.text = "DB 연결 실패, 폴백 데이터 사용 중...";
    }

    const result = await syncGlobalCache();

    console.log(chalk.green(`  ✓ skills 설치 완료 (${result.skills}개)`));
    console.log(chalk.green(`  ✓ commands 설치 완료 (${result.commands}개)`));
    console.log(chalk.green(`  ✓ agents 설치 완료 (${result.agents}개)`));

    spinner.succeed("Standard 설치 완료 (DB → ~/.claude/)");
  } catch (error) {
    spinner.fail("Standard 설치 실패");
    console.error(chalk.red(`   ${error}`));
  }
}

// (generateClaudeMd removed — setupClaudeMd handles project CLAUDE.md generation)

// === Standard 심볼릭 링크 (레거시 호환) ===
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

  // skills — 중앙 DB 단일 SoT (semo-skills 파일시스템 제거됨)
  const claudeSkillsDir = path.join(claudeDir, "skills");
  fs.mkdirSync(claudeSkillsDir, { recursive: true });

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

  // SEMO-workflow 커맨드 링크 (워크플로우 커맨드)
  const workflowCommandsLink = path.join(commandsDir, "SEMO-workflow");
  const workflowCommandsTarget = path.join(semoSystemDir, "semo-core", "commands", "SEMO-workflow");

  if (fs.existsSync(workflowCommandsLink)) {
    if (fs.lstatSync(workflowCommandsLink).isSymbolicLink()) {
      fs.unlinkSync(workflowCommandsLink);
    } else {
      removeRecursive(workflowCommandsLink);
    }
  }

  if (fs.existsSync(workflowCommandsTarget)) {
    createSymlinkOrJunction(workflowCommandsTarget, workflowCommandsLink);
    console.log(chalk.green("  ✓ .claude/commands/SEMO-workflow → semo-system/semo-core/commands/SEMO-workflow"));
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
 * v3.14.0: DB 기반 설치 지원 (semo-system 없이도 검증 가능)
 */
function verifyInstallation(cwd: string, installedExtensions: string[] = []): VerificationResult {
  const claudeDir = path.join(cwd, ".claude");
  const semoSystemDir = path.join(cwd, "semo-system");
  const hasSemoSystem = fs.existsSync(semoSystemDir);

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

  // v3.14.0: DB 기반 설치 시 semo-system이 없어도 됨
  // .claude/ 디렉토리가 있으면 DB 기반으로 설치된 것으로 간주
  if (!hasSemoSystem && !fs.existsSync(claudeDir)) {
    result.errors.push(".claude 디렉토리가 없습니다");
    result.success = false;
    return result;
  }

  // DB 기반 설치 검증 (semo-system 없음)
  if (!hasSemoSystem) {
    // agents 검증 (실제 파일 존재 여부)
    const claudeAgentsDir = path.join(claudeDir, "agents");
    if (fs.existsSync(claudeAgentsDir)) {
      const agents = fs.readdirSync(claudeAgentsDir).filter(f => {
        const p = path.join(claudeAgentsDir, f);
        return fs.existsSync(p) && fs.statSync(p).isDirectory();
      });
      result.stats.agents.expected = agents.length;
      result.stats.agents.linked = agents.length;  // DB 기반이므로 실제 파일
    }

    // skills 검증 (실제 파일 존재 여부)
    const claudeSkillsDir = path.join(claudeDir, "skills");
    if (fs.existsSync(claudeSkillsDir)) {
      const skills = fs.readdirSync(claudeSkillsDir).filter(f => {
        const p = path.join(claudeSkillsDir, f);
        return fs.existsSync(p) && fs.statSync(p).isDirectory();
      });
      result.stats.skills.expected = skills.length;
      result.stats.skills.linked = skills.length;  // DB 기반이므로 실제 파일
    }

    // commands 검증 (실제 폴더 존재 여부)
    const semoCommandsDir = path.join(claudeDir, "commands", "SEMO");
    result.stats.commands.exists = fs.existsSync(semoCommandsDir);
    result.stats.commands.valid = result.stats.commands.exists;

    return result;
  }

  // === 레거시: semo-system 기반 설치 검증 ===
  const coreDir = path.join(semoSystemDir, "semo-core");

  if (!fs.existsSync(coreDir)) {
    result.errors.push("semo-core가 설치되지 않았습니다");
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
        try {
          if (fs.existsSync(linkPath) || fs.lstatSync(linkPath).isSymbolicLink()) {
            if (isSymlinkValid(linkPath)) {
              result.stats.agents.linked++;
            } else {
              result.stats.agents.broken++;
              result.warnings.push(`깨진 링크: .claude/agents/${agent}`);
            }
          }
        } catch {
          // path doesn't exist at all — skip
        }
      }
    }
  }

  // 3. skills — 중앙 DB 단일 SoT (파일시스템 검증 불필요)

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

// === MCP 서버 정의 ===
interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  scope?: "user" | "project";
}

const BASE_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: "context7",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
    scope: "user",
  },
  {
    name: "sequential-thinking",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    scope: "user",
  },
  {
    name: "playwright",
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-playwright"],
    scope: "user",
  },
  {
    name: "github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    scope: "user",
  },
];

// === ~/.semo.env 설정 (자동 감지 → Gist → 프롬프트) ===

interface CredentialDef {
  key: string;
  required: boolean;
  sensitive: boolean;
  description: string;
  promptMessage: string;
}

const SEMO_CREDENTIALS: CredentialDef[] = [
  {
    key: "DATABASE_URL",
    required: true,
    sensitive: true,
    description: "팀 코어 PostgreSQL 연결 URL",
    promptMessage: "DATABASE_URL:",
  },
  {
    key: "OPENAI_API_KEY",
    required: false,
    sensitive: true,
    description: "OpenAI API 키 (KB 임베딩용)",
    promptMessage: "OPENAI_API_KEY (없으면 Enter):",
  },
  {
    key: "SLACK_WEBHOOK",
    required: false,
    sensitive: false,
    description: "Slack 알림 Webhook (선택)",
    promptMessage: "SLACK_WEBHOOK (없으면 Enter):",
  },
];

function writeSemoEnvFile(creds: Record<string, string>): void {
  const envFile = path.join(os.homedir(), ".semo.env");
  const lines = [
    "# SEMO 환경변수 — 모든 컨텍스트에서 자동 로드됨",
    "# (Claude Code 앱, OpenClaw LaunchAgent, cron 등)",
    "",
  ];
  // 레지스트리 키 먼저 (순서 보장)
  for (const def of SEMO_CREDENTIALS) {
    const val = creds[def.key] || "";
    lines.push(`# ${def.description}`);
    lines.push(`${def.key}='${val}'`);
    lines.push("");
  }
  // 레지스트리 외 추가 키
  for (const [k, v] of Object.entries(creds)) {
    if (!SEMO_CREDENTIALS.some((d) => d.key === k)) {
      lines.push(`${k}='${v}'`);
    }
  }
  lines.push("");
  fs.writeFileSync(envFile, lines.join("\n"), { mode: 0o600 });
}

function readSemoEnvCreds(): Record<string, string> {
  const envFile = path.join(os.homedir(), ".semo.env");
  if (!fs.existsSync(envFile)) return {};
  try {
    return parseEnvContent(fs.readFileSync(envFile, "utf-8"));
  } catch {
    return {};
  }
}

function fetchCredsFromGist(
  gistId: string,
): Record<string, string> | null {
  try {
    const raw = execSync(`gh gist view ${gistId} --raw`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 8000,
    });
    const creds = parseEnvContent(raw);
    return Object.keys(creds).length > 0 ? creds : null;
  } catch {
    return null;
  }
}

async function setupSemoEnv(
  credentialsGist?: string,
  force?: boolean,
): Promise<void> {
  console.log(chalk.cyan("\n🔑 환경변수 설정"));

  // 1. 기존 파일
  const existing = force ? {} : readSemoEnvCreds();

  // 2. Gist
  const gistId = credentialsGist || process.env.SEMO_CREDENTIALS_GIST;
  let gistCreds: Record<string, string> = {};
  if (gistId) {
    console.log(
      chalk.gray("  GitHub Gist에서 팀 접속정보 가져오는 중..."),
    );
    gistCreds = fetchCredsFromGist(gistId) || {};
  }

  // 3. 머지: gist(base) ← file(override) ← env(override)
  const merged: Record<string, string> = { ...gistCreds };
  for (const [k, v] of Object.entries(existing)) {
    if (v) merged[k] = v;
  }
  for (const def of SEMO_CREDENTIALS) {
    if (process.env[def.key]) merged[def.key] = process.env[def.key]!;
  }

  // 4. required인데 없는 키만 프롬프트
  let hasNewKeys = false;
  for (const def of SEMO_CREDENTIALS) {
    if (merged[def.key]) {
      const label = def.sensitive ? "(설정됨)" : merged[def.key];
      console.log(chalk.green(`  ✅ ${def.key} ${label}`));
    } else if (def.required) {
      const { value } = await inquirer.prompt<{ value: string }>([
        {
          type: "password",
          name: "value",
          message: def.promptMessage,
          mask: "*",
        },
      ]);
      if (value?.trim()) {
        merged[def.key] = value.trim();
        hasNewKeys = true;
      }
    } else {
      console.log(chalk.gray(`  ⏭  ${def.key} (없음 — 선택사항)`));
    }
  }

  // 5. 변경사항이 있거나 파일이 없으면 쓰기
  const envFile = path.join(os.homedir(), ".semo.env");
  const needsWrite =
    force ||
    hasNewKeys ||
    !fs.existsSync(envFile) ||
    Object.keys(gistCreds).some((k) => !existing[k]);

  if (needsWrite) {
    writeSemoEnvFile(merged);
    console.log(chalk.green("  ✅ ~/.semo.env 저장됨 (권한: 600)"));
  } else {
    console.log(chalk.gray("  ~/.semo.env 변경 없음"));
  }
}

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

    // scope 지정 (기본: project)
    const scope = server.scope || "project";
    args.push("-s", scope);

    // -- 구분자 후 명령어와 인자 추가
    args.push("--", server.command, ...server.args);

    execSync(`claude ${args.join(" ")}`, { stdio: "pipe" });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// === 글로벌 CLAUDE.md에 KB-First 규칙 주입 ===
const KB_FIRST_SECTION_MARKER = "## SEMO KB-First 행동 규칙";

async function buildKbFirstBlock(): Promise<string> {
  // DB에서 온톨로지 + 타입스키마를 조회해서 동적 생성
  let domainGuide = "";
  try {
    const pool = getPool();

    // 1. 타입스키마: 타입별 scheme_key 목록
    const schemaRows = await pool.query(
      `SELECT type_key, scheme_key, required, scheme_description
       FROM semo.kb_type_schema ORDER BY type_key, sort_order, scheme_key`
    );
    const typeSchemas = new Map<string, { scheme_key: string; required: boolean; desc: string }[]>();
    for (const r of schemaRows.rows) {
      const entries = typeSchemas.get(r.type_key) || [];
      entries.push({ scheme_key: r.scheme_key, required: r.required, desc: r.scheme_description || "" });
      typeSchemas.set(r.type_key, entries);
    }

    // 2. 온톨로지: 엔티티 타입별 도메인 목록
    const ontoRows = await pool.query(
      `SELECT entity_type, domain, description FROM semo.ontology ORDER BY entity_type, domain`
    );
    const entities = new Map<string, { domain: string; desc: string }[]>();
    for (const r of ontoRows.rows) {
      const list = entities.get(r.entity_type) || [];
      list.push({ domain: r.domain, desc: r.description || "" });
      entities.set(r.entity_type, list);
    }

    // 3. 도메인 가이드 생성
    const orgDomains = entities.get("organization") || [];
    const svcDomains = entities.get("service") || [];
    const orgSchema = typeSchemas.get("organization") || [];
    const svcSchema = typeSchemas.get("service") || [];

    domainGuide += "#### 도메인 구조\n";
    domainGuide += "| 패턴 | 예시 | 용도 |\n|------|------|------|\n";
    if (orgDomains.length > 0) {
      const orgEx = orgDomains.map(o => o.domain).join(", ");
      const orgKeys = orgSchema.filter(s => !s.scheme_key.includes("{")).map(s => s.scheme_key).join(", ");
      domainGuide += `| 조직 도메인 | \`${orgEx}\` | ${orgKeys} 등 조직 정보 |\n`;
    }
    if (svcDomains.length > 0) {
      const svcEx = svcDomains.slice(0, 5).map(s => s.domain).join(", ");
      const svcKeys = svcSchema.filter(s => !s.scheme_key.includes("{")).map(s => s.scheme_key).join(", ");
      domainGuide += `| 서비스 도메인 | \`${svcEx}\` 등 ${svcDomains.length}개 | ${svcKeys} 등 서비스 정보 |\n`;
    }

    domainGuide += "\n#### 읽기 예시 (Query-First)\n";
    domainGuide += "다음 주제 질문 → **반드시 `semo kb search`/`semo kb get`으로 KB 먼저 조회** 후 답변:\n";
    // 조직 도메인 키 가이드
    for (const s of orgSchema) {
      if (s.scheme_key.includes("{")) {
        const label = s.desc || s.scheme_key;
        domainGuide += `- ${label} → \`domain: ${orgDomains[0]?.domain || "semicolon"}\`, key: \`${s.scheme_key}\`\n`;
      }
    }
    // 서비스 도메인 키 가이드
    for (const s of svcSchema.filter(s => s.required && !s.scheme_key.includes("{"))) {
      const label = s.desc || s.scheme_key;
      domainGuide += `- 서비스 ${label} → \`domain: {서비스명}\`, key: \`${s.scheme_key}\`\n`;
    }
    domainGuide += `- 서비스 KPI → \`domain: {서비스명}\`, key: \`kpi/current\`\n`;
    domainGuide += `- 서비스 마일스톤 → \`domain: {서비스명}\`, key: \`milestone/{slug}\`\n`;

  } catch {
    // DB 연결 실패 시 최소한의 가이드
    domainGuide = `### 읽기 (Query-First)
다음 주제 질문 → **반드시 \`semo kb search\`/\`semo kb get\`으로 KB 먼저 조회** 후 답변.
도메인/키 구조는 \`semo kb ontology --action list\`로 확인 가능.
`;
  }

  return `
${KB_FIRST_SECTION_MARKER}

> semo CLI의 kb-manager 스킬을 통해 KB에 접근합니다. KB는 팀의 Single Source of Truth입니다.
> 도메인/키 구조가 변경될 수 있으므로 \`semo kb ontology --action list\`로 최신 구조를 확인하세요.

${domainGuide}
**금지:** 위 주제를 자체 지식/세션 기억만으로 답변하는 것.
KB에 없으면: "KB에 해당 정보가 없습니다. 알려주시면 등록하겠습니다."

### 쓰기 (Write-Back)
사용자가 팀 정보를 정정/추가/변경하면, 의사결정이 내려지면 → **반드시 \`semo kb upsert\`로 KB에 즉시 기록.**
**금지:** "알겠습니다/기억하겠습니다"만 하고 KB에 쓰지 않는 것.
`;
}

async function injectKbFirstToGlobalClaudeMd() {
  const globalClaudeMd = path.join(os.homedir(), ".claude", "CLAUDE.md");
  const kbFirstBlock = await buildKbFirstBlock();

  if (fs.existsSync(globalClaudeMd)) {
    const content = fs.readFileSync(globalClaudeMd, "utf-8");
    if (content.includes(KB_FIRST_SECTION_MARKER)) {
      // 기존 섹션 교체
      const regex = new RegExp(
        `\\n${KB_FIRST_SECTION_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?(?=\\n## |$)`,
        "m"
      );
      const updated = content.replace(regex, kbFirstBlock);
      fs.writeFileSync(globalClaudeMd, updated);
      console.log(chalk.gray("  ~/.claude/CLAUDE.md KB-First 규칙 업데이트됨"));
    } else {
      // 끝에 추가
      fs.writeFileSync(globalClaudeMd, content.trimEnd() + "\n" + kbFirstBlock);
      console.log(chalk.green("  ✓ ~/.claude/CLAUDE.md에 KB-First 규칙 추가됨"));
    }
  } else {
    // 파일 없으면 생성
    fs.writeFileSync(globalClaudeMd, kbFirstBlock.trim() + "\n");
    console.log(chalk.green("  ✓ ~/.claude/CLAUDE.md 생성됨 (KB-First 규칙)"));
  }
}


// === MCP 설정 ===
async function setupMCP(cwd: string, _extensions: string[], force: boolean) {
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

  // 공통 서버(context7 등)는 유저레벨에 등록하므로 프로젝트 settings에 쓰지 않음

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log(chalk.green("✓ .claude/settings.json 생성됨"));

  // Claude Code에 MCP 서버 등록 시도 (공통 서버는 유저레벨로)
  console.log(chalk.cyan("\n🔌 Claude Code에 MCP 서버 등록 중..."));

  const allServers: MCPServerConfig[] = [...BASE_MCP_SERVERS];
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
    let content = fs.readFileSync(gitignorePath, "utf-8");

    // 이미 SEMO 블록이 있으면 스킵
    if (content.includes("# === SEMO ===")) {
      console.log(chalk.gray("  → SEMO 블록 이미 존재 (건너뜀)"));
      return;
    }

    // 기존에 .claude/ 또는 .claude 전체 무시 항목 제거 (memory/ 접근을 위해)
    const lines = content.split("\n");
    const filtered = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed !== ".claude" && trimmed !== ".claude/" && trimmed !== ".claude/**";
    });
    if (filtered.length !== lines.length) {
      content = filtered.join("\n");
      console.log(chalk.gray("  → 기존 .claude 무시 항목 제거됨 (memory/ 접근 허용)"));
    }

    // 기존 파일에 추가
    fs.writeFileSync(gitignorePath, content + semoIgnoreBlock);
    console.log(chalk.green("✓ .gitignore에 SEMO 규칙 추가됨"));
  } else {
    // 새로 생성
    fs.writeFileSync(gitignorePath, semoIgnoreBlock.trim() + "\n");
    console.log(chalk.green("✓ .gitignore 생성됨 (SEMO 규칙 포함)"));
  }
}

// === Hooks 설치/업데이트 ===
async function setupHooks(isUpdate: boolean = false) {
  const action = isUpdate ? "업데이트" : "설치";
  console.log(chalk.cyan(`\n🪝 Claude Code Hooks ${action}`));
  console.log(chalk.gray("   semo CLI 기반 컨텍스트 동기화\n"));

  const homeDir = os.homedir();
  const settingsPath = path.join(homeDir, ".claude", "settings.local.json");

  // hooks 설정 객체 — semo CLI만 사용 (프로젝트 경로 무관)
  const hooksConfig = {
    SessionStart: [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: ". ~/.semo.env 2>/dev/null; semo context sync 2>/dev/null || true",
            timeout: 30,
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
            command: ". ~/.semo.env 2>/dev/null; semo context push 2>/dev/null || true",
            timeout: 30,
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

// === CLAUDE.md 생성 ===
async function setupClaudeMd(cwd: string, _extensions: string[], force: boolean) {
  console.log(chalk.cyan("\n📄 CLAUDE.md 설정"));

  const claudeMdPath = path.join(cwd, ".claude", "CLAUDE.md");

  if (fs.existsSync(claudeMdPath) && !force) {
    const shouldOverwrite = await confirmOverwrite("CLAUDE.md", claudeMdPath);
    if (!shouldOverwrite) {
      console.log(chalk.gray("  → CLAUDE.md 건너뜀"));
      return;
    }
  }

  // KB-First 섹션을 DB에서 동적 생성
  const kbFirstFull = await buildKbFirstBlock();
  // 프로젝트용: "## SEMO KB-First 행동 규칙" → "## KB-First 행동 규칙 (NON-NEGOTIABLE)"
  const kbFirstSection = kbFirstFull
    .replace(KB_FIRST_SECTION_MARKER, "## KB-First 행동 규칙 (NON-NEGOTIABLE)")
    .replace(/> semo CLI의 kb-manager 스킬을 통해.*\n/, "> KB는 팀의 Single Source of Truth이다. 아래 규칙은 예외 없이 적용된다.\n")
    .trim();

  // 프로젝트 규칙만 (스킬/에이전트 목록은 글로벌 ~/.claude/에 있음)
  const claudeMdContent = `# SEMO Project Configuration

> SEMO (Semicolon Orchestrate) - AI Agent Orchestration Framework v${VERSION}
> 스킬/에이전트/커맨드는 글로벌(~/.claude/)에서 로드됩니다.

---

## KB 접근 (semo CLI)

KB 데이터는 **semo CLI** (\`kb-manager\` 스킬)를 통해 Core DB에서 조회합니다.

| 명령어 | 설명 |
|--------|------|
| \`semo kb search "쿼리"\` | 벡터+텍스트 하이브리드 검색 |
| \`semo kb get <domain> <key> [sub_key]\` | domain+key 정확 조회 |
| \`semo kb list --domain <domain>\` | 도메인별 엔트리 목록 |
| \`semo kb upsert <domain> <key> [sub_key] --content "내용"\` | KB 항목 쓰기 |
| \`semo kb ontology --action <action>\` | 온톨로지 조회 |

---

${kbFirstSection}

---

## Pre-Commit Quality Gate

> **코드 변경이 포함된 커밋 전 반드시 Quality Gate를 통과해야 합니다.**

\`\`\`bash
npm run lint           # ESLint 검사
npx tsc --noEmit       # TypeScript 타입 체크
npm run build          # 빌드 검증
\`\`\`

\`--no-verify\` 플래그 사용 금지.

---

## 환경변수 (\`~/.semo.env\`)

SEMO는 \`~/.semo.env\` 파일에서 팀 공통 환경변수를 로드합니다.
SessionStart 훅과 OpenClaw 게이트웨이 래퍼에서 자동 source됩니다.

| 변수 | 용도 | 필수 |
|------|------|------|
| \`DATABASE_URL\` | 팀 Core DB (PostgreSQL) 연결 | ✅ |
| \`OPENAI_API_KEY\` | KB 임베딩용 (text-embedding-3-small) | 선택 |
| \`SLACK_WEBHOOK\` | Slack 알림 | 선택 |

키 갱신이 필요하면 \`~/.semo.env\`를 직접 편집하거나 \`semo onboarding -f\`를 실행하세요.

---

> Generated by SEMO CLI v${VERSION}
`;

  fs.writeFileSync(claudeMdPath, claudeMdContent);
  console.log(chalk.green("✓ .claude/CLAUDE.md 생성됨"));
}

// === list 명령어 ===
program
  .command("list")
  .description("설치된 SEMO 패키지 상태를 표시합니다")
  .action(async () => {
    const cwd = process.cwd();
    const semoSystemDir = path.join(cwd, "semo-system");

    console.log(chalk.cyan.bold("\n📦 SEMO 패키지 목록\n"));

    // Standard 패키지 표시
    console.log(chalk.white.bold("Standard (필수)"));
    const standardPkgs = ["semo-core", "semo-agents", "semo-scripts"];
    for (const pkg of standardPkgs) {
      const isInstalled = fs.existsSync(path.join(semoSystemDir, pkg));
      console.log(`  ${isInstalled ? chalk.green("✓") : chalk.gray("○")} ${pkg}`);
    }
    console.log();

    // DB 패키지 목록 (DB 연결 가능 시)
    try {
      const packages = await getPackages();
      if (packages.length > 0) {
        console.log(chalk.white.bold("DB 패키지"));
        for (const pkg of packages) {
          console.log(`  ${chalk.cyan(pkg.name)} - ${pkg.description || ""}`);
        }
        console.log();
      }
    } catch {
      // DB 연결 실패 시 무시
    }
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
    ];

    let standardOk = true;
    for (const check of standardChecks) {
      const exists = fs.existsSync(check.path);
      console.log(`  ${exists ? chalk.green("✓") : chalk.red("✗")} ${check.name}`);
      if (!exists) standardOk = false;
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
  .option("--global", "글로벌 스킬/커맨드/에이전트를 DB 최신으로 갱신 (~/.claude/)")
  .option("--system", "semo-system만 업데이트")
  .option("--skip-cli", "CLI 업데이트 건너뛰기")
  .option("--only <packages>", "특정 패키지만 업데이트 (쉼표 구분: semo-core,biz/management)")
  .option("--migrate", "레거시 환경 강제 마이그레이션")
  .action(async (options) => {
    // === --global: 글로벌 스킬 갱신 ===
    if (options.global) {
      console.log(chalk.cyan.bold("\n🔄 SEMO 글로벌 업데이트\n"));
      console.log(chalk.gray("  대상: ~/.claude/skills, commands, agents (DB 최신)\n"));

      const connected = await isDbConnected();
      if (!connected) {
        console.log(chalk.red("  DB 연결 실패 — ~/.semo.env를 확인하세요."));
        await closeConnection();
        process.exit(1);
      }

      await setupStandardGlobal();
      await closeConnection();

      console.log(chalk.green.bold("\n✅ 글로벌 스킬 업데이트 완료!\n"));
      return;
    }

    console.log(chalk.cyan.bold("\n🔄 SEMO 업데이트\n"));

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

    // 업데이트 대상 결정
    const updateSemoCore = !isSelectiveUpdate || onlyPackages.includes("semo-core");
    const updateSemoAgents = !isSelectiveUpdate || onlyPackages.includes("semo-agents");
    const updateSemoScripts = !isSelectiveUpdate || onlyPackages.includes("semo-scripts");

    console.log(chalk.cyan("\n📚 semo-system 업데이트"));
    console.log(chalk.gray("  대상:"));
    if (updateSemoCore) console.log(chalk.gray("    - semo-core"));
    if (updateSemoAgents) console.log(chalk.gray("    - semo-agents"));
    if (updateSemoScripts) console.log(chalk.gray("    - semo-scripts"));

    if (!updateSemoCore && !updateSemoAgents && !updateSemoScripts) {
      console.log(chalk.yellow("\n  ⚠️ 업데이트할 패키지가 없습니다."));
      console.log(chalk.gray("     설치된 패키지: semo-core, semo-agents, semo-scripts"));
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

    // === 4. CLAUDE.md 재생성 ===
    console.log(chalk.cyan("\n📄 CLAUDE.md 재생성"));
    await setupClaudeMd(cwd, [], true);

    // === 5. MCP 서버 동기화 ===
    console.log(chalk.cyan("\n🔧 MCP 서버 동기화"));

    // MCP 서버 등록 상태 확인
    const allServers: MCPServerConfig[] = [...BASE_MCP_SERVERS];
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
    await setupHooks(true);

    // === 7. 설치 검증 ===
    const verificationResult = verifyInstallation(cwd, []);
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

// === config 명령어 (설치 후 설정 변경) ===
const configCmd = program.command("config").description("SEMO 설정 관리");

configCmd
  .command("env")
  .description("SEMO 환경변수 설정 (DATABASE_URL, OPENAI_API_KEY 등)")
  .option("--credentials-gist <gistId>", "Private GitHub Gist에서 자동 가져오기")
  .option("--force", "기존 값도 Gist에서 덮어쓰기")
  .action(async (options) => {
    console.log(chalk.cyan.bold("\n🔑 SEMO 환경변수 설정\n"));

    const existing = readSemoEnvCreds();
    const hasExisting = Object.keys(existing).length > 0;

    if (hasExisting && !options.force) {
      const keys = Object.keys(existing).join(", ");
      const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
        {
          type: "confirm",
          name: "overwrite",
          message: `기존 설정이 있습니다 (${keys}). Gist에서 없는 키를 보충하시겠습니까?`,
          default: true,
        },
      ]);
      if (!overwrite) {
        console.log(chalk.gray("취소됨"));
        return;
      }
    }

    await setupSemoEnv(options.credentialsGist, options.force);
    console.log(chalk.gray("  다음 Claude Code 세션부터 자동으로 적용됩니다."));
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
      const packages = ["semo-core", "semo-agents", "semo-scripts"];
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

// === KB (Knowledge Base) 관리 ===
import {
  kbPull,
  kbPush,
  kbStatus,
  kbList,
  kbSearch,
  kbGet,
  kbUpsert,
  ontoList,
  ontoShow,
  ontoValidate,
  ontoPullToLocal,
  ontoListTypes,
  ontoListSchema,
  ontoRoutingTable,
  ontoListServices,
  ontoListInstances,
  generateEmbedding,
  KBEntry,
} from "./kb";

// Re-implement readSyncState locally (simple file read)
function readSyncState(cwd: string): { lastPull: string | null; lastPush: string | null; sharedCount: number } {
  const statePath = path.join(cwd, ".kb", ".sync-state.json");
  if (fs.existsSync(statePath)) {
    try { return JSON.parse(fs.readFileSync(statePath, "utf-8")); } catch { /* */ }
  }
  return { lastPull: null, lastPush: null, sharedCount: 0 };
}

const kbCmd = program
  .command("kb")
  .description("KB(Knowledge Base) 관리 — SEMO DB 기반 지식 저장소");

kbCmd
  .command("pull")
  .description("DB에서 KB를 로컬 .kb/로 내려받기")
  .option("--domain <name>", "특정 도메인만")
  .action(async (options) => {
    const spinner = ora("KB 데이터 가져오는 중...").start();
    try {
      const pool = getPool();
      const result = await kbPull(pool, options.domain, process.cwd());
      spinner.succeed(`KB pull 완료`);
      console.log(chalk.green(`  📦 KB: ${result.length}건`));

      // Also pull ontology
      const ontoCount = await ontoPullToLocal(pool, process.cwd());
      console.log(chalk.green(`  📐 온톨로지: ${ontoCount}개 도메인`));

      console.log(chalk.gray(`\n  저장 위치: .kb/`));
      await closeConnection();
    } catch (err) {
      spinner.fail(`KB pull 실패: ${err}`);
      await closeConnection();
      process.exit(1);
    }
  });

kbCmd
  .command("push")
  .description("로컬 .kb/ 데이터를 DB에 업로드")
  .option("--file <path>", ".kb/ 내 특정 파일", "team.json")
  .option("--created-by <name>", "작성자 식별자")
  .action(async (options) => {
    const cwd = process.cwd();
    const kbDir = path.join(cwd, ".kb");

    if (!fs.existsSync(kbDir)) {
      console.log(chalk.red("❌ .kb/ 디렉토리가 없습니다. 먼저 semo kb pull을 실행하세요."));
      process.exit(1);
    }

    const spinner = ora("KB 데이터 업로드 중...").start();
    try {
      const pool = getPool();
      const filePath = path.join(kbDir, options.file);

      if (!fs.existsSync(filePath)) {
        spinner.fail(`파일을 찾을 수 없습니다: .kb/${options.file}`);
        process.exit(1);
      }

      const entries: KBEntry[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const result = await kbPush(pool, entries, options.createdBy, cwd);

      spinner.succeed(`KB push 완료`);
      console.log(chalk.green(`  ✅ ${result.upserted}건 업서트됨`));
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`  ⚠️ ${result.errors.length}건 오류:`));
        result.errors.forEach(e => console.log(chalk.red(`     ${e}`)));
      }
      await closeConnection();
    } catch (err) {
      spinner.fail(`KB push 실패: ${err}`);
      await closeConnection();
      process.exit(1);
    }
  });

kbCmd
  .command("status")
  .description("KB 동기화 상태 확인")
  .action(async () => {
    const spinner = ora("KB 상태 조회 중...").start();
    try {
      const pool = getPool();
      const status = await kbStatus(pool);
      spinner.stop();

      console.log(chalk.cyan.bold("\n📊 KB 상태\n"));

      console.log(chalk.white("  📦 KB (knowledge_base)"));
      console.log(chalk.gray(`     총 ${status.shared.total}건`));
      for (const [domain, count] of Object.entries(status.shared.domains)) {
        console.log(chalk.gray(`     - ${domain}: ${count}건`));
      }
      if (status.shared.lastUpdated) {
        console.log(chalk.gray(`     최종 업데이트: ${status.shared.lastUpdated}`));
      }

      // Local sync state
      const syncState = readSyncState(process.cwd());
      if (syncState.lastPull || syncState.lastPush) {
        console.log(chalk.white("\n  🔄 로컬 동기화"));
        if (syncState.lastPull) console.log(chalk.gray(`     마지막 pull: ${syncState.lastPull}`));
        if (syncState.lastPush) console.log(chalk.gray(`     마지막 push: ${syncState.lastPush}`));
      }

      console.log();
      await closeConnection();
    } catch (err) {
      spinner.fail(`상태 조회 실패: ${err}`);
      await closeConnection();
      process.exit(1);
    }
  });

kbCmd
  .command("list")
  .description("KB 항목 목록 조회")
  .option("--domain <name>", "도메인 필터")
  .option("--service <name>", "서비스(프로젝트) 필터 — 해당 서비스의 모든 도메인 항목 반환")
  .option("--limit <n>", "최대 항목 수", "50")
  .option("--format <type>", "출력 형식 (table|json)", "table")
  .action(async (options) => {
    try {
      const pool = getPool();
      const entries = await kbList(pool, {
        domain: options.domain,
        service: options.service,
        limit: parseInt(options.limit),
      });

      if (options.format === "json") {
        console.log(JSON.stringify(entries, null, 2));
      } else {
        console.log(chalk.cyan.bold("\n📋 KB 목록\n"));

        if (entries.length > 0) {
          console.log(chalk.gray("  ─────────────────────────────────────────"));
          for (const entry of entries) {
            const preview = entry.content.substring(0, 60).replace(/\n/g, " ");
            console.log(chalk.cyan(`  [${entry.domain}] `) + chalk.white(entry.key));
            console.log(chalk.gray(`    ${preview}${entry.content.length > 60 ? "..." : ""}`));
          }
        } else {
          console.log(chalk.yellow("  KB가 비어있습니다."));
        }

        console.log();
      }
      await closeConnection();
    } catch (err) {
      console.error(chalk.red(`조회 실패: ${err}`));
      await closeConnection();
      process.exit(1);
    }
  });

kbCmd
  .command("search <query>")
  .description("KB 검색 (시맨틱 + 텍스트 하이브리드)")
  .option("--domain <name>", "도메인 필터")
  .option("--service <name>", "서비스(프로젝트) 필터")
  .option("--limit <n>", "최대 결과 수", "10")
  .option("--mode <type>", "검색 모드 (hybrid|semantic|text)", "hybrid")
  .action(async (query, options) => {
    const spinner = ora(`'${query}' 검색 중...`).start();
    try {
      const pool = getPool();
      const results = await kbSearch(pool, query, {
        domain: options.domain,
        service: options.service,
        limit: parseInt(options.limit),
        mode: options.mode,
      });

      spinner.stop();

      if (results.length === 0) {
        console.log(chalk.yellow(`\n  검색 결과 없음: '${query}'`));
      } else {
        console.log(chalk.cyan.bold(`\n🔍 검색 결과: '${query}' (${results.length}건)\n`));
        for (const entry of results) {
          const preview = entry.content.substring(0, 80).replace(/\n/g, " ");
          const score = (entry as any).score;
          const scoreStr = score ? chalk.yellow(` (${(score * 100).toFixed(1)}%)`) : "";
          const fullKey = entry.sub_key ? `${entry.key}/${entry.sub_key}` : entry.key;
          console.log(chalk.cyan(`  [${entry.domain}] `) + chalk.white(fullKey) + scoreStr);
          console.log(chalk.gray(`    ${preview}${entry.content.length > 80 ? "..." : ""}`));
          console.log();
        }
      }
      await closeConnection();
    } catch (err) {
      spinner.fail(`검색 실패: ${err}`);
      await closeConnection();
      process.exit(1);
    }
  });

kbCmd
  .command("embed")
  .description("기존 KB 항목에 임베딩 벡터 생성 (OPENAI_API_KEY 필요)")
  .option("--domain <name>", "도메인 필터")
  .option("--force", "이미 임베딩된 항목도 재생성")
  .action(async (options) => {
    if (!process.env.OPENAI_API_KEY) {
      console.log(chalk.red("❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다."));
      console.log(chalk.gray("   export OPENAI_API_KEY='sk-...'"));
      process.exit(1);
    }

    const spinner = ora("임베딩 대상 조회 중...").start();
    try {
      const pool = getPool();
      const client = await pool.connect();

      let sql = "SELECT kb_id, domain, key, content FROM semo.knowledge_base WHERE 1=1";
      const params: string[] = [];
      let pIdx = 1;
      if (!options.force) sql += " AND embedding IS NULL";
      if (options.domain) { sql += ` AND domain = $${pIdx++}`; params.push(options.domain); }

      const rows = await client.query(sql, params);

      const total = rows.rows.length;
      spinner.succeed(`${total}건 임베딩 대상`);

      if (total === 0) {
        console.log(chalk.green("  모든 항목이 이미 임베딩되어 있습니다."));
        client.release();
        await closeConnection();
        return;
      }

      let done = 0;
      const embedSpinner = ora(`임베딩 생성 중... 0/${total}`).start();

      for (const row of rows.rows) {
        const embedding = await generateEmbedding(`${row.key}: ${row.content}`);
        if (embedding) {
          await client.query(
            "UPDATE semo.knowledge_base SET embedding = $1::vector WHERE kb_id = $2",
            [`[${embedding.join(",")}]`, row.kb_id]
          );
        }
        done++;
        embedSpinner.text = `임베딩 생성 중... ${done}/${total}`;
      }

      embedSpinner.succeed(`${done}건 임베딩 완료`);
      client.release();
      await closeConnection();
    } catch (err) {
      spinner.fail(`임베딩 실패: ${err}`);
      await closeConnection();
      process.exit(1);
    }
  });

kbCmd
  .command("sync")
  .description("양방향 동기화 (pull → merge → push)")
  .option("--domain <name>", "도메인 필터")
  .action(async (options) => {
    console.log(chalk.cyan.bold("\n🔄 KB 동기화\n"));

    const spinner = ora("Step 1/2: DB에서 pull...").start();
    try {
      const pool = getPool();

      // Step 1: Pull
      const pulled = await kbPull(pool, options.domain, process.cwd());
      spinner.succeed(`Pull 완료: ${pulled.length}건`);

      // Step 2: Pull ontology
      const spinner2 = ora("Step 2/2: 온톨로지 동기화...").start();
      const ontoCount = await ontoPullToLocal(pool, process.cwd());
      spinner2.succeed(`온톨로지 ${ontoCount}개 도메인 동기화됨`);

      console.log(chalk.green.bold("\n✅ 동기화 완료\n"));
      console.log(chalk.gray("  로컬 수정 후 semo kb push로 업로드하세요."));
      console.log();
      await closeConnection();
    } catch (err) {
      spinner.fail(`동기화 실패: ${err}`);
      await closeConnection();
      process.exit(1);
    }
  });

kbCmd
  .command("get <domain> <key> [sub_key]")
  .description("KB 단일 항목 정확 조회 (domain + key + sub_key)")
  .option("--format <type>", "출력 형식 (json|table)", "json")
  .action(async (domain, key, subKey, options) => {
    try {
      const pool = getPool();
      const entry = await kbGet(pool, domain, key, subKey);

      if (!entry) {
        console.log(chalk.yellow(`\n  항목 없음: ${domain}/${key}${subKey ? '/' + subKey : ''}\n`));
        await closeConnection();
        process.exit(1);
      }

      if (options.format === "json") {
        console.log(JSON.stringify(entry, null, 2));
      } else {
        console.log(chalk.cyan.bold(`\n📄 [${entry.domain}] ${entry.key}${entry.sub_key ? '/' + entry.sub_key : ''}\n`));
        console.log(entry.content);
        if (entry.metadata && Object.keys(entry.metadata).length > 0) {
          console.log(chalk.gray(`\n  metadata: ${JSON.stringify(entry.metadata)}`));
        }
        if (entry.updated_at) {
          console.log(chalk.gray(`  updated: ${entry.updated_at}`));
        }
        console.log();
      }
      await closeConnection();
    } catch (err) {
      console.error(chalk.red(`조회 실패: ${err}`));
      await closeConnection();
      process.exit(1);
    }
  });

kbCmd
  .command("upsert <domain> <key> [sub_key]")
  .description("KB 항목 쓰기 (upsert) — 임베딩 자동 생성 + 스키마 검증")
  .requiredOption("--content <text>", "항목 본문")
  .option("--metadata <json>", "추가 메타데이터 (JSON 문자열)")
  .option("--created-by <name>", "작성자 식별자", "semo-cli")
  .action(async (domain, key, subKey, options) => {
    const spinner = ora("KB upsert 중...").start();
    try {
      const pool = getPool();
      const metadata = options.metadata ? JSON.parse(options.metadata) : undefined;
      const result = await kbUpsert(pool, {
        domain,
        key,
        sub_key: subKey,
        content: options.content,
        metadata,
        created_by: options.createdBy,
      });

      if (result.success) {
        spinner.succeed(`KB upsert 완료: ${domain}/${key}${subKey ? '/' + subKey : ''}`);
        if (result.warnings && result.warnings.length > 0) {
          for (const w of result.warnings) {
            console.log(chalk.yellow(`  ⚠️ ${w}`));
          }
        }
      } else {
        spinner.fail(`KB upsert 실패: ${result.error}`);
        process.exit(1);
      }
      await closeConnection();
    } catch (err) {
      spinner.fail(`KB upsert 실패: ${err}`);
      await closeConnection();
      process.exit(1);
    }
  });

kbCmd
  .command("ontology")
  .description("온톨로지 조회 — 도메인/타입/스키마/라우팅 테이블")
  .option("--action <type>", "조회 동작 (list|show|services|types|instances|schema|routing-table)", "list")
  .option("--domain <name>", "action=show 시 도메인")
  .option("--type <name>", "action=schema 시 타입 키")
  .option("--format <type>", "출력 형식 (json|table)", "table")
  .action(async (options) => {
    try {
      const pool = getPool();
      const action = options.action as string;

      if (action === "list") {
        const domains = await ontoList(pool);
        if (options.format === "json") {
          console.log(JSON.stringify(domains, null, 2));
        } else {
          console.log(chalk.cyan.bold("\n📐 온톨로지 도메인\n"));
          for (const d of domains) {
            const typeStr = d.entity_type ? chalk.gray(` [${d.entity_type}]`) : "";
            const svcStr = d.service ? chalk.gray(` (${d.service})`) : "";
            console.log(chalk.cyan(`  ${d.domain}`) + typeStr + svcStr);
            if (d.description) console.log(chalk.gray(`    ${d.description}`));
          }
          console.log();
        }
      } else if (action === "show") {
        if (!options.domain) {
          console.log(chalk.red("--domain 옵션이 필요합니다."));
          process.exit(1);
        }
        const onto = await ontoShow(pool, options.domain);
        if (!onto) {
          console.log(chalk.red(`온톨로지 '${options.domain}'을 찾을 수 없습니다.`));
          process.exit(1);
        }
        if (options.format === "json") {
          console.log(JSON.stringify(onto, null, 2));
        } else {
          console.log(chalk.cyan.bold(`\n📐 온톨로지: ${onto.domain}\n`));
          if (onto.description) console.log(chalk.white(`  ${onto.description}`));
          console.log(chalk.gray(`  버전: ${onto.version}`));
          console.log(chalk.gray(`  스키마:\n`));
          console.log(chalk.white(JSON.stringify(onto.schema, null, 2).split("\n").map(l => "    " + l).join("\n")));
          console.log();
        }
      } else if (action === "services") {
        const services = await ontoListServices(pool);
        if (options.format === "json") {
          console.log(JSON.stringify(services, null, 2));
        } else {
          console.log(chalk.cyan.bold("\n📐 서비스 목록\n"));
          for (const s of services) {
            console.log(chalk.cyan(`  ${s.service}`) + chalk.gray(` (${s.domain_count} domains)`));
            console.log(chalk.gray(`    ${s.domains.join(", ")}`));
          }
          console.log();
        }
      } else if (action === "types") {
        const types = await ontoListTypes(pool);
        if (options.format === "json") {
          console.log(JSON.stringify(types, null, 2));
        } else {
          console.log(chalk.cyan.bold("\n📐 온톨로지 타입\n"));
          for (const t of types) {
            console.log(chalk.cyan(`  ${t.type_key}`) + chalk.gray(` (v${t.version})`));
            if (t.description) console.log(chalk.gray(`    ${t.description}`));
          }
          console.log();
        }
      } else if (action === "instances") {
        const instances = await ontoListInstances(pool);
        if (options.format === "json") {
          console.log(JSON.stringify(instances, null, 2));
        } else {
          console.log(chalk.cyan.bold("\n📐 서비스 인스턴스\n"));
          for (const inst of instances) {
            console.log(chalk.cyan(`  ${inst.domain}`) + chalk.gray(` (${inst.entry_count} entries)`));
            if (inst.description) console.log(chalk.gray(`    ${inst.description}`));
            if (inst.scoped_domains.length > 0) {
              console.log(chalk.gray(`    scoped: ${inst.scoped_domains.join(", ")}`));
            }
          }
          console.log();
        }
      } else if (action === "schema") {
        if (!options.type) {
          console.log(chalk.red("--type 옵션이 필요합니다. (예: --type service)"));
          process.exit(1);
        }
        const schema = await ontoListSchema(pool, options.type);
        if (options.format === "json") {
          console.log(JSON.stringify(schema, null, 2));
        } else {
          console.log(chalk.cyan.bold(`\n📐 타입 스키마: ${options.type}\n`));
          if (schema.length === 0) {
            console.log(chalk.yellow(`  스키마 없음: '${options.type}'`));
          } else {
            for (const s of schema) {
              const reqStr = s.required ? chalk.red(" *") : "";
              const typeStr = chalk.gray(` [${s.key_type}]`);
              console.log(chalk.cyan(`  ${s.scheme_key}`) + typeStr + reqStr);
              if (s.scheme_description) console.log(chalk.gray(`    ${s.scheme_description}`));
              if (s.value_hint) console.log(chalk.gray(`    hint: ${s.value_hint}`));
            }
          }
          console.log();
        }
      } else if (action === "routing-table") {
        const table = await ontoRoutingTable(pool);
        if (options.format === "json") {
          console.log(JSON.stringify(table, null, 2));
        } else {
          console.log(chalk.cyan.bold("\n📐 라우팅 테이블\n"));
          let lastDomain = "";
          for (const r of table) {
            if (r.domain !== lastDomain) {
              lastDomain = r.domain;
              const svcStr = r.service ? chalk.gray(` (${r.service})`) : "";
              console.log(chalk.white.bold(`\n  ${r.domain}`) + chalk.gray(` [${r.entity_type}]`) + svcStr);
              if (r.domain_description) console.log(chalk.gray(`    ${r.domain_description}`));
            }
            const typeStr = chalk.gray(` [${r.key_type}]`);
            console.log(chalk.cyan(`    → ${r.scheme_key}`) + typeStr);
            if (r.scheme_description) console.log(chalk.gray(`      ${r.scheme_description}`));
          }
          console.log();
        }
      } else {
        console.log(chalk.red(`알 수 없는 action: '${action}'. 사용 가능: list, show, services, types, instances, schema, routing-table`));
        process.exit(1);
      }

      await closeConnection();
    } catch (err) {
      console.error(chalk.red(`온톨로지 조회 실패: ${err}`));
      await closeConnection();
      process.exit(1);
    }
  });

// === Ontology 관리 ===
const ontoCmd = program
  .command("onto")
  .description("온톨로지(Ontology) 관리 — 도메인 스키마 정의");

ontoCmd
  .command("list")
  .description("정의된 온톨로지 도메인 목록")
  .option("--service <name>", "서비스별 필터")
  .option("--format <type>", "출력 형식 (table|json)", "table")
  .action(async (options) => {
    try {
      const pool = getPool();
      let domains = await ontoList(pool);

      if (options.service) {
        domains = domains.filter(d => d.service === options.service || d.domain === options.service || d.domain.startsWith(`${options.service}.`));
      }

      if (options.format === "json") {
        console.log(JSON.stringify(domains, null, 2));
      } else {
        console.log(chalk.cyan.bold("\n📐 온톨로지 도메인\n"));
        if (domains.length === 0) {
          console.log(chalk.yellow("  온톨로지가 정의되지 않았습니다."));
        } else {
          // Group by service (_global treated as Global)
          const global = domains.filter(d => !d.service || d.service === '_global');
          const byService: Record<string, typeof domains> = {};
          for (const d of domains) {
            if (d.service && d.service !== '_global') {
              if (!byService[d.service]) byService[d.service] = [];
              byService[d.service].push(d);
            }
          }

          if (global.length > 0) {
            console.log(chalk.white.bold("  Global"));
            for (const d of global) {
              const typeStr = d.entity_type ? chalk.gray(` [${d.entity_type}]`) : "";
              console.log(chalk.cyan(`    ${d.domain}`) + typeStr + chalk.gray(` (v${d.version})`));
              if (d.description) console.log(chalk.gray(`      ${d.description}`));
            }
          }

          for (const [svc, svcDomains] of Object.entries(byService)) {
            console.log(chalk.white.bold(`\n  Service: ${svc}`));
            for (const d of svcDomains) {
              const typeStr = d.entity_type ? chalk.gray(` [${d.entity_type}]`) : "";
              console.log(chalk.cyan(`    ${d.domain}`) + typeStr + chalk.gray(` (v${d.version})`));
              if (d.description) console.log(chalk.gray(`      ${d.description}`));
            }
          }
        }
        console.log();
      }
      await closeConnection();
    } catch (err) {
      console.error(chalk.red(`조회 실패: ${err}`));
      await closeConnection();
      process.exit(1);
    }
  });

ontoCmd
  .command("types")
  .description("온톨로지 타입 목록 (구조적 템플릿)")
  .option("--format <type>", "출력 형식 (table|json)", "table")
  .action(async (options) => {
    try {
      const pool = getPool();
      const types = await ontoListTypes(pool);

      if (options.format === "json") {
        console.log(JSON.stringify(types, null, 2));
      } else {
        console.log(chalk.cyan.bold("\n📐 온톨로지 타입\n"));
        if (types.length === 0) {
          console.log(chalk.yellow("  타입이 정의되지 않았습니다. (016 마이그레이션 실행 필요)"));
        } else {
          for (const t of types) {
            console.log(chalk.cyan(`  ${t.type_key}`) + chalk.gray(` (v${t.version})`));
            if (t.description) console.log(chalk.gray(`    ${t.description}`));
          }
        }
        console.log();
      }
      await closeConnection();
    } catch (err) {
      console.error(chalk.red(`조회 실패: ${err}`));
      await closeConnection();
      process.exit(1);
    }
  });

ontoCmd
  .command("show <domain>")
  .description("특정 도메인 온톨로지 상세")
  .action(async (domain) => {
    try {
      const pool = getPool();
      const onto = await ontoShow(pool, domain);

      if (!onto) {
        console.log(chalk.red(`\n  온톨로지 '${domain}'을 찾을 수 없습니다.\n`));
        process.exit(1);
      }

      console.log(chalk.cyan.bold(`\n📐 온톨로지: ${onto.domain}\n`));
      if (onto.description) console.log(chalk.white(`  ${onto.description}`));
      console.log(chalk.gray(`  버전: ${onto.version}`));
      console.log(chalk.gray(`  스키마:\n`));
      console.log(chalk.white(JSON.stringify(onto.schema, null, 2).split("\n").map(l => "    " + l).join("\n")));
      console.log();
      await closeConnection();
    } catch (err) {
      console.error(chalk.red(`조회 실패: ${err}`));
      await closeConnection();
      process.exit(1);
    }
  });

ontoCmd
  .command("validate [domain]")
  .description("KB 항목이 온톨로지 스키마와 일치하는지 검증")
  .option("--all", "모든 도메인 검증")
  .action(async (domain, options) => {
    try {
      const pool = getPool();

      const domainsToCheck: string[] = [];
      if (options.all) {
        const allDomains = await ontoList(pool);
        domainsToCheck.push(...allDomains.map(d => d.domain));
      } else if (domain) {
        domainsToCheck.push(domain);
      } else {
        console.log(chalk.red("도메인을 지정하거나 --all 옵션을 사용하세요."));
        process.exit(1);
      }

      console.log(chalk.cyan.bold("\n🔍 온톨로지 검증\n"));

      let totalValid = 0;
      let totalInvalid = 0;

      for (const d of domainsToCheck) {
        const result = await ontoValidate(pool, d);
        totalValid += result.valid;
        totalInvalid += result.invalid.length;

        if (result.invalid.length === 0) {
          console.log(chalk.green(`  ✅ ${d}: ${result.valid}건 모두 유효`));
        } else {
          console.log(chalk.yellow(`  ⚠️ ${d}: ${result.valid}건 유효, ${result.invalid.length}건 오류`));
          for (const inv of result.invalid) {
            console.log(chalk.red(`     ${inv.key}:`));
            inv.errors.forEach(e => console.log(chalk.gray(`       - ${e}`)));
          }
        }
      }

      console.log(chalk.gray(`\n  총 결과: ${totalValid}건 유효, ${totalInvalid}건 오류\n`));
      await closeConnection();
    } catch (err) {
      console.error(chalk.red(`검증 실패: ${err}`));
      await closeConnection();
      process.exit(1);
    }
  });

// === 신규 v4 커맨드 그룹 등록 ===
registerContextCommands(program);
registerBotsCommands(program);
registerGetCommands(program);
registerSessionsCommands(program);
registerDbCommands(program);
registerMemoryCommands(program);
registerTestCommands(program);

// === semo skills — DB 시딩 ===

/**
 * SKILL.md frontmatter 파싱 (YAML 파서 없이 regex 기반)
 */
function parseSkillFrontmatter(content: string): { name: string; description: string; category: string; tools: string[] } | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];

  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : "";
  if (!name) return null;

  // multi-line description (| block scalar)
  let description = "";
  const descBlockMatch = fm.match(/^description:\s*\|\n([\s\S]*?)(?=^[a-z]|\n---)/m);
  if (descBlockMatch) {
    description = descBlockMatch[1].replace(/^  /gm, "").trim();
  } else {
    const descInlineMatch = fm.match(/^description:\s*(.+)$/m);
    if (descInlineMatch) description = descInlineMatch[1].trim();
  }

  // tools 배열
  const toolsMatch = fm.match(/^tools:\s*\[(.+)\]$/m);
  const tools = toolsMatch ? toolsMatch[1].split(",").map((t: string) => t.trim()) : [];

  // category
  const category = "core";

  return { name, description, category, tools };
}

// semo skills seed — 제거됨 (중앙 DB 단일 SoT)
// 봇 전용 스킬은 semo bots seed로 동기화

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

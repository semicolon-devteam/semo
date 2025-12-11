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

const VERSION = "2.0.1";
const SEMO_REPO = "https://github.com/semicolon-devteam/semo.git";

// 확장 패키지 정의
const EXTENSION_PACKAGES: Record<string, { name: string; desc: string; detect: string[] }> = {
  next: { name: "Next.js", desc: "Next.js 프론트엔드 개발 (13 agents, 33 skills)", detect: ["next.config.js", "next.config.mjs", "next.config.ts"] },
  backend: { name: "Backend", desc: "Spring/Node.js 백엔드 개발 (8 agents, 15 skills)", detect: ["pom.xml", "build.gradle"] },
  po: { name: "PO", desc: "Product Owner - 태스크/에픽 관리 (5 agents, 19 skills)", detect: [] },
  qa: { name: "QA", desc: "QA 테스트 관리 (4 agents, 13 skills)", detect: [] },
  pm: { name: "PM", desc: "프로젝트/스프린트 관리 (5 agents, 16 skills)", detect: [] },
  infra: { name: "Infra", desc: "인프라/배포 관리 (6 agents, 10 skills)", detect: ["docker-compose.yml", "Dockerfile"] },
  design: { name: "Design", desc: "디자인 핸드오프 (3 agents, 4 skills)", detect: [] },
  ms: { name: "Microservice", desc: "마이크로서비스 아키텍처 (5 agents, 5 skills)", detect: [] },
  mvp: { name: "MVP", desc: "MVP 빠른 개발 (4 agents, 6 skills)", detect: [] },
  meta: { name: "Meta", desc: "SEMO 프레임워크 자체 개발/관리 (6 agents, 7 skills)", detect: ["semo-core", "semo-skills", "packages/meta"] },
};

const program = new Command();

program
  .name("semo")
  .description("SEMO CLI - AI Agent Orchestration Framework")
  .version(VERSION);

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
      default: false,
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

// === init 명령어 ===
program
  .command("init")
  .description("현재 프로젝트에 SEMO를 설치합니다")
  .option("-f, --force", "기존 설정 덮어쓰기")
  .option("--skip-mcp", "MCP 설정 생략")
  .option("--with <packages>", "추가 설치할 패키지 (쉼표 구분: next,backend)")
  .action(async (options) => {
    console.log(chalk.cyan.bold("\n🚀 SEMO 설치 시작\n"));
    console.log(chalk.gray("Gemini 하이브리드 전략: White Box + Black Box\n"));

    const cwd = process.cwd();

    // 1. Git 레포지토리 확인
    const spinner = ora("Git 레포지토리 확인 중...").start();
    try {
      execSync("git rev-parse --git-dir", { cwd, stdio: "pipe" });
      spinner.succeed("Git 레포지토리 확인됨");
    } catch {
      spinner.fail("Git 레포지토리가 아닙니다. 'git init'을 먼저 실행하세요.");
      process.exit(1);
    }

    // 2. 프로젝트 유형 감지
    const detected = detectProjectType(cwd);
    let extensionsToInstall: string[] = [];

    if (options.with) {
      extensionsToInstall = options.with.split(",").map((p: string) => p.trim()).filter((p: string) => p in EXTENSION_PACKAGES);
    } else if (detected.length > 0) {
      console.log(chalk.cyan("\n📦 감지된 프로젝트 유형:"));
      detected.forEach(pkg => {
        console.log(chalk.gray(`   - ${EXTENSION_PACKAGES[pkg].name}: ${EXTENSION_PACKAGES[pkg].desc}`));
      });

      const { installDetected } = await inquirer.prompt([
        {
          type: "confirm",
          name: "installDetected",
          message: "감지된 패키지를 함께 설치할까요?",
          default: true,
        },
      ]);

      if (installDetected) {
        extensionsToInstall = detected;
      }
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

    // 8. CLAUDE.md 생성
    await setupClaudeMd(cwd, extensionsToInstall, options.force);

    // 9. Extensions 심볼릭 링크 (agents/skills 병합)
    if (extensionsToInstall.length > 0) {
      await setupExtensionSymlinks(cwd, extensionsToInstall);
    }

    // 완료 메시지
    console.log(chalk.green.bold("\n✅ SEMO 설치 완료!\n"));

    console.log(chalk.cyan("설치된 구성:"));
    console.log(chalk.gray("  [Standard]"));
    console.log(chalk.gray("    ✓ semo-core (원칙, 오케스트레이터)"));
    console.log(chalk.gray("    ✓ semo-skills (13개 통합 스킬)"));

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

    if (extensionsToInstall.length === 0 && detected.length === 0) {
      console.log(chalk.gray("\n💡 추가 패키지: semo add <package> (예: semo add next)"));
    }
    console.log();
  });

// === Standard 설치 (semo-core + semo-skills) ===
async function setupStandard(cwd: string, force: boolean) {
  const semoSystemDir = path.join(cwd, "semo-system");

  console.log(chalk.cyan("\n📚 Standard 설치 (White Box)"));
  console.log(chalk.gray("   semo-core: 원칙, 오케스트레이터"));
  console.log(chalk.gray("   semo-skills: 13개 통합 스킬\n"));

  // 기존 디렉토리 확인
  if (fs.existsSync(semoSystemDir) && !force) {
    const shouldOverwrite = await confirmOverwrite("semo-system/", semoSystemDir);
    if (!shouldOverwrite) {
      console.log(chalk.gray("  → semo-system/ 건너뜀"));
      return;
    }
    execSync(`rm -rf "${semoSystemDir}"`, { stdio: "pipe" });
    console.log(chalk.green("  ✓ 기존 semo-system/ 삭제됨"));
  }

  const spinner = ora("semo-core, semo-skills 다운로드 중...").start();

  try {
    const tempDir = path.join(cwd, ".semo-temp");
    execSync(`rm -rf "${tempDir}"`, { stdio: "pipe" });
    execSync(`git clone --depth 1 ${SEMO_REPO} "${tempDir}"`, { stdio: "pipe" });

    fs.mkdirSync(semoSystemDir, { recursive: true });

    // semo-core 복사
    if (fs.existsSync(path.join(tempDir, "semo-core"))) {
      execSync(`cp -r "${tempDir}/semo-core" "${semoSystemDir}/"`, { stdio: "pipe" });
    }

    // semo-skills 복사
    if (fs.existsSync(path.join(tempDir, "semo-skills"))) {
      execSync(`cp -r "${tempDir}/semo-skills" "${semoSystemDir}/"`, { stdio: "pipe" });
    }

    execSync(`rm -rf "${tempDir}"`, { stdio: "pipe" });

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
      if (!fs.existsSync(agentLink)) {
        fs.symlinkSync(`../../semo-system/semo-core/agents/${agent}`, agentLink);
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
      fs.unlinkSync(claudeSkillsDir);
    }
    fs.mkdirSync(claudeSkillsDir, { recursive: true });

    const skills = fs.readdirSync(coreSkillsDir).filter(f =>
      fs.statSync(path.join(coreSkillsDir, f)).isDirectory()
    );
    for (const skill of skills) {
      const skillLink = path.join(claudeSkillsDir, skill);
      if (!fs.existsSync(skillLink)) {
        fs.symlinkSync(`../../semo-system/semo-skills/${skill}`, skillLink);
      }
    }
    console.log(chalk.green(`  ✓ .claude/skills/ (${skills.length}개 skill 링크됨)`));
  }

  // commands 링크
  const commandsDir = path.join(claudeDir, "commands");
  fs.mkdirSync(commandsDir, { recursive: true });

  const semoCommandsLink = path.join(commandsDir, "SEMO");
  if (!fs.existsSync(semoCommandsLink)) {
    const commandsTarget = path.join(semoSystemDir, "semo-core", "commands", "SEMO");
    if (fs.existsSync(commandsTarget)) {
      fs.symlinkSync("../../semo-system/semo-core/commands/SEMO", semoCommandsLink);
      console.log(chalk.green("  ✓ .claude/commands/SEMO → semo-system/semo-core/commands/SEMO"));
    }
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

    for (const pkg of packages) {
      const srcPath = path.join(tempDir, "packages", pkg);
      const destPath = path.join(semoSystemDir, pkg);

      if (fs.existsSync(srcPath)) {
        if (fs.existsSync(destPath) && !force) {
          console.log(chalk.yellow(`  ⚠ ${pkg}/ 이미 존재 (건너뜀)`));
          continue;
        }
        execSync(`rm -rf "${destPath}"`, { stdio: "pipe" });
        execSync(`cp -r "${srcPath}" "${destPath}"`, { stdio: "pipe" });
      }
    }

    execSync(`rm -rf "${tempDir}"`, { stdio: "pipe" });

    spinner.succeed(`Extensions 다운로드 완료 (${packages.length}개)`);

  } catch (error) {
    spinner.fail("Extensions 다운로드 실패");
    console.error(chalk.red(`   ${error}`));
  }
}

// === Extensions 심볼릭 링크 설정 (agents/skills 병합) ===
async function setupExtensionSymlinks(cwd: string, packages: string[]) {
  console.log(chalk.cyan("\n🔗 Extensions 연결"));

  const claudeDir = path.join(cwd, ".claude");
  const semoSystemDir = path.join(cwd, "semo-system");

  for (const pkg of packages) {
    const pkgPath = path.join(semoSystemDir, pkg);
    if (!fs.existsSync(pkgPath)) continue;

    // 1. semo-{pkg} 링크
    const semoPkgLink = path.join(claudeDir, `semo-${pkg}`);
    if (!fs.existsSync(semoPkgLink)) {
      fs.symlinkSync(`../semo-system/${pkg}`, semoPkgLink);
      console.log(chalk.green(`  ✓ .claude/semo-${pkg} → semo-system/${pkg}`));
    }

    // 2. Extension의 agents를 .claude/agents/에 개별 링크
    const extAgentsDir = path.join(pkgPath, "agents");
    const claudeAgentsDir = path.join(claudeDir, "agents");
    if (fs.existsSync(extAgentsDir)) {
      const agents = fs.readdirSync(extAgentsDir).filter(f =>
        fs.statSync(path.join(extAgentsDir, f)).isDirectory()
      );
      for (const agent of agents) {
        const agentLink = path.join(claudeAgentsDir, agent);
        if (!fs.existsSync(agentLink)) {
          fs.symlinkSync(`../../semo-system/${pkg}/agents/${agent}`, agentLink);
          console.log(chalk.green(`  ✓ .claude/agents/${agent} → semo-system/${pkg}/agents/${agent}`));
        }
      }
    }

    // 3. Extension의 skills를 .claude/skills/에 개별 링크
    const extSkillsDir = path.join(pkgPath, "skills");
    const claudeSkillsDir = path.join(claudeDir, "skills");
    if (fs.existsSync(extSkillsDir)) {
      const skills = fs.readdirSync(extSkillsDir).filter(f =>
        fs.statSync(path.join(extSkillsDir, f)).isDirectory()
      );
      for (const skill of skills) {
        const skillLink = path.join(claudeSkillsDir, skill);
        if (!fs.existsSync(skillLink)) {
          fs.symlinkSync(`../../semo-system/${pkg}/skills/${skill}`, skillLink);
          console.log(chalk.green(`  ✓ .claude/skills/${skill} → semo-system/${pkg}/skills/${skill}`));
        }
      }
    }
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
    mcpServers: {
      "semo-integrations": {
        command: "npx",
        args: ["-y", "@team-semicolon/semo-mcp"],
        env: {
          GITHUB_TOKEN: "${GITHUB_TOKEN}",
          SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}",
          SUPABASE_URL: "${SUPABASE_URL}",
          SUPABASE_KEY: "${SUPABASE_KEY}",
        },
      },
    },
  };

  // Extension settings 병합
  const semoSystemDir = path.join(cwd, "semo-system");
  for (const pkg of extensions) {
    const extSettingsPath = path.join(semoSystemDir, pkg, "settings.local.json");
    if (fs.existsSync(extSettingsPath)) {
      try {
        const extSettings = JSON.parse(fs.readFileSync(extSettingsPath, "utf-8"));

        // mcpServers 병합
        if (extSettings.mcpServers) {
          Object.assign(settings.mcpServers, extSettings.mcpServers);
          console.log(chalk.gray(`  + ${pkg} MCP 설정 병합됨`));
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

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log(chalk.green("✓ .claude/settings.json 생성됨 (MCP 설정)"));
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

  for (const pkg of packages) {
    const extSettingsPath = path.join(semoSystemDir, pkg, "settings.local.json");
    if (fs.existsSync(extSettingsPath)) {
      try {
        const extSettings = JSON.parse(fs.readFileSync(extSettingsPath, "utf-8"));

        // mcpServers 병합
        if (extSettings.mcpServers) {
          settings.mcpServers = settings.mcpServers || {};
          Object.assign(settings.mcpServers, extSettings.mcpServers);
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

  const extensionsList = extensions.length > 0
    ? extensions.map(pkg => `├── ${pkg}/              # ${EXTENSION_PACKAGES[pkg].name}`).join("\n")
    : "";

  const claudeMdContent = `# SEMO Project Configuration

> SEMO (Semicolon Orchestrate) - AI Agent Orchestration Framework v${VERSION}

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
| \`/SEMO:slack\` | Slack 메시지 전송 |
| \`/SEMO:feedback\` | 피드백 제출 |
| \`/SEMO:health\` | 환경 검증 |
| \`/SEMO:update\` | SEMO 업데이트 |

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
`;

  fs.writeFileSync(claudeMdPath, claudeMdContent);
  console.log(chalk.green("✓ .claude/CLAUDE.md 생성됨"));
}

// === add 명령어 ===
program
  .command("add <package>")
  .description("Extension 패키지를 추가로 설치합니다")
  .option("-f, --force", "기존 설정 덮어쓰기")
  .action(async (packageName: string, options) => {
    const cwd = process.cwd();
    const semoSystemDir = path.join(cwd, "semo-system");

    if (!fs.existsSync(semoSystemDir)) {
      console.log(chalk.red("\nSEMO가 설치되어 있지 않습니다. 'semo init'을 먼저 실행하세요.\n"));
      process.exit(1);
    }

    if (!(packageName in EXTENSION_PACKAGES)) {
      console.log(chalk.red(`\n알 수 없는 패키지: ${packageName}`));
      console.log(chalk.gray(`사용 가능한 패키지: ${Object.keys(EXTENSION_PACKAGES).join(", ")}\n`));
      process.exit(1);
    }

    const pkgPath = path.join(semoSystemDir, packageName);
    if (fs.existsSync(pkgPath) && !options.force) {
      console.log(chalk.yellow(`\n${EXTENSION_PACKAGES[packageName].name} 패키지가 이미 설치되어 있습니다.`));
      console.log(chalk.gray("강제 재설치: semo add " + packageName + " --force\n"));
      return;
    }

    console.log(chalk.cyan(`\n📦 ${EXTENSION_PACKAGES[packageName].name} 패키지 설치\n`));
    console.log(chalk.gray(`   ${EXTENSION_PACKAGES[packageName].desc}\n`));

    // 1. 다운로드
    await downloadExtensions(cwd, [packageName], options.force);

    // 2. settings.json 병합
    await mergeExtensionSettings(cwd, [packageName]);

    // 3. 심볼릭 링크 설정
    await setupExtensionSymlinks(cwd, [packageName]);

    console.log(chalk.green.bold(`\n✅ ${EXTENSION_PACKAGES[packageName].name} 패키지 설치 완료!\n`));
  });

// === list 명령어 ===
program
  .command("list")
  .description("사용 가능한 모든 패키지를 표시합니다")
  .action(() => {
    const cwd = process.cwd();
    const semoSystemDir = path.join(cwd, "semo-system");

    console.log(chalk.cyan.bold("\n📦 SEMO 패키지 목록\n"));

    // Standard
    console.log(chalk.white.bold("Standard (필수)"));
    const coreInstalled = fs.existsSync(path.join(semoSystemDir, "semo-core"));
    const skillsInstalled = fs.existsSync(path.join(semoSystemDir, "semo-skills"));

    console.log(`  ${coreInstalled ? chalk.green("✓") : chalk.gray("○")} semo-core - 원칙, 오케스트레이터`);
    console.log(`  ${skillsInstalled ? chalk.green("✓") : chalk.gray("○")} semo-skills - 13개 통합 스킬`);
    console.log();

    // Extensions
    console.log(chalk.white.bold("Extensions (선택)"));
    for (const [key, pkg] of Object.entries(EXTENSION_PACKAGES)) {
      const isInstalled = fs.existsSync(path.join(semoSystemDir, key));
      const status = isInstalled ? chalk.green("✓") : chalk.gray("○");
      console.log(`  ${status} ${key} - ${pkg.desc}`);
    }

    console.log();
    console.log(chalk.gray("설치: semo add <package>"));
    console.log(chalk.gray("예시: semo add next\n"));
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
  .action(async () => {
    console.log(chalk.cyan.bold("\n🔄 SEMO 업데이트\n"));

    const cwd = process.cwd();
    const semoSystemDir = path.join(cwd, "semo-system");

    if (!fs.existsSync(semoSystemDir)) {
      console.log(chalk.red("SEMO가 설치되어 있지 않습니다. 'semo init'을 먼저 실행하세요."));
      process.exit(1);
    }

    // 설치된 Extensions 확인
    const installedExtensions: string[] = [];
    for (const key of Object.keys(EXTENSION_PACKAGES)) {
      if (fs.existsSync(path.join(semoSystemDir, key))) {
        installedExtensions.push(key);
      }
    }

    console.log(chalk.cyan("업데이트 대상:"));
    console.log(chalk.gray("  - semo-core"));
    console.log(chalk.gray("  - semo-skills"));
    installedExtensions.forEach(pkg => {
      console.log(chalk.gray(`  - ${pkg}`));
    });

    const spinner = ora("\n최신 버전 다운로드 중...").start();

    try {
      const tempDir = path.join(cwd, ".semo-temp");
      execSync(`rm -rf "${tempDir}"`, { stdio: "pipe" });
      execSync(`git clone --depth 1 ${SEMO_REPO} "${tempDir}"`, { stdio: "pipe" });

      // Standard 업데이트
      execSync(`rm -rf "${semoSystemDir}/semo-core" "${semoSystemDir}/semo-skills"`, { stdio: "pipe" });
      execSync(`cp -r "${tempDir}/semo-core" "${semoSystemDir}/"`, { stdio: "pipe" });
      execSync(`cp -r "${tempDir}/semo-skills" "${semoSystemDir}/"`, { stdio: "pipe" });

      // Extensions 업데이트
      for (const pkg of installedExtensions) {
        const srcPath = path.join(tempDir, "packages", pkg);
        const destPath = path.join(semoSystemDir, pkg);
        if (fs.existsSync(srcPath)) {
          execSync(`rm -rf "${destPath}"`, { stdio: "pipe" });
          execSync(`cp -r "${srcPath}" "${destPath}"`, { stdio: "pipe" });
        }
      }

      execSync(`rm -rf "${tempDir}"`, { stdio: "pipe" });

      spinner.succeed("SEMO 업데이트 완료");
    } catch (error) {
      spinner.fail("업데이트 실패");
      console.error(chalk.red(`${error}`));
    }
  });

program.parse();

#!/usr/bin/env node
/**
 * SEMO CLI
 *
 * Gemini 하이브리드 전략에 따른 SEMO 설치 자동화 도구
 *
 * 사용법:
 *   npx @semicolon/semo-cli init
 *
 * 동작:
 *   1. White Box (semo-core, semo-skills) → Git Subtree로 주입
 *   2. Black Box (semo-integrations) → MCP 설정 파일 생성
 *   3. Context Mesh (.claude/memory/) 초기화
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const VERSION = "1.0.0";
const SEMO_REPO = "https://github.com/semicolon-devteam/semo.git";

const program = new Command();

program
  .name("semo")
  .description("SEMO CLI - AI Agent Orchestration Framework")
  .version(VERSION);

// === init 명령어 ===
program
  .command("init")
  .description("현재 프로젝트에 SEMO를 설치합니다 (Gemini 하이브리드 전략)")
  .option("-f, --force", "기존 설정 덮어쓰기")
  .option("--skip-mcp", "MCP 설정 생략")
  .option("--skip-subtree", "Git Subtree 생략 (MCP만 설정)")
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

    // 2. .claude 디렉토리 생성
    const claudeDir = path.join(cwd, ".claude");
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
      console.log(chalk.green("✓ .claude/ 디렉토리 생성됨"));
    }

    // 3. White Box: Git Subtree로 semo-core, semo-skills 주입
    if (!options.skipSubtree) {
      await setupWhiteBox(cwd, options.force);
    }

    // 4. Black Box: MCP 설정 파일 생성
    if (!options.skipMcp) {
      await setupBlackBox(cwd, options.force);
    }

    // 5. Context Mesh 초기화
    await setupContextMesh(cwd);

    // 6. CLAUDE.md 생성
    await setupClaudeMd(cwd, options.force);

    console.log(chalk.green.bold("\n✅ SEMO 설치 완료!\n"));
    console.log(chalk.cyan("다음 단계:"));
    console.log(chalk.gray("  1. Claude Code에서 프로젝트 열기"));
    console.log(chalk.gray("  2. 자연어로 요청하기 (예: \"댓글 기능 구현해줘\")"));
    console.log(chalk.gray("  3. /SEMO:help로 도움말 확인\n"));
  });

// === White Box 설정 (Git Subtree) ===
async function setupWhiteBox(cwd: string, force: boolean) {
  const semoSystemDir = path.join(cwd, "semo-system");

  console.log(chalk.cyan("\n📚 White Box 설정 (Git Subtree)"));
  console.log(chalk.gray("   에이전트가 읽고 학습할 지식 베이스\n"));

  // semo-system 디렉토리 확인
  if (fs.existsSync(semoSystemDir) && !force) {
    console.log(chalk.yellow("⚠ semo-system/ 이미 존재. --force로 덮어쓰기 가능"));
    return;
  }

  const spinner = ora("semo-core, semo-skills 다운로드 중...").start();

  try {
    // Git Subtree로 semo-core 추가
    if (!fs.existsSync(path.join(semoSystemDir, "semo-core"))) {
      execSync(
        `git subtree add --prefix=semo-system/semo-core ${SEMO_REPO} main --squash 2>/dev/null || true`,
        { cwd, stdio: "pipe" }
      );
    }

    // semo-skills 추가 (같은 레포에서)
    if (!fs.existsSync(path.join(semoSystemDir, "semo-skills"))) {
      // subtree split으로 특정 폴더만 가져오기는 복잡하므로 전체 clone 후 복사
      const tempDir = path.join(cwd, ".semo-temp");
      if (!fs.existsSync(tempDir)) {
        execSync(`git clone --depth 1 ${SEMO_REPO} ${tempDir}`, { stdio: "pipe" });
      }

      // semo-core와 semo-skills 복사
      fs.mkdirSync(semoSystemDir, { recursive: true });

      if (fs.existsSync(path.join(tempDir, "semo-core"))) {
        execSync(`cp -r ${tempDir}/semo-core ${semoSystemDir}/`, { stdio: "pipe" });
      }
      if (fs.existsSync(path.join(tempDir, "semo-skills"))) {
        execSync(`cp -r ${tempDir}/semo-skills ${semoSystemDir}/`, { stdio: "pipe" });
      }

      // 임시 디렉토리 삭제
      execSync(`rm -rf ${tempDir}`, { stdio: "pipe" });
    }

    spinner.succeed("White Box 설정 완료 (semo-core, semo-skills)");

    // .claude 심볼릭 링크 생성
    const claudeDir = path.join(cwd, ".claude");
    const agentsLink = path.join(claudeDir, "agents");
    const skillsLink = path.join(claudeDir, "skills");

    if (!fs.existsSync(agentsLink)) {
      fs.symlinkSync("../semo-system/semo-core/agents", agentsLink);
      console.log(chalk.green("  ✓ .claude/agents → semo-system/semo-core/agents"));
    }
    if (!fs.existsSync(skillsLink)) {
      fs.symlinkSync("../semo-system/semo-skills", skillsLink);
      console.log(chalk.green("  ✓ .claude/skills → semo-system/semo-skills"));
    }
  } catch (error) {
    spinner.fail("White Box 설정 실패");
    console.error(chalk.red(`   ${error}`));
  }
}

// === Black Box 설정 (MCP) ===
async function setupBlackBox(cwd: string, force: boolean) {
  console.log(chalk.cyan("\n🔧 Black Box 설정 (MCP Server)"));
  console.log(chalk.gray("   토큰이 격리된 외부 연동 도구\n"));

  const settingsPath = path.join(cwd, ".claude", "settings.json");

  if (fs.existsSync(settingsPath) && !force) {
    console.log(chalk.yellow("⚠ .claude/settings.json 이미 존재. --force로 덮어쓰기 가능"));
    return;
  }

  const settings = {
    mcpServers: {
      "semo-integrations": {
        command: "npx",
        args: ["-y", "@semicolon/semo-mcp"],
        env: {
          GITHUB_TOKEN: "${GITHUB_TOKEN}",
          SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}",
          SUPABASE_URL: "${SUPABASE_URL}",
          SUPABASE_KEY: "${SUPABASE_KEY}",
        },
      },
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log(chalk.green("✓ .claude/settings.json 생성됨 (MCP 설정)"));
  console.log(chalk.gray("  → semo-integrations: github, slack, supabase"));
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

---

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **이름** | ${path.basename(cwd)} |
| **SEMO 버전** | 2.0.0 |
| **설치일** | ${new Date().toISOString().split("T")[0]} |

---

## 현재 작업 상태

_아직 작업 기록이 없습니다._

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
async function setupClaudeMd(cwd: string, force: boolean) {
  console.log(chalk.cyan("\n📄 CLAUDE.md 설정"));

  const claudeMdPath = path.join(cwd, ".claude", "CLAUDE.md");

  if (fs.existsSync(claudeMdPath) && !force) {
    console.log(chalk.yellow("⚠ CLAUDE.md 이미 존재. --force로 덮어쓰기 가능"));
    return;
  }

  const claudeMdContent = `# SEMO Project Configuration

> SEMO (Semicolon Orchestrate) - AI Agent Orchestration Framework

## 구조

\`\`\`
.claude/
├── settings.json      # MCP 서버 설정 (Black Box)
├── memory/            # Context Mesh
│   ├── context.md     # 프로젝트 상태
│   ├── decisions.md   # 아키텍처 결정
│   └── rules/         # 프로젝트별 규칙
├── agents → semo-system/semo-core/agents
└── skills → semo-system/semo-skills

semo-system/           # White Box (읽기 전용)
├── semo-core/         # Layer 0: 원칙, 오케스트레이션
└── semo-skills/       # Layer 1: coder, tester, planner
\`\`\`

## 사용 가능한 커맨드

| 커맨드 | 설명 |
|--------|------|
| \`/SEMO:help\` | 도움말 |
| \`/SEMO:slack\` | Slack 메시지 전송 |
| \`/SEMO:feedback\` | 피드백 제출 |
| \`/SEMO:health\` | 환경 검증 |

## 플랫폼 자동 감지

SEMO는 프로젝트 파일을 분석하여 플랫폼을 자동 감지합니다:

| 파일 | 플랫폼 |
|------|--------|
| \`next.config.js\` | Next.js |
| \`pom.xml\` | Spring |
| \`docker-compose.yml\` | Microservice |
| 기타 | MVP |

## References

- [SEMO Principles](semo-system/semo-core/principles/PRINCIPLES.md)
- [SEMO Skills](semo-system/semo-skills/)
`;

  fs.writeFileSync(claudeMdPath, claudeMdContent);
  console.log(chalk.green("✓ .claude/CLAUDE.md 생성됨"));
}

// === status 명령어 ===
program
  .command("status")
  .description("SEMO 설치 상태를 확인합니다")
  .action(() => {
    console.log(chalk.cyan.bold("\n📊 SEMO 설치 상태\n"));

    const cwd = process.cwd();
    const checks = [
      { name: ".claude/", path: path.join(cwd, ".claude"), type: "dir" },
      { name: ".claude/settings.json", path: path.join(cwd, ".claude", "settings.json"), type: "file" },
      { name: ".claude/memory/", path: path.join(cwd, ".claude", "memory"), type: "dir" },
      { name: "semo-system/semo-core/", path: path.join(cwd, "semo-system", "semo-core"), type: "dir" },
      { name: "semo-system/semo-skills/", path: path.join(cwd, "semo-system", "semo-skills"), type: "dir" },
    ];

    let allPassed = true;
    for (const check of checks) {
      const exists = fs.existsSync(check.path);
      if (exists) {
        console.log(chalk.green(`✓ ${check.name}`));
      } else {
        console.log(chalk.red(`✗ ${check.name}`));
        allPassed = false;
      }
    }

    console.log();
    if (allPassed) {
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
  .action(() => {
    console.log(chalk.cyan.bold("\n🔄 SEMO 업데이트\n"));

    const cwd = process.cwd();
    const semoSystemDir = path.join(cwd, "semo-system");

    if (!fs.existsSync(semoSystemDir)) {
      console.log(chalk.red("SEMO가 설치되어 있지 않습니다. 'semo init'을 먼저 실행하세요."));
      process.exit(1);
    }

    const spinner = ora("최신 버전 다운로드 중...").start();

    try {
      // 임시 디렉토리에 최신 버전 clone
      const tempDir = path.join(cwd, ".semo-temp");
      execSync(`rm -rf ${tempDir}`, { stdio: "pipe" });
      execSync(`git clone --depth 1 ${SEMO_REPO} ${tempDir}`, { stdio: "pipe" });

      // semo-core, semo-skills 업데이트
      execSync(`rm -rf ${semoSystemDir}/semo-core ${semoSystemDir}/semo-skills`, { stdio: "pipe" });
      execSync(`cp -r ${tempDir}/semo-core ${semoSystemDir}/`, { stdio: "pipe" });
      execSync(`cp -r ${tempDir}/semo-skills ${semoSystemDir}/`, { stdio: "pipe" });

      // 임시 디렉토리 삭제
      execSync(`rm -rf ${tempDir}`, { stdio: "pipe" });

      spinner.succeed("SEMO 업데이트 완료");
    } catch (error) {
      spinner.fail("업데이트 실패");
      console.error(chalk.red(`${error}`));
    }
  });

program.parse();

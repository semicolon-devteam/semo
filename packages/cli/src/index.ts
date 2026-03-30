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
import {
  ensureSemoDir,
  populateBotMirrors,
  generateSoulMd,
  generateMemoryMd,
  generateUserMd,
  generateThinRouter,
} from "./semo-workspace";

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
 * init/update 시작 시 CLI 버전 비교 결과 출력
 */
async function showVersionComparison(): Promise<void> {
  console.log(chalk.cyan("📊 버전 확인\n"));

  const spinner = ora("  버전 정보 조회 중...").start();

  try {
    const currentCliVersion = VERSION;
    const latestCliVersion = await getLatestVersion();

    spinner.stop();

    console.log(chalk.white(`  semo-cli: ${chalk.green.bold(currentCliVersion)}`));
    if (latestCliVersion) {
      console.log(chalk.gray(`            (최신: ${latestCliVersion})`));
    }

    if (latestCliVersion && isVersionLower(currentCliVersion, latestCliVersion)) {
      console.log(chalk.yellow(`\n  ⚠ CLI 업데이트 가능`));
      console.log(chalk.cyan(`    npm install -g ${PACKAGE_NAME}@latest`));
    } else {
      console.log(chalk.green("\n  ✓ 최신 버전입니다"));
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

// (migrateLegacyEnvironment / removeRecursive removed — semo-system migration no longer needed)

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
  console.log(chalk.cyan.bold("\n📦 SEMO 버전 정보\n"));

  const latestCliVersion = await getLatestVersion();

  console.log(chalk.white(`  semo-cli: ${chalk.green.bold(VERSION)}`));
  if (latestCliVersion) {
    console.log(chalk.gray(`            (최신: ${latestCliVersion})`));
  }

  if (latestCliVersion && isVersionLower(VERSION, latestCliVersion)) {
    console.log();
    console.log(chalk.yellow.bold("  ⚠️  CLI 업데이트 가능"));
    console.log(chalk.cyan(`    npm install -g ${PACKAGE_NAME}@latest`));
  } else {
    console.log();
    console.log(chalk.green("  ✓ 최신 버전"));
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
  const hasEnv = fs.existsSync(path.join(home, ".claude", "semo", ".env")) ||
                 fs.existsSync(path.join(home, ".semo.env"));  // 하위 호환
  const hasSetup = fs.existsSync(path.join(home, ".claude", "semo", "SOUL.md")) ||
                   fs.existsSync(path.join(home, ".claude", "skills"));  // 하위 호환
  return hasEnv && hasSetup;
}

// === onboarding 명령어 (글로벌 설정 — init 통합) ===
program
  .command("onboarding")
  .description("글로벌 SEMO 설정 — ~/.claude/semo/, skills/agents/commands")
  .option("--credentials-gist <gistId>", "Private GitHub Gist에서 DB 접속정보 가져오기")
  .option("-f, --force", "기존 설정 덮어쓰기")
  .option("--skip-mcp", "MCP 설정 생략")
  .option("--skip-bots", "봇 워크스페이스 미러 건너뛰기")
  .action(async (options) => {
    console.log(chalk.cyan.bold("\n🏠 SEMO 온보딩\n"));
    console.log(chalk.gray("  대상: ~/.claude/semo/ (머신당 1회)\n"));

    // 1. ~/.claude/semo/.env DB 접속 설정
    await setupSemoEnv(options.credentialsGist, options.force);

    // 2. DB health check
    const spinner = ora("DB 연결 확인 중...").start();
    const connected = await isDbConnected();
    if (connected) {
      spinner.succeed("DB 연결 확인됨");
    } else {
      spinner.warn("DB 연결 실패 — 스킬/봇 미러 설치를 건너뜁니다");
      console.log(chalk.gray([
        "",
        "  흔한 원인:",
        "  1. SSH 터널 미실행 — 로컬에서는 SSH 터널이 필요합니다:",
        "     ssh -J opc@152.70.244.169 -L 15432:localhost:5432 opc@10.0.0.91 -N -i ~/.ssh/oci_dev_rsa",
        "  2. ~/.claude/semo/.env의 DATABASE_URL 확인",
        "",
        "  터널 실행 후 다시 시도: semo onboarding",
        "",
      ].join("\n")));
      await closeConnection();
      return;
    }

    // 3. ~/.claude/semo/ 디렉토리 구조 생성
    console.log(chalk.cyan("\n📂 SEMO 워크스페이스 구성 (~/.claude/semo/)"));
    ensureSemoDir();
    console.log(chalk.green("  ✓ ~/.claude/semo/ 디렉토리 생성됨"));

    // 4. 봇 워크스페이스 미러 (DB → semo/bots/)
    if (!options.skipBots) {
      const mirrorSpinner = ora("봇 워크스페이스 미러링 (DB → semo/bots/)...").start();
      try {
        const result = await populateBotMirrors();
        mirrorSpinner.succeed(`봇 미러 완료: ${result.bots}개 봇, ${result.files}개 파일`);
      } catch (err) {
        mirrorSpinner.warn(`봇 미러 실패 (계속 진행): ${err}`);
      }
    } else {
      console.log(chalk.gray("  → 봇 미러 건너뜀 (--skip-bots)"));
    }

    // 5. SOUL.md / MEMORY.md / USER.md 생성
    try {
      await generateSoulMd();
      console.log(chalk.green("  ✓ semo/SOUL.md 생성됨 (오케스트레이터 페르소나)"));
    } catch (err) {
      console.log(chalk.yellow(`  ⚠ SOUL.md 생성 실패: ${err}`));
    }
    generateMemoryMd();
    console.log(chalk.green("  ✓ semo/MEMORY.md 생성됨 (KB 인덱스)"));
    generateUserMd();
    console.log(chalk.green("  ✓ semo/USER.md 확인됨 (사용자 프로필)"));

    // 6. Standard 설치 (DB → ~/.claude/skills, commands, agents)
    await setupStandardGlobal();

    // 7. Hooks 설치
    await setupHooks(false);

    // 8. MCP 설정
    if (!options.skipMcp) {
      await setupMCP(os.homedir(), [], options.force || false);
    }

    // 9. Thin Router CLAUDE.md 생성
    console.log(chalk.cyan("\n📄 CLAUDE.md 라우터 생성"));
    const kbFirstBlock = await buildKbFirstBlock();
    generateThinRouter(kbFirstBlock);
    console.log(chalk.green("  ✓ ~/.claude/CLAUDE.md (thin router) 생성됨"));

    await closeConnection();

    // 결과 요약
    console.log(chalk.green.bold("\n✅ SEMO 온보딩 완료!\n"));

    console.log(chalk.cyan("설치된 구성:"));
    console.log(chalk.gray("  ~/.claude/semo/.env            DB 접속정보 (권한 600)"));
    console.log(chalk.gray("  ~/.claude/semo/SOUL.md         오케스트레이터 페르소나"));
    console.log(chalk.gray("  ~/.claude/semo/MEMORY.md       KB 접근 가이드"));
    console.log(chalk.gray("  ~/.claude/semo/USER.md         사용자 프로필"));
    console.log(chalk.gray("  ~/.claude/semo/bots/           봇 워크스페이스 미러"));
    console.log(chalk.gray("  ~/.claude/skills/              팀 스킬 (DB 기반)"));
    console.log(chalk.gray("  ~/.claude/commands/            팀 커맨드 (DB 기반)"));
    console.log(chalk.gray("  ~/.claude/agents/              팀 에이전트 (DB 기반)"));
    console.log(chalk.gray("  ~/.claude/CLAUDE.md            Thin router + KB-First"));
    console.log(chalk.gray("  ~/.claude/settings.local.json  SessionStart/Stop 훅"));

    console.log(chalk.cyan("\n다음 단계:"));
    console.log(chalk.gray("  Claude Code에서 프로젝트를 열면 SessionStart 훅이 자동으로 sync합니다."));
    console.log();
  });

// === init 명령어 (deprecated — onboarding으로 통합됨) ===
program
  .command("init")
  .description("[deprecated] semo onboarding으로 통합되었습니다")
  .action(async () => {
    console.log(chalk.yellow("\n⚠ 'semo init'은 'semo onboarding'으로 통합되었습니다.\n"));
    console.log(chalk.cyan("  글로벌 설정이 필요하면:"));
    console.log(chalk.gray("    semo onboarding\n"));
    console.log(chalk.cyan("  이미 온보딩을 완료했다면:"));
    console.log(chalk.gray("    Claude Code에서 프로젝트를 열면 SessionStart 훅이 자동으로 sync합니다.\n"));
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

// (verifyInstallation / printVerificationResult removed — DB-based setup replaced semo-system symlinks)

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

// === ~/.claude/semo/.env 설정 (자동 감지 → Gist → 프롬프트) ===
// v4.5.0: ~/.semo.env → ~/.claude/semo/.env 이전
const SEMO_ENV_PATH = path.join(os.homedir(), ".claude", "semo", ".env");
const LEGACY_ENV_PATH = path.join(os.homedir(), ".semo.env");

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
  // 디렉토리 보장
  fs.mkdirSync(path.dirname(SEMO_ENV_PATH), { recursive: true });
  const lines = [
    "# SEMO 환경변수 — 모든 컨텍스트에서 자동 로드됨",
    "# (Claude Code 앱, OpenClaw LaunchAgent, cron 등)",
    "# 경로: ~/.claude/semo/.env (v4.5.0+)",
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
  fs.writeFileSync(SEMO_ENV_PATH, lines.join("\n"), { mode: 0o600 });

  // 하위 호환 심링크: ~/.semo.env → ~/.claude/semo/.env
  try {
    if (fs.existsSync(LEGACY_ENV_PATH)) {
      const stat = fs.lstatSync(LEGACY_ENV_PATH);
      if (!stat.isSymbolicLink()) {
        // 기존 실파일은 백업 후 심링크로 교체
        fs.renameSync(LEGACY_ENV_PATH, LEGACY_ENV_PATH + ".bak");
      } else {
        fs.unlinkSync(LEGACY_ENV_PATH);
      }
    }
    fs.symlinkSync(SEMO_ENV_PATH, LEGACY_ENV_PATH);
  } catch {
    // 심링크 실패 시 무시 — 새 경로가 원본
  }
}

function readSemoEnvCreds(): Record<string, string> {
  // 새 경로 우선, 없으면 레거시 폴백
  const envFile = fs.existsSync(SEMO_ENV_PATH) ? SEMO_ENV_PATH : LEGACY_ENV_PATH;
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
  const needsWrite =
    force ||
    hasNewKeys ||
    !fs.existsSync(SEMO_ENV_PATH) ||
    Object.keys(gistCreds).some((k) => !existing[k]);

  if (needsWrite) {
    writeSemoEnvFile(merged);
    console.log(chalk.green("  ✅ ~/.claude/semo/.env 저장됨 (권한: 600)"));
  } else {
    console.log(chalk.gray("  ~/.claude/semo/.env 변경 없음"));
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
    domainGuide += `- 서비스 KPI → \`domain: {서비스명}\`, key: \`kpi/{YYYY-MM-DD}\` (최신: 가장 최근 날짜)\n`;
    domainGuide += `- 서비스 마일스톤 → \`domain: {서비스명}\`, key: \`milestone/{slug}\`\n`;

    domainGuide += `\n**정확한 경로를 모를 때:**\n`;
    domainGuide += `1. \`semo kb search "검색어"\` → 결과의 \`[domain] key/sub_key\` 경로 확인\n`;
    domainGuide += `2. \`semo kb get <domain> <key> <sub_key>\` 실행\n`;
    domainGuide += `\n**도메인 자체를 모를 때:**\n`;
    domainGuide += `- \`semo kb ontology --action instances\` — 서비스 도메인 목록\n`;
    domainGuide += `- \`semo kb ontology --action routing-table\` — 전체 domain→key 매핑\n`;

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

// injectKbFirstToGlobalClaudeMd 제거 — generateThinRouter()로 대체 (semo-workspace.ts)


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

// updateGitignore 제거 — init 통합으로 프로젝트별 .gitignore 수정 불필요

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
            command: ". ~/.claude/semo/.env 2>/dev/null || . ~/.semo.env 2>/dev/null; semo context sync 2>/dev/null || true",
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
            command: ". ~/.claude/semo/.env 2>/dev/null || . ~/.semo.env 2>/dev/null; semo context push 2>/dev/null || true",
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
    console.log(chalk.cyan.bold("\n📦 SEMO 패키지 목록\n"));

    // DB 패키지 목록
    try {
      const packages = await getPackages();
      if (packages.length > 0) {
        console.log(chalk.white.bold("DB 패키지"));
        for (const pkg of packages) {
          console.log(`  ${chalk.cyan(pkg.name)} - ${pkg.description || ""}`);
        }
        console.log();
      } else {
        console.log(chalk.gray("  등록된 패키지가 없습니다.\n"));
      }
    } catch {
      console.log(chalk.yellow("  DB 연결 실패 — ~/.claude/semo/.env를 확인하세요.\n"));
    }
  });

// === status 명령어 ===
program
  .command("status")
  .description("SEMO 설치 상태를 확인합니다")
  .action(async () => {
    console.log(chalk.cyan.bold("\n📊 SEMO 설치 상태\n"));

    const home = os.homedir();

    // 글로벌 설정 확인
    console.log(chalk.white.bold("글로벌 설정 (~/.claude/semo/):"));
    const globalChecks = [
      { name: "~/.claude/semo/.env", path: path.join(home, ".claude", "semo", ".env") },
      { name: "~/.claude/semo/SOUL.md", path: path.join(home, ".claude", "semo", "SOUL.md") },
      { name: "~/.claude/skills/", path: path.join(home, ".claude", "skills") },
      { name: "~/.claude/commands/", path: path.join(home, ".claude", "commands") },
      { name: "~/.claude/agents/", path: path.join(home, ".claude", "agents") },
    ];

    let globalOk = true;
    for (const check of globalChecks) {
      const exists = fs.existsSync(check.path);
      console.log(`  ${exists ? chalk.green("✓") : chalk.red("✗")} ${check.name}`);
      if (!exists) globalOk = false;
    }

    // DB 연결 확인
    console.log(chalk.white.bold("\nDB 연결:"));
    const connected = await isDbConnected();
    if (connected) {
      console.log(chalk.green("  ✓ DB 연결 정상"));
    } else {
      console.log(chalk.red("  ✗ DB 연결 실패"));
      globalOk = false;
    }
    await closeConnection();

    console.log();
    if (globalOk) {
      console.log(chalk.green.bold("SEMO가 정상적으로 설치되어 있습니다."));
    } else {
      console.log(chalk.yellow("일부 구성 요소가 누락되었습니다. 'semo onboarding'을 실행하세요."));
    }
    console.log();
  });

// === update 명령어 ===
program
  .command("update")
  .description("SEMO를 최신 버전으로 업데이트합니다")
  .option("--self", "CLI만 업데이트")
  .option("--global", "글로벌 스킬/커맨드/에이전트를 DB 최신으로 갱신 (~/.claude/)")
  .action(async (options) => {
    // === --self: CLI만 업데이트 ===
    if (options.self) {
      console.log(chalk.cyan.bold("\n🔄 SEMO CLI 업데이트\n"));
      await showVersionComparison();

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
      console.log(chalk.green.bold("\n✅ CLI 업데이트 완료!\n"));
      return;
    }

    // === --global 또는 기본: DB 기반 글로벌 갱신 ===
    console.log(chalk.cyan.bold("\n🔄 SEMO 업데이트\n"));

    // 1. 버전 비교 (CLI only)
    await showVersionComparison();

    // 2. DB 연결 확인
    const connected = await isDbConnected();
    if (!connected) {
      console.log(chalk.red("  DB 연결 실패 — ~/.claude/semo/.env를 확인하세요."));
      await closeConnection();
      process.exit(1);
    }

    // 3. DB 기반 글로벌 스킬/커맨드/에이전트 갱신
    await setupStandardGlobal();

    // 4. Hooks 업데이트
    await setupHooks(true);

    await closeConnection();

    console.log(chalk.green.bold("\n✅ SEMO 업데이트 완료!\n"));
    console.log(chalk.gray("  💡 전체 재설치가 필요하면: semo onboarding -f\n"));
  });

// === migrate 명령어 (deprecated) ===
program
  .command("migrate")
  .description("[deprecated] semo-system 마이그레이션은 더 이상 필요하지 않습니다")
  .action(async () => {
    console.log(chalk.yellow("\n⚠ 'semo migrate'는 더 이상 필요하지 않습니다.\n"));
    console.log(chalk.gray("  SEMO는 이제 DB 기반으로 동작하며, semo-system/ 의존성이 제거되었습니다."));
    console.log(chalk.cyan("\n  전체 재설치가 필요하면:"));
    console.log(chalk.gray("    semo onboarding -f\n"));
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

    const home = os.homedir();
    const cwd = process.cwd();

    // 1. 레거시 환경 확인
    console.log(chalk.cyan("1. 레거시 환경 확인"));
    const legacyCheck = detectLegacyEnvironment(cwd);
    if (legacyCheck.hasLegacy) {
      console.log(chalk.yellow("   ⚠️ 레거시 환경 감지됨"));
      legacyCheck.legacyPaths.forEach(p => {
        console.log(chalk.gray(`      - ${p}`));
      });
      console.log(chalk.gray("   💡 레거시 폴더를 수동 삭제하세요 (semo-system/, semo-core/ 등)"));
    } else {
      console.log(chalk.green("   ✅ 레거시 환경 없음"));
    }

    // 2. DB 연결 확인
    console.log(chalk.cyan("\n2. DB 연결"));
    const connected = await isDbConnected();
    if (connected) {
      console.log(chalk.green("   ✅ DB 연결 정상"));
    } else {
      console.log(chalk.red("   ❌ DB 연결 실패"));
      console.log(chalk.gray("   💡 흔한 원인:"));
      console.log(chalk.gray("      - SSH 터널 미실행 (로컬 개발 시 필수)"));
      console.log(chalk.gray("      - ~/.claude/semo/.env의 DATABASE_URL 오류"));
      console.log(chalk.gray("   💡 해결: SSH 터널 실행 후 semo onboarding 재시도"));
    }

    // 3. 글로벌 설정 확인
    console.log(chalk.cyan("\n3. 글로벌 설정 (~/.claude/semo/)"));
    const globalChecks = [
      { name: ".env", path: path.join(home, ".claude", "semo", ".env") },
      { name: "SOUL.md", path: path.join(home, ".claude", "semo", "SOUL.md") },
      { name: "skills/", path: path.join(home, ".claude", "skills") },
      { name: "commands/", path: path.join(home, ".claude", "commands") },
      { name: "agents/", path: path.join(home, ".claude", "agents") },
    ];

    for (const check of globalChecks) {
      const exists = fs.existsSync(check.path);
      if (exists) {
        console.log(chalk.green(`   ✅ ${check.name}`));
      } else {
        console.log(chalk.yellow(`   ⚠️ ${check.name} 없음`));
      }
    }

    await closeConnection();
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
  kbDelete,
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
  ontoRegister,
  ontoAddKey,
  ontoRemoveKey,
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
  .option("--short", "미리보기 모드 (content를 80자로 잘라서 표시)")
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
          const score = (entry as any).score;
          const scoreStr = score ? chalk.yellow(` (${(score * 100).toFixed(1)}%)`) : "";
          const fullKey = entry.sub_key ? `${entry.key}/${entry.sub_key}` : entry.key;
          console.log(chalk.cyan(`  [${entry.domain}] `) + chalk.white(fullKey) + scoreStr);
          if (options.short) {
            const preview = entry.content.substring(0, 80).replace(/\n/g, " ");
            console.log(chalk.gray(`    ${preview}${entry.content.length > 80 ? "..." : ""}`));
          } else {
            console.log(chalk.gray(`    ${entry.content}`));
          }
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
  .description("KB 항목 쓰기 (upsert) — 임베딩 자동 생성 + 스키마 검증 (key는 kebab-case만 허용)")
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
  .command("delete <domain> <key> [sub_key]")
  .description("KB 항목 삭제 (domain + key + sub_key)")
  .option("--yes", "확인 프롬프트 건너뛰기 (크론/스크립트용)")
  .action(async (domain, key, subKey, options) => {
    try {
      const pool = getPool();

      // 삭제 전 항목 확인
      const entry = await kbGet(pool, domain, key, subKey);
      if (!entry) {
        console.log(chalk.yellow(`\n  항목 없음: ${domain}/${key}${subKey ? '/' + subKey : ''}\n`));
        await closeConnection();
        process.exit(1);
      }

      // 확인 프롬프트 (--yes가 없으면)
      if (!options.yes) {
        const fullPath = `${domain}/${entry.key}${entry.sub_key ? '/' + entry.sub_key : ''}`;
        console.log(chalk.cyan(`\n📄 삭제 대상: ${fullPath}`));
        console.log(chalk.gray(`  version: ${entry.version} | created_by: ${entry.created_by} | updated: ${entry.updated_at}`));
        console.log(chalk.gray(`  content: ${entry.content.substring(0, 120)}${entry.content.length > 120 ? '...' : ''}\n`));

        const { createInterface } = await import("readline");
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.yellow("  정말 삭제하시겠습니까? (y/N): "), resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== "y") {
          console.log(chalk.gray("  취소됨.\n"));
          await closeConnection();
          return;
        }
      }

      const result = await kbDelete(pool, domain, key, subKey);
      if (result.deleted) {
        const fullPath = `${domain}/${result.entry!.key}${result.entry!.sub_key ? '/' + result.entry!.sub_key : ''}`;
        console.log(chalk.green(`✔ KB 삭제 완료: ${fullPath}`));
      } else {
        console.log(chalk.red(`✖ KB 삭제 실패: ${result.error}`));
        process.exit(1);
      }
      await closeConnection();
    } catch (err) {
      console.error(chalk.red(`삭제 실패: ${err}`));
      await closeConnection();
      process.exit(1);
    }
  });

kbCmd
  .command("ontology")
  .description("온톨로지 조회 — 도메인/타입/스키마/라우팅 테이블")
  .option("--action <type>", "동작 (list|show|services|types|instances|schema|routing-table|register|add-key|remove-key)", "list")
  .option("--domain <name>", "action=show|register 시 도메인")
  .option("--type <name>", "action=schema|register|add-key|remove-key 시 타입 키")
  .option("--key <name>", "action=add-key|remove-key 시 스키마 키")
  .option("--key-type <type>", "action=add-key 시 키 유형 (singleton|collection)", "singleton")
  .option("--required", "action=add-key 시 필수 여부")
  .option("--hint <text>", "action=add-key 시 값 힌트")
  .option("--description <text>", "action=register|add-key 시 설명")
  .option("--service <name>", "action=register 시 서비스 그룹")
  .option("--tags <tags>", "action=register 시 태그 (쉼표 구분)")
  .option("--no-init", "action=register 시 필수 KB entry 자동 생성 건너뛰기")
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
      } else if (action === "register") {
        if (!options.domain) {
          console.log(chalk.red("--domain 옵션이 필요합니다."));
          process.exit(1);
        }
        if (!options.type) {
          console.log(chalk.red("--type 옵션이 필요합니다. (예: --type service, --type team, --type person)"));
          const types = await ontoListTypes(pool);
          console.log(chalk.gray(`사용 가능한 타입: ${types.map(t => t.type_key).join(", ")}`));
          process.exit(1);
        }

        const tags = options.tags ? (options.tags as string).split(",").map((t: string) => t.trim()) : undefined;
        const result = await ontoRegister(pool, {
          domain: options.domain,
          entity_type: options.type,
          description: options.description,
          service: options.service,
          tags,
          init_required: options.init !== false,
        });

        if (options.format === "json") {
          console.log(JSON.stringify(result, null, 2));
        } else {
          if (result.success) {
            console.log(chalk.green(`\n✅ 도메인 '${options.domain}' 등록 완료 (타입: ${options.type})`));
            if (result.created_entries && result.created_entries.length > 0) {
              console.log(chalk.gray(`  초기 KB entry ${result.created_entries.length}건 생성:`));
              for (const e of result.created_entries) {
                console.log(chalk.gray(`    - ${e.key}`));
              }
            }
            console.log(chalk.gray(`\n  다음 단계: semo kb upsert ${options.domain} <key> --content "..." 으로 데이터 입력\n`));
          } else {
            console.log(chalk.red(`\n❌ 등록 실패: ${result.error}\n`));
            process.exit(1);
          }
        }
      } else if (action === "add-key") {
        if (!options.type) {
          console.log(chalk.red("--type 옵션이 필요합니다. (예: --type service)"));
          process.exit(1);
        }
        if (!options.key) {
          console.log(chalk.red("--key 옵션이 필요합니다. (예: --key slack_channel)"));
          process.exit(1);
        }
        const result = await ontoAddKey(pool, {
          type_key: options.type,
          scheme_key: options.key,
          description: options.description,
          key_type: options.keyType as "singleton" | "collection",
          required: options.required || false,
          value_hint: options.hint,
        });
        if (result.success) {
          console.log(chalk.green(`\n✅ 스키마 키 추가 완료: ${options.type}.${options.key} (${options.keyType})\n`));
        } else {
          console.log(chalk.red(`\n❌ 스키마 키 추가 실패: ${result.error}\n`));
          process.exit(1);
        }

      } else if (action === "remove-key") {
        if (!options.type) {
          console.log(chalk.red("--type 옵션이 필요합니다."));
          process.exit(1);
        }
        if (!options.key) {
          console.log(chalk.red("--key 옵션이 필요합니다."));
          process.exit(1);
        }
        const result = await ontoRemoveKey(pool, options.type, options.key);
        if (result.success) {
          console.log(chalk.green(`\n✅ 스키마 키 삭제 완료: ${options.type}.${options.key}\n`));
        } else {
          console.log(chalk.red(`\n❌ 스키마 키 삭제 실패: ${result.error}\n`));
          process.exit(1);
        }

      } else {
        console.log(chalk.red(`알 수 없는 action: '${action}'. 사용 가능: list, show, services, types, instances, schema, routing-table, register, add-key, remove-key`));
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

ontoCmd
  .command("register <domain>")
  .description("새 온톨로지 도메인 등록")
  .requiredOption("--type <type>", "엔티티 타입 (예: service, team, person, bot)")
  .option("--description <text>", "도메인 설명")
  .option("--service <name>", "서비스 그룹")
  .option("--tags <tags>", "태그 (쉼표 구분)")
  .option("--no-init", "필수 KB entry 자동 생성 건너뛰기")
  .option("--format <type>", "출력 형식 (json|table)", "table")
  .action(async (domain, options) => {
    try {
      const pool = getPool();
      const tags = options.tags ? (options.tags as string).split(",").map((t: string) => t.trim()) : undefined;

      const result = await ontoRegister(pool, {
        domain,
        entity_type: options.type,
        description: options.description,
        service: options.service,
        tags,
        init_required: options.init !== false,
      });

      if (options.format === "json") {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.success) {
          console.log(chalk.green(`\n✅ 도메인 '${domain}' 등록 완료 (타입: ${options.type})`));
          if (result.created_entries && result.created_entries.length > 0) {
            console.log(chalk.gray(`  초기 KB entry ${result.created_entries.length}건 생성:`));
            for (const e of result.created_entries) {
              console.log(chalk.gray(`    - ${e.key}`));
            }
          }
          console.log(chalk.gray(`\n  다음 단계: semo kb upsert ${domain} <key> --content "..." 으로 데이터 입력\n`));
        } else {
          console.log(chalk.red(`\n❌ 등록 실패: ${result.error}\n`));
          process.exit(1);
        }
      }

      await closeConnection();
    } catch (err) {
      console.error(chalk.red(`등록 실패: ${err}`));
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

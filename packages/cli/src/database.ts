/**
 * SEMO CLI - PostgreSQL 데이터베이스 클라이언트
 *
 * 스킬, 커맨드, 에이전트 정보를 조회합니다.
 * DB 연결 실패 시 하드코딩된 폴백 데이터를 사용합니다.
 *
 * v3.14.0: Supabase → PostgreSQL 전환
 * v4.0.0: 스키마 통합 — SoT를 *_definitions 테이블로 변경
 *   - skill_definitions (prompt as content)
 *   - agent_definitions (persona_prompt as content)
 *   - command_definitions (prompt as content)
 *   - semo.skills / semo.agents / semo.commands 는 하위 호환 뷰
 */

import { Pool, PoolClient } from "pg";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { parseEnvContent } from "./env-parser";

// ~/.semo.env 자동 로드 — LaunchAgent / Claude Code 앱 / cron 등
// 인터랙티브 쉘이 아닌 환경에서 환경변수를 공급한다.
// 이미 설정된 환경변수는 덮어쓰지 않는다 (env var > file).
function loadSemoEnv(): void {
  const envFile = path.join(os.homedir(), ".semo.env");
  if (!fs.existsSync(envFile)) return;
  try {
    const creds = parseEnvContent(fs.readFileSync(envFile, "utf8"));
    for (const [key, val] of Object.entries(creds)) {
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // 파일 읽기 실패 시 무시 — 환경변수가 없으면 이후 buildDbConfig에서 에러
  }
}

// 최초 import 시 즉시 실행
loadSemoEnv();

// PostgreSQL 연결 정보 (팀 코어)
// DATABASE_URL 우선, 없으면 개별 SEMO_DB_* 변수 사용
function buildDbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    };
  }
  if (!process.env.SEMO_DB_HOST && !process.env.DATABASE_URL) {
    throw new Error(
      "DB 연결 정보가 없습니다. DATABASE_URL 또는 SEMO_DB_HOST 환경변수를 설정하세요."
    );
  }
  return {
    host: process.env.SEMO_DB_HOST,
    port: parseInt(process.env.SEMO_DB_PORT || "5432"),
    user: process.env.SEMO_DB_USER || "app",
    password: process.env.SEMO_DB_PASSWORD,
    database: process.env.SEMO_DB_NAME || "appdb",
    ssl: false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  };
}

// PostgreSQL Pool (싱글톤) — 최초 getPool() 호출 시점에 config 평가
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(buildDbConfig());
  }
  return pool;
}

// DB 연결 가능 여부 확인
let dbAvailable: boolean | null = null;

async function checkDbConnection(): Promise<boolean> {
  if (dbAvailable !== null) return dbAvailable;

  try {
    const client = await getPool().connect();
    await client.query("SELECT 1");
    client.release();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }

  return dbAvailable;
}

// ============================================================
// 타입 정의
// ============================================================

export interface Skill {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  content: string;
  bot_ids: string[];
  category: string;
  package: string;
  is_active: boolean;
  is_required: boolean;
  install_order: number;
  version: string;
}

export interface SemoCommand {
  id: string;
  name: string;
  folder: string;
  content: string;
  description: string | null;
  is_active: boolean;
}

export interface Agent {
  id: string;
  name: string;
  display_name: string;
  content: string;
  package: string;
  is_active: boolean;
  install_order: number;
  metadata?: Record<string, unknown>;
}

export interface Package {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  layer: string;
  package_type: string;
  version: string;
  is_active: boolean;
  is_required: boolean;
  install_order: number;
}

export interface BotDelegation {
  id: number;
  from_bot_id: string;
  to_bot_id: string;
  delegation_type: string;
  domains: string[];
  method: string;
  channel: string | null;
  max_roundtrips: number;
  priority: string;
  is_active: boolean;
}

export interface BotProtocol {
  id: number;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
}

// ============================================================
// 폴백 데이터 (DB 연결 실패 시 사용)
// ============================================================

const FALLBACK_SKILLS: Skill[] = [];

const FALLBACK_COMMANDS: SemoCommand[] = [];

const FALLBACK_AGENTS: Agent[] = [
  { id: "agent-semiclaw", name: "semiclaw", display_name: "SemiClaw 🦀", content: "", package: "openclaw", is_active: true, install_order: 1 },
  { id: "agent-workclaw", name: "workclaw", display_name: "WorkClaw 🛠️", content: "", package: "openclaw", is_active: true, install_order: 2 },
  { id: "agent-reviewclaw", name: "reviewclaw", display_name: "ReviewClaw 🔍", content: "", package: "openclaw", is_active: true, install_order: 3 },
  { id: "agent-planclaw", name: "planclaw", display_name: "PlanClaw 🗓️", content: "", package: "openclaw", is_active: true, install_order: 4 },
  { id: "agent-designclaw", name: "designclaw", display_name: "DesignClaw 🎨", content: "", package: "openclaw", is_active: true, install_order: 5 },
  { id: "agent-infraclaw", name: "infraclaw", display_name: "InfraClaw 🏗️", content: "", package: "openclaw", is_active: true, install_order: 6 },
  { id: "agent-growthclaw", name: "growthclaw", display_name: "GrowthClaw 🌱", content: "", package: "openclaw", is_active: true, install_order: 7 },
];

const FALLBACK_PACKAGES: Package[] = [
  { id: "pkg-cli", name: "semo-cli", display_name: "SEMO CLI", description: "CLI 도구 (컨텍스트 동기화, 봇 관리)", layer: "standard", package_type: "standard", version: "4.2.0", is_active: true, is_required: true, install_order: 10 },
  { id: "pkg-dashboard", name: "semo-dashboard", display_name: "SEMO Dashboard", description: "봇 상태/KB 대시보드", layer: "standard", package_type: "standard", version: "0.1.0", is_active: true, is_required: false, install_order: 30 },
];

// ============================================================
// DB 조회 함수
// ============================================================

/**
 * 활성 스킬 목록 조회
 * SoT: skill_definitions (prompt as content — CLI 인터페이스 유지)
 */
export async function getActiveSkills(): Promise<Skill[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    console.warn("⚠️ DB 연결 실패, 폴백 스킬 목록 사용");
    return FALLBACK_SKILLS.filter((s) => s.is_active);
  }

  try {
    const result = await getPool().query(`
      SELECT id, name, display_name, description,
             prompt AS content,
             COALESCE(
               ARRAY(SELECT jsonb_array_elements_text(metadata->'bot_ids')),
               ARRAY[]::text[]
             ) AS bot_ids,
             category, package, is_active, is_required, install_order, version
      FROM semo.skill_definitions
      WHERE is_active = true AND office_id IS NULL
      ORDER BY install_order
    `);
    return result.rows;
  } catch (error) {
    console.warn("⚠️ 스킬 조회 실패, 폴백 데이터 사용:", error);
    return FALLBACK_SKILLS.filter((s) => s.is_active);
  }
}

/**
 * 스킬 이름 목록만 조회
 */
export async function getActiveSkillNames(): Promise<string[]> {
  const skills = await getActiveSkills();
  return skills.map((s) => s.name);
}

/**
 * 특정 봇의 스킬 목록 조회 (공유 + 봇 전용)
 * skill_definitions.target_agents 배열로 매핑 — 전용 스킬 먼저, 공유 스킬 뒤
 */
export async function getActiveSkillsForBot(botId: string): Promise<Skill[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    console.warn("⚠️ DB 연결 실패, 폴백 스킬 목록 사용");
    return FALLBACK_SKILLS.filter((s) => s.is_active);
  }

  try {
    const result = await getPool().query(
      `SELECT sd.id, sd.name, sd.display_name, sd.description,
              sd.prompt AS content,
              COALESCE(
                ARRAY(SELECT jsonb_array_elements_text(sd.metadata->'bot_ids')),
                ARRAY[]::text[]
              ) AS bot_ids,
              sd.category, sd.package, sd.is_active, sd.is_required,
              sd.install_order, sd.version
       FROM semo.skill_definitions sd
       WHERE sd.is_active = true
         AND sd.office_id IS NULL
         AND (NOT sd.metadata ? 'bot_ids' OR sd.metadata->'bot_ids' ? $1)
       ORDER BY
         CASE WHEN sd.metadata->'bot_ids' ? $1 THEN 0 ELSE 1 END,
         sd.install_order`,
      [botId]
    );
    return result.rows;
  } catch (error) {
    console.warn("⚠️ 봇 스킬 조회 실패, 폴백 데이터 사용:", error);
    return FALLBACK_SKILLS.filter((s) => s.is_active);
  }
}

/**
 * 커맨드 목록 조회
 * SoT: command_definitions (prompt as content — CLI 인터페이스 유지)
 */
export async function getCommands(): Promise<SemoCommand[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    console.warn("⚠️ DB 연결 실패, 폴백 커맨드 목록 사용");
    return FALLBACK_COMMANDS.filter((c) => c.is_active);
  }

  try {
    const result = await getPool().query(`
      SELECT id, name, folder,
             prompt AS content,
             description, is_active
      FROM command_definitions
      WHERE is_active = true AND office_id IS NULL
    `);
    return result.rows;
  } catch (error) {
    console.warn("⚠️ 커맨드 조회 실패, 폴백 데이터 사용:", error);
    return FALLBACK_COMMANDS.filter((c) => c.is_active);
  }
}

/**
 * 에이전트 목록 조회
 * SoT: agent_definitions (persona_prompt as content — CLI 인터페이스 유지)
 */
export async function getAgents(): Promise<Agent[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    console.warn("⚠️ DB 연결 실패, 폴백 에이전트 목록 사용");
    return FALLBACK_AGENTS.filter((a) => a.is_active);
  }

  try {
    const result = await getPool().query(`
      SELECT id, name, name AS display_name,
             persona_prompt AS content,
             package, is_active, install_order,
             metadata
      FROM agent_definitions
      WHERE is_active = true AND office_id IS NULL
      ORDER BY install_order
    `);
    return result.rows;
  } catch (error) {
    console.warn("⚠️ 에이전트 조회 실패, 폴백 데이터 사용:", error);
    return FALLBACK_AGENTS.filter((a) => a.is_active);
  }
}

/**
 * 패키지 목록 조회
 */
export async function getPackages(layer?: string): Promise<Package[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    console.warn("⚠️ DB 연결 실패, 폴백 패키지 목록 사용");
    const fallback = FALLBACK_PACKAGES.filter((p) => p.is_active);
    return layer ? fallback.filter((p) => p.layer === layer) : fallback;
  }

  try {
    let query = `
      SELECT id, name, display_name, description, layer, package_type,
             version, is_active, is_required, install_order
      FROM semo.packages
      WHERE is_active = true
    `;
    const params: string[] = [];

    if (layer) {
      query += ` AND layer = $1`;
      params.push(layer);
    }

    query += ` ORDER BY install_order`;

    const result = await getPool().query(query, params);
    return result.rows;
  } catch (error) {
    console.warn("⚠️ 패키지 조회 실패, 폴백 데이터 사용:", error);
    const fallback = FALLBACK_PACKAGES.filter((p) => p.is_active);
    return layer ? fallback.filter((p) => p.layer === layer) : fallback;
  }
}

/**
 * 카테고리별 스킬 개수 조회
 */
export async function getSkillCountByCategory(): Promise<Record<string, number>> {
  const skills = await getActiveSkills();
  const counts: Record<string, number> = {};

  for (const skill of skills) {
    counts[skill.category] = (counts[skill.category] || 0) + 1;
  }

  return counts;
}

/**
 * 위임 매트릭스 조회
 */
export async function getDelegations(botId?: string): Promise<BotDelegation[]> {
  const isConnected = await checkDbConnection();
  if (!isConnected) return [];

  try {
    let query = `
      SELECT id, from_bot_id, to_bot_id, delegation_type,
             domains, method, channel, max_roundtrips, priority, is_active
      FROM semo.bot_delegation
      WHERE is_active = true
    `;
    const params: string[] = [];
    if (botId) {
      query += ` AND from_bot_id = $1`;
      params.push(botId);
    }
    query += ` ORDER BY from_bot_id, to_bot_id`;

    const result = await getPool().query(query, params);
    return result.rows;
  } catch {
    // Table may not exist yet
    return [];
  }
}

/**
 * 프로토콜 메타데이터 조회
 */
export async function getProtocol(): Promise<BotProtocol[]> {
  const isConnected = await checkDbConnection();
  if (!isConnected) return [];

  try {
    const result = await getPool().query(`
      SELECT id, key, value, description
      FROM semo.bot_protocol
      ORDER BY key
    `);
    return result.rows;
  } catch {
    // Table may not exist yet
    return [];
  }
}

/**
 * DB 연결 종료
 */
export async function closeConnection(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbAvailable = null;
  }
}

/**
 * DB 연결 상태 확인
 */
export async function isDbConnected(): Promise<boolean> {
  return checkDbConnection();
}

/**
 * MCP KB Server — Database module
 *
 * Slimmed-down copy of packages/cli/src/database.ts
 * No ora/chalk/commander dependencies — pure DB client for long-running MCP process.
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ============================================================
// Env parser (inlined from cli/src/env-parser.ts)
// ============================================================

function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const raw of content.split("\n")) {
    const line = raw.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      val = val.slice(1, -1);
    }
    if (key) result[key] = val;
  }
  return result;
}

// ============================================================
// ~/.semo.env 자동 로드
// ============================================================

function loadSemoEnv(): void {
  const envFile = path.join(os.homedir(), ".semo.env");
  if (!fs.existsSync(envFile)) return;
  try {
    const creds = parseEnvContent(fs.readFileSync(envFile, "utf8"));
    for (const [key, val] of Object.entries(creds)) {
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // 파일 읽기 실패 시 무시
  }
}

// 최초 import 시 즉시 실행
loadSemoEnv();

// ============================================================
// DB Config & Pool
// ============================================================

function buildDbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : false,
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

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(buildDbConfig());
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

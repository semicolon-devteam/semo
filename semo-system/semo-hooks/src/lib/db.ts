/**
 * semo-hooks DB 연결 모듈
 *
 * mcp-server/memory.ts의 패턴을 재사용
 * 암호화된 토큰 또는 환경변수 지원
 */

import { Pool } from 'pg';
import { decrypt } from './crypto.js';
import type { InteractionLogInsert, SessionUpsert } from './types.js';

// 암호화된 토큰 로드
function loadEncryptedDbPassword(): string {
  try {
    // CI/CD에서 생성된 암호화 토큰 (배포 패키지용)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const generated = require('./tokens.generated.js');
    if (generated.ENCRYPTED_TOKENS?.DB_PASSWORD) {
      const decrypted = decrypt(generated.ENCRYPTED_TOKENS.DB_PASSWORD);
      if (decrypted) return decrypted;
    }
  } catch {
    // tokens.generated.js 없음 - 로컬 개발 환경
  }
  return '';
}

// DB 비밀번호 가져오기 (우선순위: 환경변수 > 암호화된 팀 토큰)
function getDbPassword(): string {
  // 1. 환경변수 우선 (로컬 개발/테스트용)
  if (process.env.SEMO_DB_PASSWORD) {
    return process.env.SEMO_DB_PASSWORD;
  }
  // 2. 암호화된 팀 토큰 (배포 패키지용)
  return loadEncryptedDbPassword();
}

// DB 설정 (환경변수 또는 기본값)
const DB_CONFIG = {
  host: process.env.SEMO_DB_HOST || '3.38.162.21',
  port: parseInt(process.env.SEMO_DB_PORT || '5432'),
  database: process.env.SEMO_DB_NAME || 'appdb',
  user: process.env.SEMO_DB_USER || 'app',
  password: getDbPassword(),
  max: 3, // Hook은 짧게 실행되므로 적은 연결
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
};

// Connection Pool (싱글톤)
let pool: Pool | null = null;

/**
 * DB Pool 가져오기 (Lazy initialization)
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(DB_CONFIG);

    pool.on('error', (err) => {
      if (process.env.SEMO_HOOKS_DEBUG) {
        console.error('[semo-hooks] Pool error:', err.message);
      }
    });
  }
  return pool;
}

/**
 * DB 연결 종료
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * DB 연결 가능 여부 확인
 */
export function isDbEnabled(): boolean {
  return !!DB_CONFIG.password;
}

/**
 * 기본 사용자 ID (환경변수 또는 기본값)
 */
export function getDefaultUserId(): string {
  return process.env.SEMO_USER_ID || '00000000-0000-0000-0000-000000000001';
}

/**
 * 기본 에이전트 ID (semo-hooks용)
 */
export function getDefaultAgentId(): string {
  return '00000000-0000-0000-0000-000000000002';
}

/**
 * 상호작용 로그 저장
 */
export async function logInteraction(params: InteractionLogInsert): Promise<void> {
  if (!isDbEnabled()) return;

  try {
    const p = getPool();
    await p.query(`
      INSERT INTO semo.interaction_logs
        (user_id, session_id, agent_id, role, content, skill_name, skill_args, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      params.user_id,
      params.session_id,
      params.agent_id,
      params.role,
      params.content,
      params.skill_name,
      params.skill_args ? JSON.stringify(params.skill_args) : null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]);
  } catch (error) {
    if (process.env.SEMO_HOOKS_DEBUG) {
      console.error('[semo-hooks] Log failed:', (error as Error).message);
    }
  }
}

/**
 * 세션 upsert
 */
export async function upsertSession(params: SessionUpsert): Promise<void> {
  if (!isDbEnabled()) return;

  try {
    const p = getPool();
    await p.query(`
      INSERT INTO semo.sessions (session_id, user_id, project_path, metadata)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (session_id) DO UPDATE SET
        project_path = COALESCE(EXCLUDED.project_path, semo.sessions.project_path),
        metadata = COALESCE(EXCLUDED.metadata, semo.sessions.metadata)
    `, [
      params.session_id,
      params.user_id,
      params.cwd,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]);
  } catch (error) {
    if (process.env.SEMO_HOOKS_DEBUG) {
      console.error('[semo-hooks] Session upsert failed:', (error as Error).message);
    }
  }
}

/**
 * 세션 종료 업데이트
 */
export async function endSession(sessionId: string, reason: string): Promise<void> {
  if (!isDbEnabled()) return;

  try {
    const p = getPool();
    await p.query(`
      UPDATE semo.sessions
      SET
        metadata = jsonb_set(
          COALESCE(metadata, '{}')::jsonb,
          '{ended_at}',
          to_jsonb(NOW()::text)
        ) || jsonb_build_object('end_reason', $2)
      WHERE session_id = $1
    `, [sessionId, reason]);
  } catch (error) {
    if (process.env.SEMO_HOOKS_DEBUG) {
      console.error('[semo-hooks] Session end failed:', (error as Error).message);
    }
  }
}

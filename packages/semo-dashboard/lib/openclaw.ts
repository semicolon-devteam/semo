/**
 * @file lib/openclaw.ts
 * @description OpenClaw 데이터 접근 레이어.
 *   대시보드는 semo.bot_sessions / semo.bot_cron_jobs 테이블을 primary source로 사용한다.
 *   세션/크론 데이터는 `semo sessions sync --all` (SessionStart 훅 또는 수동)으로 채워진다.
 * @dependencies lib/db.ts, DATABASE_URL 환경변수
 * @usage
 *   import { listSessions, listCronJobs } from '@/lib/openclaw';
 *   const sessions = await listSessions('workclaw');
 *
 * @remarks
 *   기존 openclaw CLI 호출 (`openclaw sessions list --json`) 방식은 제거되었다.
 *   OpenClaw 봇은 게이트웨이(WS/HTTP 서버)로 운영되므로 openclaw CLI가 PATH에 없고,
 *   Claude Code SessionStart/Stop 훅도 트리거되지 않는다.
 */

import { query } from '@/lib/db';

/** OpenClaw 세션 조회 결과 형태 */
export interface OpenClawSession {
  /** 세션 고유 키 */
  key: string;
  /** 사용자 표시 라벨 */
  label?: string;
  /** 세션 종류 */
  kind?: 'main' | 'isolated';
  /** 채팅 채널 (e.g. 'slack', 'telegram') */
  channel?: string;
  /** 마지막 메시지 ISO 타임스탬프 */
  lastMessageAt?: string;
  /** 누적 메시지 수 */
  messageCount?: number;
}

/** OpenClaw 크론 잡 조회 결과 형태 */
export interface OpenClawCronJob {
  /** 잡 고유 ID */
  id: string;
  /** 잡 이름 */
  name?: string;
  /** 실행 스케줄 정의 (JSONB) */
  schedule: {
    kind: 'cron' | 'every' | 'at';
    [key: string]: unknown;
  };
  /** 활성화 여부 */
  enabled: boolean;
  /** 마지막 실행 ISO 타임스탬프 */
  lastRun?: string;
  /** 다음 예정 실행 ISO 타임스탬프 */
  nextRun?: string;
  /** 대상 세션 키 */
  sessionTarget?: string;
}

/**
 * DB에서 봇 세션 목록을 조회한다.
 * `semo sessions sync --all`로 채워진 데이터를 읽는다.
 *
 * @param botId - 봇 식별자
 * @param limit - 최대 반환 건수 (기본값: 120)
 * @returns OpenClawSession 배열 (DB 오류 시 빈 배열)
 */
export async function listSessions(botId: string, limit = 120): Promise<OpenClawSession[]> {
  try {
    const result = await query<{
      session_key: string;
      label: string | null;
      kind: string | null;
      chat_type: string | null;
      last_activity: string | null;
      message_count: number;
    }>(
      `SELECT session_key, label, kind, chat_type, last_activity, message_count
       FROM semo.bot_sessions
       WHERE bot_id = $1
       ORDER BY last_activity DESC NULLS LAST
       LIMIT $2`,
      [botId, limit]
    );

    return result.rows.map(row => ({
      key: row.session_key,
      label: row.label ?? undefined,
      kind: (row.kind === 'isolated' ? 'isolated' : 'main') as 'main' | 'isolated',
      channel: row.chat_type ?? undefined,
      lastMessageAt: row.last_activity ?? undefined,
      messageCount: row.message_count,
    }));
  } catch {
    return [];
  }
}

/**
 * DB에서 봇 크론 잡 목록을 조회한다.
 *
 * @param botId - 봇 식별자
 * @returns OpenClawCronJob 배열 (DB 오류 시 빈 배열)
 */
export async function listCronJobs(botId: string): Promise<OpenClawCronJob[]> {
  try {
    const result = await query<{
      job_id: string;
      name: string | null;
      schedule: OpenClawCronJob['schedule'];
      enabled: boolean;
      last_run: string | null;
      next_run: string | null;
      session_target: string | null;
    }>(
      `SELECT job_id, name, schedule, enabled, last_run, next_run, session_target
       FROM semo.bot_cron_jobs
       WHERE bot_id = $1
       ORDER BY next_run NULLS LAST`,
      [botId]
    );

    return result.rows.map(row => ({
      id: row.job_id,
      name: row.name ?? undefined,
      schedule: row.schedule,
      enabled: row.enabled,
      lastRun: row.last_run ?? undefined,
      nextRun: row.next_run ?? undefined,
      sessionTarget: row.session_target ?? undefined,
    }));
  } catch {
    return [];
  }
}

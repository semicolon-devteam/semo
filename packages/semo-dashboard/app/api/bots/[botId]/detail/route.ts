/**
 * @file app/api/bots/[botId]/detail/route.ts
 * @description 특정 봇의 상세 정보 API. 세션·크론잡(DB)과 설정·파일·메모리(GitHub)를
 *   한 번에 조합하여 BotDetail 객체로 반환한다.
 *
 * @api GET /api/bots/:botId/detail
 * @apiSuccess {BotDetail} 200 - config, files, memory, activity 포함 상세 객체
 * @apiError {object} 500 - { error: string } DB 연결 실패 또는 GitHub API 오류 시
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getFileContent, getBotFiles } from '@/lib/github';
import type { BotDetail, Session, CronJob, BotFile, DailyLog } from '@/types';

// Force dynamic rendering to prevent build-time DB connection
export const dynamic = 'force-dynamic';

/** semo.bot_sessions 테이블 행 형태 */
interface SessionRow {
  /** OpenClaw 세션 고유 키 */
  session_key: string;
  /** 사용자 표시 라벨 */
  label: string;
  /** 세션 종류 */
  kind: 'main' | 'isolated';
  /** 채팅 채널 종류 */
  chat_type: string;
  /** 마지막 메시지 ISO 타임스탬프 */
  last_activity: string;
  /** 누적 메시지 수 */
  message_count: number;
}

/** semo.bot_cron_jobs 테이블 행 형태 */
interface CronJobRow {
  /** 잡 고유 ID */
  job_id: string;
  /** 잡 이름 */
  name: string;
  /** 실행 스케줄 JSONB */
  schedule: CronJob['schedule'];
  /** 활성화 여부 */
  enabled: boolean;
  /** 마지막 실행 ISO 타임스탬프 */
  last_run: string | null;
  /** 다음 예정 실행 ISO 타임스탬프 */
  next_run: string | null;
  /** 대상 세션 키 */
  session_target: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;

    // Step 1: Fetch sessions from DB
    const sessionsResult = await query<SessionRow>(`
      SELECT session_key, label, kind, chat_type, last_activity, message_count
      FROM semo.bot_sessions
      WHERE bot_id = $1
      ORDER BY last_activity DESC
    `, [botId]);

    const sessions: Session[] = sessionsResult.rows.map((row: SessionRow) => ({
      sessionKey: row.session_key,
      label: row.label,
      kind: row.kind,
      chatType: row.chat_type,
      lastActivity: row.last_activity,
      messageCount: row.message_count,
    }));

    // Step 2: Fetch cron jobs from DB
    const cronResult = await query<CronJobRow>(`
      SELECT job_id, name, schedule, enabled, last_run, next_run, session_target
      FROM semo.bot_cron_jobs
      WHERE bot_id = $1
      ORDER BY next_run NULLS LAST
    `, [botId]).catch(() => ({ rows: [] as CronJobRow[] }));

    const cronJobs: CronJob[] = cronResult.rows.map((row: CronJobRow) => ({
      jobId: row.job_id,
      name: row.name,
      schedule: row.schedule,
      enabled: row.enabled,
      lastRun: row.last_run || undefined,
      nextRun: row.next_run || undefined,
    }));

    // Step 3: Fetch config files from GitHub (SOUL.md, AGENTS.md, USER.md)
    const [soul, agents, user] = await Promise.all([
      getFileContent(`semo-system/bot-workspaces/${botId}/SOUL.md`).catch(() => ''),
      getFileContent(`semo-system/bot-workspaces/${botId}/AGENTS.md`).catch(() => ''),
      getFileContent(`semo-system/bot-workspaces/${botId}/USER.md`).catch(() => ''),
    ]);

    // Step 4: Fetch workspace files (top-level)
    const files: BotFile[] = await getBotFiles(botId)
      .then(gitHubFiles => gitHubFiles.map(f => ({
        path: f.name,
        type: f.type === 'dir' ? 'directory' : 'file' as const,
      })))
      .catch(() => []);

    // Step 5: Fetch memory files (decisions.md, team.md)
    const [decisions, team] = await Promise.all([
      getFileContent(`semo-system/bot-workspaces/${botId}/memory/decisions.md`).catch(() => ''),
      getFileContent(`semo-system/bot-workspaces/${botId}/memory/team.md`).catch(() => ''),
    ]);

    // Step 6: Fetch recent daily logs (last 3 days)
    const today = new Date();
    const dailyLogs: DailyLog[] = [];

    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

      const content = await getFileContent(
        `semo-system/bot-workspaces/${botId}/memory/${dateStr}.md`
      ).catch(() => null);

      if (content) {
        dailyLogs.push({ date: dateStr, content });
      }
    }

    const detail: BotDetail = {
      config: {
        soul,
        agents,
        user,
      },
      files,
      memory: {
        decisions,
        team,
        dailyLogs,
      },
      activity: {
        sessions,
        cronJobs,
      },
    };

    return NextResponse.json(detail);
  } catch (error) {
    // DB 연결 실패 또는 GitHub API 오류 시
    console.error('Error fetching bot detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bot detail' },
      { status: 500 }
    );
  }
}

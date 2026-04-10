/**
 * semo bots — 봇 상태 관리
 *
 * Actual semo.bot_status schema:
 *   bot_id, name, emoji, role, last_active, session_count, workspace_path, status, synced_at
 *
 * Actual semo.bot_sessions schema:
 *   bot_id, session_key, label, kind, chat_type, last_activity, message_count, synced_at
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  getPool,
  closeConnection,
  isDbConnected,
  getDelegations,
  getActiveSkills,
} from '../database';
import { syncBotSessions } from './sessions';
import {
  auditBot,
  auditBotFromDb,
  auditBotDb,
  auditBotKb,
  mergeDbChecks,
  fixBot,
  fixBotFromDb,
  syncBotFromDb,
  auditSkillStructure,
  loadCheckDefs,
  storeAuditResults,
  formatAuditSlack,
  BotAuditResult,
  WorkspaceStandardRow,
} from './audit';
import { getCronJobStats } from './context';

// ============================================================
// Types (matches actual DB schema)
// ============================================================

interface BotStatus {
  bot_id: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  status: string | null;
  last_active: string | null;
  session_count: number;
  workspace_path: string | null;
  synced_at: string | null;
}

interface BotSession {
  bot_id: string;
  session_key: string;
  label: string | null;
  kind: string | null;
  chat_type: string | null;
  last_activity: string | null;
  message_count: number;
}

// ============================================================
// SOUL.md / IDENTITY.md parser (v2.0: SOUL.md 우선)
// ============================================================

interface BotIdentity {
  name: string | null;
  emoji: string | null;
  role: string | null;
}

function parseIdentityMd(content: string): BotIdentity {
  // v1 호환: IDENTITY.md 또는 SOUL.md에서 Name/Emoji/Role 파싱
  const nameMatch = content.match(/(?:\*\*)?Name:(?:\*\*)?\s*(.+)/i);
  const emojiMatch = content.match(/(?:\*\*)?Emoji:(?:\*\*)?\s*(\S+)/i);
  const roleMatch = content.match(/(?:\*\*)?(?:Creature|Role|직책):(?:\*\*)?\s*(.+)/i);

  const name = nameMatch ? nameMatch[1].trim() : null;
  const emoji = emojiMatch ? emojiMatch[1].trim() : null;
  const role = roleMatch ? roleMatch[1].trim() : null;

  return {
    name: name && name.length <= 100 ? name : null,
    emoji: emoji && emoji.length <= 10 ? emoji : null,
    role: role && role.length <= 100 ? role : null,
  };
}

function parseSoulIdentity(content: string, botId: string): BotIdentity {
  // v2.0: SOUL.md ## Identity 섹션에서 이름/역할 추출
  // 첫 줄 "# {name} — SOUL" 패턴 또는 ## Identity 이후 내용
  const titleMatch = content.match(/^#\s+(.+?)(?:\s*[—–-]\s*SOUL)?$/m);
  const name = titleMatch ? titleMatch[1].trim() : botId;

  // ## R&R 또는 ## Identity 아래 첫 줄에서 역할 추출
  const rrMatch = content.match(/##\s*R&R\s*\n+(?:>\s*)?(.+)/i);
  const role = rrMatch ? rrMatch[1].trim().substring(0, 100) : null;

  // 이모지: 제목이나 첫 줄에서 추출
  const emojiMatch = content.match(/([\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}])/u);
  const emoji = emojiMatch ? emojiMatch[1] : null;

  return { name, emoji, role };
}

// ============================================================
// Bot workspace scanner
// ============================================================

interface ScannedBot {
  botId: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  lastActive: Date | null;
  workspacePath: string;
}

const KNOWN_BOTS = [
  'semiclaw',
  'workclaw',
  'reviewclaw',
  'planclaw',
  'designclaw',
  'infraclaw',
  'growthclaw',
];

function scanBotWorkspaces(_semoSystemDir?: string): ScannedBot[] {
  const home = process.env.HOME || '/Users/reus';
  const bots: ScannedBot[] = [];

  for (const botId of KNOWN_BOTS) {
    // v2.0 SoT: ~/.openclaw-{bot}/workspace/
    const botDir = path.join(home, `.openclaw-${botId}`, 'workspace');
    if (!fs.existsSync(botDir)) continue;

    // Most recent file mtime
    let lastActive: Date | null = null;
    try {
      const times = getAllFileMtimes(botDir);
      if (times.length > 0) {
        lastActive = new Date(Math.max(...times.map((t) => t.getTime())));
      }
    } catch {
      /* skip */
    }

    // v2.0: SOUL.md에서 Identity 파싱 (IDENTITY.md fallback)
    let identity: BotIdentity = { name: null, emoji: null, role: null };
    const soulPath = path.join(botDir, 'SOUL.md');
    const identityPath = path.join(botDir, 'IDENTITY.md');
    if (fs.existsSync(soulPath)) {
      try {
        identity = parseSoulIdentity(fs.readFileSync(soulPath, 'utf-8'), botId);
      } catch {
        /* skip */
      }
    } else if (fs.existsSync(identityPath)) {
      try {
        identity = parseIdentityMd(fs.readFileSync(identityPath, 'utf-8'));
      } catch {
        /* skip */
      }
    }

    bots.push({ botId, ...identity, lastActive, workspacePath: botDir });
  }

  return bots;
}

function getAllFileMtimes(dir: string, depth = 0): Date[] {
  if (depth > 2) return [];
  const times: Date[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        times.push(fs.statSync(fullPath).mtime);
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        times.push(...getAllFileMtimes(fullPath, depth + 1));
      }
    }
  } catch {
    /* skip */
  }
  return times;
}

// ============================================================
// Gateway status detection
// ============================================================

async function detectGatewayStatus(botId: string): Promise<'online' | 'offline'> {
  const configPath = path.join(os.homedir(), `.openclaw-${botId}`, 'openclaw.json');
  if (!fs.existsSync(configPath)) return 'offline';

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const port = config?.gateway?.port;
    if (!port) return 'offline';

    const res = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(1000),
    });
    return res.ok ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}

// ============================================================
// Workspace files sync → bot_workspace_files
// ============================================================

import * as crypto from 'crypto';

const BINARY_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.bmp',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.zip',
  '.tar',
  '.gz',
  '.bz2',
  '.7z',
  '.rar',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
  '.db',
  '.sqlite',
  '.sqlite3',
]);
const MAX_FILE_SIZE = 512 * 1024; // 512KB

export async function syncWorkspaceFiles(
  client: {
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount?: number | null }>;
  },
  botId: string,
  workspaceDir: string,
): Promise<number> {
  const files: { relPath: string; content: string; hash: string; size: number }[] = [];

  function scan(dir: string, relBase: string, depth: number) {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;

      // Skip symlinks
      try {
        if (fs.lstatSync(fullPath).isSymbolicLink()) continue;
      } catch {
        continue;
      }

      if (entry.isDirectory()) {
        scan(fullPath, relPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTS.has(ext)) continue;

        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }
        if (stat.size > MAX_FILE_SIZE) continue;

        let content: string;
        try {
          content = fs.readFileSync(fullPath, 'utf-8');
        } catch {
          continue;
        }

        // Skip files with NULL bytes (binary masquerading as text)
        if (content.includes('\0')) continue;

        const hash = crypto.createHash('sha256').update(content).digest('hex');
        files.push({ relPath, content, hash, size: stat.size });
      }
    }
  }

  scan(workspaceDir, '', 0);

  let upserted = 0;
  for (const f of files) {
    const result = await client.query(
      `INSERT INTO semo.bot_workspace_files (bot_id, file_path, content, file_size, file_hash, synced_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (bot_id, file_path) DO UPDATE SET
         content   = EXCLUDED.content,
         file_size = EXCLUDED.file_size,
         file_hash = EXCLUDED.file_hash,
         synced_at = NOW()
       WHERE semo.bot_workspace_files.file_hash IS DISTINCT FROM EXCLUDED.file_hash`,
      [botId, f.relPath, f.content, f.size, f.hash],
    );
    if (result.rowCount && result.rowCount > 0) {
      upserted++;
    }
  }

  // Delete files in DB but not on disk (for this bot_id)
  const dbFiles = await client.query(
    `SELECT file_path FROM semo.bot_workspace_files WHERE bot_id = $1`,
    [botId],
  );
  const diskPaths = new Set(files.map((f) => f.relPath));
  for (const row of dbFiles.rows as { file_path: string }[]) {
    if (!diskPaths.has(row.file_path)) {
      await client.query(
        `DELETE FROM semo.bot_workspace_files WHERE bot_id = $1 AND file_path = $2`,
        [botId, row.file_path],
      );
    }
  }

  return files.length;
}

// ============================================================
// Command registration
// ============================================================

export function registerBotsCommands(program: Command): void {
  const botsCmd = program.command('bots').description('봇 상태 조회 및 관리 (semo.bot_status)');

  // ── semo bots status ────────────────────────────────────────
  botsCmd
    .command('status')
    .description('모든 봇의 현재 상태 조회')
    .option('--status <filter>', '상태 필터 (online|offline)')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const spinner = ora('봇 상태 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        let query = `
          SELECT bot_id, name, emoji, role, status,
                 last_active::text, session_count, synced_at::text
          FROM semo.bot_status
        `;
        const params: string[] = [];
        if (options.status) {
          query += ' WHERE status = $1';
          params.push(options.status);
        }
        query += ' ORDER BY bot_id';

        const result = await client.query(query, params);
        client.release();

        const bots: BotStatus[] = result.rows;
        spinner.stop();

        if (options.format === 'json') {
          console.log(JSON.stringify(bots, null, 2));
        } else {
          console.log(chalk.cyan.bold('\n🤖 봇 상태\n'));

          if (bots.length === 0) {
            console.log(chalk.yellow('  봇 상태 데이터가 없습니다.'));
            console.log(chalk.gray("  'semo bots sync'로 초기 데이터를 적재하세요."));
          } else {
            console.log(
              chalk.gray('  봇              이름                    상태       마지막 활동'),
            );
            console.log(chalk.gray('  ' + '─'.repeat(75)));
            for (const b of bots) {
              const statusIcon =
                b.status === 'online' ? chalk.green('● online ') : chalk.red('○ offline');
              const lastActive = b.last_active
                ? new Date(b.last_active).toLocaleString('ko-KR')
                : '-';
              const displayName = `${b.emoji || ''} ${b.name || b.bot_id}`.trim();
              console.log(
                `  ${b.bot_id.padEnd(16)}${displayName.padEnd(24)}${String(statusIcon).padEnd(12)}${lastActive}`,
              );
            }
          }

          console.log();
          const online = bots.filter((b) => b.status === 'online').length;
          console.log(chalk.gray(`  총 ${bots.length}개 봇 (온라인: ${online}개)\n`));
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo bots sessions ──────────────────────────────────────
  botsCmd
    .command('sessions')
    .description('봇 세션 히스토리 조회')
    .option('--bot <name>', '특정 봇만')
    .option('--limit <n>', '최대 조회 수', '20')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const spinner = ora('세션 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        let query = `
          SELECT bot_id, session_key, label, kind, chat_type,
                 last_activity::text, message_count
          FROM semo.bot_sessions
        `;
        const params: (string | number)[] = [];
        let idx = 1;

        if (options.bot) {
          query += ` WHERE bot_id = $${idx++}`;
          params.push(options.bot);
        }
        query += ` ORDER BY last_activity DESC NULLS LAST LIMIT $${idx++}`;
        params.push(parseInt(options.limit));

        const result = await client.query(query, params);
        client.release();

        const sessions: BotSession[] = result.rows;
        spinner.stop();

        if (options.format === 'json') {
          console.log(JSON.stringify(sessions, null, 2));
        } else {
          console.log(chalk.cyan.bold('\n📋 봇 세션 히스토리\n'));
          if (sessions.length === 0) {
            console.log(chalk.yellow('  세션 데이터가 없습니다.'));
          } else {
            for (const s of sessions) {
              const lastActivity = s.last_activity
                ? new Date(s.last_activity).toLocaleString('ko-KR')
                : '-';
              console.log(
                chalk.cyan(`  ${s.bot_id}`) +
                  chalk.gray(` [${s.session_key}]`) +
                  (s.label ? chalk.white(` "${s.label}"`) : '') +
                  chalk.gray(` ${lastActivity} (${s.message_count}msg)`),
              );
            }
          }
          console.log();
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo bots sync ──────────────────────────────────────────
  botsCmd
    .command('sync')
    .description('bot-workspaces/ 스캔 → semo.bot_status DB upsert')
    .option('--dry-run', '실제 upsert 없이 미리보기')
    .action(async (options) => {
      const spinner = ora('bot-workspaces 스캔 중...').start();
      const bots = scanBotWorkspaces();

      if (bots.length === 0) {
        spinner.warn('봇 워크스페이스가 없습니다.');
        return;
      }

      spinner.text = `${bots.length}개 봇 발견`;

      if (options.dryRun) {
        spinner.stop();
        console.log(chalk.cyan.bold('\n[dry-run] 감지된 봇:\n'));
        for (const bot of bots) {
          const display = [bot.emoji, bot.name].filter(Boolean).join(' ') || bot.botId;
          console.log(
            chalk.gray(`  ${bot.botId.padEnd(16)}`) +
              chalk.white(display.padEnd(24)) +
              chalk.gray(bot.lastActive?.toLocaleString('ko-KR') || '-'),
          );
        }
        console.log();
        return;
      }

      spinner.text = `${bots.length}개 봇 DB 반영 중...`;

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      const pool = getPool();
      const client = await pool.connect();
      let upserted = 0;
      const errors: string[] = [];

      try {
        await client.query('BEGIN');

        // Detect gateway status for all bots in parallel
        const statusMap = new Map<string, 'online' | 'offline'>();
        const statusResults = await Promise.all(
          bots.map(async (bot) => ({
            botId: bot.botId,
            status: await detectGatewayStatus(bot.botId),
          })),
        );
        for (const { botId, status } of statusResults) {
          statusMap.set(botId, status);
        }

        const onlineCount = statusResults.filter((r) => r.status === 'online').length;
        spinner.text = `${bots.length}개 봇 DB 반영 중... (게이트웨이: ${onlineCount}개 online)`;

        for (const bot of bots) {
          try {
            const detectedStatus = statusMap.get(bot.botId) || 'offline';
            await client.query(
              `INSERT INTO semo.bot_status
                 (bot_id, name, emoji, role, status, last_active, workspace_path, synced_at)
               VALUES ($1, $2, $3, $4, $7, $5, $6, NOW())
               ON CONFLICT (bot_id) DO UPDATE SET
                 name           = COALESCE(EXCLUDED.name, semo.bot_status.name),
                 emoji          = COALESCE(EXCLUDED.emoji, semo.bot_status.emoji),
                 role           = COALESCE(EXCLUDED.role, semo.bot_status.role),
                 status         = EXCLUDED.status,
                 last_active    = CASE
                   WHEN EXCLUDED.last_active IS NOT NULL
                     AND (semo.bot_status.last_active IS NULL
                          OR EXCLUDED.last_active > semo.bot_status.last_active)
                   THEN EXCLUDED.last_active
                   ELSE semo.bot_status.last_active
                 END,
                 workspace_path = EXCLUDED.workspace_path,
                 synced_at      = NOW()`,
              [
                bot.botId,
                bot.name,
                bot.emoji,
                bot.role,
                bot.lastActive?.toISOString() || null,
                bot.workspacePath,
                detectedStatus,
              ],
            );
            upserted++;
          } catch (err) {
            errors.push(`${bot.botId}: ${err}`);
          }
        }

        await client.query('COMMIT');
        spinner.succeed(`bots sync 완료: ${upserted}개 봇 업서트`);
        if (errors.length > 0) {
          errors.forEach((e) => console.log(chalk.red(`  ❌ ${e}`)));
        }

        // P2-1: sessions sync 연동 — spawnSync 대신 같은 프로세스에서 직접 호출
        try {
          const botIds = bots.map((b) => b.botId);
          console.log(chalk.gray('  → sessions sync 실행 중...'));
          const sessionsClient = await pool.connect();
          const { total } = await syncBotSessions(botIds, sessionsClient);
          sessionsClient.release();
          if (total > 0) {
            console.log(chalk.green(`  → sessions sync 완료: ${total}건 upsert`));
          }
        } catch {
          console.log(chalk.yellow('  ⚠ sessions sync 실패 (무시)'));
        }

        // Cron jobs — DB 카운트 표시 (파일 sync 제거됨, Phase 4-A)
        try {
          const cronStats = await getCronJobStats(pool);
          if (cronStats.jobs > 0) {
            console.log(
              chalk.green(`  → 크론잡: ${cronStats.bots}개 봇, ${cronStats.jobs}개 잡 (DB SoT)`),
            );
          }
        } catch {
          // 비치명적
        }

        // Audit piggyback — sync 후 자동 audit 실행
        try {
          console.log(chalk.gray('  → audit 실행 중...'));
          let auditResults = await Promise.all(
            bots.map((b) => auditBotFromDb(b.workspacePath, b.botId, pool)),
          );
          // KB 도메인 체크 merge (팀 레벨 — 한 번 조회 후 전체 적용)
          const kbChecks = await auditBotKb(pool);
          auditResults = auditResults.map((r) => mergeDbChecks(r, kbChecks));
          const auditClient = await pool.connect();
          await storeAuditResults(auditResults, auditClient);
          auditClient.release();
          const good = auditResults.filter((r) => r.rating === 'GOOD').length;
          console.log(chalk.green(`  → audit 완료: ${auditResults.length}개 봇 (GOOD: ${good})`));
        } catch {
          console.log(chalk.yellow('  ⚠ audit 저장 실패 (무시)'));
        }

        // Files piggyback — 워크스페이스 파일 → bot_workspace_files 동기화
        try {
          console.log(chalk.gray('  → files sync 실행 중...'));
          const filesClient = await pool.connect();
          try {
            let totalFiles = 0;
            for (const bot of bots) {
              totalFiles += await syncWorkspaceFiles(filesClient, bot.botId, bot.workspacePath);
            }
            // Shared files
            const sharedDir = path.join(os.homedir(), '.semo', 'shared');
            if (fs.existsSync(sharedDir)) {
              totalFiles += await syncWorkspaceFiles(filesClient, '_shared', sharedDir);
            }
            console.log(chalk.green(`  → files sync 완료: ${totalFiles}개 파일`));
          } finally {
            filesClient.release();
          }
        } catch (filesErr) {
          console.log(chalk.yellow(`  ⚠ files sync 실패 (무시): ${filesErr}`));
        }
      } catch (err) {
        await client.query('ROLLBACK');
        spinner.fail(`sync 실패: ${err}`);
        process.exit(1);
      } finally {
        client.release();
        await closeConnection();
      }
    });

  // ── semo bots audit ───────────────────────────────────────────
  botsCmd
    .command('audit')
    .description('봇 워크스페이스 표준 구조 audit')
    .option('--format <type>', '출력 형식 (table|json|slack)', 'table')
    .option('--fix', '누락 파일/디렉토리 자동 생성 (DB fix_action 활용)')
    .option('--sync', 'DB required 항목 proactive 보장 (누락 파일 생성)')
    .option('--force', 'delete fix_action 실행 허용 (--fix와 함께 사용)')
    .option('--no-db', 'DB 저장 건너뛰기')
    .option('--local', '~/.claude/semo/bots/ 로컬 미러 audit')
    .action(async (options) => {
      const home = process.env.HOME || '/Users/reus';

      const isLocal = options.local === true;
      const sourceLabel = isLocal ? '~/.claude/semo/bots/' : '~/.openclaw-*/workspace/';
      const spinner = ora(`bot-workspaces audit 중... (${sourceLabel})`).start();

      const botEntries: { botId: string; botDir: string }[] = [];

      if (isLocal) {
        // 로컬 미러: ~/.claude/semo/bots/{botId}/
        const semoBotsDir = path.join(home, '.claude', 'semo', 'bots');
        if (fs.existsSync(semoBotsDir)) {
          const dirs = fs
            .readdirSync(semoBotsDir)
            .filter((f) => fs.statSync(path.join(semoBotsDir, f)).isDirectory());
          for (const botId of dirs) {
            botEntries.push({ botId, botDir: path.join(semoBotsDir, botId) });
          }
        }
      } else {
        // v2.0: SoT는 ~/.openclaw-{bot}/workspace/
        for (const botId of KNOWN_BOTS) {
          const botDir = path.join(home, `.openclaw-${botId}`, 'workspace');
          if (fs.existsSync(botDir)) {
            botEntries.push({ botId, botDir });
          }
        }
      }

      if (botEntries.length === 0) {
        spinner.warn('봇 워크스페이스가 없습니다.');
        return;
      }

      // Run audit — try DB-based rules first, fallback to hardcoded
      let results: BotAuditResult[];
      const dbConnected = await isDbConnected();
      let dbRules: WorkspaceStandardRow[] = [];

      if (dbConnected) {
        const pool = getPool();
        try {
          const { rows } = await loadCheckDefs(pool);
          dbRules = rows;
        } catch {
          /* DB rules load failed, will use fallback */
        }
        results = await Promise.all(
          botEntries.map(({ botId, botDir }) => auditBotFromDb(botDir, botId, pool)),
        );
      } else {
        results = botEntries.map(({ botId, botDir }) => auditBot(botDir, botId));
      }

      // Merge skill structure checks into results
      for (let i = 0; i < results.length; i++) {
        const skillChecks = auditSkillStructure(botEntries[i].botDir, botEntries[i].botId);
        if (skillChecks.length > 0) {
          results[i] = mergeDbChecks(results[i], skillChecks);
        }
      }

      spinner.stop();

      // --sync: DB required 항목 proactive 보장
      if (options.sync && dbRules.length > 0) {
        let totalCreated = 0;
        const allViolations: string[] = [];
        for (const { botId, botDir } of botEntries) {
          const botSpecificRules = dbRules.filter((row) => {
            if (row.bot_scope === 'all') return true;
            if (row.bot_scope === 'include') return row.bot_ids.includes(botId);
            if (row.bot_scope === 'exclude') return !row.bot_ids.includes(botId);
            return true;
          });
          const { created, violations } = syncBotFromDb(botDir, botId, botSpecificRules);
          if (created > 0) {
            console.log(chalk.green(`  ✔ ${botId}: ${created}개 항목 동기화 생성`));
            totalCreated += created;
          }
          allViolations.push(...violations.map((v) => `${botId}: ${v}`));
        }
        if (totalCreated > 0) {
          console.log(chalk.green(`\n총 ${totalCreated}개 동기화`));
        }
        if (allViolations.length > 0) {
          console.log(chalk.yellow(`\n⚠ content_rules 위반 (보고만):`));
          for (const v of allViolations) {
            console.log(chalk.yellow(`  - ${v}`));
          }
        }
        // Re-audit after sync
        if (totalCreated > 0) {
          if (dbConnected) {
            const pool = getPool();
            results = await Promise.all(
              botEntries.map(({ botId, botDir }) => auditBotFromDb(botDir, botId, pool)),
            );
          } else {
            results = botEntries.map(({ botId, botDir }) => auditBot(botDir, botId));
          }
          for (let i = 0; i < results.length; i++) {
            const skillChecks = auditSkillStructure(botEntries[i].botDir, botEntries[i].botId);
            if (skillChecks.length > 0) {
              results[i] = mergeDbChecks(results[i], skillChecks);
            }
          }
        }
      }

      // --fix
      if (options.fix) {
        let totalFixed = 0;
        for (const r of results) {
          const botDir = isLocal
            ? path.join(home, '.claude', 'semo', 'bots', r.botId)
            : path.join(home, `.openclaw-${r.botId}`, 'workspace');

          let fixed: number;
          if (dbRules.length > 0) {
            // DB-based fix
            const botSpecificRules = dbRules.filter((row) => {
              if (row.bot_scope === 'all') return true;
              if (row.bot_scope === 'include') return row.bot_ids.includes(r.botId);
              if (row.bot_scope === 'exclude') return !row.bot_ids.includes(r.botId);
              return true;
            });
            const result = fixBotFromDb(botDir, r.botId, r.checks, botSpecificRules, {
              force: options.force,
            });
            fixed = result.fixed;
            if (result.skipped.length > 0) {
              for (const s of result.skipped) {
                console.log(chalk.yellow(`  ⚠ ${r.botId}: ${s}`));
              }
            }
          } else {
            // Fallback to hardcoded fix
            fixed = fixBot(botDir, r.botId, r.checks);
          }

          if (fixed > 0) {
            console.log(chalk.green(`  ✔ ${r.botId}: ${fixed}개 파일/디렉토리 수정`));
            totalFixed += fixed;
          }
        }
        if (totalFixed > 0) {
          console.log(chalk.green(`\n총 ${totalFixed}개 수정`));
          // Re-audit after fix
          if (dbConnected) {
            const pool = getPool();
            results = await Promise.all(
              botEntries.map(({ botId, botDir }) => auditBotFromDb(botDir, botId, pool)),
            );
          } else {
            results = botEntries.map(({ botId, botDir }) => auditBot(botDir, botId));
          }
          for (let i = 0; i < results.length; i++) {
            const skillChecks = auditSkillStructure(botEntries[i].botDir, botEntries[i].botId);
            if (skillChecks.length > 0) {
              results[i] = mergeDbChecks(results[i], skillChecks);
            }
          }
        }
      }

      // DB sync checks + store
      if (options.db !== false) {
        const connected = await isDbConnected();
        if (connected) {
          const pool = getPool();

          // Merge DB sync checks into results
          try {
            for (let i = 0; i < results.length; i++) {
              const dbChecks = await auditBotDb(results[i].botId, pool);
              results[i] = mergeDbChecks(results[i], dbChecks);
            }
          } catch (err) {
            console.log(chalk.yellow(`  ⚠ DB sync 체크 실패: ${err}`));
          }

          // Merge KB domain checks (team-level — 한 번 조회 후 전체 적용)
          try {
            const kbChecks = await auditBotKb(pool);
            for (let i = 0; i < results.length; i++) {
              results[i] = mergeDbChecks(results[i], kbChecks);
            }
          } catch (err) {
            console.log(chalk.yellow(`  ⚠ KB 도메인 체크 실패: ${err}`));
          }

          // Store results (separate try — table may not exist yet)
          try {
            const client = await pool.connect();
            try {
              await storeAuditResults(results, client);
            } finally {
              client.release();
            }
          } catch {
            // bot_workspace_audits table may not exist — silent skip
          }

          await closeConnection();
        } else {
          await closeConnection();
        }
      }

      // Output
      if (options.format === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else if (options.format === 'slack') {
        console.log(formatAuditSlack(results));
      } else {
        console.log(chalk.cyan.bold('\n🔍 Bot Workspace Audit\n'));
        console.log(chalk.gray('  봇              Score  Rating       Passed'));
        console.log(chalk.gray('  ' + '─'.repeat(55)));

        for (const r of results) {
          const ratingColor =
            r.rating === 'GOOD'
              ? chalk.green
              : r.rating === 'NEEDS-WORK'
                ? chalk.yellow
                : chalk.red;
          const passed = r.checks.filter((c) => c.passed).length;
          console.log(
            `  ${r.botId.padEnd(16)}${String(r.score).padStart(3)}%   ${ratingColor(r.rating.padEnd(12))} ${passed}/${r.checks.length}`,
          );
        }

        const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
        const good = results.filter((r) => r.rating === 'GOOD').length;
        console.log(chalk.gray(`\n  ${results.length}개 봇, 평균 ${avgScore}%, GOOD: ${good}개\n`));
      }
    });

  // ── semo bots seed ──────────────────────────────────────────
  botsCmd
    .command('seed')
    .description('[deprecated] 스킬/에이전트 SoT는 DB 직접 관리로 전환됨')
    .action(async () => {
      console.log(chalk.yellow("\n⚠ 'semo bots seed'는 더 이상 사용되지 않습니다."));
      console.log(
        chalk.gray(
          '  스킬/에이전트 SoT는 DB(skill_definitions, agent_definitions)로 이전되었습니다.',
        ),
      );
      console.log(chalk.gray('  수정은 직접 DB UPDATE 또는 마이그레이션을 사용하세요.\n'));
    });

  // ── semo bots cron ──────────────────────────────────────────
  const cronCmd = botsCmd.command('cron').description('봇 크론잡 조회 및 동기화');

  cronCmd
    .command('list')
    .description('DB에서 봇 크론잡 조회')
    .option('--bot <name>', '특정 봇만')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const spinner = ora('크론잡 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        let query = `
          SELECT bot_id, job_id, name, schedule, enabled,
                 last_run::text, next_run::text, session_target, synced_at::text
          FROM semo.bot_cron_jobs
        `;
        const params: string[] = [];
        if (options.bot) {
          query += ' WHERE bot_id = $1';
          params.push(options.bot);
        }
        query += ' ORDER BY bot_id, name';

        const result = await client.query(query, params);
        client.release();
        spinner.stop();

        if (options.format === 'json') {
          console.log(JSON.stringify(result.rows, null, 2));
        } else {
          console.log(chalk.cyan.bold('\n⏰ 봇 크론잡\n'));

          if (result.rows.length === 0) {
            console.log(chalk.yellow('  크론잡 데이터가 없습니다.'));
            console.log(
              chalk.gray("  'semo bots cron sync' 또는 'semo context sync'로 동기화하세요."),
            );
          } else {
            let currentBot = '';
            for (const row of result.rows) {
              if (row.bot_id !== currentBot) {
                currentBot = row.bot_id;
                console.log(chalk.white.bold(`  ${currentBot}`));
              }
              const status = row.enabled ? chalk.green('●') : chalk.red('○');
              const nextRun = row.next_run ? new Date(row.next_run).toLocaleString('ko-KR') : '-';
              console.log(`    ${status} ${(row.name || row.job_id).padEnd(30)} next: ${nextRun}`);
            }
          }

          console.log();
          const enabledCount = result.rows.filter((r: any) => r.enabled).length;
          console.log(chalk.gray(`  총 ${result.rows.length}개 잡 (활성: ${enabledCount}개)\n`));
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  cronCmd
    .command('sync')
    .description('[deprecated] → semo cron import 사용')
    .action(async () => {
      console.log(chalk.yellow('⚠️  [deprecated] 파일 기반 크론 sync는 제거되었습니다.'));
      console.log(
        chalk.yellow('   기존 파일에서 임포트: semo cron import ~/.openclaw-{bot}/cron/jobs.json'),
      );
      console.log(
        chalk.yellow(
          '   새 잡 생성: semo cron create --bot {id} --name {name} --schedule "cron:..."',
        ),
      );
      console.log(chalk.yellow('   DB 조회: semo cron list'));
    });

  // ── semo bots delegation ─────────────────────────────────────
  botsCmd
    .command('delegation')
    .description('봇 간 위임 매트릭스 조회')
    .option('--bot <name>', '특정 봇의 위임 관계만')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const spinner = ora('위임 매트릭스 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const delegations = await getDelegations(options.bot || undefined);
        spinner.stop();

        if (options.format === 'json') {
          console.log(JSON.stringify(delegations, null, 2));
        } else {
          console.log(chalk.cyan.bold('\n🔗 봇 위임 매트릭스\n'));

          if (delegations.length === 0) {
            console.log(chalk.yellow('  위임 데이터가 없습니다.'));
            console.log(chalk.gray("  'semo bots seed'로 위임 매트릭스를 시딩하세요."));
          } else {
            let currentFrom = '';
            for (const d of delegations) {
              if (d.from_bot_id !== currentFrom) {
                currentFrom = d.from_bot_id;
                console.log(chalk.white.bold(`  ${currentFrom}`));
              }
              const domains = d.domains.join(', ');
              console.log(
                chalk.gray(`    → ${d.to_bot_id.padEnd(14)}`) +
                  chalk.white(`[${d.delegation_type}] `) +
                  chalk.cyan(domains) +
                  chalk.gray(` (via ${d.method})`),
              );
            }
          }

          console.log();
          console.log(chalk.gray(`  총 ${delegations.length}개 위임 관계\n`));
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo bots skill-deploy ──────────────────────────────────
  botsCmd
    .command('skill-deploy')
    .description('DB skill_definitions → 봇 워크스페이스 SKILL.md 역배포')
    .option('--bot <botId>', '특정 봇에만 배포')
    .option('--dry-run', '파일 쓰기 없이 계획만 출력')
    .option('--force', '기존 SKILL.md와 내용이 달라도 덮어쓰기')
    .action(async (options) => {
      const spinner = ora('스킬 배포 준비 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const skills = await getActiveSkills();
        spinner.succeed(`활성 스킬 ${skills.length}개 조회 완료`);

        // Filter skills that have bot_ids assigned and content
        const deployable = skills.filter(
          (s) => s.bot_ids && s.bot_ids.length > 0 && s.content && s.content.trim(),
        );

        if (deployable.length === 0) {
          console.log(chalk.yellow('배포 가능한 스킬이 없습니다.'));
          return;
        }

        // Build (skill, botId) pairs
        type Action = 'CREATE' | 'OVERWRITE' | 'SKIP_SAME' | 'SKIP_EXISTS';
        interface DeployEntry {
          skillName: string;
          botId: string;
          action: Action;
          filePath: string;
          content: string;
        }

        const entries: DeployEntry[] = [];

        for (const skill of deployable) {
          const targetBots = options.bot
            ? skill.bot_ids.filter((b: string) => b === options.bot)
            : skill.bot_ids;

          for (const botId of targetBots) {
            const wsDir = path.join(os.homedir(), `.openclaw-${botId}`, 'workspace');
            const skillDir = path.join(wsDir, 'skills', skill.name);
            const filePath = path.join(skillDir, 'SKILL.md');

            let action: Action;
            if (!fs.existsSync(filePath)) {
              action = 'CREATE';
            } else {
              const existing = fs.readFileSync(filePath, 'utf-8');
              if (existing === skill.content) {
                action = 'SKIP_SAME';
              } else if (options.force) {
                action = 'OVERWRITE';
              } else {
                action = 'SKIP_EXISTS';
              }
            }

            entries.push({
              skillName: skill.name,
              botId,
              action,
              filePath,
              content: skill.content,
            });
          }
        }

        // Summary table
        const actionColor: Record<Action, (s: string) => string> = {
          CREATE: chalk.green,
          OVERWRITE: chalk.yellow,
          SKIP_SAME: chalk.gray,
          SKIP_EXISTS: chalk.cyan,
        };

        console.log('\n' + chalk.bold('배포 계획:'));
        console.log('─'.repeat(70));
        for (const e of entries) {
          const tag = actionColor[e.action](e.action.padEnd(12));
          console.log(`  ${tag} ${e.botId}/${e.skillName}`);
        }
        console.log('─'.repeat(70));

        const creates = entries.filter((e) => e.action === 'CREATE').length;
        const overwrites = entries.filter((e) => e.action === 'OVERWRITE').length;
        const skipSame = entries.filter((e) => e.action === 'SKIP_SAME').length;
        const skipExists = entries.filter((e) => e.action === 'SKIP_EXISTS').length;
        console.log(
          `  CREATE: ${creates}  OVERWRITE: ${overwrites}  동일: ${skipSame}  스킵(--force 필요): ${skipExists}`,
        );

        if (options.dryRun) {
          console.log(chalk.yellow('\n--dry-run: 파일 쓰기를 건너뜁니다.'));
          return;
        }

        const toWrite = entries.filter((e) => e.action === 'CREATE' || e.action === 'OVERWRITE');
        if (toWrite.length === 0) {
          console.log(chalk.green('\n변경할 파일이 없습니다.'));
          return;
        }

        // Write files
        const writeSpinner = ora(`SKILL.md ${toWrite.length}개 배포 중...`).start();
        for (const e of toWrite) {
          const dir = path.dirname(e.filePath);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(e.filePath, e.content, 'utf-8');
        }
        writeSpinner.succeed(`SKILL.md ${toWrite.length}개 배포 완료`);

        // Sync workspace files for affected bots
        const affectedBots = [...new Set(toWrite.map((e) => e.botId))];
        const pool = getPool();
        const client = await pool.connect();
        try {
          for (const botId of affectedBots) {
            const wsDir = path.join(os.homedir(), `.openclaw-${botId}`, 'workspace');
            if (fs.existsSync(wsDir)) {
              const syncSpinner = ora(`${botId} 워크스페이스 DB 싱크 중...`).start();
              const count = await syncWorkspaceFiles(client, botId, wsDir);
              syncSpinner.succeed(`${botId} 워크스페이스 싱크 완료 (${count}개 파일 갱신)`);
            }
          }
        } finally {
          client.release();
        }

        console.log(chalk.green(`\n✔ 스킬 역배포 완료`));
      } catch (err) {
        spinner.isSpinning && spinner.fail('스킬 배포 실패');
        console.error(chalk.red(`❌ ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo bots set-status ─────────────────────────────────────
  botsCmd
    .command('set-status <bot_id> <status>')
    .description('봇 온라인 상태 수동 설정 (online|offline)')
    .action(async (botId: string, status: string) => {
      if (status !== 'online' && status !== 'offline') {
        console.log(chalk.red("❌ status는 'online' 또는 'offline'만 가능합니다."));
        process.exit(1);
      }

      const connected = await isDbConnected();
      if (!connected) {
        console.log(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();
        await client.query(
          `INSERT INTO semo.bot_status (bot_id, status, synced_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (bot_id) DO UPDATE SET
             status = EXCLUDED.status,
             synced_at = NOW()`,
          [botId, status],
        );
        client.release();
        console.log(chalk.green(`✔ ${botId} → ${status}`));
      } catch (err) {
        console.log(chalk.red(`❌ 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}

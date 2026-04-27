/**
 * semo memory sync — L1 (bot workspace) → L2 (KB) 메모리 동기화
 *
 * Bot workspace의 일일 메모리 파일(YYYY-MM-DD.md)을 KB memory 도메인으로 싱크.
 * V1: LLM 요약 없이 raw 저장 (Garden 정책 확정 후 추가 예정)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { getPool, closeConnection } from '../database';
import { resolveBotWorkspace } from '../paths';
import { generateEmbedding } from '../kb';

// ============================================================
// Types
// ============================================================

interface MemorySyncState {
  synced: Record<string, { hash: string; syncedAt: string }>;
}

interface SyncCandidate {
  sourceType: 'bot' | 'local-session';
  sourceId: string;
  date: string;
  filePath: string;
  content: string;
  hash: string;
}

// ============================================================
// Constants
// ============================================================

const BOT_IDS = [
  'semiclaw',
  'workclaw',
  'reviewclaw',
  'planclaw',
  'designclaw',
  'infraclaw',
  'growthclaw',
  'incubator',
];

const MEMORY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}\.md$/;
const STATE_DIR = path.join(os.homedir(), '.semo');
const STATE_FILE = path.join(STATE_DIR, 'memory-sync-state.json');

// ============================================================
// State Management
// ============================================================

function readSyncState(): MemorySyncState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {
    // corrupted state file
  }
  return { synced: {} };
}

function writeSyncState(state: MemorySyncState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function contentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ============================================================
// File Discovery
// ============================================================

function discoverBotMemoryFiles(botId: string, minAgeDays: number): SyncCandidate[] {
  const memoryDir = path.join(resolveBotWorkspace(botId), 'memory');

  if (!fs.existsSync(memoryDir)) return [];

  const candidates: SyncCandidate[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minAgeDays);

  const files = fs.readdirSync(memoryDir);
  for (const file of files) {
    if (!MEMORY_DATE_PATTERN.test(file)) continue;

    const dateStr = file.replace('.md', '');
    const fileDate = new Date(dateStr + 'T23:59:59Z');

    if (fileDate > cutoffDate) continue; // Too recent

    const filePath = path.join(memoryDir, file);
    const content = fs.readFileSync(filePath, 'utf-8').trim();

    if (!content) continue; // Skip empty files

    candidates.push({
      sourceType: 'bot',
      sourceId: botId,
      date: dateStr,
      filePath,
      content,
      hash: contentHash(content),
    });
  }

  return candidates;
}

// ============================================================
// Sync Logic
// ============================================================

async function syncMemories(
  candidates: SyncCandidate[],
  state: MemorySyncState,
  force: boolean,
  dryRun: boolean,
): Promise<{ synced: number; skipped: number; errors: string[] }> {
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  if (candidates.length === 0) {
    return { synced, skipped, errors };
  }

  const pool = getPool();

  for (const candidate of candidates) {
    const stateKey = `${candidate.sourceId}/${candidate.date}`;

    // Check watermark
    if (!force) {
      const existing = state.synced[stateKey];
      if (existing && existing.hash === candidate.hash) {
        skipped++;
        continue;
      }
    }

    if (dryRun) {
      console.log(
        chalk.gray(
          `  [dry-run] ${stateKey} (${candidate.content.length} chars, hash: ${candidate.hash})`,
        ),
      );
      synced++;
      continue;
    }

    try {
      const domain = 'memory';
      const flatKey = 'memory';
      const subKey = stateKey; // sourceId/date
      const metadata = {
        source_type: candidate.sourceType,
        source_id: candidate.sourceId,
        date: candidate.date,
        content_hash: candidate.hash,
        original_size: candidate.content.length,
        synced_at: new Date().toISOString(),
      };

      // Generate embedding
      const text = `memory/${stateKey}: ${candidate.content}`;
      const embedding = await generateEmbedding(text);
      const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
           ON CONFLICT (domain, key, sub_key) DO UPDATE SET
             content = EXCLUDED.content,
             metadata = EXCLUDED.metadata,
             embedding = EXCLUDED.embedding`,
          [
            domain,
            flatKey,
            subKey,
            candidate.content,
            JSON.stringify(metadata),
            'semo-memory-sync',
            embeddingStr,
          ],
        );
      } finally {
        client.release();
      }

      // Update watermark
      state.synced[stateKey] = {
        hash: candidate.hash,
        syncedAt: new Date().toISOString(),
      };
      synced++;
    } catch (err) {
      errors.push(`${stateKey}: ${err}`);
    }
  }

  return { synced, skipped, errors };
}

// ============================================================
// Command Registration
// ============================================================

export function registerMemoryCommands(program: Command): void {
  const memoryCmd = program
    .command('memory')
    .description('메모리 관리 — L1(bot workspace) → L2(KB) 동기화');

  memoryCmd
    .command('sync')
    .description('봇 워크스페이스 메모리를 KB memory 도메인으로 동기화')
    .option('--source <type>', '소스 타입 (bot | local | all)', 'all')
    .option('--bot <id>', '특정 봇만 동기화')
    .option('--days <n>', 'N일 이상 경과한 메모리만 동기화', '2')
    .option('--dry-run', '프리뷰만 (실제 동기화 안 함)')
    .option('--force', '워터마크 무시, 전체 재동기화')
    .action(async (options) => {
      console.log(
        chalk.yellow.bold(
          '\n⚠️  [DEPRECATED] semo memory sync는 semiclaw memory-escalation 크론잡으로 대체되었습니다.',
        ),
      );
      console.log(
        chalk.yellow(
          '   매일 06:00 자동 실행되며, LLM 기반 분류로 적절한 KB 도메인/키에 에스컬레이션합니다.',
        ),
      );
      console.log(
        chalk.yellow(
          "   수동 실행이 필요하면 semiclaw에게 'memory-escalation 스킬 실행' 을 지시하세요.\n",
        ),
      );

      const dryRun = !!options.dryRun;
      const force = !!options.force;
      const minAgeDays = parseInt(options.days) || 2;
      const sourceType = options.source as string;
      const specificBot = options.bot as string | undefined;

      const spinner = ora(dryRun ? '동기화 대상 탐색 중...' : '메모리 동기화 중...').start();

      try {
        const state = readSyncState();
        let allCandidates: SyncCandidate[] = [];

        // Discover bot memory files
        if (sourceType === 'bot' || sourceType === 'all') {
          const bots = specificBot ? [specificBot] : BOT_IDS;

          for (const botId of bots) {
            const candidates = discoverBotMemoryFiles(botId, minAgeDays);
            allCandidates.push(...candidates);
          }
        }

        spinner.text = `${allCandidates.length}개 메모리 파일 발견`;

        if (allCandidates.length === 0) {
          spinner.succeed('동기화 대상 메모리 파일 없음');
          await closeConnection();
          return;
        }

        const result = await syncMemories(allCandidates, state, force, dryRun);

        if (!dryRun) {
          writeSyncState(state);
        }

        if (dryRun) {
          spinner.succeed(`[dry-run] ${result.synced}건 동기화 예정, ${result.skipped}건 스킵`);
        } else {
          spinner.succeed(`${result.synced}건 동기화 완료, ${result.skipped}건 스킵 (변경 없음)`);
        }

        if (result.errors.length > 0) {
          console.log(chalk.yellow(`  ⚠️ ${result.errors.length}건 오류:`));
          for (const err of result.errors) {
            console.log(chalk.red(`     ${err}`));
          }
        }

        console.log();
        await closeConnection();
      } catch (err) {
        spinner.fail(`메모리 동기화 실패: ${err}`);
        await closeConnection();
        process.exit(1);
      }
    });

  memoryCmd
    .command('status')
    .description('메모리 동기화 상태 확인')
    .option('--bot <id>', '특정 봇만')
    .action(async (options) => {
      const state = readSyncState();
      const specificBot = options.bot as string | undefined;

      console.log(chalk.cyan.bold('\n📝 메모리 동기화 상태\n'));

      const entries = Object.entries(state.synced);
      if (entries.length === 0) {
        console.log(chalk.yellow('  동기화된 메모리 없음'));
        console.log();
        return;
      }

      // Group by source
      const grouped: Record<string, { date: string; hash: string; syncedAt: string }[]> = {};
      for (const [stKey, val] of entries) {
        const [sourceId, date] = stKey.split('/');
        if (specificBot && sourceId !== specificBot) continue;
        if (!grouped[sourceId]) grouped[sourceId] = [];
        grouped[sourceId].push({ date, ...val });
      }

      for (const [sourceId, items] of Object.entries(grouped)) {
        console.log(chalk.white(`  ${sourceId}:`));
        const sorted = items.sort((a, b) => b.date.localeCompare(a.date));
        const shown = sorted.slice(0, 10);
        for (const item of shown) {
          console.log(chalk.gray(`    ${item.date}  (synced: ${item.syncedAt.split('T')[0]})`));
        }
        if (sorted.length > 10) {
          console.log(chalk.gray(`    ... +${sorted.length - 10} more`));
        }
      }

      console.log();
    });

  // ── semo memory archive — P2-4 ──────────────────────────
  memoryCmd
    .command('archive')
    .description('오래된 메모리 파일을 cold/ 서브디렉토리로 이동 (Hot/Cold 분리)')
    .option('--bot <id>', 'bot 워크스페이스 (~/.semo/workspaces/<id>/memory/)')
    .option('--memory-dir <path>', '메모리 디렉토리 직접 지정')
    .option('--before <date>', 'YYYY-MM-DD 이전에 마지막 변경된 파일만 대상 (기본: 90일 전)')
    .option('--dry-run', '이동 없이 대상만 출력')
    .action(async (options) => {
      const memoryDir = options.memoryDir
        ? path.resolve(options.memoryDir.replace(/^~/, os.homedir()))
        : options.bot
          ? path.join(os.homedir(), '.semo', 'workspaces', options.bot, 'memory')
          : path.join(os.homedir(), '.claude', 'memory');

      if (!fs.existsSync(memoryDir)) {
        console.log(chalk.yellow(`\n  메모리 디렉토리 없음: ${memoryDir}\n`));
        process.exit(1);
      }

      const cutoffDate = options.before
        ? new Date(options.before)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      if (isNaN(cutoffDate.getTime())) {
        console.log(chalk.red(`\n  --before 형식 오류 (YYYY-MM-DD 필요): ${options.before}\n`));
        process.exit(1);
      }

      const coldDir = path.join(memoryDir, 'cold');
      const candidates: Array<{ name: string; mtime: Date; bytes: number }> = [];
      for (const entry of fs.readdirSync(memoryDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        if (entry.name === 'MEMORY.md') continue; // 인덱스는 보존
        const p = path.join(memoryDir, entry.name);
        const st = fs.statSync(p);
        if (st.mtime < cutoffDate) {
          candidates.push({ name: entry.name, mtime: st.mtime, bytes: st.size });
        }
      }

      console.log(chalk.cyan.bold(`\n📦 Memory Archive — ${memoryDir}`));
      console.log(chalk.gray(`  cutoff (mtime <): ${cutoffDate.toISOString().slice(0, 10)}`));
      console.log(
        chalk.gray(`  대상: ${candidates.length}건${options.dryRun ? ' (dry-run)' : ''}\n`),
      );

      if (candidates.length === 0) {
        console.log(chalk.green('  archive 대상 없음.\n'));
        return;
      }

      candidates.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
      for (const c of candidates) {
        console.log(
          `    ${c.mtime.toISOString().slice(0, 10)}  ${c.bytes.toString().padStart(6)}B  ${c.name}`,
        );
      }

      if (options.dryRun) {
        console.log(chalk.gray(`\n  --dry-run — 실제 이동 안 함. 적용: 옵션 제거 후 재실행.\n`));
        return;
      }

      fs.mkdirSync(coldDir, { recursive: true });
      let moved = 0;
      for (const c of candidates) {
        const src = path.join(memoryDir, c.name);
        const dst = path.join(coldDir, c.name);
        try {
          fs.renameSync(src, dst);
          moved++;
        } catch (err) {
          console.log(chalk.red(`    ❌ ${c.name}: ${(err as Error).message}`));
        }
      }
      console.log(chalk.green(`\n  ✅ ${moved}건 archive 완료 → ${coldDir}\n`));
      console.log(
        chalk.gray(
          '  MEMORY.md 인덱스는 자동 갱신되지 않음 — 필요 시 수동 정리 (또는 Cold 섹션 추가).\n',
        ),
      );
    });
}

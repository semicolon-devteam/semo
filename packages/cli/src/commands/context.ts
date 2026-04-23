/**
 * semo context — 스킬/캐시 동기화
 *
 * sync: DB → 글로벌 캐시 (skills/commands/agents) + 스킬 DB 동기화
 * push: .claude/memory/<domain>.md → DB (deprecated — semo kb upsert로 대체)
 *
 * [v4.2.0] KB→md 파일 생성 제거 — semo CLI kb 명령어로 통일
 * [v4.17.0] 크론잡 파일 sync 제거 — DB가 SoT, semo cron CLI로 관리
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Pool } from 'pg';
import { getPool, closeConnection, isDbConnected } from '../database';
import { KBEntry, generateEmbeddings } from '../kb';
// [v4.7.0] syncSkillsToDB 복원 — 워크스페이스 → DB 동기화 경로 재활성화
import { syncSkillsToDB, getBotIds } from './skill-sync';
import { syncGlobalCache } from '../global-cache';
import { populateBotMirrors, ensureEnforcementHooks, ensureRulesSymlink } from '../semo-workspace';

// ============================================================
// Memory file mapping
// ============================================================

const MEMORY_DIR = '.claude/memory';

// --out-dir 로 override 가능 (OpenClaw 봇 workspace 경로 지원)
// 기본값: ~/.claude/memory/ (글로벌 — 모든 프로젝트에서 공유)
function resolveMemoryDir(outDir?: string): string {
  if (outDir) {
    // 절대경로 또는 ~ 경로 처리
    return outDir.replace(/^~/, require('os').homedir());
  }
  return path.join(require('os').homedir(), MEMORY_DIR);
}

/** @deprecated context push uses legacy flat domains — prefer semo kb upsert */
const KB_DOMAIN_MAP: Record<string, string> = {
  semicolon: 'semicolon.md',
  team: 'team.md',
  project: 'projects.md',
  decision: 'decisions.md',
  infra: 'infra.md',
  process: 'process.md',
};

// ============================================================
// Helpers
// ============================================================

function ensureMemoryDir(resolvedDir: string): string {
  fs.mkdirSync(resolvedDir, { recursive: true });
  return resolvedDir;
}

// [v4.2.0] KB→md 헬퍼 함수 제거 — semo CLI로 대체
// kbEntriesToMarkdown, botStatusToMarkdown, ontologyToMarkdown, fetchBotStatus 삭제됨

// ============================================================
// Cron job count (DB-first — file sync 제거됨, Phase 4-A)
// ============================================================

/**
 * DB에서 크론잡 카운트만 조회 (표시용).
 * 파일 기반 sync는 제거됨. 잡 관리는 `semo cron create/import`로.
 */
export async function getCronJobStats(pool: Pool): Promise<{ bots: number; jobs: number }> {
  const result = await pool.query(
    `SELECT COUNT(DISTINCT bot_id)::int AS bots, COUNT(*)::int AS jobs FROM semo.bot_cron_jobs`,
  );
  const row = result.rows[0] as { bots: number; jobs: number };
  return { bots: row.bots, jobs: row.jobs };
}

// ============================================================
// Markdown → KBEntry parser (for push)
// ============================================================

function parseMarkdownSections(content: string, domain: string): KBEntry[] {
  const entries: KBEntry[] = [];

  // Split by h2 sections
  const sections = content.split(/\n##\s+/);

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const firstNewline = section.indexOf('\n');
    if (firstNewline === -1) continue;

    const key = section.substring(0, firstNewline).trim();
    const body = section.substring(firstNewline + 1).trim();

    if (key && body) {
      entries.push({
        domain,
        key,
        content: body,
        created_by: 'claude-context-push',
      });
    }
  }

  return entries;
}

// [v4.2.0] digestToMarkdown 제거 — semo CLI로 대체

// ============================================================
// Commands
// ============================================================

export function registerContextCommands(program: Command): void {
  const ctxCmd = program.command('context').description('스킬/캐시/크론잡 동기화 (KB는 semo CLI)');

  // ── semo context sync ──────────────────────────────────────
  ctxCmd
    .command('sync')
    .description('스킬/에이전트/캐시 동기화 + 크론잡 (KB는 semo CLI 사용)')
    .option('--no-skills', '스킬 파일 → DB 동기화 건너뜀')
    .option('--out-dir <path>', '캐시 파일 출력 경로 (기본: .claude/memory/)')
    .option('--no-global-cache', '글로벌 캐시(skills/commands/agents) 동기화 건너뜀')
    .action(async (options) => {
      const spinner = ora('context sync 시작...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.warn('DB 연결 실패 — context sync 건너뜀');
        await closeConnection();
        return;
      }

      const pool = getPool();
      const memDir = ensureMemoryDir(resolveMemoryDir(options.outDir));

      try {
        // [v4.2.0] KB→md 파일 생성 제거 — semo CLI kb 명령어로 대체
        // 기존 memory/*.md (team, projects, decisions, infra, process, bots, ontology) 파일은
        // semo CLI가 실시간 DB 조회로 대체합니다.

        // [v4.7.0] 워크스페이스 → DB 스킬 동기화 복원
        // v4.4.0에서 제거했으나, 워크스페이스 스킬이 DB에 미반영되는 문제 발생.
        // --no-skills 플래그로 스킵 가능.
        if (options.skills !== false) {
          spinner.text = '스킬 동기화 (워크스페이스 → DB)...';
          try {
            const client = await pool.connect();
            try {
              const skillResult = await syncSkillsToDB(client, pool);
              if (skillResult.total > 0) {
                console.log(chalk.green(`  ✓ 스킬 DB 동기화: ${skillResult.total}개 스킬 upsert`));
              }
            } finally {
              client.release();
            }
          } catch (skillErr) {
            console.log(chalk.yellow(`  ⚠ 스킬 DB 동기화 실패 (비치명적): ${skillErr}`));
          }
        }

        // DB → 글로벌 캐시 (skills/commands/agents → ~/.claude/)
        if (options.globalCache !== false) {
          spinner.text = '글로벌 캐시 동기화 (skills/commands/agents)...';
          try {
            const cacheResult = await syncGlobalCache();
            console.log(
              chalk.green(
                `  ✓ 글로벌 캐시: skills(${cacheResult.skills}) commands(${cacheResult.commands}) agents(${cacheResult.agents})`,
              ),
            );
          } catch (cacheErr) {
            // DB 실패 시 기존 파일 유지 (비치명적)
            console.log(chalk.yellow(`  ⚠ 글로벌 캐시 동기화 실패 (기존 파일 유지): ${cacheErr}`));
          }
        }

        // 3. 봇 미러 리프레시 (DB → ~/.claude/semo/bots/)
        const semoDir = path.join(os.homedir(), '.claude', 'semo');
        if (fs.existsSync(semoDir)) {
          try {
            spinner.text = '봇 미러 동기화 (~/.claude/semo/bots/)...';
            const mirrorResult = await populateBotMirrors();
            if (mirrorResult.files > 0) {
              console.log(
                chalk.green(`  ✓ 봇 미러: ${mirrorResult.bots}개 봇, ${mirrorResult.files}개 파일`),
              );
            }
          } catch {
            // 봇 미러 동기화 실패는 비치명적
          }
        }

        // 4. 봇 세션 enforcement 훅 + rules 심링크 보장
        try {
          spinner.text = '봇 세션 enforcement 확인...';
          const sessionRoot = path.join(os.homedir(), '.semo', 'sessions');
          if (fs.existsSync(sessionRoot)) {
            const sessions = fs
              .readdirSync(sessionRoot)
              .filter((d) => fs.existsSync(path.join(sessionRoot, d, '.claude')));
            let hookCount = 0;
            let linkCount = 0;
            for (const s of sessions) {
              const dir = path.join(sessionRoot, s);
              const { added } = ensureEnforcementHooks(dir);
              hookCount += added.length;
              if (ensureRulesSymlink(dir)) linkCount++;
            }
            if (hookCount > 0 || linkCount > 0) {
              console.log(
                chalk.green(`  ✓ enforcement: ${hookCount}개 훅 추가, ${linkCount}개 rules 심링크`),
              );
            }
          }
        } catch {
          // enforcement 확인 실패는 비치명적
        }

        // 5. 크론잡 카운트 표시 (DB-first — 파일 sync 제거됨)
        try {
          spinner.text = '크론잡 확인...';
          const cronStats = await getCronJobStats(pool);
          if (cronStats.jobs > 0) {
            console.log(
              chalk.green(`  ✓ 크론잡: ${cronStats.bots}개 봇, ${cronStats.jobs}개 잡 (DB SoT)`),
            );
          }
        } catch {
          // 크론잡 조회 실패는 비치명적
        }

        spinner.succeed('context sync 완료 — 스킬/캐시/봇미러/크론잡 동기화');
        console.log(chalk.gray(`  저장 위치: ${memDir}`));
      } catch (err) {
        spinner.fail(`context sync 실패: ${err}`);
      } finally {
        await closeConnection();
      }
    });

  // ── semo context push ──────────────────────────────────────
  ctxCmd
    .command('push')
    .description('.claude/memory/<domain>.md → Core DB (semo.knowledge_base)')
    .option('--domain <name>', 'push할 도메인 (쉼표 구분 가능, 기본: decision)', 'decision')
    .option('--dry-run', '실제 push 없이 변경사항만 미리보기')
    .option(
      '--out-dir <path>',
      '메모리 파일 경로 (기본: .claude/memory/). OpenClaw 봇 workspace 지원용',
    )
    .action(async (options) => {
      console.log(
        chalk.yellow('⚠️  [deprecated] context push는 semo kb upsert로 대체 예정입니다.'),
      );
      console.log(chalk.yellow('   봇/세션에서는 semo kb upsert 명령어를 직접 사용하세요.\n'));

      const domains: string[] = (options.domain as string)
        .split(',')
        .map((d: string) => d.trim())
        .filter(Boolean);
      const memDir = resolveMemoryDir(options.outDir);

      // 각 도메인별 엔트리 수집
      const allEntries: KBEntry[] = [];
      for (const domain of domains) {
        const filename = KB_DOMAIN_MAP[domain] || `${domain}.md`;
        const filePath = path.join(memDir, filename);

        if (!fs.existsSync(filePath)) {
          console.log(chalk.yellow(`⚠️  파일 없음 (건너뜀): ${MEMORY_DIR}/${filename}`));
          continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const entries = parseMarkdownSections(content, domain);
        allEntries.push(...entries);
      }

      if (allEntries.length === 0) {
        console.log(chalk.yellow('⚠️  push할 항목이 없습니다.'));
        return;
      }

      console.log(
        chalk.cyan(`\n📤 context push: ${domains.join(', ')} (${allEntries.length}건)\n`),
      );

      if (options.dryRun) {
        for (const e of allEntries) {
          console.log(chalk.gray(`  [dry-run] ${e.domain}/${e.key}`));
        }
        return;
      }

      const spinner = ora('DB에 업로드 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        process.exit(1);
      }

      const pool = getPool();
      const client = await pool.connect();
      let upserted = 0;
      const errors: string[] = [];

      try {
        // Domain validation: check all domains against ontology
        const ontologyResult = await client.query('SELECT domain FROM semo.ontology');
        const knownDomains = new Set(ontologyResult.rows.map((r: { domain: string }) => r.domain));

        const validEntries: KBEntry[] = [];
        for (const entry of allEntries) {
          if (knownDomains.has(entry.domain)) {
            validEntries.push(entry);
          } else {
            errors.push(
              `${entry.domain}/${entry.key}: 미등록 도메인 '${entry.domain}' (등록된 도메인: ${Array.from(knownDomains).join(', ')})`,
            );
          }
        }

        if (validEntries.length === 0 && errors.length > 0) {
          spinner.fail('모든 엔트리가 도메인 검증에 실패했습니다.');
          errors.forEach((e) => console.log(chalk.red(`  ❌ ${e}`)));
          client.release();
          await closeConnection();
          return;
        }

        // Generate embeddings for all valid entries
        spinner.text = '임베딩 생성 중...';
        const texts = validEntries.map((e) => `${e.key}: ${e.content}`);
        const embeddings = await generateEmbeddings(texts);

        await client.query('BEGIN');
        for (let i = 0; i < validEntries.length; i++) {
          const entry = validEntries[i];
          try {
            const embedding = embeddings[i];
            const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

            await client.query(
              `INSERT INTO semo.knowledge_base (domain, key, content, metadata, created_by, embedding)
               VALUES ($1, $2, $3, $4, $5, $6::vector)
               ON CONFLICT (domain, key) DO UPDATE SET
                 content = EXCLUDED.content,
                 metadata = EXCLUDED.metadata,
                 embedding = COALESCE(EXCLUDED.embedding, semo.knowledge_base.embedding)`,
              [
                entry.domain,
                entry.key,
                entry.content,
                JSON.stringify(entry.metadata || {}),
                entry.created_by,
                embeddingStr,
              ],
            );
            upserted++;
          } catch (err) {
            errors.push(`${entry.domain}/${entry.key}: ${err}`);
          }
        }
        await client.query('COMMIT');

        spinner.succeed(
          `push 완료: ${upserted}건 업서트 (임베딩 ${process.env.OPENAI_API_KEY ? '생성됨' : '건너뜀'})`,
        );
        if (errors.length > 0) {
          errors.forEach((e) => console.log(chalk.red(`  ❌ ${e}`)));
        }
      } catch (err) {
        await client.query('ROLLBACK');
        spinner.fail(`push 실패: ${err}`);
      } finally {
        client.release();
        await closeConnection();
      }
    });
}

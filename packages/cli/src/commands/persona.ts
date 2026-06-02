/**
 * semo persona — 고객용 base 에이전트 행동(SOUL) SoT 관리.
 *
 * SoT = semo.agent_personas (마이그레이션 125). 프로토타입 hermes SOUL.md 와
 * 미래 고객 install 이 모두 여기서 resolve. operator(슬랙)가 컨펌 후 이 CLI 로 편집.
 *
 *   semo persona list                         — 등록된 persona 목록
 *   semo persona get <slug>                    — soul_md 출력 (--meta 로 메타 포함)
 *   semo persona set <slug> --file F --by WHO  — soul_md 갱신(version++ + revision)
 *   semo persona revisions <slug>              — 편집 이력
 *   semo persona sync [--home DIR]             — DB → hermes 프로파일 SOUL.md 반영
 *
 * 설계: docs/superpowers/specs/2026-06-02-agent-behavior-sot-and-propagation-design.md
 */
import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getPool, closeConnection } from '../database';

interface PersonaRow {
  slug: string;
  display_name: string | null;
  soul_md: string;
  version: number;
  status: string;
  updated_by: string | null;
  updated_at: string;
}

async function readSoulInput(opts: { file?: string; stdin?: boolean }): Promise<string> {
  if (opts.file) return fs.readFileSync(opts.file, 'utf8');
  if (opts.stdin) return fs.readFileSync(0, 'utf8');
  throw new Error('soul_md 입력이 필요합니다 (--file <path> 또는 --stdin)');
}

export function registerPersonaCommands(program: Command): void {
  const cmd = program.command('persona').description('고객 base 에이전트 행동(SOUL) SoT 관리');

  cmd
    .command('list')
    .description('등록된 persona 목록')
    .action(async () => {
      const pool = getPool();
      try {
        const { rows } = await pool.query<PersonaRow>(
          `SELECT slug, display_name, version, status, updated_by, updated_at::text
             FROM semo.agent_personas ORDER BY slug`,
        );
        if (rows.length === 0) {
          console.log('(등록된 persona 없음 — semo persona set 으로 seed)');
        } else {
          for (const r of rows) {
            console.log(
              `${r.slug}\tv${r.version}\t${r.status}\t${r.display_name ?? ''}\t(by ${r.updated_by ?? '-'} @ ${r.updated_at})`,
            );
          }
        }
      } finally {
        await closeConnection();
      }
    });

  cmd
    .command('get <slug>')
    .description('persona soul_md 출력')
    .option('--meta', '메타데이터 포함(JSON)')
    .action(async (slug: string, options: { meta?: boolean }) => {
      const pool = getPool();
      try {
        const { rows } = await pool.query<PersonaRow>(
          `SELECT slug, display_name, soul_md, version, status, updated_by, updated_at::text
             FROM semo.agent_personas WHERE slug = $1`,
          [slug],
        );
        if (rows.length === 0) {
          console.error(`persona 없음: ${slug}`);
          process.exitCode = 1;
          return;
        }
        if (options.meta) {
          console.log(JSON.stringify(rows[0], null, 2));
        } else {
          process.stdout.write(rows[0].soul_md);
        }
      } finally {
        await closeConnection();
      }
    });

  cmd
    .command('set <slug>')
    .description('persona soul_md 갱신(version++ + revision append). 없으면 생성(v1).')
    .option('--file <path>', 'soul_md 파일 경로')
    .option('--stdin', 'soul_md 를 stdin 으로 입력')
    .option('--by <who>', '편집자 (mark|reus|operator ...)', 'unknown')
    .option('--display-name <name>', '표시 이름 (최초 생성 시)')
    .option('--note <note>', '편집 메모(revision)')
    .action(
      async (
        slug: string,
        options: {
          file?: string;
          stdin?: boolean;
          by: string;
          displayName?: string;
          note?: string;
        },
      ) => {
        const soul = (await readSoulInput(options)).trim();
        if (!soul) throw new Error('soul_md 가 비어 있습니다.');
        const pool = getPool();
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const existing = await client.query<{ version: number }>(
            `SELECT version FROM semo.agent_personas WHERE slug = $1 FOR UPDATE`,
            [slug],
          );
          let version: number;
          if (existing.rows.length === 0) {
            version = 1;
            await client.query(
              `INSERT INTO semo.agent_personas (slug, display_name, soul_md, version, updated_by)
               VALUES ($1, $2, $3, 1, $4)`,
              [slug, options.displayName ?? slug, soul, options.by],
            );
          } else {
            version = existing.rows[0].version + 1;
            await client.query(
              `UPDATE semo.agent_personas
                  SET soul_md = $2, version = $3, updated_by = $4, updated_at = now()
                WHERE slug = $1`,
              [slug, soul, version, options.by],
            );
          }
          await client.query(
            `INSERT INTO semo.agent_persona_revisions (slug, version, soul_md, updated_by, note)
             VALUES ($1, $2, $3, $4, $5)`,
            [slug, version, soul, options.by, options.note ?? null],
          );
          await client.query('COMMIT');
          console.log(`✔ persona ${slug} → v${version} (by ${options.by})`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
          await closeConnection();
        }
      },
    );

  cmd
    .command('revisions <slug>')
    .description('persona 편집 이력')
    .action(async (slug: string) => {
      const pool = getPool();
      try {
        const { rows } = await pool.query<{
          version: number;
          updated_by: string | null;
          note: string | null;
          created_at: string;
        }>(
          `SELECT version, updated_by, note, created_at::text
             FROM semo.agent_persona_revisions WHERE slug = $1 ORDER BY version DESC`,
          [slug],
        );
        if (rows.length === 0) {
          console.log(`(이력 없음: ${slug})`);
        } else {
          for (const r of rows) {
            console.log(
              `v${r.version}\t${r.created_at}\tby ${r.updated_by ?? '-'}\t${r.note ?? ''}`,
            );
          }
        }
      } finally {
        await closeConnection();
      }
    });

  cmd
    .command('sync')
    .description('DB persona → hermes 프로파일 SOUL.md 반영 (프로토타입 런타임)')
    .option('--home <dir>', 'hermes home (기본 $SEMI_HERMES_HOME 또는 ~/.hermes-semo-canary)')
    .action(async (options: { home?: string }) => {
      const home =
        options.home ||
        process.env.SEMI_HERMES_HOME ||
        path.join(os.homedir(), '.hermes-semo-canary');
      const pool = getPool();
      try {
        const { rows } = await pool.query<PersonaRow>(
          `SELECT slug, soul_md FROM semo.agent_personas WHERE status = 'active'`,
        );
        let synced = 0;
        for (const r of rows) {
          const destDir = path.join(home, 'profiles', `semo-${r.slug}`);
          if (!fs.existsSync(destDir)) {
            console.warn(`[persona sync] skip ${r.slug} (프로파일 없음: ${destDir})`);
            continue;
          }
          fs.writeFileSync(path.join(destDir, 'SOUL.md'), r.soul_md);
          console.log(`[persona sync] ${r.slug} → ${path.join(destDir, 'SOUL.md')}`);
          synced++;
        }
        console.log(`[persona sync] done (${synced} personas, home=${home})`);
      } finally {
        await closeConnection();
      }
    });
}

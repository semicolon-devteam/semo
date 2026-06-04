/**
 * semo credential — Agent Service Credential (PAT) vault CRUD
 *
 * 중앙 credential vault: 팀 서비스가 에이전트 쓰기 요청을 받을 때 SEMO에서 PAT를
 * 발급/검증한다. 평문은 발급 시 1회만 출력되고, DB에는 HMAC-SHA256 해시만.
 *
 * 관련 결정: `semicolon decision agent-authenticated-action-standard`
 * 관련 마이그레이션: 107_agent_service_credentials.sql
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createHmac, randomBytes } from 'crypto';
import { getPool, closeConnection, isDbConnected } from '../database';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

const TOKEN_ENV_LIVE = 'live';
const TOKEN_RANDOM_BYTES = 18;
const PEPPER_ENV_VAR = 'SEMO_CREDENTIAL_PEPPER';

function getPepperOrExit(): string {
  const pepper = process.env[PEPPER_ENV_VAR];
  if (!pepper || pepper.length < 16) {
    console.error(
      chalk.red(
        `❌ ${PEPPER_ENV_VAR} 환경변수가 없거나 너무 짧습니다 (최소 16자).\n` +
          `   ~/.claude/semo/.env 또는 시크릿 스토어에 설정하세요.`,
      ),
    );
    process.exit(1);
  }
  return pepper;
}

function hashToken(plaintext: string, pepper: string): string {
  return createHmac('sha256', pepper).update(plaintext, 'utf8').digest('hex');
}

function buildTokenPrefix(botId: string, env: string = TOKEN_ENV_LIVE): string {
  return `semo_pat_${env}_${botId}_`;
}

function generatePlaintextToken(
  botId: string,
  env: string = TOKEN_ENV_LIVE,
): { plaintext: string; prefix: string } {
  const prefix = buildTokenPrefix(botId, env);
  const random = randomBytes(TOKEN_RANDOM_BYTES).toString('base64url');
  return { plaintext: `${prefix}${random}`, prefix };
}

function normalizeScope(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!/^[a-z0-9-]+:[a-z0-9*-]+$/.test(s)) {
    throw new Error(`잘못된 scope 형식: "${raw}" (기대: "{resource}:{action}")`);
  }
  return s;
}

function parseScopes(csv: string): string[] {
  const scopes = csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeScope);
  if (scopes.length === 0) throw new Error('scopes 가 비어있습니다');
  return Array.from(new Set(scopes));
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function fmtStatus(row: { revoked_at: string | null; expires_at: string | null }): string {
  if (row.revoked_at) return chalk.red('revoked');
  if (row.expires_at && new Date(row.expires_at) < new Date()) return chalk.gray('expired');
  return chalk.green('active');
}

export function registerCredentialCommands(program: Command): void {
  const cmd = program
    .command('credential')
    .description('Agent Service Credential (PAT) 발급/검증 (중앙 vault)');

  // issue
  cmd
    .command('issue')
    .description('새 PAT 발급 (평문은 stdout 1회만 출력됨)')
    .requiredOption('--bot-id <id>', '소유 에이전트 bot_id')
    .requiredOption('--service <domain>', '대상 서비스 KB domain')
    .requiredOption('--scopes <csv>', 'scope CSV (예: board:write,board:read)')
    .option('--expires-at <iso>', '만료 시각 (ISO 8601, 생략 시 무기한)')
    .option('--metadata <json>', '추가 메타데이터 (JSON 객체)')
    .option('--issued-by <who>', '발급자 식별자 (감사용)', 'cli')
    .option('--format <type>', '출력 형식 (human|json)', 'human')
    .action(async (opts) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        process.exit(1);
      }
      const pepper = getPepperOrExit();

      let scopes: string[];
      try {
        scopes = parseScopes(opts.scopes);
      } catch (err) {
        console.error(chalk.red(`❌ ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }

      let metadata: Record<string, unknown> = {};
      if (opts.metadata) {
        try {
          metadata = JSON.parse(opts.metadata);
        } catch {
          console.error(chalk.red('❌ --metadata JSON 파싱 실패'));
          process.exit(1);
        }
      }

      let expiresAtIso: string | null = null;
      if (opts.expiresAt) {
        const d = new Date(opts.expiresAt);
        if (isNaN(d.getTime())) {
          console.error(
            chalk.red(`❌ --expires-at 파싱 실패: "${opts.expiresAt}" (ISO 8601 형식 필요)`),
          );
          process.exit(1);
        }
        expiresAtIso = d.toISOString();
      }

      const botId = String(opts.botId).toLowerCase();
      const { plaintext, prefix } = generatePlaintextToken(botId);
      const tokenHash = hashToken(plaintext, pepper);

      try {
        const pool = getPool();
        const res = await pool.query(
          `INSERT INTO ${DB_SCHEMA}.agent_service_credentials
             (bot_id, service_domain, token_hash, token_prefix, scopes,
              expires_at, issued_by, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, bot_id, service_domain, token_prefix, scopes,
                     issued_at, expires_at, issued_by`,
          [
            botId,
            opts.service,
            tokenHash,
            prefix,
            scopes,
            expiresAtIso,
            opts.issuedBy,
            JSON.stringify(metadata),
          ],
        );
        const row = res.rows[0];

        if (opts.format === 'json') {
          console.log(
            JSON.stringify(
              {
                id: row.id,
                bot_id: row.bot_id,
                service_domain: row.service_domain,
                token_prefix: row.token_prefix,
                scopes: row.scopes,
                issued_at: row.issued_at,
                expires_at: row.expires_at,
                issued_by: row.issued_by,
                plaintext,
              },
              null,
              2,
            ),
          );
        } else {
          console.log(chalk.green.bold('\n✅ PAT 발급 완료 (평문은 이 1회만 표시됨)\n'));
          console.log(chalk.gray('  id          :'), row.id);
          console.log(chalk.gray('  bot_id      :'), row.bot_id);
          console.log(chalk.gray('  service     :'), row.service_domain);
          console.log(chalk.gray('  scopes      :'), row.scopes.join(', '));
          console.log(chalk.gray('  issued_at   :'), row.issued_at);
          console.log(
            chalk.gray('  expires_at  :'),
            row.expires_at ? row.expires_at : chalk.yellow('무기한'),
          );
          console.log(chalk.gray('  issued_by   :'), row.issued_by);
          console.log();
          console.log(chalk.yellow.bold('  🔑 PLAINTEXT TOKEN (지금만 보임 — 안전한 곳에 저장):'));
          console.log(chalk.cyan.bold(`  ${plaintext}\n`));
          if (!opts.expiresAt) {
            console.log(
              chalk.yellow('⚠ 무기한 토큰입니다. 서비스 측 rotate 정책으로 관리하세요.\n'),
            );
          }
        }
      } catch (err) {
        console.error(chalk.red(`❌ issue 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // list
  cmd
    .command('list')
    .description('발급된 PAT 목록 조회 (평문/해시 노출 없음)')
    .option('--bot-id <id>', 'bot 필터')
    .option('--service <domain>', 'service 필터')
    .option('--include-revoked', 'revoked 항목 포함', false)
    .option('--limit <n>', '최대 건수', '50')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (opts) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        process.exit(1);
      }

      try {
        const pool = getPool();
        const conditions: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (opts.botId) {
          conditions.push(`bot_id = $${idx++}`);
          params.push(String(opts.botId).toLowerCase());
        }
        if (opts.service) {
          conditions.push(`service_domain = $${idx++}`);
          params.push(opts.service);
        }
        if (!opts.includeRevoked) {
          conditions.push(`revoked_at IS NULL`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(parseInt(opts.limit));

        const res = await pool.query(
          `SELECT id, bot_id, service_domain, token_prefix, scopes,
                  issued_at::text, expires_at::text, last_used_at::text,
                  revoked_at::text, revoked_reason, issued_by
           FROM ${DB_SCHEMA}.agent_service_credentials
           ${where}
           ORDER BY issued_at DESC
           LIMIT $${idx}`,
          params,
        );

        if (opts.format === 'json') {
          console.log(JSON.stringify(res.rows, null, 2));
          return;
        }

        if (res.rows.length === 0) {
          console.log(chalk.yellow('발급된 PAT 없음'));
          return;
        }

        console.log(chalk.bold(`\n🔑 Credentials (${res.rows.length}건)\n`));
        for (const r of res.rows) {
          const status = fmtStatus(r);
          const scopes = r.scopes.join(',');
          const lastUsed = r.last_used_at
            ? new Date(r.last_used_at).toLocaleString('ko-KR')
            : chalk.gray('never');
          console.log(
            `  ${chalk.dim(shortId(r.id))}  ${status.padEnd(20)} ` +
              chalk.white(r.bot_id.padEnd(12)) +
              chalk.cyan(r.service_domain.padEnd(16)) +
              chalk.gray(scopes),
          );
          console.log(
            chalk.gray(
              `             prefix=${r.token_prefix}  last_used=${lastUsed}  by=${r.issued_by}`,
            ),
          );
        }
        console.log();
      } catch (err) {
        console.error(chalk.red(`❌ list 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // revoke
  cmd
    .command('revoke <id>')
    .description('PAT revoke (soft delete)')
    .option('--reason <text>', 'revoke 사유 (감사용)')
    .option('--format <type>', '출력 형식 (human|json)', 'human')
    .action(async (id, opts) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        process.exit(1);
      }

      try {
        const pool = getPool();
        const res = await pool.query(
          `UPDATE ${DB_SCHEMA}.agent_service_credentials
             SET revoked_at = NOW(),
                 revoked_reason = $2
           WHERE id = $1 AND revoked_at IS NULL
           RETURNING id, bot_id, service_domain, token_prefix, revoked_at::text, revoked_reason`,
          [id, opts.reason ?? null],
        );

        if (res.rowCount === 0) {
          console.error(chalk.yellow(`⚠ credential 없거나 이미 revoke 됨: ${id}`));
          process.exit(1);
        }
        const row = res.rows[0];
        if (opts.format === 'json') {
          console.log(JSON.stringify(row, null, 2));
        } else {
          console.log(chalk.green(`✅ revoked: ${row.id}`));
          console.log(chalk.gray(`  ${row.bot_id} → ${row.service_domain}  at ${row.revoked_at}`));
          if (row.revoked_reason) console.log(chalk.gray(`  reason: ${row.revoked_reason}`));
        }
      } catch (err) {
        console.error(chalk.red(`❌ revoke 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // rotate
  cmd
    .command('rotate <id>')
    .description('기존 PAT revoke + 동일 bot/service/scopes 로 새 PAT 발급')
    .option('--reason <text>', 'rotate 사유 (기본: "rotated")')
    .option('--format <type>', '출력 형식 (human|json)', 'human')
    .action(async (id, opts) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        process.exit(1);
      }
      const pepper = getPepperOrExit();

      const pool = getPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const existing = await client.query(
          `SELECT id, bot_id, service_domain, scopes, expires_at, issued_by, metadata
             FROM ${DB_SCHEMA}.agent_service_credentials
            WHERE id = $1 AND revoked_at IS NULL
            FOR UPDATE`,
          [id],
        );
        if (existing.rowCount === 0) {
          await client.query('ROLLBACK');
          console.error(chalk.yellow(`⚠ credential 없거나 이미 revoke 됨: ${id}`));
          process.exit(1);
        }
        const old = existing.rows[0];

        const { plaintext, prefix } = generatePlaintextToken(old.bot_id);
        const tokenHash = hashToken(plaintext, pepper);

        await client.query(
          `UPDATE ${DB_SCHEMA}.agent_service_credentials
             SET revoked_at = NOW(),
                 revoked_reason = $2
           WHERE id = $1`,
          [id, opts.reason ?? 'rotated'],
        );

        const inserted = await client.query(
          `INSERT INTO ${DB_SCHEMA}.agent_service_credentials
             (bot_id, service_domain, token_hash, token_prefix, scopes,
              expires_at, issued_by, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, bot_id, service_domain, token_prefix, scopes,
                     issued_at, expires_at, issued_by`,
          [
            old.bot_id,
            old.service_domain,
            tokenHash,
            prefix,
            old.scopes,
            old.expires_at,
            old.issued_by,
            JSON.stringify({ ...(old.metadata ?? {}), rotated_from: id }),
          ],
        );

        await client.query('COMMIT');

        const row = inserted.rows[0];
        if (opts.format === 'json') {
          console.log(
            JSON.stringify(
              {
                rotated_from: id,
                new_credential: { ...row, plaintext },
              },
              null,
              2,
            ),
          );
        } else {
          console.log(chalk.green.bold(`\n🔄 rotated — 이전 ${shortId(id)} revoked\n`));
          console.log(chalk.gray('  new id      :'), row.id);
          console.log(chalk.gray('  bot_id      :'), row.bot_id);
          console.log(chalk.gray('  service     :'), row.service_domain);
          console.log(chalk.gray('  scopes      :'), row.scopes.join(', '));
          console.log();
          console.log(chalk.yellow.bold('  🔑 NEW PLAINTEXT TOKEN (지금만 보임):'));
          console.log(chalk.cyan.bold(`  ${plaintext}\n`));
        }
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(chalk.red(`❌ rotate 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        client.release();
        await closeConnection();
      }
    });

  // verify
  cmd
    .command('verify <plaintext>')
    .description('평문 PAT 검증 (테스트/서비스 통합용)')
    .option('--scope <scope>', '필수 scope (예: board:write)')
    .option('--format <type>', '출력 형식 (human|json)', 'human')
    .action(async (plaintext, opts) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('❌ DB 연결 실패'));
        process.exit(1);
      }
      const pepper = getPepperOrExit();
      const tokenHash = hashToken(plaintext, pepper);

      try {
        const pool = getPool();
        const res = await pool.query(
          `SELECT id, bot_id, service_domain, token_prefix, scopes,
                  issued_at::text, expires_at::text, last_used_at::text,
                  revoked_at::text, issued_by
             FROM ${DB_SCHEMA}.agent_service_credentials
            WHERE token_hash = $1`,
          [tokenHash],
        );

        const reply = (valid: boolean, reason: string | null, row?: Record<string, unknown>) => {
          if (opts.format === 'json') {
            console.log(JSON.stringify({ valid, reason, credential: row ?? null }, null, 2));
          } else {
            if (valid) {
              console.log(chalk.green.bold('✅ valid'));
              if (row) {
                console.log(
                  chalk.gray(
                    `  ${row.bot_id} → ${row.service_domain} (${(row.scopes as string[]).join(', ')})`,
                  ),
                );
              }
            } else {
              console.log(chalk.red(`❌ invalid: ${reason}`));
            }
          }
          process.exit(valid ? 0 : 2);
        };

        if (res.rowCount === 0) return reply(false, 'not_found');
        const row = res.rows[0];

        if (row.revoked_at) return reply(false, 'revoked', row);
        if (row.expires_at && new Date(row.expires_at) < new Date()) {
          return reply(false, 'expired', row);
        }
        if (opts.scope) {
          const required = normalizeScope(opts.scope);
          const [resource] = required.split(':');
          const hasWildcard = (row.scopes as string[]).includes(`${resource}:*`);
          const hasExact = (row.scopes as string[]).includes(required);
          if (!hasExact && !hasWildcard) {
            return reply(false, `scope_missing:${required}`, row);
          }
        }

        await pool
          .query(
            `UPDATE ${DB_SCHEMA}.agent_service_credentials SET last_used_at = NOW() WHERE id = $1`,
            [row.id],
          )
          .catch(() => {
            console.error(chalk.yellow('⚠ last_used_at 업데이트 실패 (verify 결과는 valid)'));
          });

        return reply(true, null, row);
      } catch (err) {
        console.error(chalk.red(`❌ verify 실패: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}

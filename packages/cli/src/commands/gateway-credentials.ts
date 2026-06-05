/**
 * semo gateway — SemiColony 멀티테넌트 KB 게이트웨이 자격증명 발급/회전/폐기
 *
 * 외부 Colony 는 `Authorization: Bearer sck_{slug}_...` 로 kb-gateway 를 호출한다.
 * 평문 토큰은 발급 시 1회만 출력되고, DB(semo.gateway_credentials)에는 sha256 해시만 저장된다.
 *
 * ⚠️ 토큰 형식/해시는 packages/kb-gateway/src/lib/tenant-credentials.ts 와 **반드시 동일**해야 한다
 *    (게이트웨이가 sha256(token) 으로 조회·검증). pepper 없음.
 *
 * 관련 결정: semicolony/decision/semicolony-gateway-tenancy-auth-persona-resolved
 * 관련 마이그레이션: 129_kb_multitenant_gateway.sql
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createHash, randomBytes } from 'crypto';
import { getPool, closeConnection } from '../database';

const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';
const TENANT_TOKEN_PREFIX = 'sck_';
const DEFAULT_SCOPES = ['kb:read', 'kb:write', 'persona:read'];

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateTenantToken(slug: string): {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const rand = randomBytes(32).toString('base64url');
  const token = `${TENANT_TOKEN_PREFIX}${slug}_${rand}`;
  const tokenPrefix = token.slice(0, TENANT_TOKEN_PREFIX.length + slug.length + 1 + 6);
  return { token, tokenHash: hashToken(token), tokenPrefix };
}

function parseScopes(csv: string | undefined): string[] {
  if (!csv) return DEFAULT_SCOPES;
  const out = csv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const s of out) {
    if (!/^[a-z0-9-]+:[a-z0-9*-]+$/.test(s)) {
      throw new Error(`잘못된 scope 형식: "${s}" (기대: "{resource}:{action}", 예: kb:read)`);
    }
  }
  return out.length ? out : DEFAULT_SCOPES;
}

interface TenantRow {
  id: string;
  slug: string;
  display_name: string | null;
}

async function resolveTenant(slug: string): Promise<TenantRow> {
  const pool = getPool();
  const { rows } = await pool.query<TenantRow>(
    `SELECT id, slug, display_name FROM public.tenants WHERE slug = $1`,
    [slug],
  );
  if (!rows[0]) {
    throw new Error(`테넌트를 찾을 수 없습니다: "${slug}" (public.tenants)`);
  }
  return rows[0];
}

function printToken(token: string, prefix: string, slug: string): void {
  console.log(chalk.green('\n✔ 게이트웨이 자격증명 발급 완료'));
  console.log(chalk.yellow('  아래 토큰은 지금 한 번만 표시됩니다. 안전하게 보관하세요.\n'));
  console.log('  ' + chalk.bold.cyan(token) + '\n');
  console.log(chalk.gray(`  tenant=${slug}  prefix=${prefix}`));
  console.log(chalk.gray(`  Colony env: export SEMICOLONY_API_KEY=${token}\n`));
}

export interface IssueCredentialResult {
  id: string;
  token: string; // 평문 — 1회만 노출
  tokenPrefix: string;
  scopes: string[];
}

/** 테넌트에 새 자격증명 발급(평문 토큰 반환). CLI·provisioning 공용 issuance 단일 경로. */
export async function issueGatewayCredentialForTenant(opts: {
  tenantId: string;
  tenantSlug: string;
  scopes?: string[];
  issuedBy?: string;
  expiresDays?: string | number;
}): Promise<IssueCredentialResult> {
  const pool = getPool();
  const scopes = opts.scopes && opts.scopes.length ? opts.scopes : DEFAULT_SCOPES;
  const { token, tokenHash, tokenPrefix } = generateTenantToken(opts.tenantSlug);
  const hasExpiry = opts.expiresDays != null && String(opts.expiresDays).length > 0;
  const sql = `
    INSERT INTO ${DB_SCHEMA}.gateway_credentials
      (tenant_id, tenant_slug, token_hash, token_prefix, scopes, issued_by, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, ${hasExpiry ? `now() + ($7 || ' days')::interval` : 'NULL'})
    RETURNING id`;
  const params = hasExpiry
    ? [
        opts.tenantId,
        opts.tenantSlug,
        tokenHash,
        tokenPrefix,
        scopes,
        opts.issuedBy ?? 'cli',
        String(opts.expiresDays),
      ]
    : [opts.tenantId, opts.tenantSlug, tokenHash, tokenPrefix, scopes, opts.issuedBy ?? 'cli'];
  const { rows } = await pool.query<{ id: string }>(sql, params);
  return { id: rows[0].id, token, tokenPrefix, scopes };
}

/**
 * 테넌트에 활성 자격증명이 없으면 발급(idempotent). provisioning(고객 install)용.
 * @returns created=false → 기존 활성 키 존재(평문 없음). created=true → 신규 token 반환(Colony env 주입용).
 */
export async function ensureTenantGatewayCredential(
  tenantSlug: string,
  opts: { scopes?: string[]; issuedBy?: string } = {},
): Promise<{ created: boolean; token?: string; tokenPrefix?: string }> {
  const pool = getPool();
  const t = await pool.query<{ id: string }>(`SELECT id FROM public.tenants WHERE slug = $1`, [
    tenantSlug,
  ]);
  const tenantId = t.rows[0]?.id;
  if (!tenantId) throw new Error(`tenant not found: ${tenantSlug}`);
  const active = await pool.query<{ n: number }>(
    `SELECT count(*)::int n FROM ${DB_SCHEMA}.gateway_credentials WHERE tenant_id = $1 AND status = 'active'`,
    [tenantId],
  );
  if ((active.rows[0]?.n ?? 0) > 0) return { created: false };
  const r = await issueGatewayCredentialForTenant({
    tenantId,
    tenantSlug,
    scopes: opts.scopes,
    issuedBy: opts.issuedBy ?? 'provisioning',
  });
  return { created: true, token: r.token, tokenPrefix: r.tokenPrefix };
}

export function registerGatewayCommands(program: Command): void {
  const gw = program
    .command('gateway')
    .description('SemiColony KB 게이트웨이 멀티테넌트 자격증명 관리');

  gw.command('issue-key')
    .description('테넌트에 새 Bearer 자격증명 발급 (평문 1회 출력)')
    .requiredOption('--tenant <slug>', 'public.tenants.slug')
    .option('--scopes <csv>', `콤마구분 scope (기본: ${DEFAULT_SCOPES.join(',')})`)
    .option('--expires-days <n>', '만료일수 (미지정 시 무기한)')
    .option('--issued-by <who>', '발급자 식별자', 'cli')
    .action(
      async (opts: { tenant: string; scopes?: string; expiresDays?: string; issuedBy: string }) => {
        try {
          const tenant = await resolveTenant(opts.tenant);
          const scopes = parseScopes(opts.scopes);
          const { id, token, tokenPrefix } = await issueGatewayCredentialForTenant({
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            scopes,
            issuedBy: opts.issuedBy,
            expiresDays: opts.expiresDays,
          });
          printToken(token, tokenPrefix, tenant.slug);
          console.log(chalk.gray(`  id=${id}  scopes=[${scopes.join(', ')}]`));
        } catch (err) {
          console.error(chalk.red(`❌ ${err instanceof Error ? err.message : String(err)}`));
          process.exitCode = 1;
        } finally {
          await closeConnection();
        }
      },
    );

  gw.command('rotate-key')
    .description('테넌트 자격증명 회전 (새 키 발급 + 기존 활성 키에 grace 만료 부여)')
    .requiredOption('--tenant <slug>', 'public.tenants.slug')
    .option('--grace-days <n>', '기존 키 grace 기간(일)', '7')
    .option('--scopes <csv>', `새 키 scope (기본: ${DEFAULT_SCOPES.join(',')})`)
    .option('--issued-by <who>', '발급자 식별자', 'cli')
    .action(
      async (opts: { tenant: string; graceDays: string; scopes?: string; issuedBy: string }) => {
        const pool = getPool();
        try {
          const tenant = await resolveTenant(opts.tenant);
          const scopes = parseScopes(opts.scopes);
          // 기존 활성 키: grace 기간 뒤 만료(즉시 폐기 대신 무중단 회전).
          const graced = await pool.query(
            `UPDATE ${DB_SCHEMA}.gateway_credentials
              SET expires_at = LEAST(COALESCE(expires_at, 'infinity'::timestamptz), now() + ($2 || ' days')::interval),
                  metadata = metadata || jsonb_build_object('rotated_at', now()::text)
            WHERE tenant_id = $1 AND status = 'active'`,
            [tenant.id, opts.graceDays],
          );
          const { token, tokenHash, tokenPrefix } = generateTenantToken(tenant.slug);
          await pool.query(
            `INSERT INTO ${DB_SCHEMA}.gateway_credentials
             (tenant_id, tenant_slug, token_hash, token_prefix, scopes, issued_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
            [tenant.id, tenant.slug, tokenHash, tokenPrefix, scopes, opts.issuedBy],
          );
          printToken(token, tokenPrefix, tenant.slug);
          console.log(
            chalk.gray(
              `  기존 활성 키 ${graced.rowCount ?? 0}개에 ${opts.graceDays}일 grace 만료 부여됨.`,
            ),
          );
        } catch (err) {
          console.error(chalk.red(`❌ ${err instanceof Error ? err.message : String(err)}`));
          process.exitCode = 1;
        } finally {
          await closeConnection();
        }
      },
    );

  gw.command('revoke-key')
    .description('자격증명 즉시 폐기 (--id 또는 --tenant 전체)')
    .option('--id <uuid>', '특정 자격증명 id')
    .option('--tenant <slug>', '해당 테넌트의 모든 활성 자격증명')
    .option('--reason <text>', '폐기 사유', 'manual revoke')
    .action(async (opts: { id?: string; tenant?: string; reason: string }) => {
      const pool = getPool();
      try {
        if (!opts.id && !opts.tenant) {
          throw new Error('--id 또는 --tenant 중 하나는 필수입니다.');
        }
        let res;
        if (opts.id) {
          res = await pool.query(
            `UPDATE ${DB_SCHEMA}.gateway_credentials
                SET status='revoked', revoked_at=now(), revoked_reason=$2
              WHERE id=$1 AND status='active'`,
            [opts.id, opts.reason],
          );
        } else {
          const tenant = await resolveTenant(opts.tenant!);
          res = await pool.query(
            `UPDATE ${DB_SCHEMA}.gateway_credentials
                SET status='revoked', revoked_at=now(), revoked_reason=$2
              WHERE tenant_id=$1 AND status='active'`,
            [tenant.id, opts.reason],
          );
        }
        console.log(chalk.green(`✔ 폐기 완료: ${res.rowCount ?? 0}개 자격증명 revoked`));
      } catch (err) {
        console.error(chalk.red(`❌ ${err instanceof Error ? err.message : String(err)}`));
        process.exitCode = 1;
      } finally {
        await closeConnection();
      }
    });

  gw.command('list-keys')
    .description('자격증명 목록 (시크릿 미노출)')
    .option('--tenant <slug>', '특정 테넌트만')
    .action(async (opts: { tenant?: string }) => {
      const pool = getPool();
      try {
        const where = opts.tenant ? `WHERE tenant_slug = $1` : '';
        const params = opts.tenant ? [opts.tenant] : [];
        const { rows } = await pool.query(
          `SELECT token_prefix, tenant_slug, status, scopes,
                  issued_at::text, expires_at::text, last_used_at::text
             FROM ${DB_SCHEMA}.gateway_credentials
             ${where}
            ORDER BY issued_at DESC
            LIMIT 100`,
          params,
        );
        if (!rows.length) {
          console.log(chalk.gray('자격증명이 없습니다.'));
          return;
        }
        for (const r of rows as Array<Record<string, unknown>>) {
          const status = r.status === 'active' ? chalk.green('active') : chalk.red('revoked');
          console.log(
            `${chalk.cyan(String(r.token_prefix))}… [${status}] ${r.tenant_slug} ` +
              `scopes=[${(r.scopes as string[]).join(',')}] ` +
              `issued=${r.issued_at} expires=${r.expires_at ?? '∞'} last_used=${r.last_used_at ?? '-'}`,
          );
        }
      } catch (err) {
        console.error(chalk.red(`❌ ${err instanceof Error ? err.message : String(err)}`));
        process.exitCode = 1;
      } finally {
        await closeConnection();
      }
    });
}

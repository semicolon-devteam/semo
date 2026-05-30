/**
 * `semo dev tenant ...` — Dynamic tenant management for the SEMO Dashboard appdb.
 *
 * Provides developer-only CRUD/seed helpers against the appdb `public.tenants`
 * family (tenants, subscriptions, agent_installs, agent_activity, usage_meters,
 * payment_events). Intentionally isolated from the main CLI pg.Pool — the SEMO
 * CLI's DATABASE_URL frequently points at the KB cluster, but this command
 * needs the appdb. We therefore:
 *
 *   1) Read `process.env.SEMO_APPDB_URL ?? process.env.DATABASE_URL`.
 *   2) Build a LOCAL pg.Pool inside this module (lazy-loaded `pg`).
 *   3) Never touch `database.ts` / the shared pool.
 *
 * Subcommands:
 *   - list    : tabular listing of tenants
 *   - create  : INSERT tenant (+ default subscription) idempotently
 *   - seed    : populate installs / activity / usage_meters / payment_events
 *               (idempotent via tenants.metadata.seed_v; reset to re-seed)
 *   - reset   : delete child rows for one tenant and clear seed gate
 *   - delete  : drop tenant + cascaded children (refuses without --yes)
 */

import { Command } from 'commander';
import chalk from 'chalk';

// pg is an optional dependency in package.json. We lazy-load with require so a
// missing install fails loudly only when the command actually runs.
type PgPool = import('pg').Pool;
type PgPoolClient = import('pg').PoolClient;

let pgModuleCache: typeof import('pg') | null = null;
function loadPg(): typeof import('pg') {
  if (!pgModuleCache) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pgModuleCache = require('pg') as typeof import('pg');
    } catch (err) {
      throw new Error(
        `pg 드라이버를 로드할 수 없습니다. \`npm i pg\` 후 다시 시도하세요. (${(err as Error).message})`,
      );
    }
  }
  return pgModuleCache;
}

function resolveAppdbUrl(): string {
  const url = process.env.SEMO_APPDB_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'appdb 연결 정보가 없습니다. SEMO_APPDB_URL 또는 DATABASE_URL 환경변수를 설정하세요.',
    );
  }
  return url;
}

function buildLocalPool(): PgPool {
  const url = resolveAppdbUrl();
  const { Pool } = loadPg();
  return new Pool({
    connectionString: url,
    ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
}

async function withPool<T>(fn: (pool: PgPool) => Promise<T>): Promise<T> {
  const pool = buildLocalPool();
  try {
    return await fn(pool);
  } finally {
    await pool.end().catch(() => {
      /* swallow — best-effort close */
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Output helpers
// ──────────────────────────────────────────────────────────────────────────

function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const sep = widths.map((w) => '─'.repeat(w + 2)).join('┼');
  const fmtRow = (cols: string[]) =>
    '│ ' + cols.map((c, i) => (c ?? '').padEnd(widths[i])).join(' │ ') + ' │';
  console.log(fmtRow(headers));
  console.log('├' + sep + '┤');
  for (const r of rows) console.log(fmtRow(r));
}

function formatDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
  return String(value).slice(0, 19).replace('T', ' ');
}

// ──────────────────────────────────────────────────────────────────────────
// Subcommand impls
// ──────────────────────────────────────────────────────────────────────────

interface TenantRow {
  slug: string;
  display_name: string;
  tenant_type: string;
  plan_slug: string;
  owned: boolean;
  created_at: string | Date;
}

async function cmdList(): Promise<void> {
  await withPool(async (pool) => {
    const res = await pool.query<TenantRow>(
      `SELECT slug,
              display_name,
              tenant_type,
              plan_slug,
              (owner_user_id IS NOT NULL) AS owned,
              created_at
         FROM public.tenants
        ORDER BY created_at ASC`,
    );
    if (res.rows.length === 0) {
      console.log(chalk.yellow('등록된 tenant 가 없습니다.'));
      return;
    }
    const rows = res.rows.map((r) => [
      r.slug,
      r.display_name,
      r.tenant_type,
      r.plan_slug,
      r.owned ? 'yes' : 'no',
      formatDate(r.created_at),
    ]);
    printTable(['SLUG', 'DISPLAY', 'TYPE', 'PLAN', 'OWNED', 'CREATED_AT'], rows);
    console.log(chalk.gray(`\n총 ${res.rows.length}개 tenant.`));
  });
}

interface CreateOpts {
  slug: string;
  display: string;
  plan?: string;
  type?: string;
}

const ALLOWED_PLANS = new Set(['free', 'starter', 'pro', 'business']);
const ALLOWED_TYPES = new Set(['personal', 'team', 'provider']);

async function cmdCreate(opts: CreateOpts): Promise<void> {
  if (!opts.slug || !opts.display) {
    throw new Error('--slug 와 --display 는 필수입니다.');
  }
  const plan = opts.plan ?? 'starter';
  if (!ALLOWED_PLANS.has(plan)) {
    throw new Error(`--plan 은 ${Array.from(ALLOWED_PLANS).join('|')} 중 하나여야 합니다.`);
  }
  const type = opts.type ?? (opts.slug.startsWith('team-') ? 'team' : 'personal');
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error(`--type 은 ${Array.from(ALLOWED_TYPES).join('|')} 중 하나여야 합니다.`);
  }

  await withPool(async (pool) => {
    const client: PgPoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const tenantRes = await client.query<{ id: string }>(
        `INSERT INTO public.tenants (slug, display_name, tenant_type, plan_slug)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [opts.slug, opts.display, type, plan],
      );

      if (tenantRes.rows.length === 0) {
        await client.query('ROLLBACK');
        console.log(chalk.yellow(`⚠️  tenant slug='${opts.slug}' 이(가) 이미 존재합니다. (no-op)`));
        return;
      }

      const tenantId = tenantRes.rows[0].id;

      // Default subscription — gracefully no-op if plan row missing or already
      // present (UNIQUE(tenant_id)).
      const subRes = await client.query<{ id: string }>(
        `INSERT INTO public.subscriptions (tenant_id, plan_slug, status, started_at, next_billing_at)
         VALUES ($1, $2, 'active', now(), now() + interval '30 days')
         ON CONFLICT (tenant_id) DO NOTHING
         RETURNING id`,
        [tenantId, plan],
      );

      await client.query('COMMIT');
      console.log(
        chalk.green(`✓ tenant 생성: slug='${opts.slug}' id=${tenantId} plan=${plan} type=${type}`),
      );
      if (subRes.rows.length > 0) {
        console.log(chalk.gray(`  subscription seeded (active, +30d billing)`));
      } else {
        console.log(chalk.gray(`  subscription 이미 존재 — skip`));
      }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  });
}

interface SeedOpts {
  slug: string;
  installs?: number | string;
  activity?: number | string;
  pay?: number | string;
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = arr.slice();
  // Fisher-Yates partial shuffle
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

const SEED_VERBS = [
  '주문 응대',
  '재고 알림',
  'SNS 발행',
  '문의 응답',
  '추천',
  '정산',
  '미팅 요약',
  '세금계산서',
  '문서 초안',
];
const SEED_TARGETS = [
  '테이블 4',
  '단골 김지훈',
  '카카오 채널',
  '인스타그램',
  '네이버 블로그',
  '신한 카드',
  '주간 운영회의',
  '거래처 미림상사',
  '직원 채용공고',
  '우유 2L',
  '시럽 — 카라멜',
];
const SEED_STATUS = ['done', 'done', 'done', 'done', 'pending'];

async function cmdSeed(opts: SeedOpts): Promise<void> {
  if (!opts.slug) throw new Error('--slug 는 필수입니다.');
  const installs = Math.max(0, parseInt(String(opts.installs ?? 5), 10));
  const activity = Math.max(0, parseInt(String(opts.activity ?? 12), 10));
  const pay = Math.max(0, parseInt(String(opts.pay ?? 2), 10));

  await withPool(async (pool) => {
    const client: PgPoolClient = await pool.connect();
    try {
      await client.query('BEGIN');

      const tRes = await client.query<{
        id: string;
        seeded: boolean;
        display_name: string;
      }>(
        `SELECT id,
                (metadata ? 'seed_v') AS seeded,
                display_name
           FROM public.tenants
          WHERE slug = $1
          FOR UPDATE`,
        [opts.slug],
      );
      if (tRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error(
          `tenant slug='${opts.slug}' 을 찾을 수 없습니다. \`semo dev tenant create\` 먼저 실행하세요.`,
        );
      }
      const { id: tenantId, seeded } = tRes.rows[0];
      if (seeded) {
        await client.query('ROLLBACK');
        console.log(
          chalk.yellow(
            `⚠️  '${opts.slug}' 은 이미 seed 됐습니다 (metadata.seed_v 존재). ` +
              `재시드하려면 먼저 \`semo dev tenant reset --slug ${opts.slug} --yes\` 실행.`,
          ),
        );
        return;
      }

      // 1) Pick approved customer-audience listings
      const lstRes = await client.query<{ id: string; display_name: string }>(
        `SELECT id, display_name
           FROM public.agent_listings
          WHERE audience = 'customer' AND review_status = 'approved'
          ORDER BY created_at ASC`,
      );
      if (lstRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error(
          'public.agent_listings 에 audience=customer + review_status=approved 인 항목이 없습니다.',
        );
      }
      const pickedInstalls = pickN(lstRes.rows, installs);

      let insertedInstalls = 0;
      for (const lst of pickedInstalls) {
        const ins = await client.query(
          `INSERT INTO public.agent_installs
              (tenant_id, listing_id, instance_name, install_status, today_summary, avatar_state, last_activity_at)
            VALUES ($1, $2, $3, 'active', $4, 'idle', now() - (random() * interval '60 minutes'))
            ON CONFLICT (tenant_id, listing_id, instance_name) DO NOTHING`,
          [tenantId, lst.id, lst.display_name, `${lst.display_name} 기본 인스턴스`],
        );
        insertedInstalls += ins.rowCount ?? 0;
      }

      // 2) Activity rows — randomised verbs/targets, spread over ~3 days
      const activityListings = pickN(lstRes.rows, Math.min(lstRes.rows.length, activity));
      let insertedActivity = 0;
      for (let i = 0; i < activity; i++) {
        const lst = activityListings[i % Math.max(1, activityListings.length)] ?? lstRes.rows[0];
        const verb = SEED_VERBS[Math.floor(Math.random() * SEED_VERBS.length)];
        const target = SEED_TARGETS[Math.floor(Math.random() * SEED_TARGETS.length)];
        const status = SEED_STATUS[Math.floor(Math.random() * SEED_STATUS.length)];
        const minutesAgo = Math.floor(Math.random() * 60 * 24 * 3); // 0..3d
        const ins = await client.query(
          `INSERT INTO public.agent_activity
              (tenant_id, listing_id, verb, target, detail, is_ai, status, occurred_at)
            VALUES ($1, $2, $3, $4, $5, true, $6, now() - ($7::int * interval '1 minute'))`,
          [
            tenantId,
            lst.id,
            verb,
            target,
            `${verb} — ${target} 처리 #${i + 1}`,
            status,
            minutesAgo,
          ],
        );
        insertedActivity += ins.rowCount ?? 0;
      }

      // 3) usage_meters (current period)
      const meterRes = await client.query(
        `INSERT INTO public.usage_meters (tenant_id, metric, used, limit_val, period_start)
         VALUES
           ($1, 'ai_responses',  $2, 1000, date_trunc('month', now())::date),
           ($1, 'kb_storage_mb', $3,  500, date_trunc('month', now())::date),
           ($1, 'employees',     $4,   10, date_trunc('month', now())::date)
         ON CONFLICT (tenant_id, metric, period_start) DO NOTHING`,
        [
          tenantId,
          50 + Math.floor(Math.random() * 500),
          20 + Math.floor(Math.random() * 200),
          1 + Math.floor(Math.random() * 8),
        ],
      );

      // 4) payment_events
      let insertedPay = 0;
      for (let i = 0; i < pay; i++) {
        const daysAgo = 5 + i * 30;
        const ins = await client.query(
          `INSERT INTO public.payment_events
              (tenant_id, event_type, amount_krw, status, invoice_label, occurred_at)
            VALUES ($1, 'charge', $2, 'paid', $3, now() - ($4::int * interval '1 day'))`,
          [tenantId, 29000, `seed invoice #${i + 1}`, daysAgo],
        );
        insertedPay += ins.rowCount ?? 0;
      }

      // 5) Gate the seed via metadata
      await client.query(
        `UPDATE public.tenants
            SET metadata = metadata || jsonb_build_object('seed_v', '1', 'seeded_at', to_jsonb(now()))
          WHERE id = $1`,
        [tenantId],
      );

      await client.query('COMMIT');
      console.log(chalk.green(`✓ seed 완료: tenant='${opts.slug}'`));
      console.log(chalk.gray(`  installs       : ${insertedInstalls}`));
      console.log(chalk.gray(`  activity       : ${insertedActivity}`));
      console.log(chalk.gray(`  usage_meters   : ${meterRes.rowCount ?? 0}`));
      console.log(chalk.gray(`  payment_events : ${insertedPay}`));
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  });
}

interface ResetOpts {
  slug: string;
  yes?: boolean;
}

async function cmdReset(opts: ResetOpts): Promise<void> {
  if (!opts.slug) throw new Error('--slug 는 필수입니다.');
  if (!opts.yes) {
    throw new Error('파괴적 작업입니다. --yes 를 명시하세요.');
  }

  await withPool(async (pool) => {
    const client: PgPoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const tRes = await client.query<{ id: string }>(
        `SELECT id FROM public.tenants WHERE slug = $1 FOR UPDATE`,
        [opts.slug],
      );
      if (tRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error(`tenant slug='${opts.slug}' 을 찾을 수 없습니다.`);
      }
      const tenantId = tRes.rows[0].id;

      const tables = [
        'agent_installs',
        'agent_activity',
        'usage_meters',
        'payment_events',
      ] as const;
      const counts: Record<string, number> = {};
      for (const tbl of tables) {
        const res = await client.query(`DELETE FROM public.${tbl} WHERE tenant_id = $1`, [
          tenantId,
        ]);
        counts[tbl] = res.rowCount ?? 0;
      }

      const metaRes = await client.query(
        `UPDATE public.tenants
            SET metadata = metadata - 'seed_v' - 'seeded_at'
          WHERE id = $1
        RETURNING (metadata ? 'seed_v') AS still_seeded`,
        [tenantId],
      );

      await client.query('COMMIT');
      console.log(chalk.green(`✓ reset 완료: tenant='${opts.slug}'`));
      for (const tbl of tables) {
        console.log(chalk.gray(`  ${tbl.padEnd(16)} : ${counts[tbl]} rows deleted`));
      }
      const stillSeeded = metaRes.rows[0]?.still_seeded;
      console.log(chalk.gray(`  metadata.seed_v cleared (still_seeded=${stillSeeded ?? false})`));
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  });
}

interface DeleteOpts {
  slug: string;
  yes?: boolean;
  forceSeed?: boolean;
}

const PROTECTED_SLUGS = new Set(['team-semicolon', 'jeongmin-cafe']);

async function cmdDelete(opts: DeleteOpts): Promise<void> {
  if (!opts.slug) throw new Error('--slug 는 필수입니다.');
  if (!opts.yes) {
    throw new Error('파괴적 작업입니다. --yes 를 명시하세요.');
  }
  if (PROTECTED_SLUGS.has(opts.slug) && !opts.forceSeed) {
    throw new Error(
      `'${opts.slug}' 은 보호된 seed tenant 입니다. 삭제하려면 --force-seed 도 추가하세요.`,
    );
  }

  await withPool(async (pool) => {
    const res = await pool.query<{ id: string }>(
      `DELETE FROM public.tenants WHERE slug = $1 RETURNING id`,
      [opts.slug],
    );
    if (res.rows.length === 0) {
      console.log(chalk.yellow(`⚠️  tenant slug='${opts.slug}' 이(가) 존재하지 않습니다.`));
      return;
    }
    console.log(
      chalk.green(`✓ tenant 삭제: slug='${opts.slug}' id=${res.rows[0].id} (CASCADE 자식 제거)`),
    );
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Registration
// ──────────────────────────────────────────────────────────────────────────

export function registerDevTenantCommand(program: Command): void {
  const dev = program.command('dev').description('개발자용 헬퍼 (appdb 직접 조작 — 비프로덕션)');

  const tenant = dev.command('tenant').description('SEMO Dashboard appdb tenant 동적 관리');

  tenant
    .command('list')
    .description('현재 등록된 tenant 목록을 표 형태로 출력')
    .action(async () => {
      try {
        await cmdList();
      } catch (err) {
        console.error(chalk.red(`✗ ${(err as Error).message}`));
        process.exitCode = 1;
      }
    });

  tenant
    .command('create')
    .description('새 tenant 생성 (+ 기본 subscription)')
    .requiredOption('--slug <slug>', 'tenant slug (UNIQUE)')
    .requiredOption('--display <name>', 'display_name')
    .option('--plan <plan>', `${Array.from(ALLOWED_PLANS).join('|')} (default starter)`)
    .option(
      '--type <type>',
      `${Array.from(ALLOWED_TYPES).join('|')} (default: team if slug team- prefix, else personal)`,
    )
    .action(async (opts: CreateOpts) => {
      try {
        await cmdCreate(opts);
      } catch (err) {
        console.error(chalk.red(`✗ ${(err as Error).message}`));
        process.exitCode = 1;
      }
    });

  tenant
    .command('seed')
    .description('tenant 에 install/activity/usage/payment 시드 데이터 적재')
    .requiredOption('--slug <slug>', 'tenant slug')
    .option('--installs <n>', '활성 install 수 (default 5)', '5')
    .option('--activity <n>', 'agent_activity row 수 (default 12)', '12')
    .option('--pay <n>', 'payment_event row 수 (default 2)', '2')
    .action(async (opts: SeedOpts) => {
      try {
        await cmdSeed(opts);
      } catch (err) {
        console.error(chalk.red(`✗ ${(err as Error).message}`));
        process.exitCode = 1;
      }
    });

  tenant
    .command('reset')
    .description('tenant 의 자식 row 삭제 + seed_v 해제 (tenant 본체는 유지)')
    .requiredOption('--slug <slug>', 'tenant slug')
    .option('--yes', '확인 플래그 (필수)')
    .action(async (opts: ResetOpts) => {
      try {
        await cmdReset(opts);
      } catch (err) {
        console.error(chalk.red(`✗ ${(err as Error).message}`));
        process.exitCode = 1;
      }
    });

  tenant
    .command('delete')
    .description('tenant 자체를 삭제 (CASCADE 로 자식까지 제거)')
    .requiredOption('--slug <slug>', 'tenant slug')
    .option('--yes', '확인 플래그 (필수)')
    .option('--force-seed', "'team-semicolon' / 'jeongmin-cafe' 보호 해제")
    .action(async (opts: DeleteOpts) => {
      try {
        await cmdDelete(opts);
      } catch (err) {
        console.error(chalk.red(`✗ ${(err as Error).message}`));
        process.exitCode = 1;
      }
    });
}

#!/usr/bin/env node
/**
 * check-semicolony-schema-flip-preflight.mjs
 *
 * Read-only preflight for the semo -> semicolony DB schema flip.
 * It does not clone, migrate, update env files, restart services, or write to DB.
 *
 * Usage:
 *   node scripts/check-semicolony-schema-flip-preflight.mjs
 *   node scripts/check-semicolony-schema-flip-preflight.mjs --env ~/.claude/semo/.env
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import util from 'node:util';

const args = process.argv.slice(2);
const SOURCE_SCHEMA = 'semo';
const TARGET_SCHEMA = 'semicolony';

function usage() {
  console.log(
    `Usage: node scripts/check-semicolony-schema-flip-preflight.mjs [--env <path>] [--json]\n\nRead-only checks:\n  - source/target schema existence\n  - schema_migrations parity\n  - migration files pending against both schemas\n  - row-count parity for common tables\n  - object-count parity for tables/views/sequences/functions/triggers/FKs\n  - runtime env sanity for SEMICOLONY_DB_SCHEMA/SEMO_DB_SCHEMA\n\nNo DB writes are performed.`,
  );
}

function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

if (args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

const jsonOutput = args.includes('--json');

function loadEnvFile(file) {
  if (!file || !fs.existsSync(file)) return false;
  const body = fs.readFileSync(file, 'utf8');
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eq = normalized.indexOf('=');
    if (eq === -1) continue;
    const key = normalized.slice(0, eq).trim();
    let value = normalized.slice(eq + 1).trim();
    if (!key || process.env[key] != null) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  return true;
}

const explicitEnv = argValue('--env');
const defaultEnv = path.join(os.homedir(), '.claude', 'semo', '.env');
const loadedEnv = loadEnvFile(explicitEnv ?? defaultEnv);

const checks = [];
function errorDetail(err) {
  if (err instanceof Error && err.message) return err.message;
  if (err && Array.isArray(err.errors)) {
    return err.errors
      .map((e) => (e instanceof Error && e.message ? e.message : util.inspect(e)))
      .join(' | ');
  }
  if (err && err.cause) return errorDetail(err.cause);
  return util.inspect(err, { depth: 2 });
}
function record(level, name, detail) {
  checks.push({ level, name, detail });
  if (!jsonOutput) {
    const tag = level === 'fail' ? 'FAIL' : level === 'warn' ? 'WARN' : 'PASS';
    console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
const pass = (name, detail) => record('pass', name, detail);
const warn = (name, detail) => record('warn', name, detail);
const fail = (name, detail) => record('fail', name, detail);

function dbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : false,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 5000,
      max: 2,
    };
  }
  if (!process.env.SEMO_DB_HOST) {
    throw new Error(
      'DATABASE_URL or SEMO_DB_HOST is required. Pass --env ~/.claude/semo/.env if needed.',
    );
  }
  return {
    host: process.env.SEMO_DB_HOST,
    port: Number(process.env.SEMO_DB_PORT || 5432),
    user: process.env.SEMO_DB_USER || 'app',
    password: process.env.SEMO_DB_PASSWORD,
    database: process.env.SEMO_DB_NAME || 'appdb',
    ssl: false,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 5000,
    max: 2,
  };
}

function qIdent(id) {
  return '"' + id.replace(/"/g, '""') + '"';
}

function migrationVersionsFromDisk() {
  const dir = path.resolve('packages', 'cli', 'migrations');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => f.replace(/\.sql$/, ''));
}

function diffSets(left, right) {
  const r = new Set(right);
  return left.filter((v) => !r.has(v));
}

async function schemaExists(pool, schema) {
  const { rows } = await pool.query(
    'SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname=$1) AS ok',
    [schema],
  );
  return rows[0]?.ok === true;
}

async function migrationVersions(pool, schema) {
  const reg = `${schema}.schema_migrations`;
  const exists = await pool.query('SELECT to_regclass($1) AS table_name', [reg]);
  if (!exists.rows[0]?.table_name) return null;
  const { rows } = await pool.query(
    `SELECT version FROM ${qIdent(schema)}.schema_migrations ORDER BY version`,
  );
  return rows.map((r) => r.version);
}

async function tableNames(pool, schema) {
  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename`,
    [schema],
  );
  return rows.map((r) => r.tablename);
}

async function rowCount(pool, schema, table) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::text AS n FROM ${qIdent(schema)}.${qIdent(table)}`,
  );
  return BigInt(rows[0].n);
}

async function objectCounts(pool, schema) {
  const sql = `
    SELECT 'tables' AS kind, COUNT(*)::int AS n FROM pg_tables WHERE schemaname=$1
    UNION ALL SELECT 'views', COUNT(*)::int FROM pg_views WHERE schemaname=$1
    UNION ALL SELECT 'sequences', COUNT(*)::int FROM information_schema.sequences WHERE sequence_schema=$1
    UNION ALL SELECT 'functions', COUNT(*)::int
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
     WHERE ns.nspname=$1 AND p.prokind IN ('f','p')
    UNION ALL SELECT 'triggers', COUNT(*)::int
      FROM pg_trigger tg
      JOIN pg_class cl ON cl.oid=tg.tgrelid
      JOIN pg_namespace ns ON ns.oid=cl.relnamespace
     WHERE ns.nspname=$1 AND NOT tg.tgisinternal
    UNION ALL SELECT 'foreign_keys', COUNT(*)::int
      FROM pg_constraint co JOIN pg_namespace ns ON ns.oid=co.connamespace
     WHERE ns.nspname=$1 AND co.contype='f'`;
  const { rows } = await pool.query(sql, [schema]);
  return Object.fromEntries(rows.map((r) => [r.kind, r.n]));
}

function checkEnv() {
  if (loadedEnv) pass('env file loaded', explicitEnv ?? defaultEnv);
  else
    warn(
      'env file not loaded',
      explicitEnv ? `not found: ${explicitEnv}` : `not found: ${defaultEnv}`,
    );

  const resolved = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? SOURCE_SCHEMA;
  if (process.env.SEMICOLONY_DB_SCHEMA && process.env.SEMICOLONY_DB_SCHEMA !== TARGET_SCHEMA) {
    fail(
      'SEMICOLONY_DB_SCHEMA value',
      `expected ${TARGET_SCHEMA}, got ${process.env.SEMICOLONY_DB_SCHEMA}`,
    );
  } else if (resolved === TARGET_SCHEMA) {
    warn(
      'runtime DB schema env',
      'already resolves to semicolony; rollback must remove SEMICOLONY_DB_SCHEMA',
    );
  } else if (resolved === SOURCE_SCHEMA) {
    pass('runtime DB schema env', 'currently resolves to semo; flip is still pending');
  } else {
    fail('runtime DB schema env', `unexpected resolved schema: ${resolved}`);
  }
}

async function main() {
  checkEnv();

  const pg = await import('pg');
  const Pool = pg.default?.Pool ?? pg.Pool;
  const pool = new Pool(dbConfig());
  try {
    await pool.query('SELECT 1');
    pass('database connection', 'read-only connection ok');

    const [sourceExists, targetExists] = await Promise.all([
      schemaExists(pool, SOURCE_SCHEMA),
      schemaExists(pool, TARGET_SCHEMA),
    ]);
    sourceExists
      ? pass('source schema exists', SOURCE_SCHEMA)
      : fail('source schema missing', SOURCE_SCHEMA);
    targetExists
      ? pass('target schema exists', TARGET_SCHEMA)
      : fail('target schema missing', TARGET_SCHEMA);
    if (!sourceExists || !targetExists) return;

    const disk = migrationVersionsFromDisk();
    const [sourceMigrations, targetMigrations] = await Promise.all([
      migrationVersions(pool, SOURCE_SCHEMA),
      migrationVersions(pool, TARGET_SCHEMA),
    ]);
    if (!sourceMigrations) fail('source schema_migrations', 'missing');
    if (!targetMigrations) fail('target schema_migrations', 'missing');
    if (!sourceMigrations || !targetMigrations) return;

    const sourceOnly = diffSets(sourceMigrations, targetMigrations);
    const targetOnly = diffSets(targetMigrations, sourceMigrations);
    if (sourceOnly.length || targetOnly.length) {
      fail(
        'schema_migrations parity',
        `source_only=${sourceOnly.slice(0, 10).join(',') || '-'} target_only=${targetOnly.slice(0, 10).join(',') || '-'}`,
      );
    } else {
      pass('schema_migrations parity', `${sourceMigrations.length}/${targetMigrations.length}`);
    }

    const sourcePending = diffSets(disk, sourceMigrations);
    const targetPending = diffSets(disk, targetMigrations);
    sourcePending.length
      ? fail('source pending migrations', sourcePending.slice(0, 12).join(', '))
      : pass('source pending migrations', '0');
    targetPending.length
      ? fail('target pending migrations', targetPending.slice(0, 12).join(', '))
      : pass('target pending migrations', '0');

    const [sourceTables, targetTables] = await Promise.all([
      tableNames(pool, SOURCE_SCHEMA),
      tableNames(pool, TARGET_SCHEMA),
    ]);
    const missingTargetTables = diffSets(sourceTables, targetTables);
    const extraTargetTables = diffSets(targetTables, sourceTables);
    if (missingTargetTables.length || extraTargetTables.length) {
      fail(
        'table name parity',
        `missing_target=${missingTargetTables.slice(0, 10).join(',') || '-'} extra_target=${extraTargetTables.slice(0, 10).join(',') || '-'}`,
      );
    } else {
      pass('table name parity', `${sourceTables.length} tables`);
    }

    const commonTables = sourceTables.filter((t) => targetTables.includes(t));
    const mismatches = [];
    for (const table of commonTables) {
      const [a, b] = await Promise.all([
        rowCount(pool, SOURCE_SCHEMA, table),
        rowCount(pool, TARGET_SCHEMA, table),
      ]);
      if (a !== b) mismatches.push(`${table}:${a}->${b}`);
    }
    mismatches.length
      ? fail('row-count parity', mismatches.slice(0, 12).join(', '))
      : pass('row-count parity', `${commonTables.length} common tables`);

    const [sourceObjects, targetObjects] = await Promise.all([
      objectCounts(pool, SOURCE_SCHEMA),
      objectCounts(pool, TARGET_SCHEMA),
    ]);
    const objectMismatches = Object.keys(sourceObjects).filter(
      (k) => sourceObjects[k] !== targetObjects[k],
    );
    if (objectMismatches.length) {
      fail(
        'object-count parity',
        objectMismatches.map((k) => `${k}:${sourceObjects[k]}->${targetObjects[k]}`).join(', '),
      );
    } else {
      pass('object-count parity', JSON.stringify(sourceObjects));
    }
  } finally {
    await pool.end();
  }
}

main()
  .catch((err) => {
    fail('preflight runtime error', errorDetail(err));
  })
  .finally(() => {
    const failures = checks.filter((c) => c.level === 'fail').length;
    const warnings = checks.filter((c) => c.level === 'warn').length;
    if (jsonOutput) console.log(JSON.stringify({ failures, warnings, checks }, null, 2));
    else console.log(`\nSummary: ${failures} failure(s), ${warnings} warning(s)`);
    process.exit(failures > 0 ? 1 : 0);
  });

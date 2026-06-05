import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve as pathResolve } from 'node:path';
import { Pool } from 'pg';
import { OpenAIEmbeddingProvider } from '@team-semicolon/semo-common';
import { buildApp } from './app.js';
import { PgKbService } from './lib/kb-service.js';
import { TenantKbService } from './lib/tenant-kb.js';
import { PersonaService } from './lib/persona-service.js';
import { TenantCredentialResolver } from './lib/tenant-credentials.js';

function loadSecret(): string {
  if (process.env.KB_GATEWAY_SECRET) return process.env.KB_GATEWAY_SECRET;
  const secretPath = pathResolve(homedir(), '.semo/secrets/kb-gateway.key');
  try {
    return readFileSync(secretPath, 'utf8').trim();
  } catch {
    throw new Error(
      `KB_GATEWAY_SECRET not set and ${secretPath} missing. Create one with: openssl rand -hex 32 > ${secretPath}`,
    );
  }
}

function buildPool(): Pool {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return new Pool({
    host: process.env.KB_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.KB_DB_PORT || '5432', 10),
    user: process.env.KB_DB_USER || 'app',
    password: process.env.KB_DB_PASSWORD || '',
    database: process.env.KB_DB_NAME || 'appdb',
    ssl: false,
    connectionTimeoutMillis: 5000,
  });
}

async function main() {
  const pool = buildPool();
  const embedding = new OpenAIEmbeddingProvider();
  const kb = new PgKbService(pool, embedding);
  const tenantKb = new TenantKbService(pool, embedding);
  const persona = new PersonaService(pool);
  const credentials = new TenantCredentialResolver(pool, {
    // 폐기/만료 전파 lag = 이 값. 즉시 무효화가 필요하면 0. (기본 5초)
    cacheTtlMs: parseInt(process.env.KB_GATEWAY_CRED_CACHE_MS || '5000', 10),
  });
  const secret = loadSecret();

  const app = await buildApp({
    kb,
    tenantKb,
    persona,
    credentials,
    embedding,
    secret,
    logger: true,
  });

  const port = parseInt(process.env.KB_GATEWAY_PORT || '18810', 10);
  // 외부 Colony 노출 시 KB_GATEWAY_HOST=0.0.0.0 (TLS 종단은 ingress/reverse-proxy). 기본은 로컬.
  const host = process.env.KB_GATEWAY_HOST || '127.0.0.1';
  await app.listen({ port, host });
  // eslint-disable-next-line no-console
  console.log(`[kb-gateway] listening on http://${host}:${port}`);

  const shutdown = async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[kb-gateway] startup failed', err);
  process.exit(1);
});

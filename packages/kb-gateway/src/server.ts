import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve as pathResolve } from 'node:path';
import { Pool } from 'pg';
import { OpenAIEmbeddingProvider } from '@team-semicolon/semo-common';
import { buildApp } from './app.js';
import { PgKbService } from './lib/kb-service.js';

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
  const secret = loadSecret();

  const app = await buildApp({ kb, embedding, secret, logger: true });

  const port = parseInt(process.env.KB_GATEWAY_PORT || '18810', 10);
  await app.listen({ port, host: '127.0.0.1' });
  // eslint-disable-next-line no-console
  console.log(`[kb-gateway] listening on http://127.0.0.1:${port}`);

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

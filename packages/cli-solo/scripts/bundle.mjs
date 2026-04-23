#!/usr/bin/env node
/**
 * cli-solo bundler — 단일 파일 번들로 외부 pg/slack 의존성을 완전히 배제.
 *
 * 번들 대상: src/index.ts + @team-semicolon/semo-common/solo + semo-kb-core + semo-ops-store/sqlite.
 * External: better-sqlite3(네이티브 바인딩).
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'src', 'index.ts');
const outfile = path.join(root, 'dist', 'bundle.js');

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: ['better-sqlite3'],
  logLevel: 'info',
});

fs.chmodSync(outfile, 0o755);
console.log(`✓ bundled → ${outfile}`);

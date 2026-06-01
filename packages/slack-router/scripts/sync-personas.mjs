#!/usr/bin/env node
// repo personas → active hermes home 의 SOUL.md 동기화.
// SoT = packages/slack-router/personas/{semi,colony,operator}.SOUL.md
// 대상 home = $SEMI_HERMES_HOME (기본 ~/.hermes-semo-canary)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const personasDir = join(here, '..', 'personas');
const home = process.env.SEMI_HERMES_HOME || join(homedir(), '.hermes-semo-canary');

const MAP = [
  ['semi.SOUL.md', 'semo-semi'],
  ['colony.SOUL.md', 'semo-colony'],
  ['operator.SOUL.md', 'semo-operator'],
];

let synced = 0;
for (const [file, profile] of MAP) {
  const src = join(personasDir, file);
  if (!existsSync(src)) {
    console.warn(`[sync-personas] skip (no src): ${file}`);
    continue;
  }
  const destDir = join(home, 'profiles', profile);
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, 'SOUL.md');
  writeFileSync(dest, readFileSync(src, 'utf8'));
  console.log(`[sync-personas] ${file} → ${dest}`);
  synced++;
}
console.log(`[sync-personas] done (${synced} profiles, home=${home})`);

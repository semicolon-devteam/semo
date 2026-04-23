#!/usr/bin/env node
/**
 * 최소 스모크 테스트 — dist/profile-resolver.js 를 직접 import 해서 판별 순서 검증.
 * vitest 미사용(인터랙티브 쉘 행업 회피).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { resolveProfile } = await import(path.resolve(__dirname, '../dist/profile-resolver.js'));

const originalEnv = { ...process.env };
let pass = 0;
let fail = 0;
const tmpRoots = [];

function assert(label, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? ` (${detail})` : ''}`);
  }
}

function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpRoots.push(dir);
  return dir;
}

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.SEMO_PROFILE;
  delete process.env.SEMO_HOME;
}

console.log('profile-resolver smoke test');

resetEnv();
process.env.SEMO_PROFILE = 'personal';
{
  const tmp = mkTmp('semo-core-profile-');
  const result = resolveProfile(tmp);
  assert(
    'env SEMO_PROFILE=personal 최우선',
    result.profile === 'personal' && result.source === 'env:SEMO_PROFILE',
    JSON.stringify(result),
  );
}

resetEnv();
process.env.SEMO_PROFILE = 'team';
{
  const tmp = mkTmp('semo-core-profile-');
  const result = resolveProfile(tmp);
  assert('env SEMO_PROFILE=team', result.profile === 'team', JSON.stringify(result));
}

resetEnv();
{
  const semoHome = mkTmp('semo-home-');
  fs.writeFileSync(path.join(semoHome, 'config.toml'), 'profile = "personal"\n');
  process.env.SEMO_HOME = semoHome;
  const tmp = mkTmp('semo-core-profile-');
  const result = resolveProfile(tmp);
  assert(
    'SEMO_HOME/config.toml 의 top-level profile',
    result.profile === 'personal' && result.source === 'config:semo-home',
    JSON.stringify(result),
  );
}

resetEnv();
{
  const tmp = mkTmp('semo-core-profile-');
  fs.writeFileSync(path.join(tmp, 'semo.config.toml'), 'profile = "personal"\n');
  const result = resolveProfile(tmp);
  assert(
    'cwd/semo.config.toml 의 top-level profile',
    result.profile === 'personal' && result.source === 'config:cwd',
    JSON.stringify(result),
  );
}

resetEnv();
{
  const tmp = mkTmp('semo-core-profile-');
  fs.writeFileSync(path.join(tmp, 'semo.config.toml'), '[profile]\nname = "personal"\n');
  const result = resolveProfile(tmp);
  assert('[profile].name 섹션 문법도 허용', result.profile === 'personal', JSON.stringify(result));
}

resetEnv();
{
  const tmp = mkTmp('semo-core-profile-');
  const result = resolveProfile(tmp);
  assert(
    '아무 설정 없으면 기본값 team',
    result.profile === 'team' && result.source === 'default',
    JSON.stringify(result),
  );
}

resetEnv();
{
  const tmp = mkTmp('semo-core-profile-');
  fs.writeFileSync(path.join(tmp, 'semo.config.toml'), 'profile = "enterprise"\n');
  const result = resolveProfile(tmp);
  assert(
    '유효하지 않은 profile 값은 무시되고 default',
    result.source === 'default',
    JSON.stringify(result),
  );
}

resetEnv();
{
  const tmp = mkTmp('semo-core-profile-');
  fs.writeFileSync(path.join(tmp, 'semo.config.toml'), 'profile = "person');
  const result = resolveProfile(tmp);
  assert('깨진 toml 은 무시', result.profile === 'team', JSON.stringify(result));
}

for (const dir of tmpRoots) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

process.env = { ...originalEnv };

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

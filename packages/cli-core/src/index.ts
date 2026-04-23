#!/usr/bin/env node
/**
 * semo-core — L0 메타프레임워크 entry.
 *
 * 역할: profile 판별 후 적절한 하위 CLI 에 dispatch.
 *   - team     → @team-semicolon/semo-cli  (bin: semo)
 *   - personal → @team-semicolon/semo-solo (bin: semo-solo)
 *
 * 이 엔트리는 기존 CLI 코드를 재사용하는 **얇은 래퍼**다. 각 CLI 의 lifecycle
 * (exit code, stdio, signal) 은 그대로 전파된다.
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { resolveProfile, type Profile } from './profile-resolver.js';

interface DispatchTarget {
  profile: Profile;
  bin: string;
  packageName: string;
}

const TARGETS: Record<Profile, DispatchTarget> = {
  team: {
    profile: 'team',
    bin: 'semo',
    packageName: '@team-semicolon/semo-cli',
  },
  personal: {
    profile: 'personal',
    bin: 'semo-solo',
    packageName: '@team-semicolon/semo-solo',
  },
};

function resolveBinPath(packageName: string, binName: string): string | null {
  try {
    const pkgPath = require.resolve(`${packageName}/package.json`);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      bin?: Record<string, string> | string;
    };
    const pkgDir = path.dirname(pkgPath);
    const binField = pkg.bin;
    if (typeof binField === 'string') return path.resolve(pkgDir, binField);
    if (binField && typeof binField === 'object') {
      const binRel = binField[binName] ?? Object.values(binField)[0];
      return binRel ? path.resolve(pkgDir, binRel) : null;
    }
    return null;
  } catch {
    return null;
  }
}

function fail(message: string, exitCode = 1): never {
  process.stderr.write(`semo-core: ${message}\n`);
  process.exit(exitCode);
}

function main(): void {
  const resolution = resolveProfile();
  const target = TARGETS[resolution.profile];

  const args = process.argv.slice(2);

  if (args[0] === '--print-profile') {
    process.stdout.write(`${JSON.stringify(resolution, null, 2)}\n`);
    return;
  }

  const binPath = resolveBinPath(target.packageName, target.bin);
  if (!binPath || !fs.existsSync(binPath)) {
    fail(
      `${target.profile} 프로파일의 하위 CLI 를 찾지 못했습니다. ` +
        `${target.packageName} 가 설치되어 있는지 확인하세요. ` +
        `(source: ${resolution.source}${resolution.configPath ? `, config: ${resolution.configPath}` : ''})`,
    );
  }

  const result = spawnSync(process.execPath, [binPath, ...args], {
    stdio: 'inherit',
    env: { ...process.env, SEMO_DISPATCHED_PROFILE: target.profile },
  });

  if (result.error) fail(result.error.message);
  process.exit(result.status ?? 0);
}

main();

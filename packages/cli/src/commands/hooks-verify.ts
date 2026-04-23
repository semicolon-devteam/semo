/**
 * semo hooks — shared/hooks/ 디렉터리 SHA256 검증
 *
 * 공격 벡터:
 *   kernel npm 업데이트로 새 훅 bash 스크립트를 내려받으면 임의 코드가 Stop/SessionStart
 *   등 claude-code 훅에서 실행된다. 체크섬으로 예상과 다른 콘텐츠를 감지한다.
 *
 * 명령어:
 *   semo hooks manifest   — 현재 hooks 디렉터리를 해싱해 manifest.json 생성 (kernel 패키징용)
 *   semo hooks verify     — manifest.json 과 실제 파일 비교. 미스매치 시 exit 1.
 *
 * manifest 형식:
 *   {
 *     "version": "1",
 *     "generated_at": "2026-04-22T15:00:00.000Z",
 *     "hooks_dir": "~/.semo/shared/hooks",
 *     "files": {
 *       "decision-reminder.sh": "sha256:abcd...",
 *       ...
 *     }
 *   }
 */
import { Command } from 'commander';
import chalk from 'chalk';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { semoHome } from '../paths.js';

export interface HooksManifest {
  version: string;
  generated_at: string;
  hooks_dir: string;
  files: Record<string, string>;
}

export function defaultHooksDir(): string {
  return path.join(semoHome(), 'shared', 'hooks');
}

export function defaultManifestPath(): string {
  return path.join(semoHome(), 'shared', 'hooks-manifest.json');
}

function hashFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');
}

export function listHookFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

export function buildManifest(dir: string): HooksManifest {
  const files: Record<string, string> = {};
  for (const name of listHookFiles(dir)) {
    files[name] = hashFile(path.join(dir, name));
  }
  return {
    version: '1',
    generated_at: new Date().toISOString(),
    hooks_dir: dir,
    files,
  };
}

export interface VerifyResult {
  ok: boolean;
  missing: string[]; // manifest 에 있으나 디스크엔 없음
  extra: string[]; // 디스크엔 있으나 manifest 에 없음
  mismatched: string[]; // 해시 불일치
}

export function verifyManifest(dir: string, manifest: HooksManifest): VerifyResult {
  const onDisk = new Set(listHookFiles(dir));
  const inManifest = new Set(Object.keys(manifest.files));
  const missing: string[] = [];
  const extra: string[] = [];
  const mismatched: string[] = [];

  for (const name of inManifest) {
    if (!onDisk.has(name)) {
      missing.push(name);
      continue;
    }
    const actual = hashFile(path.join(dir, name));
    if (actual !== manifest.files[name]) {
      mismatched.push(name);
    }
  }
  for (const name of onDisk) {
    if (!inManifest.has(name)) extra.push(name);
  }

  return {
    ok: missing.length === 0 && mismatched.length === 0 && extra.length === 0,
    missing,
    extra,
    mismatched,
  };
}

export function registerHooksCommand(program: Command): void {
  const hooks = program.command('hooks').description('공통 훅 (~/.semo/shared/hooks) SHA256 검증');

  hooks
    .command('manifest')
    .description('현재 hooks 디렉터리 해싱하여 manifest.json 생성')
    .option('--dir <path>', 'hooks 디렉터리 경로', defaultHooksDir())
    .option('-o, --output <path>', '출력 manifest 파일', defaultManifestPath())
    .action((opts: { dir: string; output: string }) => {
      if (!fs.existsSync(opts.dir)) {
        console.error(chalk.red(`✗ hooks 디렉터리 없음: ${opts.dir}`));
        process.exit(1);
      }
      const m = buildManifest(opts.dir);
      fs.mkdirSync(path.dirname(opts.output), { recursive: true });
      fs.writeFileSync(opts.output, JSON.stringify(m, null, 2));
      console.log(chalk.green(`✓ manifest 생성: ${opts.output}`));
      console.log(chalk.gray(`  ${Object.keys(m.files).length}개 훅 파일 해싱됨`));
    });

  hooks
    .command('verify')
    .description('manifest.json 과 실제 hooks 파일 SHA256 대조')
    .option('--dir <path>', 'hooks 디렉터리', defaultHooksDir())
    .option('--manifest <path>', 'manifest 경로', defaultManifestPath())
    .option('--strict', 'extra (unknown) 파일도 에러로 취급')
    .action((opts: { dir: string; manifest: string; strict?: boolean }) => {
      if (!fs.existsSync(opts.manifest)) {
        console.error(chalk.red(`✗ manifest 없음: ${opts.manifest}`));
        console.error(chalk.gray('  먼저 `semo hooks manifest` 로 생성하세요.'));
        process.exit(2);
      }
      const manifest = JSON.parse(fs.readFileSync(opts.manifest, 'utf8')) as HooksManifest;
      const res = verifyManifest(opts.dir, manifest);

      if (res.missing.length > 0) {
        console.log(chalk.red(`✗ 누락 (${res.missing.length}):`));
        for (const f of res.missing) console.log(`    - ${f}`);
      }
      if (res.mismatched.length > 0) {
        console.log(chalk.red(`✗ SHA256 불일치 (${res.mismatched.length}):`));
        for (const f of res.mismatched) console.log(`    ! ${f}`);
      }
      if (res.extra.length > 0) {
        const color = opts.strict ? chalk.red : chalk.yellow;
        console.log(
          color(`${opts.strict ? '✗' : '⚠'} manifest 에 없는 파일 (${res.extra.length}):`),
        );
        for (const f of res.extra) console.log(`    + ${f}`);
      }

      const hardFail =
        res.missing.length > 0 ||
        res.mismatched.length > 0 ||
        (opts.strict && res.extra.length > 0);

      if (hardFail) {
        console.log(chalk.red(`\n검증 실패 — 훅 신뢰성 손상 감지`));
        process.exit(1);
      }
      console.log(chalk.green(`✓ 모든 훅 SHA256 일치 (${Object.keys(manifest.files).length}개)`));
    });
}

/**
 * semo update — SEMO CLI + kernel 최신화
 *
 * 역할:
 *   1. `--check` :   설치된 CLI 버전과 npm 최신 버전 비교. 차이가 있으면 exit 1.
 *   2. `--status`:   현재 kernel/tenant/merged 레이아웃 상태 출력.
 *   3. 기본       :  레이아웃 확보 → tenant overlay 적용 → 결과 요약.
 *
 * 주의:
 *   실제 `npm i -g` 은 호출하지 않는다. 사용자가 직접 실행해야 하는 설치 명령을
 *   안내만 한다 — 자동 업그레이드는 호스트 환경을 변형시키므로 수동 확인 원칙.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ensureSemoLayout, semoHome, kernelDir, tenantDir, mergedClaudeDir } from '../paths.js';
import {
  defaultHooksDir,
  defaultManifestPath,
  verifyManifest,
  type HooksManifest,
} from './hooks-verify.js';

interface KernelSkillEntry {
  readonly id: string;
  readonly summary: string;
  readonly skillMd: string;
}

async function loadBuiltinKernelSkills(): Promise<readonly KernelSkillEntry[]> {
  try {
    const mod = (await import('@team-semicolon/semo-common')) as {
      BUILTIN_KERNEL_SKILLS?: readonly KernelSkillEntry[];
    };
    return mod.BUILTIN_KERNEL_SKILLS ?? [];
  } catch {
    return [];
  }
}

interface MaterializeResult {
  written: string[];
  unchanged: string[];
}

export function materializeKernelSkills(
  skills: readonly KernelSkillEntry[],
  targetRoot: string = path.join(kernelDir(), 'skills'),
): MaterializeResult {
  const written: string[] = [];
  const unchanged: string[] = [];
  fs.mkdirSync(targetRoot, { recursive: true });
  for (const skill of skills) {
    const dir = path.join(targetRoot, skill.id);
    const file = path.join(dir, 'SKILL.md');
    fs.mkdirSync(dir, { recursive: true });
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (existing === skill.skillMd) {
      unchanged.push(skill.id);
      continue;
    }
    fs.writeFileSync(file, skill.skillMd);
    written.push(skill.id);
  }
  return { written, unchanged };
}

const PACKAGE_NAME = '@team-semicolon/semo-cli';

interface VersionInfo {
  installed: string;
  latest?: string;
  updateAvailable: boolean;
  fetchError?: string;
}

function readInstalledVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function fetchLatestVersion(): { version?: string; error?: string } {
  try {
    const out = execSync(`npm view ${PACKAGE_NAME} version`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15_000,
    }).trim();
    return { version: out };
  } catch (err) {
    return { error: (err as Error).message.split('\n')[0] };
  }
}

function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const [am, an, ap] = parse(a);
  const [bm, bn, bp] = parse(b);
  if (am !== bm) return am - bm;
  if (an !== bn) return an - bn;
  return ap - bp;
}

export function getVersionInfo(): VersionInfo {
  const installed = readInstalledVersion();
  const { version: latest, error } = fetchLatestVersion();
  return {
    installed,
    latest,
    updateAvailable: latest ? compareSemver(latest, installed) > 0 : false,
    fetchError: error,
  };
}

function printStatus(): void {
  const info = getVersionInfo();
  console.log(chalk.bold('SEMO 상태'));
  console.log(`  CLI 설치   : ${chalk.cyan(info.installed)}`);
  if (info.latest) {
    const marker = info.updateAvailable ? chalk.yellow('업데이트 가능') : chalk.green('최신');
    console.log(`  npm latest : ${chalk.cyan(info.latest)}  ${marker}`);
  } else {
    console.log(`  npm latest : ${chalk.gray('조회 실패 — ' + (info.fetchError || '네트워크?'))}`);
  }
  console.log();
  console.log(chalk.bold('레이아웃 (3-layer)'));
  console.log(`  SEMO_HOME  : ${semoHome()}`);
  console.log(`  kernel/    : ${kernelDir()}  ${exists(kernelDir())}`);
  console.log(`  tenant/    : ${tenantDir()}  ${exists(tenantDir())}`);
  console.log(`  merged/    : ${mergedClaudeDir()}  ${exists(mergedClaudeDir())}`);
}

function exists(p: string): string {
  return fs.existsSync(p) ? chalk.green('✓') : chalk.red('✗ (없음)');
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('SEMO kernel 레이아웃 확보 + tenant overlay 재적용. --check 로 버전만 비교.')
    .option('--check', '설치 버전과 npm latest 비교만 수행 (exit 1 if outdated)')
    .option('--status', '현재 레이아웃/버전 상태 출력')
    .action(async (opts: { check?: boolean; status?: boolean }) => {
      if (opts.status) {
        printStatus();
        return;
      }

      if (opts.check) {
        const info = getVersionInfo();
        if (info.fetchError) {
          console.error(chalk.red(`✗ npm 조회 실패: ${info.fetchError}`));
          process.exit(2);
        }
        if (info.updateAvailable) {
          console.log(
            chalk.yellow(
              `⚠ 업데이트 가능: ${info.installed} → ${info.latest}\n  실행: npm i -g ${PACKAGE_NAME}@latest`,
            ),
          );
          process.exit(1);
        }
        console.log(chalk.green(`✓ 최신 상태 (${info.installed})`));
        return;
      }

      const { created } = ensureSemoLayout();
      if (created.length > 0) {
        console.log(chalk.cyan(`레이아웃 생성: ${created.length}개 디렉터리`));
        for (const d of created) console.log(`  + ${d}`);
      } else {
        console.log(chalk.gray('레이아웃 이미 존재'));
      }

      const builtinSkills = await loadBuiltinKernelSkills();
      if (builtinSkills.length > 0) {
        const res = materializeKernelSkills(builtinSkills);
        if (res.written.length > 0) {
          console.log(
            chalk.cyan(
              `kernel skills 적용: ${res.written.length}개 갱신` +
                (res.unchanged.length > 0 ? `, ${res.unchanged.length}개 변경 없음` : ''),
            ),
          );
          for (const id of res.written) console.log(`  + ${id}`);
        } else {
          console.log(chalk.gray(`kernel skills: ${res.unchanged.length}개 변경 없음`));
        }
      }

      const manifestPath = defaultManifestPath();
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as HooksManifest;
          const res = verifyManifest(defaultHooksDir(), manifest);
          if (!res.ok) {
            console.error(chalk.red('\n✗ 훅 SHA256 검증 실패 — 공급망 변조 의심'));
            if (res.missing.length) console.error(chalk.red(`  누락: ${res.missing.join(', ')}`));
            if (res.mismatched.length)
              console.error(chalk.red(`  불일치: ${res.mismatched.join(', ')}`));
            if (res.extra.length)
              console.error(chalk.yellow(`  추가됨(경고): ${res.extra.join(', ')}`));
            console.error(chalk.gray('  `semo hooks verify` 로 상세 확인 후 재설치하세요.'));
            process.exit(3);
          }
          console.log(chalk.green(`✓ 훅 SHA256 검증 OK (${Object.keys(manifest.files).length}개)`));
        } catch (err) {
          console.error(chalk.red(`✗ 훅 manifest 파싱 실패: ${(err as Error).message}`));
          process.exit(3);
        }
      } else {
        console.log(chalk.gray('훅 manifest 없음 — 검증 건너뜀'));
      }

      const info = getVersionInfo();
      console.log();
      console.log(
        `현재 CLI: ${chalk.cyan(info.installed)}` +
          (info.latest
            ? `   npm latest: ${info.updateAvailable ? chalk.yellow(info.latest) : chalk.green(info.latest)}`
            : ''),
      );

      if (info.updateAvailable) {
        console.log(
          chalk.yellow(
            `\n→ 새 버전이 있습니다. 직접 설치하세요:\n  npm i -g ${PACKAGE_NAME}@latest\n`,
          ),
        );
      }

      console.log(
        chalk.gray('\n실제 skills/commands/agents 동기화는 `semo context sync` 에서 수행합니다.'),
      );
    });
}

export const __testables = { compareSemver, readInstalledVersion, materializeKernelSkills };

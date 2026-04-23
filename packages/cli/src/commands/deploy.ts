/**
 * semo deploy — Personal 프로파일 원샷 셋업 플레이북.
 *
 *   semo deploy local [--profile personal-discord] [--yes] [--dry-run]
 *     init → migrate-sqlite → seats add → doctor 를 순차 실행.
 *     컨설턴트가 고객 Mac 에 SEMO 를 얹을 때 또는 tester 가 새 환경에서 전체 파이프라인을
 *     한 번에 돌릴 때 사용.
 *
 *   semo deploy --remote user@host
 *     SSH 기반 원격 설치 — P5.1 MVP 는 instruction print 만. 실제 ssh 동작은 후속 PR.
 *
 * 설계 원칙:
 *   - 각 단계는 이미 존재하는 semo 서브커맨드의 self-invocation 이다.
 *     새 로직을 여기 추가하지 않고, 여러 커맨드를 "올바른 순서" 로 묶는 것이 목적.
 *   - 실패 시 다음 단계로 넘어가지 않고 즉시 종료 (fail-fast).
 *   - --dry-run 은 명령어만 출력. 실제 프로세스 spawn 없음.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { spawnSync } from 'child_process';
import * as path from 'path';

type ProfileName = 'personal-discord' | 'personal-offline' | 'team' | 'solo-connected' | 'custom';

interface PlaybookStep {
  label: string;
  argv: string[];
  optional?: boolean; // true 면 실패해도 계속 진행
}

function selfCliEntry(): string {
  // dist/commands/deploy.js 에서 실행될 때 dist/index.js 를 가리킴.
  // tsx 로 src 를 직접 실행 중일 때는 src/index.ts.
  // 어느 쪽이든 __filename 기준 상대경로 2단계 올라감.
  const here = __filename;
  const base = path.dirname(path.dirname(here));
  return path.join(base, 'index.' + (here.endsWith('.js') ? 'js' : 'ts'));
}

function buildPersonalPlaybook(
  profile: ProfileName,
  opts: { seats: number; skipDoctor: boolean; force: boolean },
): PlaybookStep[] {
  const steps: PlaybookStep[] = [
    {
      label: `config.toml 초기화 (profile=${profile})`,
      argv: ['init', '--profile', profile, ...(opts.force ? ['--force'] : [])],
    },
    {
      label: 'SQLite 마이그레이션 (kb + ops)',
      argv: ['migrate-sqlite'],
    },
    {
      label: `bot seat pool (${opts.seats}개)`,
      argv: ['seats', 'add', '--count', String(opts.seats)],
    },
  ];
  if (!opts.skipDoctor) {
    steps.push({
      label: '프리플라이트 진단',
      argv: ['doctor'],
      optional: true, // Ollama/Discord 토큰 없는 상태에서도 배포 자체는 성공 취급
    });
  }
  return steps;
}

function runStep(step: PlaybookStep, cliEntry: string): { code: number } {
  // PATH 의존 제거: `npx`/`node` 찾기 대신 현재 프로세스의 node 절대경로(process.execPath)를 그대로 사용.
  // 이렇게 해야 nvm/volta/fnm 환경에서 예상치 못한 다른 버전으로 spawn 되지 않음.
  // dev (.ts) 는 `node --import tsx` (Node ≥20.6 자체 기능 + node_modules/tsx 자동 탐색).
  const isTs = cliEntry.endsWith('.ts');
  const args = isTs ? ['--import', 'tsx', cliEntry, ...step.argv] : [cliEntry, ...step.argv];
  const res = spawnSync(process.execPath, args, { stdio: 'inherit' });
  return { code: res.status ?? 1 };
}

function printDryRun(steps: PlaybookStep[]): void {
  console.log(chalk.bold.cyan('\n[dry-run] 실행될 단계:\n'));
  steps.forEach((s, i) => {
    const optTag = s.optional ? chalk.gray(' (실패해도 계속)') : '';
    console.log(`  ${i + 1}. ${chalk.bold(s.label)}${optTag}`);
    console.log(`     ${chalk.gray('semo ' + s.argv.join(' '))}`);
  });
  console.log();
}

export function registerDeployCommand(program: Command): void {
  const cmd = program
    .command('deploy')
    .description('Personal 프로파일 원샷 셋업 플레이북 (install/re-install)');

  cmd
    .command('local', { isDefault: true })
    .description('현재 Mac/Linux 에 personal 프로파일 전체 셋업 (init → migrate → seats → doctor)')
    .option('-p, --profile <name>', 'personal-discord | personal-offline', 'personal-discord')
    .option('-s, --seats <n>', '초기 bot seat 개수', '2')
    .option('--skip-doctor', '마지막 doctor 단계 스킵')
    .option('--force', '기존 config.toml 덮어쓰기 (init --force)')
    .option('-y, --yes', '확인 프롬프트 자동 승인')
    .option('--dry-run', '명령어만 출력, 실제 실행 없음')
    .action(
      async (opts: {
        profile?: string;
        seats?: string;
        skipDoctor?: boolean;
        force?: boolean;
        yes?: boolean;
        dryRun?: boolean;
      }) => {
        const profile = (opts.profile ?? 'personal-discord') as ProfileName;
        if (profile !== 'personal-discord' && profile !== 'personal-offline') {
          console.error(
            chalk.red(
              `✗ --profile 은 personal-discord 또는 personal-offline 만 허용 (받음: ${profile})`,
            ),
          );
          process.exit(2);
        }
        const seats = parseInt(opts.seats ?? '2', 10);
        if (!Number.isFinite(seats) || seats < 1) {
          console.error(chalk.red(`✗ --seats 는 1 이상의 정수 (받음: ${opts.seats})`));
          process.exit(2);
        }

        const steps = buildPersonalPlaybook(profile, {
          seats,
          skipDoctor: opts.skipDoctor ?? false,
          force: opts.force ?? false,
        });

        if (opts.dryRun) {
          printDryRun(steps);
          return;
        }

        console.log(
          chalk.cyan.bold(`\n▶ semo deploy local (profile=${profile}, seats=${seats})\n`),
        );
        if (!opts.yes) {
          console.log(
            chalk.gray('  --yes 가 지정되지 않아도 단계마다 프롬프트 없이 순차 실행됩니다.'),
          );
          console.log(chalk.gray('  중단은 Ctrl+C.\n'));
        }

        const cliEntry = selfCliEntry();
        let stepIdx = 0;
        for (const step of steps) {
          stepIdx += 1;
          console.log(chalk.bold(`\n[${stepIdx}/${steps.length}] ${step.label}`));
          console.log(chalk.gray(`    → semo ${step.argv.join(' ')}`));
          const { code } = runStep(step, cliEntry);
          if (code !== 0) {
            if (step.optional) {
              console.log(chalk.yellow(`    ⚠ exit=${code} — optional 단계이므로 계속 진행`));
            } else {
              console.error(chalk.red(`\n✗ 단계 실패 (exit=${code}): ${step.label}`));
              process.exit(code);
            }
          }
        }

        console.log(chalk.green.bold('\n✓ deploy 완료'));
        console.log(
          chalk.gray(
            '\n다음 단계:\n' +
              '  • Ollama 모델 설치: brew install ollama && ollama pull qwen2.5-coder:14b\n' +
              '  • Discord 봇 토큰: export DISCORD_TOKEN=... 후 semo router start\n' +
              '  • 대화형 온보딩: semo onboard\n',
          ),
        );
      },
    );

  cmd
    .command('remote <host>')
    .description('[WIP] SSH 기반 원격 설치 — 현재는 수동 실행 가이드만 출력 (실 SSH 실행 미구현)')
    .action((host: string) => {
      console.log(chalk.yellow.bold('\n⚠ semo deploy remote 는 아직 실험 단계입니다.\n'));
      console.log('현재는 아래 수동 절차를 권장합니다:\n');
      console.log(chalk.cyan(`  ssh ${host} 'bash -lc "npm i -g @team-semicolon/semo-cli"'`));
      console.log(chalk.cyan(`  ssh ${host} 'bash -lc "semo deploy local --yes"'`));
      console.log(chalk.cyan(`  ssh ${host} 'bash -lc "semo doctor"'`));
      console.log();
      console.log(
        chalk.gray('후속 PR: ssh2/child_process 래핑 + 신뢰할 수 있는 호스트 키 확인 자동화.'),
      );
    });

  return undefined;
}

export const __testables = { buildPersonalPlaybook };

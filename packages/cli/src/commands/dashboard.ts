/**
 * semo dashboard — Personal 대시보드 로컬 실행 엔트리.
 *
 *   semo dashboard --local                 # default: dev 모드, HMR, localhost:3939
 *   semo dashboard --local --mode prod     # next build + next start (prod 런타임)
 *   semo dashboard --local --port 4000     # 포트 커스터마이징
 *   semo dashboard --local --no-open       # 브라우저 자동 오픈 스킵
 *   semo dashboard --local --rebuild       # prod 모드일 때 .next 캐시 무시하고 재빌드
 *
 * 설계 원칙 (PR-C 플랜):
 *   - 레포 checkout 전제. npm 글로벌 설치 지원은 별도 PR 로 분리.
 *   - packages/semo-dashboard-personal 워크스페이스를 탐지해서 next 를 spawn.
 *   - SIGINT/SIGTERM 을 child 에 forward → 좀비 프로세스 방지.
 *   - SEMO_HOME 을 spawn env 에 명시 — shell 상속 가정 없이 재현 가능.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const PERSONAL_PKG_DIR = 'packages/semo-dashboard-personal';
const DEFAULT_PORT = 3939;

function findWorkspaceRoot(startDir: string): string | null {
  let dir = startDir;
  // 최대 10단계 상향 — npm workspace 는 보통 2~3단계
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { workspaces?: string[] };
        if (pkg.workspaces && Array.isArray(pkg.workspaces)) {
          return dir;
        }
      } catch {
        // 파싱 실패 — 다음 상위로
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function personalPkgPath(repoRoot: string): string {
  return path.join(repoRoot, PERSONAL_PKG_DIR);
}

function hasProdBuild(pkgDir: string): boolean {
  return fs.existsSync(path.join(pkgDir, '.next', 'BUILD_ID'));
}

function openBrowserCmd(url: string): { cmd: string; args: string[] } | null {
  if (process.platform === 'darwin') return { cmd: 'open', args: [url] };
  if (process.platform === 'win32') return { cmd: 'cmd', args: ['/c', 'start', '', url] };
  if (process.platform === 'linux') return { cmd: 'xdg-open', args: [url] };
  return null;
}

function openBrowser(url: string): void {
  const spec = openBrowserCmd(url);
  if (!spec) return;
  try {
    const child = spawn(spec.cmd, spec.args, { stdio: 'ignore', detached: true });
    child.unref();
  } catch {
    // 무시 — CLI 로그에 URL 찍어두면 수동 오픈 가능
  }
}

async function waitThenOpen(url: string): Promise<void> {
  // next dev 의 첫 컴파일이 M1 기준 4~8초 걸릴 수 있어 여유있게 5초 대기.
  // stdout 을 pipe 해서 "ready" 문자열 감지하는 방식이 이상적이나
  // stdio:'inherit' 의 사용자 로그 경험을 유지하기 위해 고정 지연 채택.
  await new Promise((resolve) => setTimeout(resolve, 5000));
  openBrowser(url);
}

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Personal 대시보드 로컬 실행 (Next.js on semo-dashboard-personal)')
    .option('--local', 'local 모드로 기동 (현재 유일한 모드 — 향후 remote 확장 예정)')
    .option('-p, --port <n>', '포트', String(DEFAULT_PORT))
    .option('-m, --mode <mode>', 'dev | prod', 'dev')
    .option('--no-open', '브라우저 자동 오픈 스킵')
    .option('--rebuild', 'prod 모드일 때 .next 캐시 무시하고 재빌드')
    .action(
      async (opts: {
        local?: boolean;
        port?: string;
        mode?: string;
        open?: boolean;
        rebuild?: boolean;
      }) => {
        if (!opts.local) {
          console.error(chalk.red('✗ --local 플래그 필수 (향후 remote 모드 확장 예정)'));
          process.exit(2);
        }
        const mode = (opts.mode ?? 'dev').toLowerCase();
        if (mode !== 'dev' && mode !== 'prod') {
          console.error(chalk.red(`✗ --mode 는 dev 또는 prod 만 허용 (받음: ${mode})`));
          process.exit(2);
        }
        const port = parseInt(opts.port ?? String(DEFAULT_PORT), 10);
        if (!Number.isFinite(port) || port < 1 || port > 65535) {
          console.error(chalk.red(`✗ --port 는 1~65535 범위의 정수 (받음: ${opts.port})`));
          process.exit(2);
        }

        const repoRoot = findWorkspaceRoot(__dirname) ?? findWorkspaceRoot(process.cwd());
        if (!repoRoot) {
          console.error(
            chalk.red(
              '✗ semo 워크스페이스 루트를 찾지 못했습니다. 레포 checkout 내부에서 실행해주세요.',
            ),
          );
          process.exit(1);
        }

        const pkgDir = personalPkgPath(repoRoot);
        if (!fs.existsSync(pkgDir)) {
          console.error(chalk.red(`✗ ${PERSONAL_PKG_DIR} 디렉토리가 없습니다: ${pkgDir}`));
          process.exit(1);
        }
        const nextBin = path.join(pkgDir, 'node_modules', '.bin', 'next');
        const rootNextBin = path.join(repoRoot, 'node_modules', '.bin', 'next');
        if (!fs.existsSync(nextBin) && !fs.existsSync(rootNextBin)) {
          console.error(
            chalk.red(`✗ next 바이너리 없음. ${repoRoot} 에서 npm install 을 먼저 실행하세요.`),
          );
          process.exit(1);
        }

        const semoHome = process.env.SEMO_HOME ?? path.join(os.homedir(), '.semo');
        if (!fs.existsSync(semoHome)) {
          console.log(chalk.yellow(`! SEMO_HOME(${semoHome}) 이 없습니다. 자동 생성.`));
          fs.mkdirSync(semoHome, { recursive: true });
        }

        const url = `http://localhost:${port}`;
        console.log(chalk.cyan.bold(`\n▶ semo dashboard --local (mode=${mode}, port=${port})`));
        console.log(chalk.gray(`  repo root: ${repoRoot}`));
        console.log(chalk.gray(`  SEMO_HOME: ${semoHome}`));
        console.log(chalk.gray(`  URL:       ${url}\n`));

        // prod 모드 & 빌드 없음 or --rebuild → next build 선행
        if (mode === 'prod' && (opts.rebuild || !hasProdBuild(pkgDir))) {
          console.log(chalk.cyan('▶ next build (prod 빌드 생성 중)...\n'));
          const buildExit = await new Promise<number>((resolve) => {
            const child = spawn('npx', ['next', 'build'], {
              cwd: pkgDir,
              stdio: 'inherit',
              env: { ...process.env, SEMO_HOME: semoHome },
            });
            child.on('exit', (code) => resolve(code ?? 1));
          });
          if (buildExit !== 0) {
            console.error(chalk.red(`✗ next build 실패 (exit=${buildExit})`));
            process.exit(buildExit);
          }
        }

        const nextArgs =
          mode === 'dev'
            ? ['next', 'dev', '--port', String(port)]
            : ['next', 'start', '--port', String(port)];

        const child = spawn('npx', nextArgs, {
          cwd: pkgDir,
          stdio: 'inherit',
          // 포트는 --port CLI 인자로만 전달. PORT env 중복은 의도 불명확 → 제거.
          env: { ...process.env, SEMO_HOME: semoHome },
        });

        const forward = (sig: NodeJS.Signals) => {
          if (!child.killed) child.kill(sig);
        };
        process.once('SIGINT', () => forward('SIGINT'));
        process.once('SIGTERM', () => forward('SIGTERM'));

        child.on('error', (err) => {
          console.error(chalk.red(`✗ next ${mode} spawn 실패: ${err.message}`));
          process.exit(1);
        });
        child.on('exit', (code, signal) => {
          if (signal) {
            process.exit(0);
          }
          process.exit(code ?? 0);
        });

        if (opts.open !== false) {
          void waitThenOpen(url);
        }
      },
    );
}

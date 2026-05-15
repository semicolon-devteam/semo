import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileP = promisify(execFile);

type ManagedService = 'slack-router' | 'inbox-pump' | 'agent-mailbox';
const SERVICES: ManagedService[] = ['slack-router', 'inbox-pump', 'agent-mailbox'];

const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents');
const LOG_DIR = path.join(os.homedir(), '.semo', 'logs');
const DEFAULT_PATH = '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin';

interface ServiceOptions {
  repo?: string;
  mailboxDir?: string;
  sessionDir?: string;
  surfaceMap?: string;
  workspace?: string;
  bot?: string;
  intervalMs?: string;
  dryRun?: boolean;
}

interface ServiceSpec {
  service: ManagedService;
  label: string;
  plistPath: string;
  command: string;
  logPath: string;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function launchctlDomain(): string {
  return `gui/${process.getuid?.() ?? os.userInfo().uid}`;
}

function defaultRepoPath(): string {
  const env = process.env.SEMO_REPO_PATH;
  if (env) return env;
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'packages', 'cli', 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function semoCommand(repoPath: string): string {
  const bundle = path.join(repoPath, 'packages', 'cli', 'dist', 'bundle.js');
  if (fs.existsSync(bundle)) return `node ${shellQuote(bundle)}`;
  return 'semo';
}

function envPrelude(repoPath: string): string {
  const envPath = path.join(os.homedir(), '.claude', 'semo', '.env');
  return [
    `cd ${shellQuote(repoPath)}`,
    'set -a',
    `([ ! -f ${shellQuote(envPath)} ] || source ${shellQuote(envPath)})`,
    'set +a',
  ].join(' && ');
}

function buildSpec(service: ManagedService, opts: ServiceOptions): ServiceSpec {
  const repoPath = path.resolve(opts.repo ?? defaultRepoPath());
  const mailboxDir = opts.mailboxDir ?? path.join(os.homedir(), '.semo', 'mailbox');
  const sessionDir = opts.sessionDir ?? path.join(os.homedir(), '.semo', 'sessions');
  const surfaceMap = opts.surfaceMap ?? '/tmp/semo-surface-map.json';
  const workspace = opts.workspace ?? 'semo-agents';
  const bot = opts.bot ?? process.env.SEMO_BOT_ID ?? 'semiclaw';
  const intervalMs = opts.intervalMs ?? '3000';

  const label = `com.semicolon.semo-${service}`;
  const plistPath = path.join(LAUNCH_AGENTS_DIR, `${label}.plist`);
  const logPath = path.join(LOG_DIR, `${service}.log`);
  const prelude = envPrelude(repoPath);

  let command: string;
  if (service === 'slack-router') {
    command = [
      prelude,
      `export SEMO_MAILBOX_DIR=${shellQuote(mailboxDir)}`,
      `export SEMO_SESSION_DIR=${shellQuote(sessionDir)}`,
      `export SEMO_SURFACE_MAP=${shellQuote(surfaceMap)}`,
      'npx tsx packages/slack-router/src/index.ts',
    ].join(' && ');
  } else if (service === 'inbox-pump') {
    command = [
      prelude,
      `export SEMO_MAILBOX_DIR=${shellQuote(mailboxDir)}`,
      `export SEMO_SURFACE_MAP=${shellQuote(surfaceMap)}`,
      `export SEMO_WORKSPACE=${shellQuote(workspace)}`,
      `${semoCommand(repoPath)} bots inbox-pump --interval-ms ${shellQuote(intervalMs)}`,
    ].join(' && ');
  } else {
    command = [
      prelude,
      `export SEMO_BOT_ID=${shellQuote(bot)}`,
      `export SEMO_MAILBOX_DIR=${shellQuote(mailboxDir)}`,
      'npx tsx packages/agent-mailbox/src/index.ts',
    ].join(' && ');
  }

  return { service, label, plistPath, command, logPath };
}

function renderPlist(spec: ServiceSpec): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(spec.label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>${xmlEscape(spec.command)}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${xmlEscape(os.homedir())}</string>
    <key>PATH</key>
    <string>${DEFAULT_PATH}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
    <key>Crashed</key>
    <true/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${xmlEscape(spec.logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(spec.logPath)}</string>
</dict>
</plist>
`;
}

function pickServices(service?: string): ManagedService[] {
  if (!service || service === 'all') return SERVICES;
  if (!SERVICES.includes(service as ManagedService)) {
    throw new Error(`service 는 ${SERVICES.join(', ')} 또는 all 만 허용 (받음: ${service})`);
  }
  return [service as ManagedService];
}

async function bootout(spec: ServiceSpec): Promise<void> {
  try {
    await execFileP('launchctl', ['bootout', launchctlDomain(), spec.plistPath], { timeout: 5000 });
  } catch {
    try {
      await execFileP('launchctl', ['unload', spec.plistPath], { timeout: 5000 });
    } catch {
      // already unloaded or never loaded
    }
  }
}

async function bootstrap(spec: ServiceSpec): Promise<void> {
  try {
    await execFileP('launchctl', ['bootstrap', launchctlDomain(), spec.plistPath], {
      timeout: 5000,
    });
  } catch {
    await execFileP('launchctl', ['load', spec.plistPath], { timeout: 5000 });
  }
}

async function kickstart(spec: ServiceSpec): Promise<void> {
  try {
    await execFileP('launchctl', ['kickstart', '-k', `${launchctlDomain()}/${spec.label}`], {
      timeout: 5000,
    });
  } catch {
    await bootstrap(spec);
  }
}

export function registerBotsServiceCommand(parent: Command): void {
  const cmd = parent
    .command('service')
    .description('SEMO 봇 운영 서비스 launchctl 관리 (slack-router/inbox-pump/agent-mailbox)');

  const addCommonOptions = (c: Command): Command =>
    c
      .argument('[service]', `${SERVICES.join(' | ')} | all`, 'all')
      .option('--repo <path>', 'SEMO repo path', defaultRepoPath())
      .option('--mailbox-dir <dir>', 'SEMO_MAILBOX_DIR', path.join(os.homedir(), '.semo', 'mailbox'))
      .option('--session-dir <dir>', 'SEMO_SESSION_DIR', path.join(os.homedir(), '.semo', 'sessions'))
      .option('--surface-map <path>', 'SEMO_SURFACE_MAP', '/tmp/semo-surface-map.json')
      .option('--workspace <name>', 'SEMO_WORKSPACE for inbox-pump', 'semo-agents')
      .option('--bot <id>', 'SEMO_BOT_ID for agent-mailbox singleton service', 'semiclaw')
      .option('--interval-ms <n>', 'inbox-pump interval', '3000')
      .option('--dry-run', 'plist 출력만 하고 파일/launchctl 변경 안 함');

  addCommonOptions(cmd.command('install').description('launchd plist 생성 후 bootstrap'))
    .action(async (service: string, opts: ServiceOptions) => {
      fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
      fs.mkdirSync(LOG_DIR, { recursive: true });
      for (const svc of pickServices(service)) {
        const spec = buildSpec(svc, opts);
        const plist = renderPlist(spec);
        if (opts.dryRun) {
          console.log(chalk.cyan(`\n# ${spec.plistPath}`));
          console.log(plist);
          continue;
        }
        fs.writeFileSync(spec.plistPath, plist, 'utf8');
        await bootout(spec);
        await bootstrap(spec);
        console.log(chalk.green(`✓ installed ${spec.label}`));
        console.log(chalk.gray(`  plist: ${spec.plistPath}`));
        console.log(chalk.gray(`  log:   ${spec.logPath}`));
      }
    });

  addCommonOptions(cmd.command('uninstall').description('launchd bootout 후 plist 삭제'))
    .action(async (service: string, opts: ServiceOptions) => {
      for (const svc of pickServices(service)) {
        const spec = buildSpec(svc, opts);
        if (opts.dryRun) {
          console.log(chalk.cyan(`[dry-run] uninstall ${spec.label} (${spec.plistPath})`));
          continue;
        }
        await bootout(spec);
        if (fs.existsSync(spec.plistPath)) fs.unlinkSync(spec.plistPath);
        console.log(chalk.green(`✓ uninstalled ${spec.label}`));
      }
    });

  addCommonOptions(cmd.command('restart').description('launchd kickstart -k 로 서비스 재시작'))
    .action(async (service: string, opts: ServiceOptions) => {
      for (const svc of pickServices(service)) {
        const spec = buildSpec(svc, opts);
        if (opts.dryRun) {
          console.log(chalk.cyan(`[dry-run] restart ${spec.label}`));
          continue;
        }
        if (!fs.existsSync(spec.plistPath)) {
          console.error(chalk.red(`✗ plist 없음: ${spec.plistPath} — 먼저 install 실행`));
          process.exitCode = 1;
          continue;
        }
        await kickstart(spec);
        console.log(chalk.green(`✓ restarted ${spec.label}`));
      }
    });

  addCommonOptions(cmd.command('status').description('plist 존재 여부와 launchctl 상태 조회'))
    .action(async (service: string, opts: ServiceOptions) => {
      for (const svc of pickServices(service)) {
        const spec = buildSpec(svc, opts);
        const exists = fs.existsSync(spec.plistPath);
        let loaded = false;
        try {
          await execFileP('launchctl', ['print', `${launchctlDomain()}/${spec.label}`], {
            timeout: 5000,
          });
          loaded = true;
        } catch {
          loaded = false;
        }
        console.log(
          `${spec.service.padEnd(14)} plist=${exists ? chalk.green('yes') : chalk.gray('no')} loaded=${
            loaded ? chalk.green('yes') : chalk.gray('no')
          } ${chalk.gray(spec.plistPath)}`,
        );
      }
    });
}

export const __testables = {
  buildSpec,
  renderPlist,
  pickServices,
};

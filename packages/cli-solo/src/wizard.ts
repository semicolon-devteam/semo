/**
 * semo-solo init 위저드 — 순수 readline 기반. 외부 의존 없음.
 *
 * 프롬프트 흐름: profile → kb.driver → execution.target → model → network.mode → listen.
 * 모든 질문에 기본값이 있어 Enter 만으로 end-to-end 진행 가능.
 */
import { createInterface } from 'node:readline';
import chalk from 'chalk';

export type Profile = 'solo-offline' | 'solo-connected';
export type KbDriver = 'sqlite' | 'obsidian';
export type ExecTarget =
  | 'ollama'
  | 'mlx'
  | 'anthropic-api'
  | 'openai'
  | 'gemini'
  | 'claude-code'
  | 'mock';
export type NetworkMode = 'offline' | 'lan' | 'tailscale';

export interface WizardAnswers {
  profile: Profile;
  kbDriver: KbDriver;
  sqlitePath: string;
  obsidianVault?: string;
  execTarget: ExecTarget;
  model?: string;
  endpoint?: string;
  networkMode: NetworkMode;
  listen: string;
}

export interface WizardDefaults {
  profile?: Profile;
  kbDriver?: KbDriver;
  sqlitePath: string;
  execTarget?: ExecTarget;
  model?: string;
  networkMode?: NetworkMode;
  listen?: string;
}

const MODEL_DEFAULTS: Record<ExecTarget, string | undefined> = {
  ollama: 'qwen2.5-coder:14b',
  mlx: 'mlx-community/Qwen2.5-Coder-14B-Instruct-4bit',
  'anthropic-api': 'claude-opus-4-7',
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-pro',
  'claude-code': 'claude-opus-4-7',
  mock: undefined,
};

export async function runWizard(defaults: WizardDefaults): Promise<WizardAnswers> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const lineQueue: string[] = [];
  const waiters: Array<(line: string) => void> = [];
  let ended = false;
  rl.on('line', (line) => {
    if (waiters.length) waiters.shift()!(line);
    else lineQueue.push(line);
  });
  rl.on('close', () => {
    ended = true;
    while (waiters.length) waiters.shift()!('');
  });
  const ask = (q: string): Promise<string> => {
    process.stdout.write(q);
    if (lineQueue.length) return Promise.resolve(lineQueue.shift()!.trim());
    if (ended) return Promise.resolve('');
    return new Promise((resolve) => waiters.push((line) => resolve(line.trim())));
  };
  const choose = async <T extends string>(
    label: string,
    options: readonly T[],
    defaultValue: T,
  ): Promise<T> => {
    const lines = options
      .map((opt, i) => `  ${i + 1}. ${opt}${opt === defaultValue ? chalk.gray(' (기본)') : ''}`)
      .join('\n');
    const answer = await ask(`${chalk.bold(label)}\n${lines}\n> `);
    if (!answer) return defaultValue;
    const idx = parseInt(answer, 10);
    if (!Number.isNaN(idx) && idx >= 1 && idx <= options.length) return options[idx - 1];
    const byValue = options.find((o) => o === answer);
    if (byValue) return byValue;
    console.log(chalk.yellow(`  (인식 불가 — ${defaultValue} 사용)`));
    return defaultValue;
  };

  try {
    console.log(chalk.bold.cyan('\n=== SEMO Solo init wizard ===\n'));

    const profile = await choose<Profile>(
      '프로파일',
      ['solo-offline', 'solo-connected'] as const,
      defaults.profile ?? 'solo-offline',
    );

    const kbDriver = await choose<KbDriver>(
      'KB 저장소',
      ['sqlite', 'obsidian'] as const,
      defaults.kbDriver ?? 'sqlite',
    );

    let obsidianVault: string | undefined;
    if (kbDriver === 'obsidian') {
      obsidianVault = (await ask(`${chalk.bold('Vault 경로')} > `)) || '';
      if (!obsidianVault) {
        console.log(chalk.yellow('  (미입력 — sqlite 로 폴백)'));
        obsidianVault = undefined;
      }
    }
    const sqlitePath =
      (await ask(`${chalk.bold('SQLite DB 경로')} ${chalk.gray(`(${defaults.sqlitePath})`)} > `)) ||
      defaults.sqlitePath;

    const execTarget = await choose<ExecTarget>(
      '실행 엔진',
      ['ollama', 'mlx', 'anthropic-api', 'openai', 'gemini', 'claude-code', 'mock'] as const,
      defaults.execTarget ?? 'ollama',
    );

    const modelDefault = defaults.model ?? MODEL_DEFAULTS[execTarget] ?? '';
    const model = modelDefault
      ? (await ask(`${chalk.bold('모델 ID')} ${chalk.gray(`(${modelDefault})`)} > `)) ||
        modelDefault
      : undefined;

    let endpoint: string | undefined;
    if (execTarget === 'ollama' || execTarget === 'mlx') {
      const epDefault =
        execTarget === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:8080';
      const ep = await ask(`${chalk.bold('엔드포인트')} ${chalk.gray(`(${epDefault})`)} > `);
      endpoint = ep || epDefault;
    }

    const networkMode = await choose<NetworkMode>(
      '네트워크 모드',
      ['offline', 'lan', 'tailscale'] as const,
      defaults.networkMode ?? (profile === 'solo-offline' ? 'offline' : 'lan'),
    );

    const listenDefault =
      defaults.listen ?? (networkMode === 'offline' ? '127.0.0.1:3939' : '0.0.0.0:3939');
    const listen =
      (await ask(`${chalk.bold('listen 주소')} ${chalk.gray(`(${listenDefault})`)} > `)) ||
      listenDefault;

    return {
      profile,
      kbDriver: kbDriver === 'obsidian' && !obsidianVault ? 'sqlite' : kbDriver,
      sqlitePath,
      obsidianVault,
      execTarget,
      model,
      endpoint,
      networkMode,
      listen,
    };
  } finally {
    rl.close();
  }
}

export function renderConfigToml(a: WizardAnswers): string {
  const lines: string[] = [];
  lines.push(`profile = "${a.profile}"`);
  lines.push('');
  lines.push('[kb]');
  lines.push(`driver = "${a.kbDriver}"`);
  lines.push(`sqlite_path = "${a.sqlitePath.replace(/\\/g, '\\\\')}"`);
  if (a.kbDriver === 'obsidian' && a.obsidianVault) {
    lines.push(`obsidian_vault = "${a.obsidianVault.replace(/\\/g, '\\\\')}"`);
  }
  lines.push('');
  lines.push('[messaging]');
  lines.push('sources = ["stdin"]');
  lines.push('');
  lines.push('[execution]');
  lines.push(`target = "${a.execTarget}"`);
  if (a.model) lines.push(`model = "${a.model}"`);
  if (a.endpoint) lines.push(`endpoint = "${a.endpoint}"`);
  lines.push('');
  lines.push('[network]');
  lines.push(`mode = "${a.networkMode}"`);
  lines.push(`listen = "${a.listen}"`);
  lines.push('');
  return lines.join('\n');
}

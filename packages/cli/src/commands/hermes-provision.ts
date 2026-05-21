import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileP = promisify(execFile);

export interface HermesProvisionInput {
  botId: string;
  hostKind?: string | null;
  hermesHome?: string | null;
  hermesProfile?: string | null;
  hermesBaseProfile?: string | null;
  hermesSkills?: string | null;
  noHermesProvision?: boolean | null;
}

export interface HermesProvisionPlan {
  required: boolean;
  home: string | null;
  profile: string;
  baseProfile: string;
  skills: string[];
}

export interface HermesProvisionResult {
  skipped: boolean;
  profile: string;
  home: string | null;
  profileCreated: boolean;
  skillsSynced: string[];
  missingSkills: string[];
}

export interface HermesCommandRunner {
  (args: string[], env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }>;
}

export function parseCsvList(value?: string | null): string[] {
  return Array.from(
    new Set(
      (value ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

export function buildHermesProvisionPlan(input: HermesProvisionInput): HermesProvisionPlan {
  const hostKind = (input.hostKind ?? 'claude-code').trim().toLowerCase();
  const required =
    input.noHermesProvision === true
      ? false
      : hostKind === 'hermes-cli' || hostKind === 'hermes-desktop';
  const profile = input.hermesProfile?.trim() || `semo-${input.botId}`;
  const baseProfile =
    input.hermesBaseProfile?.trim() || process.env.SEMO_HERMES_BASE_PROFILE || 'semo-hermes-canary';
  return {
    required,
    home: input.hermesHome?.trim() || process.env.SEMO_HERMES_HOME || null,
    profile,
    baseProfile,
    skills: parseCsvList(input.hermesSkills),
  };
}

export function parseHermesSkillList(output: string): string[] {
  const names = new Set<string>();
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('│')) continue;
    const cols = trimmed
      .split('│')
      .map((s) => s.trim())
      .filter(Boolean);
    const name = cols[0];
    if (!name || name === 'Name' || /^[-─]+$/.test(name)) continue;
    names.add(name);
  }
  return Array.from(names);
}

function readSkillName(skillMd: string): string | null {
  const text = fs.readFileSync(skillMd, 'utf8');
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) return null;
  const name = frontmatter[1].match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m);
  return name?.[1]?.trim() ?? null;
}

export function findHermesSkillSource(skillName: string, homes?: string[]): string | null {
  const roots = homes ?? [path.join(os.homedir(), '.hermes')];
  for (const home of roots) {
    const skillsRoot = path.join(home, 'skills');
    if (!fs.existsSync(skillsRoot)) continue;
    const stack = [skillsRoot];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(p);
        if (entry.isFile() && entry.name === 'SKILL.md') {
          const parent = path.dirname(p);
          if (path.basename(parent) === skillName || readSkillName(p) === skillName) return parent;
        }
      }
    }
  }
  return null;
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

export function syncHermesSkillToDir(
  skillName: string,
  targetSkillsRoot: string,
  sourceHomes?: string[],
): boolean {
  const src = findHermesSkillSource(skillName, sourceHomes);
  if (!src) return false;
  const category = path.basename(path.dirname(src));
  const dest = path.join(targetSkillsRoot, category, path.basename(src));
  copyDir(src, dest);
  return true;
}

export function syncHermesSkillToHome(
  skillName: string,
  targetHome: string,
  sourceHomes?: string[],
): boolean {
  return syncHermesSkillToDir(skillName, path.join(targetHome, 'skills'), sourceHomes);
}

async function defaultHermesRunner(args: string[], env: NodeJS.ProcessEnv) {
  const { stdout, stderr } = await execFileP('hermes', args, { env, timeout: 30_000 });
  return { stdout, stderr };
}

function envForHermes(home: string | null): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (home) env.HERMES_HOME = home;
  return env;
}

export async function ensureHermesProvisioned(
  plan: HermesProvisionPlan,
  options: { runner?: HermesCommandRunner; sourceHomes?: string[] } = {},
): Promise<HermesProvisionResult> {
  if (!plan.required) {
    return {
      skipped: true,
      profile: plan.profile,
      home: plan.home,
      profileCreated: false,
      skillsSynced: [],
      missingSkills: [],
    };
  }

  const runner = options.runner ?? defaultHermesRunner;
  const env = envForHermes(plan.home);
  let profileCreated = false;
  try {
    await runner(['profile', 'show', plan.profile], env);
  } catch {
    await runner(
      [
        'profile',
        'create',
        plan.profile,
        '--clone-from',
        plan.baseProfile,
        '--no-alias',
        '--description',
        `SEMO Agent Factory worker profile for ${plan.profile}.`,
      ],
      env,
    );
    profileCreated = true;
  }

  const list = await runner(['skills', 'list'], env).catch(() => ({ stdout: '', stderr: '' }));
  const installed = new Set(parseHermesSkillList(`${list.stdout}\n${list.stderr}`));
  const skillsSynced: string[] = [];
  const missingSkills: string[] = [];
  const targetHome = plan.home ?? path.join(os.homedir(), '.hermes');
  const targetSkillRoots = [
    path.join(targetHome, 'skills'),
    path.join(targetHome, 'profiles', plan.profile, 'skills'),
  ];
  for (const skill of plan.skills) {
    const syncedTargets = targetSkillRoots.filter((root) =>
      syncHermesSkillToDir(skill, root, options.sourceHomes),
    );
    if (syncedTargets.length > 0) {
      skillsSynced.push(skill);
      installed.add(skill);
    } else if (installed.has(skill)) {
      continue;
    } else {
      missingSkills.push(skill);
    }
  }

  if (missingSkills.length > 0) {
    throw new Error(
      `Hermes skill not found for target profile ${plan.profile}: ${missingSkills.join(', ')}`,
    );
  }

  return {
    skipped: false,
    profile: plan.profile,
    home: plan.home,
    profileCreated,
    skillsSynced,
    missingSkills,
  };
}

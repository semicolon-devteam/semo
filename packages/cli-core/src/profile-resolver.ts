/**
 * Profile Resolver — Team vs Personal 프로파일 판별.
 *
 * 해석 순서:
 *   1) SEMO_PROFILE 환경변수 (team | personal)
 *   2) $SEMO_HOME/config.toml 의 [profile] 섹션 또는 top-level `profile` 키
 *   3) ~/.semo/config.toml 의 동일 키
 *   4) 현재 작업 디렉토리의 semo.config.toml / .semo/config.toml
 *   5) 기본값: 'team' (세미콜론 운영자 호환)
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';

export type Profile = 'team' | 'personal';

export interface ProfileResolution {
  profile: Profile;
  source: 'env:SEMO_PROFILE' | 'config:semo-home' | 'config:user-home' | 'config:cwd' | 'default';
  configPath?: string;
}

function isProfile(value: unknown): value is Profile {
  return value === 'team' || value === 'personal';
}

function readProfileFromConfig(configPath: string): Profile | null {
  if (!fs.existsSync(configPath)) return null;
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = parseToml(raw) as Record<string, unknown>;
    const topLevel = parsed.profile;
    if (isProfile(topLevel)) return topLevel;
    const section = parsed.profile;
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      const nameField = (section as Record<string, unknown>).name;
      if (isProfile(nameField)) return nameField;
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveProfile(cwd: string = process.cwd()): ProfileResolution {
  const envProfile = process.env.SEMO_PROFILE?.trim().toLowerCase();
  if (isProfile(envProfile)) {
    return { profile: envProfile, source: 'env:SEMO_PROFILE' };
  }

  const semoHome = process.env.SEMO_HOME;
  if (semoHome) {
    const configPath = path.join(semoHome, 'config.toml');
    const profile = readProfileFromConfig(configPath);
    if (profile) return { profile, source: 'config:semo-home', configPath };
  }

  if (process.env.SEMO_IGNORE_USER_HOME_CONFIG !== '1') {
    const userHomeConfig = path.join(os.homedir(), '.semo', 'config.toml');
    const userProfile = readProfileFromConfig(userHomeConfig);
    if (userProfile) {
      return { profile: userProfile, source: 'config:user-home', configPath: userHomeConfig };
    }
  }

  const cwdCandidates = [
    path.join(cwd, 'semo.config.toml'),
    path.join(cwd, '.semo', 'config.toml'),
  ];
  for (const candidate of cwdCandidates) {
    const profile = readProfileFromConfig(candidate);
    if (profile) return { profile, source: 'config:cwd', configPath: candidate };
  }

  return { profile: 'team', source: 'default' };
}

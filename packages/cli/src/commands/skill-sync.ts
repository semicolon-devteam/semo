/**
 * skill-sync — 봇 워크스페이스 스킬 스캔 + DB 동기화
 *
 * v3.0: ~/.semo/workspaces/{bot}/skills/ 경로 스캔 (resolveBotWorkspace fallback)
 * 봇 목록은 bot_status DB에서 동적 로드, fallback으로 로컬 디렉토리 스캔.
 *
 * semo bots sync (piggyback) 및 semo context sync (세션 훅) 양쪽에서 호출.
 * 스킬 이름은 flat (예: 'kb-manager'), metadata.bot_ids 배열로 봇 매핑.
 * 동일 스킬명이 여러 봇에 존재하면 bot_ids를 머지.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Pool, PoolClient } from 'pg';
import { resolveBotWorkspace, SEMO_WORKSPACES } from '../paths';

export interface ScannedSkill {
  name: string;
  prompt: string;
  package: string;
  botId: string;
  mtime: number;
  referenceFiles?: Record<string, string>;
}

export interface SkillSyncResult {
  botSpecific: number;
  total: number;
}

/**
 * ~/.semo/workspaces/{bot}/skills/ 에서 봇 전용 스킬 파일 스캔
 *
 * @param botIds - 스캔 대상 봇 ID 목록
 */
export function scanSkills(botIds: string[]): ScannedSkill[];
/**
 * @deprecated semo-system/ 기반 스캔 (하위호환 유지)
 */
export function scanSkills(semoSystemDir: string): ScannedSkill[];
export function scanSkills(arg: string | string[]): ScannedSkill[] {
  if (typeof arg === 'string') {
    return scanSkillsLegacy(arg);
  }
  return scanSkillsV2(arg);
}

function scanSkillsV2(botIds: string[]): ScannedSkill[] {
  const skills: ScannedSkill[] = [];

  for (const botId of botIds) {
    const skillsDir = path.join(resolveBotWorkspace(botId), 'skills');
    if (!fs.existsSync(skillsDir)) continue;

    let skillEntries: fs.Dirent[];
    try {
      skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const skillEntry of skillEntries) {
      if (!skillEntry.isDirectory()) continue;
      if (skillEntry.name.endsWith('.skill')) continue;
      if (skillEntry.name.startsWith('_') || skillEntry.name.startsWith('.')) continue;

      const skillMdPath = path.join(skillsDir, skillEntry.name, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;

      try {
        const stat = fs.statSync(skillMdPath);

        // Scan references/ subdirectory
        let referenceFiles: Record<string, string> | undefined;
        const refsDir = path.join(skillsDir, skillEntry.name, 'references');
        if (fs.existsSync(refsDir)) {
          try {
            const refs: Record<string, string> = {};
            for (const refFile of fs.readdirSync(refsDir)) {
              const refPath = path.join(refsDir, refFile);
              try {
                if (!fs.statSync(refPath).isFile()) continue;
                refs[refFile] = fs.readFileSync(refPath, 'utf-8');
              } catch {
                /* skip unreadable */
              }
            }
            if (Object.keys(refs).length > 0) referenceFiles = refs;
          } catch {
            /* skip unreadable refs dir */
          }
        }

        skills.push({
          name: skillEntry.name,
          prompt: fs.readFileSync(skillMdPath, 'utf-8'),
          package: 'openclaw',
          botId,
          mtime: stat.mtimeMs,
          referenceFiles,
        });
      } catch {
        /* skip unreadable */
      }
    }
  }

  return skills;
}

/** Legacy: semo-system/bot-workspaces 에서 스캔 (하위호환) */
function scanSkillsLegacy(semoSystemDir: string): ScannedSkill[] {
  const skills: ScannedSkill[] = [];

  const workspacesDir = path.join(semoSystemDir, 'bot-workspaces');
  if (!fs.existsSync(workspacesDir)) return skills;

  const botEntries = fs.readdirSync(workspacesDir, { withFileTypes: true });
  for (const botEntry of botEntries) {
    if (!botEntry.isDirectory()) continue;
    const skillsDir = path.join(workspacesDir, botEntry.name, 'skills');
    if (!fs.existsSync(skillsDir)) continue;

    const skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const skillEntry of skillEntries) {
      if (!skillEntry.isDirectory()) continue;
      if (skillEntry.name.endsWith('.skill')) continue;
      const skillMdPath = path.join(skillsDir, skillEntry.name, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;
      try {
        const stat = fs.statSync(skillMdPath);

        // Scan references/ subdirectory
        let referenceFiles: Record<string, string> | undefined;
        const refsDir = path.join(skillsDir, skillEntry.name, 'references');
        if (fs.existsSync(refsDir)) {
          try {
            const refs: Record<string, string> = {};
            for (const refFile of fs.readdirSync(refsDir)) {
              const refPath = path.join(refsDir, refFile);
              try {
                if (!fs.statSync(refPath).isFile()) continue;
                refs[refFile] = fs.readFileSync(refPath, 'utf-8');
              } catch {
                /* skip unreadable */
              }
            }
            if (Object.keys(refs).length > 0) referenceFiles = refs;
          } catch {
            /* skip unreadable refs dir */
          }
        }

        skills.push({
          name: skillEntry.name,
          prompt: fs.readFileSync(skillMdPath, 'utf-8'),
          package: 'openclaw',
          botId: botEntry.name,
          mtime: stat.mtimeMs,
          referenceFiles,
        });
      } catch {
        /* skip unreadable */
      }
    }
  }

  return skills;
}

interface DeduplicatedSkill extends ScannedSkill {
  allBotIds: string[];
}

/**
 * 동일 이름 스킬을 그룹핑하여 newest-mtime의 prompt를 선택, bot_ids를 머지.
 * canonical bot (mtime 최신)이 allBotIds[0]에 위치.
 */
function deduplicateSkills(skills: ScannedSkill[]): DeduplicatedSkill[] {
  const byName = new Map<string, ScannedSkill[]>();
  for (const s of skills) {
    const group = byName.get(s.name) || [];
    group.push(s);
    byName.set(s.name, group);
  }

  const result: DeduplicatedSkill[] = [];
  for (const [, group] of byName) {
    group.sort((a, b) => b.mtime - a.mtime);
    const winner = group[0];
    const canonicalBotId = winner.botId;
    const otherBotIds = group
      .filter((s) => s.botId !== canonicalBotId)
      .map((s) => s.botId)
      .sort();

    let mergedRefs: Record<string, string> | undefined;
    for (const s of [...group].reverse()) {
      if (s.referenceFiles) mergedRefs = { ...(mergedRefs || {}), ...s.referenceFiles };
    }

    result.push({
      ...winner,
      referenceFiles: mergedRefs,
      allBotIds: [canonicalBotId, ...otherBotIds],
    });
  }
  return result;
}

/**
 * DB에서 봇 목록을 로드, fallback으로 로컬 디렉토리 스캔
 */
export async function getBotIds(pool: Pool): Promise<string[]> {
  try {
    const result = await pool.query('SELECT bot_id FROM semo.bot_status ORDER BY bot_id');
    if (result.rows.length > 0) {
      return result.rows.map((r: { bot_id: string }) => r.bot_id);
    }
  } catch {
    /* fallback to local scan */
  }

  // Fallback: scan ~/.semo/workspaces/ directories
  const botIds: string[] = [];
  try {
    if (fs.existsSync(SEMO_WORKSPACES)) {
      const entries = fs.readdirSync(SEMO_WORKSPACES);
      for (const entry of entries) {
        const wsDir = path.join(SEMO_WORKSPACES, entry);
        if (fs.statSync(wsDir).isDirectory()) {
          botIds.push(entry);
        }
      }
    }
  } catch {
    /* skip */
  }

  return botIds.sort();
}

/**
 * 스캔된 스킬을 skill_definitions에 upsert.
 * deduplicateSkills()로 스킬당 1회만 upsert — newest-mtime의 prompt가 선택됨.
 */
export async function syncSkillsToDB(client: PoolClient, pool: Pool): Promise<SkillSyncResult> {
  const botIds = await getBotIds(pool);
  const rawSkills = scanSkills(botIds);
  const skills = deduplicateSkills(rawSkills);

  for (const skill of skills) {
    const metadata: Record<string, unknown> = { bot_ids: skill.allBotIds };
    if (skill.referenceFiles) metadata.reference_files = skill.referenceFiles;

    await client.query(
      `INSERT INTO semo.skill_definitions (name, prompt, package, metadata, is_active, office_id)
       VALUES ($1, $2, $3, $4, true, NULL)
       ON CONFLICT (name, office_id) DO UPDATE SET
         prompt = EXCLUDED.prompt,
         package = EXCLUDED.package,
         metadata = skill_definitions.metadata || EXCLUDED.metadata,
         updated_at = NOW()`,
      [skill.name, skill.prompt, skill.package, JSON.stringify(metadata)],
    );
  }

  return {
    botSpecific: rawSkills.length,
    total: skills.length,
  };
}

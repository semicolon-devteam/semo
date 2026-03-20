/**
 * skill-sync — 봇 전용 스킬 파일 스캔 + DB 동기화
 *
 * semo bots sync (piggyback) 및 semo context sync (세션 훅) 양쪽에서 호출.
 * 스킬 이름은 flat (예: 'kb-manager'), metadata.bot_ids 배열로 봇 매핑.
 * 동일 스킬명이 여러 봇에 존재하면 bot_ids를 머지.
 */

import * as fs from "fs";
import * as path from "path";
import { PoolClient } from "pg";

interface ScannedSkill {
  name: string;
  prompt: string;
  package: string;
  botId: string;
}

export interface SkillSyncResult {
  botSpecific: number;
  total: number;
}

/**
 * semo-system/bot-workspaces 에서 봇 전용 스킬 파일 스캔
 */
export function scanSkills(semoSystemDir: string): ScannedSkill[] {
  const skills: ScannedSkill[] = [];

  const workspacesDir = path.join(semoSystemDir, "bot-workspaces");
  if (!fs.existsSync(workspacesDir)) return skills;

  const botEntries = fs.readdirSync(workspacesDir, { withFileTypes: true });
  for (const botEntry of botEntries) {
    if (!botEntry.isDirectory()) continue;
    const skillsDir = path.join(workspacesDir, botEntry.name, "skills");
    if (!fs.existsSync(skillsDir)) continue;

    const skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const skillEntry of skillEntries) {
      if (!skillEntry.isDirectory()) continue;
      if (skillEntry.name.endsWith(".skill")) continue;
      const skillMdPath = path.join(skillsDir, skillEntry.name, "SKILL.md");
      if (!fs.existsSync(skillMdPath)) continue;
      try {
        skills.push({
          name: skillEntry.name,
          prompt: fs.readFileSync(skillMdPath, "utf-8"),
          package: "openclaw",
          botId: botEntry.name,
        });
      } catch { /* skip unreadable */ }
    }
  }

  return skills;
}

/**
 * 스캔된 스킬을 skill_definitions에 upsert
 * flat name + metadata.bot_ids 배열 사용, 동일 스킬명은 bot_ids 머지
 */
export async function syncSkillsToDB(
  client: PoolClient,
  semoSystemDir: string
): Promise<SkillSyncResult> {
  const skills = scanSkills(semoSystemDir);

  for (const skill of skills) {
    await client.query(
      `INSERT INTO skill_definitions (name, prompt, package, metadata, is_active, office_id)
       VALUES ($1, $2, $3, $4, true, NULL)
       ON CONFLICT (name, office_id) DO UPDATE SET
         prompt = EXCLUDED.prompt,
         package = EXCLUDED.package,
         metadata = jsonb_set(
           skill_definitions.metadata,
           '{bot_ids}',
           (SELECT jsonb_agg(DISTINCT v)
            FROM jsonb_array_elements(
              COALESCE(skill_definitions.metadata->'bot_ids', '[]'::jsonb) ||
              COALESCE(EXCLUDED.metadata->'bot_ids', '[]'::jsonb)
            ) AS v)
         ),
         updated_at = NOW()`,
      [skill.name, skill.prompt, skill.package, JSON.stringify({ bot_ids: [skill.botId] })]
    );
  }

  return {
    botSpecific: skills.length,
    total: skills.length,
  };
}

/**
 * skill-sync — 스킬 파일 스캔 + DB 동기화
 *
 * semo bots sync (piggyback) 및 semo context sync (세션 훅) 양쪽에서 호출.
 * 공유 스킬은 target_agents DEFAULT '{all}', 봇 전용은 '{botId}'로 설정.
 */

import * as fs from "fs";
import * as path from "path";
import { PoolClient } from "pg";

interface ScannedSkill {
  name: string;
  prompt: string;
  package: string;
  botId: string | null;
}

export interface SkillSyncResult {
  shared: number;
  botSpecific: number;
  total: number;
}

/**
 * semo-system 디렉토리에서 스킬 파일 스캔
 */
export function scanSkills(semoSystemDir: string): { shared: ScannedSkill[]; botSpecific: ScannedSkill[] } {
  const shared: ScannedSkill[] = [];
  const botSpecific: ScannedSkill[] = [];

  // 1. 공유 스킬: semo-skills/*/SKILL.md
  const sharedSkillsDir = path.join(semoSystemDir, "semo-skills");
  if (fs.existsSync(sharedSkillsDir)) {
    const entries = fs.readdirSync(sharedSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = path.join(sharedSkillsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillMdPath)) continue;
      try {
        shared.push({
          name: entry.name,
          prompt: fs.readFileSync(skillMdPath, "utf-8"),
          package: "semo-skills",
          botId: null,
        });
      } catch { /* skip unreadable */ }
    }
  }

  // 2. 봇 전용 스킬: bot-workspaces/*/skills/*/SKILL.md
  const workspacesDir = path.join(semoSystemDir, "bot-workspaces");
  if (fs.existsSync(workspacesDir)) {
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
          botSpecific.push({
            name: `${botEntry.name}/${skillEntry.name}`,
            prompt: fs.readFileSync(skillMdPath, "utf-8"),
            package: "openclaw",
            botId: botEntry.name,
          });
        } catch { /* skip unreadable */ }
      }
    }
  }

  return { shared, botSpecific };
}

/**
 * 스캔된 스킬을 skill_definitions에 upsert
 * 기존 트랜잭션 내에서 호출 가능 (caller가 BEGIN/COMMIT 관리)
 */
export async function syncSkillsToDB(
  client: PoolClient,
  semoSystemDir: string
): Promise<SkillSyncResult> {
  const { shared, botSpecific } = scanSkills(semoSystemDir);

  // 공유 스킬 — target_agents DEFAULT '{all}'
  for (const skill of shared) {
    await client.query(
      `INSERT INTO skill_definitions (name, prompt, package, is_active, office_id)
       VALUES ($1, $2, $3, true, NULL)
       ON CONFLICT (name, office_id) DO UPDATE SET
         prompt = EXCLUDED.prompt,
         package = EXCLUDED.package,
         updated_at = NOW()`,
      [skill.name, skill.prompt, skill.package]
    );
  }

  // 봇 전용 스킬 — target_agents = '{botId}'
  for (const skill of botSpecific) {
    await client.query(
      `INSERT INTO skill_definitions (name, prompt, package, target_agents, metadata, is_active, office_id)
       VALUES ($1, $2, $3, $4, $5, true, NULL)
       ON CONFLICT (name, office_id) DO UPDATE SET
         prompt = EXCLUDED.prompt,
         package = EXCLUDED.package,
         target_agents = EXCLUDED.target_agents,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()`,
      [skill.name, skill.prompt, skill.package, `{${skill.botId}}`, JSON.stringify({ bot_id: skill.botId })]
    );
  }

  return {
    shared: shared.length,
    botSpecific: botSpecific.length,
    total: shared.length + botSpecific.length,
  };
}

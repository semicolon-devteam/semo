/**
 * skill-sync — 봇 워크스페이스 스킬 스캔 + DB 동기화
 *
 * v2.0: ~/.openclaw-{bot}/workspace/skills/ 경로 스캔 (semo-system/ 폐기)
 * 봇 목록은 bot_status DB에서 동적 로드, fallback으로 로컬 디렉토리 스캔.
 *
 * semo bots sync (piggyback) 및 semo context sync (세션 훅) 양쪽에서 호출.
 * 스킬 이름은 flat (예: 'kb-manager'), metadata.bot_ids 배열로 봇 매핑.
 * 동일 스킬명이 여러 봇에 존재하면 bot_ids를 머지.
 */

import * as fs from "fs";
import * as path from "path";
import { Pool, PoolClient } from "pg";

export interface ScannedSkill {
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
 * ~/.openclaw-{bot}/workspace/skills/ 에서 봇 전용 스킬 파일 스캔
 *
 * @param botIds - 스캔 대상 봇 ID 목록
 */
export function scanSkills(botIds: string[]): ScannedSkill[];
/**
 * @deprecated semo-system/ 기반 스캔 (하위호환 유지)
 */
export function scanSkills(semoSystemDir: string): ScannedSkill[];
export function scanSkills(arg: string | string[]): ScannedSkill[] {
  if (typeof arg === "string") {
    return scanSkillsLegacy(arg);
  }
  return scanSkillsV2(arg);
}

function scanSkillsV2(botIds: string[]): ScannedSkill[] {
  const skills: ScannedSkill[] = [];
  const home = process.env.HOME || "/Users/reus";

  for (const botId of botIds) {
    const skillsDir = path.join(home, `.openclaw-${botId}`, "workspace", "skills");
    if (!fs.existsSync(skillsDir)) continue;

    let skillEntries: fs.Dirent[];
    try {
      skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch { continue; }

    for (const skillEntry of skillEntries) {
      if (!skillEntry.isDirectory()) continue;
      if (skillEntry.name.endsWith(".skill")) continue;
      if (skillEntry.name.startsWith("_") || skillEntry.name.startsWith(".")) continue;

      const skillMdPath = path.join(skillsDir, skillEntry.name, "SKILL.md");
      if (!fs.existsSync(skillMdPath)) continue;

      try {
        skills.push({
          name: skillEntry.name,
          prompt: fs.readFileSync(skillMdPath, "utf-8"),
          package: "openclaw",
          botId,
        });
      } catch { /* skip unreadable */ }
    }
  }

  return skills;
}

/** Legacy: semo-system/bot-workspaces 에서 스캔 (하위호환) */
function scanSkillsLegacy(semoSystemDir: string): ScannedSkill[] {
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
 * DB에서 봇 목록을 로드, fallback으로 로컬 디렉토리 스캔
 */
export async function getBotIds(pool: Pool): Promise<string[]> {
  try {
    const result = await pool.query(
      "SELECT bot_id FROM semo.bot_status ORDER BY bot_id",
    );
    if (result.rows.length > 0) {
      return result.rows.map((r: { bot_id: string }) => r.bot_id);
    }
  } catch { /* fallback to local scan */ }

  // Fallback: scan ~/.openclaw-*/workspace/ directories
  const home = process.env.HOME || "/Users/reus";
  const botIds: string[] = [];
  try {
    const entries = fs.readdirSync(home);
    for (const entry of entries) {
      const match = entry.match(/^\.openclaw-(.+)$/);
      if (match) {
        const wsDir = path.join(home, entry, "workspace");
        if (fs.existsSync(wsDir)) {
          botIds.push(match[1]);
        }
      }
    }
  } catch { /* skip */ }

  return botIds.sort();
}

/**
 * 스캔된 스킬을 skill_definitions에 upsert
 * flat name + metadata.bot_ids 배열 사용, 동일 스킬명은 bot_ids 머지
 */
export async function syncSkillsToDB(
  client: PoolClient,
  pool: Pool,
): Promise<SkillSyncResult> {
  const botIds = await getBotIds(pool);
  const skills = scanSkills(botIds);

  for (const skill of skills) {
    await client.query(
      `INSERT INTO semo.skill_definitions (name, prompt, package, metadata, is_active, office_id)
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

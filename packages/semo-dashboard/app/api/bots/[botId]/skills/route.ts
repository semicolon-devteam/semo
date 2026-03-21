import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { list as kbList } from '@/lib/kb';
import type { BotSkill } from '@/types';

interface SkillRow {
  name: string;
  is_active: boolean;
  category: string | null;
  package: string | null;
  updated_at: string | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;

    if (!/^[a-zA-Z0-9_-]+$/.test(botId)) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
    }

    // 1. Scan skills from KB (skill domain — SoT) + bot_workspace_files fallback
    const wsSkills = new Map<string, { hasReferences: boolean }>();

    // 1a. KB skill domain
    try {
      const kbSkills = await kbList('skill');
      for (const entry of kbSkills) {
        // key format: {botId}/{skillName} or {botId}/{skillName}/ref-{name}
        if (!entry.key.startsWith(`${botId}/`)) continue;
        const parts = entry.key.split('/');
        if (parts.length >= 2) {
          const skillName = parts[1];
          const existing = wsSkills.get(skillName) || { hasReferences: false };
          if (parts.length >= 3 && parts[2].startsWith('ref-')) {
            existing.hasReferences = true;
          }
          wsSkills.set(skillName, existing);
        }
      }
    } catch { /* KB unavailable */ }

    // 1b. Fallback: bot_workspace_files (for scripts/ detection and non-migrated skills)
    try {
      const wsResult = await query<{ file_path: string }>(
        `SELECT file_path FROM semo.bot_workspace_files
         WHERE bot_id = $1 AND file_path LIKE 'skills/%'`,
        [botId]
      );
      for (const row of wsResult.rows) {
        const parts = row.file_path.split('/');
        if (parts.length >= 3 && parts[2] === 'SKILL.md') {
          const skillName = parts[1];
          if (!wsSkills.has(skillName)) {
            const hasReferences = wsResult.rows.some(r =>
              r.file_path.startsWith(`skills/${skillName}/references/`)
            );
            wsSkills.set(skillName, { hasReferences });
          }
        }
      }
    } catch {
      // DB unavailable for workspace files
    }

    // 2. Query skill_definitions DB
    const dbSkills = new Map<string, SkillRow>();
    try {
      const result = await query<SkillRow>(
        `SELECT name, is_active, category, package, updated_at
         FROM skill_definitions
         WHERE metadata->>'bot_id' = $1 AND office_id IS NULL`,
        [botId]
      );
      for (const row of result.rows) {
        // name format: "botId/skillName"
        const shortName = row.name.startsWith(`${botId}/`)
          ? row.name.slice(botId.length + 1)
          : row.name;
        dbSkills.set(shortName, row);
      }
    } catch {
      // DB unavailable — workspace-only mode
    }

    // 3. Merge
    const allNames = new Set([...wsSkills.keys(), ...dbSkills.keys()]);
    const skills: BotSkill[] = [];

    for (const name of allNames) {
      const inWs = wsSkills.has(name);
      const inDb = dbSkills.has(name);
      const dbRow = dbSkills.get(name);

      let source: BotSkill['source'];
      if (inWs && inDb) source = 'synced';
      else if (inWs) source = 'workspace-only';
      else source = 'db-only';

      skills.push({
        name,
        fullName: `${botId}/${name}`,
        source,
        isActive: dbRow?.is_active ?? true,
        category: dbRow?.category ?? null,
        package: dbRow?.package ?? null,
        updatedAt: dbRow?.updated_at ?? null,
        hasReferences: wsSkills.get(name)?.hasReferences ?? false,
      });
    }

    // Sort: synced first, then workspace-only, then db-only; alphabetical within
    skills.sort((a, b) => {
      const order = { synced: 0, 'workspace-only': 1, 'db-only': 2 };
      const diff = order[a.source] - order[b.source];
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });

    return NextResponse.json(skills);
  } catch (error) {
    console.error('Error fetching skills:', error);
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 });
  }
}

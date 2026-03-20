import { NextResponse } from 'next/server';
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import { query } from '@/lib/db';
import type { BotSkill } from '@/types';

const WORKSPACES_DIR = path.resolve(process.cwd(), '../../semo-system/bot-workspaces');

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

    // 1. Scan workspace skills
    const wsSkills = new Map<string, { hasReferences: boolean }>();
    const skillsDir = path.join(WORKSPACES_DIR, botId, 'skills');
    if (existsSync(skillsDir)) {
      const entries = readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.endsWith('.skill')) continue;
        const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
        if (!existsSync(skillMdPath)) continue;
        const hasReferences = existsSync(path.join(skillsDir, entry.name, 'references'));
        wsSkills.set(entry.name, { hasReferences });
      }
    }

    // 2. Query DB
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

import { Pool } from 'pg';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export interface SpeakerProfile {
  domain: string;
  nickname?: string;
  organization?: string;
  communicationProfile?: {
    tech_level: string;
    access_level: string;
    dri_scope: string;
    comm_style: string;
    language: string;
  };
}

// 10분 TTL 캐시
const cache = new Map<string, { profile: SpeakerProfile | null; expiry: number }>();
const CACHE_TTL = 10 * 60_000;

export async function resolveSpeaker(
  pool: Pool,
  platform: 'slack' | 'discord',
  senderId: string,
): Promise<SpeakerProfile | null> {
  const key = `${platform}:${senderId}`;
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiry) return cached.profile;

  const idKey = platform === 'slack' ? 'slack-id' : 'discord-id';

  // KB 역조회: senderId → person 도메인
  const result = await pool.query(
    `SELECT kb.domain FROM ${DB_SCHEMA}.knowledge_base kb
     JOIN ${DB_SCHEMA}.ontology o ON o.domain = kb.domain AND o.entity_type = 'person'
     WHERE kb.key = $1 AND kb.content = $2 LIMIT 1`,
    [idKey, senderId],
  );

  if (result.rows.length === 0) {
    cache.set(key, { profile: null, expiry: Date.now() + CACHE_TTL });
    return null;
  }

  const domain = result.rows[0].domain;

  // communication-profile + organization + nickname 로드
  const profileResult = await pool.query(
    `SELECT key, content FROM ${DB_SCHEMA}.knowledge_base
     WHERE domain = $1 AND key IN ('communication-profile', 'organization', 'nickname')`,
    [domain],
  );

  const profile: SpeakerProfile = { domain };
  for (const row of profileResult.rows) {
    if (row.key === 'nickname') profile.nickname = row.content;
    if (row.key === 'organization') profile.organization = row.content;
    if (row.key === 'communication-profile') {
      const lines = (row.content as string).split('\n');
      const cp: Record<string, string> = {};
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          cp[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
        }
      }
      profile.communicationProfile = cp as SpeakerProfile['communicationProfile'];
    }
  }

  cache.set(key, { profile, expiry: Date.now() + CACHE_TTL });
  return profile;
}

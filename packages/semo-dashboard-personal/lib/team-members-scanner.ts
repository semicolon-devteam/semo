import 'server-only';
import type { TeamMember } from '@/lib/shared-ui';
import { kbDb } from './kb-db';

// kb.db 에서 person 엔트리를 찾는 휴리스틱:
//   (key='profile', sub_key='nickname') = 표시용 닉네임
//   (key='profile', sub_key='role')     = 역할 라벨
// 닉네임이 있는 도메인만 팀 멤버로 승격. Personal 초기 설치에는 이 엔트리가 비어있으므로
// 대부분 readTeamMembers 의 self fallback 이 동작한다. SemoBot 온보딩이 엔트리를 생성하면
// 자연스럽게 여기서 스캔되어 목록이 채워진다.
//
// knowledge_base 에 `UNIQUE(domain, key, sub_key)` 제약이 있으므로 domain 당 각 sub_key
// 는 최대 1건이다. MAX(CASE ...) 집계는 그 단일 값을 그대로 골라낸다.
function scanTeamFromKb(): TeamMember[] {
  const db = kbDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        `SELECT domain,
                MAX(CASE WHEN sub_key='nickname' THEN content END) AS nickname,
                MAX(CASE WHEN sub_key='role'     THEN content END) AS role
         FROM knowledge_base
         WHERE key='profile' AND sub_key IN ('nickname','role')
         GROUP BY domain
         HAVING nickname IS NOT NULL AND length(nickname) > 0
         ORDER BY domain ASC`,
      )
      .all() as Array<{ domain: string; nickname: string; role: string | null }>;
    return rows.map((r) => ({
      domain: r.domain,
      nickname: r.nickname,
      role: r.role && r.role.length > 0 ? r.role : 'Member',
    }));
  } catch (err) {
    console.warn('[team-members-scanner] query failed:', (err as Error).message);
    return [];
  }
}

export function readTeamMembers(): TeamMember[] {
  const fromKb = scanTeamFromKb();
  if (fromKb.length > 0) return fromKb;
  // Personal 초기 설치용 self fallback. FormModal 의 assignee <select> 가 최소 1개 option 을
  // 요구하므로 비워둘 수 없다.
  // TODO: config.toml 에 `self.domain` 이 정의되면 이 값을 리터럴 'me' 대신 사용하여
  //       assignee 충돌 가능성을 제거한다.
  return [{ domain: 'me', nickname: 'me', role: 'Owner' }];
}

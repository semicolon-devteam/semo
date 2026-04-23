/**
 * TemplateCatalog — builtin + tenant 확장 템플릿 조회·검색.
 *
 * MVP 는 builtin 만. 추후 `~/.semo/tenant/templates/` 로드 지원 시
 * constructor 에 tenant 목록을 주입하면 된다 (merge: tenant 가 builtin 을 덮어씀).
 */
import { BUILTIN_BOT_TEMPLATES } from './builtin.js';
import type { BotTemplate, TemplateSearchResult } from './types.js';

export class TemplateCatalog {
  private readonly byId: Map<string, BotTemplate>;

  constructor(private readonly templates: readonly BotTemplate[] = BUILTIN_BOT_TEMPLATES) {
    this.byId = new Map(templates.map((t) => [t.id.toLowerCase(), t]));
  }

  list(): readonly BotTemplate[] {
    return this.templates;
  }

  get(id: string): BotTemplate | null {
    return this.byId.get(id.toLowerCase()) ?? null;
  }

  has(id: string): boolean {
    return this.byId.has(id.toLowerCase());
  }

  /**
   * 태그/이름/요약/역할 문자열에 대해 단순 rank 검색.
   * 완전 일치 > 태그 일치 > 이름 일치 > 요약 포함 > 역할 포함.
   */
  search(query: string): readonly TemplateSearchResult[] {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];
    const results: TemplateSearchResult[] = [];

    for (const t of this.templates) {
      const matchedBy: string[] = [];
      let score = 0;

      if (t.id.toLowerCase() === q) {
        score += 100;
        matchedBy.push('id-exact');
      } else if (t.id.toLowerCase().includes(q)) {
        score += 30;
        matchedBy.push('id-partial');
      }

      for (const tag of t.tags) {
        const tl = tag.toLowerCase();
        if (tl === q) {
          score += 50;
          matchedBy.push(`tag:${tag}`);
        } else if (tl.includes(q) || q.includes(tl)) {
          score += 15;
          matchedBy.push(`tag~${tag}`);
        }
      }

      if (t.name.toLowerCase().includes(q)) {
        score += 20;
        matchedBy.push('name');
      }
      if (t.summary.toLowerCase().includes(q)) {
        score += 10;
        matchedBy.push('summary');
      }
      if (t.role.toLowerCase().includes(q)) {
        score += 5;
        matchedBy.push('role');
      }

      if (score > 0) {
        results.push({ template: t, score, matchedBy });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }
}

export const defaultTemplateCatalog = new TemplateCatalog();

/**
 * Bot template catalog (L0 kernel asset).
 *
 * 템플릿은 "역할 정의 + KB 스코프 + 추천 스킬" 순수 데이터.
 * tenant 고유 도메인은 템플릿에 들어오지 않는다 (L2 전용).
 *
 * 설치 시 고객은 `semo templates apply <id>` 로 자기 L2 봇을 생성하고,
 * 그 이후 자유롭게 커스터마이징한다.
 */

export interface BotTemplate {
  /** 고유 ID (e.g. 'planclaw'). 그대로 default botId 로 사용. */
  readonly id: string;
  /** 사람이 읽는 이름 (한국어). */
  readonly name: string;
  /** 한 줄 요약 — 카탈로그 목록에 표시. */
  readonly summary: string;
  /** 역할 프롬프트 시드 — agent-factory 가 봇 identity 로 저장. */
  readonly role: string;
  /**
   * 기본 KB 접근 도메인.
   * Personal 프로파일에서는 보통 ['inbox', 'me'] 수준으로 최소화.
   * Team 프로파일에서 고객이 본인 서비스 도메인을 추가.
   */
  readonly kbDomains: readonly string[];
  /** 추천 스킬 ID 목록. 실제 DB 에 등록된 스킬과 매칭되어야 한다. */
  readonly suggestedSkills: readonly string[];
  /** Slack / Discord 봇 아이콘 (emoji). */
  readonly slackIcon?: string;
  /** 검색용 태그 (한영 혼용). */
  readonly tags: readonly string[];
}

export interface TemplateSearchResult {
  readonly template: BotTemplate;
  readonly score: number;
  readonly matchedBy: readonly string[];
}

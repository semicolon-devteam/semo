import { describe, expect, it } from 'vitest';
import { parseDelegationKeywords, kbIntentMatch } from '../router/kb-routing.js';

/**
 * Phase 3b 단위 테스트.
 *
 * 비전(2026-04-29 reus): KB delegation 의 "## 수신 키워드" = 라우팅 SoT.
 * Codex 권고: 1차 substring 매칭 + confidence threshold + top-2 fallback.
 */

describe('parseDelegationKeywords (Phase 3b)', () => {
  it('## 수신 키워드 섹션의 - 항목들을 소문자 정규화 + 중복 제거', () => {
    const md = `## 수신 키워드
- 할일
- 액션아이템
- ACTION ITEM
- action item
- todo

## 에스컬레이션
- 담당 밖 → semiclaw`;
    const r = parseDelegationKeywords(md);
    expect(r).toContain('할일');
    expect(r).toContain('액션아이템');
    expect(r).toContain('action item');
    expect(r).toContain('todo');
    // 'ACTION ITEM' → 'action item' 으로 정규화 + 중복 제거
    expect(r.filter((k) => k === 'action item')).toHaveLength(1);
  });

  it('placeholder "- (TODO: ...)" 제외', () => {
    const md = `## 수신 키워드
- 키워드1
- (TODO: 키워드 백필 필요)
- 키워드2`;
    const r = parseDelegationKeywords(md);
    expect(r).toEqual(['키워드1', '키워드2']);
  });

  it('## 수신 키워드 섹션 없으면 빈 배열', () => {
    expect(parseDelegationKeywords('# Title\n\n본문')).toEqual([]);
  });

  it('다음 ## 헤더에서 잘림 — 에스컬레이션 섹션 흡수 X', () => {
    const md = `## 수신 키워드
- A
- B

## 에스컬레이션
- 무시되어야 할 라인
- 또 다른 라인`;
    const r = parseDelegationKeywords(md);
    expect(r).toEqual(['a', 'b']);
  });
});

describe('kbIntentMatch (Phase 3b)', () => {
  const routes = [
    { botId: 'reviewclaw', keywords: ['리뷰', '버그', '품질', 'qa', 'pr 리뷰'] },
    { botId: 'planclaw', keywords: ['기획', '스펙', 'spec', '요구사항'] },
    { botId: 'kb-sidekick', keywords: ['kb', '지식베이스', '의사결정 찾아', '도메인 목록'] },
    { botId: 'workclaw', keywords: ['개발', '구현', 'feature 구현'] },
    { botId: 'semobot', keywords: [] }, // 빈 키워드 — 후보 안 됨
  ];

  it('정확 매칭: 단일 봇 1순위', () => {
    const r = kbIntentMatch('이 PR 리뷰 부탁합니다', routes);
    expect(r?.botId).toBe('reviewclaw');
    expect(r?.score).toBeGreaterThan(0);
    expect(r?.matchedKeywords).toContain('pr 리뷰');
  });

  it('한국어 키워드 매칭 (대소문자 무관)', () => {
    const r = kbIntentMatch('KB에서 의사결정 찾아줘', routes);
    expect(r?.botId).toBe('kb-sidekick');
    // 'kb', '의사결정 찾아' 둘 다 매칭
    expect(r?.score).toBeGreaterThanOrEqual(2);
  });

  it('runnerUp 노출: 두 봇 모두 매칭되면 top-2 표시', () => {
    const r = kbIntentMatch('기획서 리뷰 부탁', routes);
    // '기획' 1개 → planclaw, '리뷰' 1개 → reviewclaw, 동률 1점.
    // tiebreak (긴 키워드 우선) — '기획' 2자, '리뷰' 2자 동률, 입력 순서대로 reviewclaw 가 정렬상 먼저 등장 가능.
    expect(r).not.toBeNull();
    expect(r?.runnerUp).toBeDefined();
    expect(['planclaw', 'reviewclaw']).toContain(r?.botId);
    expect(['planclaw', 'reviewclaw']).toContain(r?.runnerUp?.botId);
  });

  it('매칭 0 → null (라우터가 다른 룰로 fallback)', () => {
    const r = kbIntentMatch('점심 뭐 먹지', routes);
    expect(r).toBeNull();
  });

  it('빈 키워드 봇은 후보 제외', () => {
    const r = kbIntentMatch('semobot semobot semobot', [
      { botId: 'semobot', keywords: [] },
      { botId: 'a', keywords: ['semobot'] },
    ]);
    expect(r?.botId).toBe('a');
  });

  it('빈 텍스트 → null', () => {
    expect(kbIntentMatch('', routes)).toBeNull();
  });

  it('routes 비어있으면 → null', () => {
    expect(kbIntentMatch('hello', [])).toBeNull();
  });

  it('동률 시 긴 키워드 우선 (tiebreak)', () => {
    const r = kbIntentMatch('feature 구현 진행', [
      { botId: 'short', keywords: ['진행'] },
      { botId: 'long', keywords: ['feature 구현'] },
    ]);
    // 둘 다 1개 매칭. long 의 'feature 구현' (10자) > short 의 '진행' (2자)
    expect(r?.botId).toBe('long');
  });
});

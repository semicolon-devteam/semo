/**
 * RuleFactoryIntentParser 단위테스트.
 *
 * Rule-based 파서는 LLM 없이도 기본 온보딩 대화가 가능해야 한다.
 * 커버리지 목표: 각 action 변종별 최소 한 개 + 모호 케이스 명확화 요청.
 */
import { describe, expect, it } from 'vitest';
import { ruleFactoryIntentParser as p } from '../factory/rule-parser.js';

describe('RuleFactoryIntentParser — bot.create', () => {
  it('"기획 봇 하나 만들어줘" → planclaw 템플릿 제안', () => {
    const a = p.parse('기획 봇 하나 만들어줘');
    expect(a.kind).toBe('bot.create');
    if (a.kind === 'bot.create') {
      expect(a.template).toBe('planclaw');
      expect(a.role).toContain('기획');
      expect(a.botId).toBe('planclaw');
    }
  });

  it('"리뷰 봇 추가" → reviewclaw', () => {
    const a = p.parse('리뷰 봇 추가');
    expect(a.kind).toBe('bot.create');
    if (a.kind === 'bot.create') {
      expect(a.template).toBe('reviewclaw');
    }
  });

  it('"디자인 봇 만들기" → designclaw', () => {
    const a = p.parse('디자인 봇 만들기');
    expect(a.kind).toBe('bot.create');
    if (a.kind === 'bot.create') {
      expect(a.template).toBe('designclaw');
    }
  });

  it('"create a new growth bot" → growthclaw', () => {
    const a = p.parse('create a new growth bot');
    expect(a.kind).toBe('bot.create');
    if (a.kind === 'bot.create') {
      expect(a.template).toBe('growthclaw');
    }
  });
});

describe('RuleFactoryIntentParser — bot.list / ontology.list', () => {
  it('"봇 목록" → bot.list', () => {
    expect(p.parse('봇 목록').kind).toBe('bot.list');
  });

  it('"list bots" → bot.list', () => {
    expect(p.parse('list bots').kind).toBe('bot.list');
  });

  it('"어떤 봇 있어?" → bot.list', () => {
    expect(p.parse('어떤 봇 있어?').kind).toBe('bot.list');
  });

  it('"온톨로지 타입 목록" → ontology.list', () => {
    expect(p.parse('온톨로지 타입 목록').kind).toBe('ontology.list');
  });

  it('"어떤 도메인이 있지?" → ontology.list', () => {
    expect(p.parse('어떤 도메인이 있지?').kind).toBe('ontology.list');
  });
});

describe('RuleFactoryIntentParser — kb.upsert', () => {
  it('"KB에 \\"SEMO는 OSS다\\" 저장해" → kb.upsert (content 추출)', () => {
    const a = p.parse('KB에 "SEMO는 OSS다" 저장해줘');
    expect(a.kind).toBe('kb.upsert');
    if (a.kind === 'kb.upsert') {
      expect(a.content).toBe('SEMO는 OSS다');
      expect(a.domain).toBe('inbox');
      expect(a.key).toBe('note');
    }
  });

  it('명시적 domain=/key= 는 존중', () => {
    const a = p.parse('KB에 domain=reus key=role "PM" 등록');
    expect(a.kind).toBe('kb.upsert');
    if (a.kind === 'kb.upsert') {
      expect(a.domain).toBe('reus');
      expect(a.key).toBe('role');
      expect(a.content).toBe('PM');
    }
  });
});

describe('RuleFactoryIntentParser — kb.search', () => {
  it('"SEMO 검색해줘" → kb.search', () => {
    const a = p.parse('SEMO 검색해줘');
    expect(a.kind).toBe('kb.search');
    if (a.kind === 'kb.search') {
      expect(a.query).toContain('SEMO');
    }
  });

  it('"find planclaw" → kb.search', () => {
    const a = p.parse('find planclaw');
    expect(a.kind).toBe('kb.search');
    if (a.kind === 'kb.search') {
      expect(a.query).toContain('planclaw');
    }
  });
});

describe('RuleFactoryIntentParser — needs-clarification', () => {
  it('역할 모호한 "봇 하나 만들어줘" → needs-clarification', () => {
    const a = p.parse('봇 하나 만들어줘');
    expect(a.kind).toBe('needs-clarification');
    if (a.kind === 'needs-clarification') {
      expect(a.reason).toBe('role-unknown');
      expect(a.prompt).toContain('역할');
    }
  });
});

describe('RuleFactoryIntentParser — unknown', () => {
  it('빈 메시지 → unknown', () => {
    expect(p.parse('   ').kind).toBe('unknown');
  });

  it('완전히 무관한 문장 → unknown', () => {
    const a = p.parse('오늘 점심 뭐 먹지');
    expect(a.kind).toBe('unknown');
  });
});

describe('RuleFactoryIntentParser — sourceText 보존', () => {
  it('모든 action 이 원문을 sourceText 에 보존', () => {
    const cases = [
      '기획 봇 만들어줘',
      '봇 목록',
      '온톨로지 목록',
      'KB에 "메모" 저장해',
      'planclaw 검색해',
      '봇 만들어줘',
      '오늘 뭐하지',
    ];
    for (const c of cases) {
      const a = p.parse(c);
      expect(a.sourceText).toBe(c);
    }
  });
});

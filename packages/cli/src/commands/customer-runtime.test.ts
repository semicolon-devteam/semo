import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  customerBotId,
  buildCustomerSoul,
  scoreAgent,
  mapActionItemToWorkItem,
  mapCommitmentToWorkItem,
} from './customer-runtime';

describe('customerBotId', () => {
  it('테넌트+에이전트로 안정적 bot_id 생성', () => {
    expect(customerBotId('jeongmin-cafe', 'jumuni')).toBe('ag-jeongmin-cafe-jumuni');
  });
});

describe('buildCustomerSoul', () => {
  it('listing 메타로 persona soul 합성 (이름/역할/스킬/테넌트 포함)', () => {
    const soul = buildCustomerSoul({
      display_name: '리서처',
      role_label: '웹 조사·분석 직원',
      bio: '웹에서 정보를 조사한다',
      short_desc: null,
      dept: '리서치',
      tenant_slug: 'team-semicolon',
      skills: ['web-research', 'analysis'],
    });
    expect(soul).toContain('리서처');
    expect(soul).toContain('웹 조사·분석 직원');
    expect(soul).toContain('web-research, analysis');
    expect(soul).toContain('team-semicolon');
  });

  it('빈 메타도 깨지지 않음', () => {
    const soul = buildCustomerSoul({
      display_name: '봇',
      role_label: null,
      bio: null,
      short_desc: null,
      dept: null,
      tenant_slug: 't',
      skills: null,
    });
    expect(soul).toContain('봇');
    expect(soul).toContain('직원'); // role_label null → 기본 '직원'
  });
});

describe('scoreAgent', () => {
  const cafe = {
    listing_id: 'l1',
    agent_slug: 'jumuni',
    display_name: '주문이',
    role_label: '주문 응대 직원',
    short_desc: '주문을 받고 응대한다',
    dept: null,
    skills: ['order', 'reception'],
  };

  it('키워드 적중률로 점수(0~1)', () => {
    expect(scoreAgent(cafe, { keywords: ['주문', '응대', 'order'] })).toBeCloseTo(1.0, 5);
    expect(scoreAgent(cafe, { keywords: ['주문', '없는키워드'] })).toBeCloseTo(0.5, 5);
    expect(scoreAgent(cafe, { keywords: ['전혀', '관계', '없음'] })).toBe(0);
  });

  it('빈 키워드는 0', () => {
    expect(scoreAgent(cafe, { keywords: [] })).toBe(0);
  });

  it('대소문자 무관 매칭', () => {
    expect(scoreAgent(cafe, { keywords: ['ORDER'] })).toBeCloseTo(1.0, 5);
  });
});

describe('product work item facade', () => {
  it('bot_commitments는 실행 큐(in-flight)로 매핑한다', () => {
    expect(
      mapCommitmentToWorkItem({
        id: 'cmt-1',
        bot_id: 'ag-jeongmin-cafe-jumuni',
        status: 'active',
        title: '예약 문의 응대',
        description: null,
        source_type: 'slack',
        source_ref: 'C1:123.456',
        deadline_at: null,
        metadata: { thread_ts: '123.456' },
      }),
    ).toMatchObject({
      id: 'cmt-1',
      kind: 'in-flight',
      status: 'running',
      title: '예약 문의 응대',
      ownerId: 'ag-jeongmin-cafe-jumuni',
      targetId: null,
      sourceTable: 'bot_commitments',
      sourceStatus: 'active',
      sourceType: 'slack',
      sourceRef: 'C1:123.456',
    });

    expect(
      mapCommitmentToWorkItem({
        id: 'cmt-2',
        bot_id: 'ag-jeongmin-cafe-jumuni',
        status: 'pending',
        title: '주문 확인',
      }),
    ).toMatchObject({ kind: 'in-flight', status: 'queued' });

    expect(
      mapCommitmentToWorkItem({
        id: 'cmt-3',
        bot_id: 'ag-jeongmin-cafe-jumuni',
        status: 'stale_auto',
        title: '오래된 작업',
      }),
    ).toMatchObject({ kind: 'in-flight', status: 'expired' });
  });

  it('action_items는 계획/할일(plan)로 매핑한다', () => {
    expect(
      mapActionItemToWorkItem({
        action_item_id: 'ai-1',
        owner_domain: 'semiclaw',
        target_domain: 'axoracle',
        status: 'open',
        description: 'AXOracle 온보딩 개선안 작성',
        priority: 'high',
        category: 'planning',
        source: 'manual',
        related_url: 'https://example.test/task',
      }),
    ).toMatchObject({
      id: 'ai-1',
      kind: 'plan',
      status: 'planned',
      title: 'AXOracle 온보딩 개선안 작성',
      ownerId: 'semiclaw',
      targetId: 'axoracle',
      sourceTable: 'action_items',
      sourceStatus: 'open',
      priority: 'high',
      category: 'planning',
      sourceType: 'manual',
      sourceRef: 'https://example.test/task',
    });

    expect(
      mapActionItemToWorkItem({
        action_item_id: 'ai-2',
        owner_domain: 'semiclaw',
        target_domain: null,
        status: 'completed',
        description: '완료된 할일',
      }),
    ).toMatchObject({ kind: 'plan', status: 'completed', targetId: null });
  });
});

describe('entity relation graph migration', () => {
  const sql = readFileSync(resolve(__dirname, '../../migrations/128_entity_relations.sql'), 'utf8');

  it('registered relation type과 relation table을 additive로 추가한다', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS semo.relation_types');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS semo.entity_relations');
    expect(sql).toContain('REFERENCES semo.relation_types(relation_type)');
    expect(sql).not.toMatch(/^\s*(BEGIN|COMMIT);\s*$/im);
  });

  it('relation lifecycle, tenant scope, provenance를 DB 레벨에서 고정한다', () => {
    expect(sql).toContain("scope IN ('tenant-local', 'platform-global')");
    expect(sql).toContain("status IN ('proposed', 'approved', 'retired', 'rejected')");
    expect(sql).toContain("scope = 'platform-global' OR tenant_id IS NOT NULL");
    expect(sql).toContain('jsonb_typeof(source_ref) =');
    expect(sql).toContain('jsonb_typeof(target_ref) =');
    expect(sql).toContain('valid_from');
    expect(sql).toContain('valid_to');
    expect(sql).toContain('provenance');
  });
});

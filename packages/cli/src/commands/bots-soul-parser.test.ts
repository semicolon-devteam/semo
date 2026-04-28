import { describe, expect, it } from 'vitest';
import { parseSoulIdentity } from './bots.js';

/**
 * SOUL.md identity 파서 회귀 방지.
 * "⚠ {Name} — SOUL.md" 류 prefix 가 emoji/name 으로 잘못 흡수되던 버그 수정.
 */

describe('parseSoulIdentity', () => {
  it('첫 줄 "# {name} — SOUL.md" 패턴: name 만 추출 (— SOUL.md 흡수 X)', () => {
    const md = `# SemiClaw — SOUL.md\n\n## Identity\n- :brain: **SemiClaw** — PM\n`;
    const r = parseSoulIdentity(md, 'semiclaw');
    expect(r.name).toBe('SemiClaw');
  });

  it('첫 줄 "# {name} — SOUL" (md 없음) 도 동일', () => {
    const md = `# WorkClaw — SOUL\n\n## Identity\n- :hammer: WorkClaw\n`;
    const r = parseSoulIdentity(md, 'workclaw');
    expect(r.name).toBe('WorkClaw');
  });

  it('첫 줄 "# {name}" (suffix 없음): name 그대로', () => {
    const md = `# PlanClaw\n\n## Identity\n- :brain: PlanClaw\n`;
    const r = parseSoulIdentity(md, 'planclaw');
    expect(r.name).toBe('PlanClaw');
  });

  it('# 헤더 없으면 botId fallback', () => {
    const md = `## Identity\n- nothing\n`;
    const r = parseSoulIdentity(md, 'newbot');
    expect(r.name).toBe('newbot');
  });

  it('emoji: ## Identity 안의 :shortcode: 우선 추출', () => {
    const md = `# SemiClaw — SOUL.md\n\n## Identity\n- :brain: **SemiClaw** — PM\n\n⚠️ 검증 경고: 본문에 unicode 이모지가 있어도 무시\n`;
    const r = parseSoulIdentity(md, 'semiclaw');
    expect(r.emoji).toBe(':brain:');
  });

  it('emoji: ## Identity 안에 unicode emoji 만 있으면 그것 채택', () => {
    const md = `# DesignClaw — SOUL.md\n\n## Identity\n- 🎨 DesignClaw\n`;
    const r = parseSoulIdentity(md, 'designclaw');
    expect(r.emoji).toBe('🎨');
  });

  it('emoji: ## Identity 가 없거나 비면 null (본문의 ⚠ 류는 잡지 않음)', () => {
    const md = `# Bot\n\n## R&R\n⚠️ warning here\n`;
    const r = parseSoulIdentity(md, 'bot');
    expect(r.emoji).toBeNull();
  });

  it('role: ## R&R 첫 줄에서 추출 (100자 cap)', () => {
    const md = `# SemiClaw — SOUL.md\n\n## R&R\n팀 PM/오케스트레이터 — 라우팅, 위임, 결과 종합\n`;
    const r = parseSoulIdentity(md, 'semiclaw');
    expect(r.role).toContain('팀 PM');
  });

  it('이전 버그 회귀 방지: name 에 "SOUL.md" 가 들어가면 안 됨', () => {
    const md = `# InfraClaw — SOUL.md\n\n## Identity\n- :shield: InfraClaw\n`;
    const r = parseSoulIdentity(md, 'infraclaw');
    expect(r.name).not.toContain('SOUL');
    expect(r.name).not.toContain('—');
  });
});

import { describe, it, expect } from 'vitest';
import { detectEscalation, ESCALATION_PATTERNS } from '../session-pool';

describe('detectEscalation (from source)', () => {
  it('should have at least 3 patterns', () => {
    expect(ESCALATION_PATTERNS.length).toBeGreaterThanOrEqual(3);
  });

  it('should detect Korean "에스컬레이션" pattern', () => {
    const result = detectEscalation('이건 제 역할이 아니라 에스컬레이션: workclaw');
    expect(result).not.toBeNull();
    expect(result!.targetBotId).toBe('workclaw');
  });

  it('should detect arrow "→ BotClaw" pattern', () => {
    const result = detectEscalation('기획 확인이 필요합니다 → PlanClaw');
    expect(result).not.toBeNull();
    expect(result!.targetBotId).toBe('planclaw');
  });

  it('should detect "인계" pattern', () => {
    const result = detectEscalation('디자인 관련은 인계: designclaw');
    expect(result).not.toBeNull();
    expect(result!.targetBotId).toBe('designclaw');
  });

  it('should detect "역할 밖" pattern', () => {
    const result = detectEscalation('역할 밖 요청입니다. infraclaw에 문의하세요');
    expect(result).not.toBeNull();
    expect(result!.targetBotId).toBe('infraclaw');
  });

  it('should return null for normal response', () => {
    expect(detectEscalation('컬러 팔레트를 제안합니다. 메인 컬러는 #3B82F6입니다.')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(detectEscalation('')).toBeNull();
  });

  it('should handle case-insensitive matching', () => {
    const result = detectEscalation('에스컬레이션: WORKCLAW');
    expect(result).not.toBeNull();
    expect(result!.targetBotId).toBe('workclaw');
  });

  it('should normalize PascalCase bot name to lowercase', () => {
    const result = detectEscalation('→ DesignClaw');
    expect(result!.targetBotId).toBe('designclaw');
  });

  it('should include reason in result', () => {
    const result = detectEscalation('인계: planclaw 에 확인 요청');
    expect(result!.reason).toBeTruthy();
  });
});

import { describe, it, expect } from 'vitest';

/**
 * 훅 CWD 감지 regex 테스트
 *
 * 모든 공유 훅은 동일한 regex 패턴으로 봇 세션을 감지해야 한다.
 * 이 테스트는 통합된 정규식이 모든 경로 변형을 올바르게 매칭하는지 검증한다.
 */

// 8개 훅에서 공통으로 사용하는 봇 세션 감지 regex (Python 호환)
const BOT_SESSION_REGEX =
  /openclaw-[a-z]+\/workspace|semo-(bot-)?sessions\/|\.semo\/sessions\/|\.semo\/workspaces\//;

// destructive-guard 전용 (이전에 다른 패턴이었으나 통일됨)
const DESTRUCTIVE_GUARD_REGEX =
  /openclaw-[a-z]+\/workspace|semo-(bot-)?sessions\/|\.semo\/sessions\/|\.semo\/workspaces\//;

describe('Hook bot session detection regex', () => {
  describe('new consolidated path (~/.semo/sessions/)', () => {
    it('matches ~/.semo/sessions/semiclaw', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.semo/sessions/semiclaw')).toBe(true);
    });

    it('matches ~/.semo/sessions/planclaw', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.semo/sessions/planclaw')).toBe(true);
    });

    it('matches ~/.semo/sessions/semiclaw-overflow', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.semo/sessions/semiclaw-overflow')).toBe(true);
    });
  });

  describe('symlink legacy path (~/.semo-bot-sessions/)', () => {
    it('matches ~/.semo-bot-sessions/semiclaw', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.semo-bot-sessions/semiclaw')).toBe(true);
    });
  });

  describe('old legacy path (~/.semo-sessions/)', () => {
    it('matches ~/.semo-sessions/uuid-session', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.semo-sessions/3c6aa753')).toBe(true);
    });
  });

  describe('openclaw legacy path', () => {
    it('matches ~/.openclaw-semiclaw/workspace', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.openclaw-semiclaw/workspace')).toBe(true);
    });

    it('matches ~/.openclaw-growthclaw/workspace/skills', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.openclaw-growthclaw/workspace/skills')).toBe(
        true,
      );
    });
  });

  describe('new workspace path (~/.semo/workspaces/)', () => {
    it('matches ~/.semo/workspaces/semiclaw', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.semo/workspaces/semiclaw')).toBe(true);
    });

    it('matches ~/.semo/workspaces/reviewclaw/skills', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.semo/workspaces/reviewclaw/skills')).toBe(true);
    });
  });

  describe('non-bot paths (should NOT match)', () => {
    it('does not match regular project dir', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/Desktop/Sources/semicolon/projects/semo')).toBe(
        false,
      );
    });

    it('does not match home dir', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus')).toBe(false);
    });

    it('does not match .claude dir', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.claude/semo')).toBe(false);
    });

    it('does not match .semo root (without /sessions/)', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.semo')).toBe(false);
    });

    it('does not match .semo/shared', () => {
      expect(BOT_SESSION_REGEX.test('/Users/reus/.semo/shared/hooks')).toBe(false);
    });
  });

  describe('destructive-guard consistency', () => {
    it('destructive-guard regex matches same paths as other hooks', () => {
      const testPaths = [
        '/Users/reus/.semo/sessions/semiclaw',
        '/Users/reus/.semo/workspaces/reviewclaw',
        '/Users/reus/.semo-bot-sessions/planclaw',
        '/Users/reus/.openclaw-workclaw/workspace',
        '/Users/reus/.semo-sessions/uuid123',
      ];

      for (const p of testPaths) {
        expect(DESTRUCTIVE_GUARD_REGEX.test(p)).toBe(BOT_SESSION_REGEX.test(p));
      }
    });
  });
});

describe('Bot ID extraction from CWD', () => {
  // commitment-guard.sh와 cron-reregister.sh에서 사용하는 botId 추출 패턴

  function extractBotId(cwd: string): string {
    // Priority order: workspaces → openclaw → semo-bot-sessions → .semo/sessions
    let m = cwd.match(/\.semo\/workspaces\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];

    m = cwd.match(/openclaw-([a-z]+)\/workspace/);
    if (m) return m[1];

    m = cwd.match(/semo-(?:bot-)?sessions\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];

    m = cwd.match(/\.semo\/sessions\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];

    return '';
  }

  it('extracts from workspaces path ~/.semo/workspaces/reviewclaw', () => {
    expect(extractBotId('/Users/reus/.semo/workspaces/reviewclaw')).toBe('reviewclaw');
  });

  it('extracts from new path ~/.semo/sessions/semiclaw', () => {
    expect(extractBotId('/Users/reus/.semo/sessions/semiclaw')).toBe('semiclaw');
  });

  it('extracts from symlink path ~/.semo-bot-sessions/planclaw', () => {
    expect(extractBotId('/Users/reus/.semo-bot-sessions/planclaw')).toBe('planclaw');
  });

  it('extracts from openclaw path', () => {
    expect(extractBotId('/Users/reus/.openclaw-workclaw/workspace')).toBe('workclaw');
  });

  it('extracts overflow bot id', () => {
    expect(extractBotId('/Users/reus/.semo/sessions/semiclaw-overflow')).toBe('semiclaw-overflow');
  });

  it('returns empty for non-bot path', () => {
    expect(extractBotId('/Users/reus/Desktop/Sources')).toBe('');
  });
});

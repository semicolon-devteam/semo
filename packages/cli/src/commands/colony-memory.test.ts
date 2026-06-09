import { describe, expect, it } from 'vitest';
import {
  buildDreamingPrompt,
  buildWindow,
  parseDreamingJson,
  planKbWrites,
  redactSensitiveText,
  type DreamingOutput,
  type SlackCollectedMessage,
} from './colony-memory';

const messages: SlackCollectedMessage[] = [
  {
    channelId: 'C123',
    channelName: 'bot-ops',
    ts: '1780000100.000100',
    threadTs: '1780000100.000100',
    userId: 'U1',
    senderName: 'Mark',
    text: '결정: Colony memory cycle은 3시간 단위로 갑니다. token xoxb-secret-value',
    permalink: 'https://example.slack.com/archives/C123/p1780000100000100',
  },
];

describe('Colony Dreaming Memory Cycle helpers', () => {
  it('buildWindow creates stable 3h windows with overlap-aware oldest timestamp', () => {
    const window = buildWindow(new Date('2026-06-09T12:34:56.000Z'), 3, 10);

    expect(window.windowId).toBe('2026-06-09T09-2026-06-09T12');
    expect(window.fromIso).toBe('2026-06-09T09:34:56.000Z');
    expect(window.toIso).toBe('2026-06-09T12:34:56.000Z');
    expect(window.oldestSlackTs).toBe('1780997096.000000');
  });

  it('redacts Slack/OpenAI/database-like secrets before prompt or KB writes', () => {
    const text =
      'xoxb-1234567890-abcdef sk-proj-abcdefghijklmnopqrstuvwxyz0123456789 postgres://user:pass@example/db';

    expect(redactSensitiveText(text)).toBe(
      '[REDACTED_SLACK_TOKEN] [REDACTED_OPENAI_KEY] postgres://[REDACTED]@example/db',
    );
  });

  it('buildDreamingPrompt preserves source refs and requests strict JSON output', () => {
    const prompt = buildDreamingPrompt({
      window: buildWindow(new Date('2026-06-09T12:00:00.000Z'), 3, 10),
      channel: { id: 'C123', name: 'bot-ops', domain: 'semicolony' },
      messages,
    });

    expect(prompt).toContain('STRICT_JSON_ONLY');
    expect(prompt).toContain('semicolony');
    expect(prompt).toContain('C123');
    expect(prompt).toContain('[REDACTED_SLACK_TOKEN]');
    expect(prompt).toContain('https://example.slack.com/archives/C123/p1780000100000100');
  });

  it('parseDreamingJson accepts fenced JSON and normalizes missing arrays', () => {
    const parsed = parseDreamingJson(`요약\n\`\`\`json
{"summary":"ok","decisions":[{"title":"go","content":"ship","confidence":0.9,"source_refs":["C123:178"]}]}
\`\`\``);

    expect(parsed.summary).toBe('ok');
    expect(parsed.decisions).toHaveLength(1);
    expect(parsed.facts).toEqual([]);
    expect(parsed.action_items).toEqual([]);
  });

  it('planKbWrites creates append-only window, latest projection, and approval-gated candidates', () => {
    const output: DreamingOutput = {
      summary: '3시간 요약',
      facts: [{ title: 'fact', content: 'known', confidence: 0.8, source_refs: ['C123:178'] }],
      decisions: [
        { title: 'decision', content: 'needs approval', confidence: 0.9, source_refs: ['C123:178'] },
      ],
      action_items: [],
      blockers: [],
      open_questions: [],
      relation_candidates: [],
      memory_candidates: [],
    };

    const writes = planKbWrites({
      window: buildWindow(new Date('2026-06-09T12:00:00.000Z'), 3, 10),
      channel: { id: 'C123', name: 'bot-ops', domain: 'semicolony' },
      messages,
      output,
    });

    expect(writes.map((w) => `${w.domain}/${w.key}/${w.subKey}`)).toContain(
      'semicolony/iteration/colony-memory-window-2026-06-09T09-2026-06-09T12-C123',
    );
    expect(writes.map((w) => `${w.domain}/${w.key}/${w.subKey}`)).toContain(
      'semicolony/iteration/colony-context-memory-latest',
    );
    expect(writes.some((w) => w.key === 'memory-candidate' && w.metadata.requires_approval)).toBe(
      true,
    );
  });
});

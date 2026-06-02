import { describe, it, expect } from 'vitest';
import {
  parseApplyCodeTask,
  checkPathsAgainstAllowlist,
  buildCodeAgentPrompt,
  buildOperatorCodeGuide,
  DEFAULT_ALLOWLIST,
  DEFAULT_DENYLIST,
} from './operator-code-task';

describe('parseApplyCodeTask', () => {
  it('APPLY_CODE_TASK 블록을 파싱 (slug/title/rationale/paths/task)', () => {
    const text = [
      '코드로 고쳐야 할 일이라 PR을 올릴게요.',
      'APPLY_CODE_TASK: semi',
      'TITLE: fix(router): inject thread history into orchestrator prompt',
      'RATIONALE: Semi가 이전 대화를 못 봐서 맥락 없는 답을 함',
      'PATHS: packages/slack-router/src/index.ts, packages/slack-router/src/conversation-context.ts',
      '---TASK---',
      'handleOrchestrator에서 promptWithContext에 thread 히스토리를 주입하라.',
      '수용 기준: 기존 테스트 무회귀 + 신규 단위테스트.',
      '---END---',
    ].join('\n');
    const r = parseApplyCodeTask(text);
    expect(r).not.toBeNull();
    expect(r!.slug).toBe('semi');
    expect(r!.title).toBe('fix(router): inject thread history into orchestrator prompt');
    expect(r!.rationale).toBe('Semi가 이전 대화를 못 봐서 맥락 없는 답을 함');
    expect(r!.paths).toEqual([
      'packages/slack-router/src/index.ts',
      'packages/slack-router/src/conversation-context.ts',
    ]);
    expect(r!.task).toContain('handleOrchestrator');
    expect(r!.task).toContain('수용 기준');
  });

  it('블록 없으면 null (단순 제안/대화)', () => {
    expect(parseApplyCodeTask('이건 코드 변경 같은데 PR 올릴까요?')).toBeNull();
  });

  it('task 본문이 비면 null', () => {
    const text = 'APPLY_CODE_TASK: semi\nTITLE: x\n---TASK---\n\n---END---';
    expect(parseApplyCodeTask(text)).toBeNull();
  });

  it('TITLE 없으면 slug 기반 fallback title', () => {
    const text = [
      'APPLY_CODE_TASK: colony',
      '---TASK---',
      '요약 거절 로직을 코드에서 제거하라.',
      '---END---',
    ].join('\n');
    const r = parseApplyCodeTask(text);
    expect(r).not.toBeNull();
    expect(r!.title).toBe('operator: colony code change');
    expect(r!.paths).toEqual([]);
  });
});

describe('checkPathsAgainstAllowlist', () => {
  const allow = ['packages/slack-router/src/**', 'packages/slack-router/personas/**'];
  const deny = ['packages/slack-router/src/operator-code-task.ts', '**/*.sql'];

  it('allow 안 + deny 밖 → ok', () => {
    const r = checkPathsAgainstAllowlist(['packages/slack-router/src/index.ts'], allow, deny);
    expect(r.ok).toBe(true);
    expect(r.offending).toEqual([]);
  });

  it('allow 밖 → 차단', () => {
    const r = checkPathsAgainstAllowlist(['packages/cli/src/commands/cron.ts'], allow, deny);
    expect(r.ok).toBe(false);
    expect(r.offending).toContain('packages/cli/src/commands/cron.ts');
  });

  it('allow와 deny 동시 매치 → deny 우선 차단', () => {
    const r = checkPathsAgainstAllowlist(
      ['packages/slack-router/src/operator-code-task.ts'],
      allow,
      deny,
    );
    expect(r.ok).toBe(false);
    expect(r.offending).toContain('packages/slack-router/src/operator-code-task.ts');
  });

  it('여러 파일 혼합 → offending만 추려냄', () => {
    const r = checkPathsAgainstAllowlist(
      [
        'packages/slack-router/src/index.ts',
        'db/migrations/125_x.sql',
        'packages/slack-router/personas/operator.SOUL.md',
      ],
      allow,
      deny,
    );
    expect(r.ok).toBe(false);
    expect(r.offending).toEqual(['db/migrations/125_x.sql']);
  });

  it('빈 변경 목록 → 차단(빈 PR 방지)', () => {
    const r = checkPathsAgainstAllowlist([], allow, deny);
    expect(r.ok).toBe(false);
  });
});

describe('DEFAULT allow/deny (자기-가드)', () => {
  it('Semi/Colony 행동 코드는 allow', () => {
    const r = checkPathsAgainstAllowlist(
      ['packages/slack-router/src/index.ts'],
      DEFAULT_ALLOWLIST,
      DEFAULT_DENYLIST,
    );
    expect(r.ok).toBe(true);
  });

  it('자기-가드 파일(dispatch/워크플로)·마이그레이션은 deny', () => {
    for (const f of [
      'packages/slack-router/src/operator-code-dispatch.ts',
      'packages/slack-router/src/operator-code-task.ts',
      '.github/workflows/operator-auto-merge.yml',
      'packages/semo-dashboard/migrations/125_agent_code_tasks.sql',
    ]) {
      const r = checkPathsAgainstAllowlist([f], DEFAULT_ALLOWLIST, DEFAULT_DENYLIST);
      expect(r.ok, `${f} should be denied`).toBe(false);
    }
  });
});

describe('buildCodeAgentPrompt', () => {
  it('task 본문 + allowlist 경계 + Quality Gate를 포함', () => {
    const task = {
      slug: 'semi',
      title: 'fix: x',
      rationale: 'because',
      paths: ['packages/slack-router/src/index.ts'],
      task: 'handleOrchestrator에 히스토리 주입',
    };
    const prompt = buildCodeAgentPrompt(task, {
      allowlist: DEFAULT_ALLOWLIST,
      qualityGate: 'npm run lint && npx tsc --noEmit',
    });
    expect(prompt).toContain('handleOrchestrator에 히스토리 주입');
    expect(prompt).toContain('packages/slack-router/src/index.ts');
    expect(prompt.toLowerCase()).toContain('lint');
  });
});

describe('buildOperatorCodeGuide', () => {
  it('APPLY_CODE_TASK 사용법을 안내', () => {
    const guide = buildOperatorCodeGuide();
    expect(guide).toContain('APPLY_CODE_TASK');
  });
});

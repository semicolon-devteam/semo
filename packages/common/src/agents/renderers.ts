import * as path from 'node:path';
import type { AgentRenderer, AgentSpec, RenderContext, RenderedAgentArtifact } from './types.js';

const DEFAULT_SESSION_DIR = '~/.semo/sessions';
const DEFAULT_MAILBOX_DIR = '~/.semo/mailbox';
const DEFAULT_CODEX_SKILLS_DIR = '~/.codex/skills';
const DEFAULT_OPENCLAW_HOME_DIR = '~';

function lines(items: Array<string | false | null | undefined>): string {
  return items.filter((v): v is string => typeof v === 'string' && v.length > 0).join('\n');
}

function bulletList(items: string[], fallback = '- (none)'): string {
  if (items.length === 0) return fallback;
  return items.map((item) => `- ${item}`).join('\n');
}

function delegationBlock(spec: AgentSpec): string {
  if (spec.delegations.length === 0) {
    return spec.profile === 'personal'
      ? '- No delegation configured for Personal profile.'
      : '- 위임 규칙 없음. 애매하면 orchestration role로 에스컬레이션.';
  }
  return spec.delegations
    .map((d) => {
      const domains = d.domains.length > 0 ? d.domains.join(', ') : 'general';
      const via = d.method ? ` via ${d.method}` : '';
      return `- ${d.toBotId}: ${domains}${via}`;
    })
    .join('\n');
}

function legacyTeamClaudeMd(spec: AgentSpec, mailboxDir: string): string {
  const sourceBotId = spec.derivedFrom ?? spec.botId;
  const soulPrompt = spec.personaPrompt.split('\n').slice(0, 60).join('\n');
  const title =
    spec.derivedFrom && spec.derivedFrom !== spec.botId
      ? `# SEMO Bot Session — ${spec.botId}\n\n> Overflow session for ${spec.derivedFrom}. Same persona, separate mailbox.`
      : `# SEMO Bot Session — ${spec.botId}`;

  const commandBlock =
    sourceBotId === 'semiclaw'
      ? `**너는 SEMO Agents 총사령관이다.** 직접 처리하거나 적합한 에이전트에 위임한다.

### 위임 판단 (NON-NEGOTIABLE)
1. \`semo kb ontology --action list --type agents\` 으로 활성 에이전트 목록 동적 조회
2. 각 에이전트의 \`semo kb get {에이전트도메인} delegation\` 조회
3. 메시지 내용과 수신 키워드 대조 → 매칭 시 \`escalate(target, reason, context)\`
4. 비매칭 → 직접 처리
- 내 담당: \`semo kb get semiclaw delegation\`
- 에이전트 상태: \`cat ~/.semo/mailbox/{botId}/heartbeat\``
      : `- **semiclaw는 오케스트레이터/총사령관**이다. 판단 불가 상황은 semiclaw에 escalate.
- 전문 영역 밖 요청 → \`escalate("semiclaw", reason, context)\`
- 내 정체성: \`semo kb get ${sourceBotId} identity\`
- 내 담당: \`semo kb get ${sourceBotId} delegation\``;

  return `${title}

> Architecture B: Mailbox-based multi-session agent.
> Bot: ${sourceBotId} (${spec.role})
> Mailbox: ${mailboxDir}/${spec.botId}/

${soulPrompt}

---

## Mailbox Protocol (NON-NEGOTIABLE)

1. **On startup**: call \`check_inbox\` immediately.
2. Every inbox message MUST produce exactly one \`reply()\` or \`escalate()\` call.
3. If \`check_inbox\` returns null (empty), wait ~10 seconds then call \`check_inbox\` again.
4. For long tasks, call \`update_status()\` periodically ("KB 조회 중...", "분석 중...").
5. Skipping \`reply()\` permanently blocks the Slack thread — never skip.
6. Always pass \`bot_id="${sourceBotId}"\` in reply/ask_user calls.

## 지휘 체계

${commandBlock}

## KB Rules (NON-NEGOTIABLE)

- 서비스/프로젝트 정보는 반드시 \`semo kb search\` 또는 \`semo kb get\`으로 먼저 조회
- KB에 없으면 "KB에 해당 정보가 없습니다"로 응답. 추측 금지.
- 서비스 구조화 메타: \`semo service get {domain}\`

## Response Rules

- 결과만 보고 — 중간 과정 로그 불필요
- 한국어 기본, 사용자 언어에 맞춤
- KB 인용 시 [답변근거: KB {domain} {key}] 출처 표기

## Delegation Rules (NON-NEGOTIABLE)

매 user message 처리 시 다음 절차 강제:

1. **자기 수신 키워드 확인**: \`semo kb get ${sourceBotId} delegation\` — 본인 영역 명확화
2. **메시지 키워드 매칭**: 다른 봇 키워드 (workclaw=구현/코딩/PR/버그수정, planclaw=기획/스펙, designclaw=디자인/UI, reviewclaw=리뷰/QA, infraclaw=인프라/배포, growthclaw=SEO/KPI) 에 매칭되고 자기 영역 아니면 **즉시 escalate("{matching-bot}", reason, context)** 호출 — 직접 처리 금지
3. **[DELEGATION-CHECK] hint 존중**: UserPromptSubmit hook 이 [DELEGATION-CHECK] 메시지 inject 하면 권유된 봇으로 escalate 우선
4. **직접 처리 예외**: 자기 영역인데 직접 처리할 경우 응답 첫 줄에 \`[직접 처리 사유: ...]\` 명시

⚠️ 위반 사례: KB \`incident/semiclaw-delegation-violation-butler-fix-2026-05-14\` — SemiClaw 가 workclaw 키워드 (버그 수정/PR) 직접 처리하다 sandbox 차단. 재발 금지.
`;
}

function jsonArtifact(
  target: RenderedAgentArtifact['target'],
  artifactPath: string,
  value: unknown,
): RenderedAgentArtifact {
  return {
    target,
    path: artifactPath,
    format: 'json',
    content: JSON.stringify(value, null, 2) + '\n',
  };
}

function markdownArtifact(
  target: RenderedAgentArtifact['target'],
  artifactPath: string,
  content: string,
): RenderedAgentArtifact {
  return { target, path: artifactPath, format: 'markdown', content };
}

export class ClaudeCodeAgentRenderer implements AgentRenderer {
  readonly target = 'claude-code' as const;

  render(spec: AgentSpec, context: RenderContext = {}): RenderedAgentArtifact[] {
    const profile = context.profile ?? spec.profile;
    const sessionDir = context.sessionDir ?? DEFAULT_SESSION_DIR;
    const mailboxDir = context.mailboxDir ?? DEFAULT_MAILBOX_DIR;
    const semoRoot = context.semoRoot ?? '.';
    const base = path.join(sessionDir, spec.botId);
    const usesMailbox = profile === 'team';
    const flushBotId = spec.replyAs ?? spec.botId;

    const claudeMd = usesMailbox
      ? legacyTeamClaudeMd(spec, mailboxDir)
      : lines([
          `# SEMO Bot Session - ${spec.botId}`,
          '',
          `> Bot: ${spec.displayName} (${spec.role})`,
          '> Runtime: local-cli / personal',
          '',
          spec.personaPrompt,
          '',
          '---',
          '',
          '## Local Runtime Protocol',
          '',
          '1. Read the user request and local SEMO profile before acting.',
          '2. Use local KB/profile tools when available; otherwise state missing context.',
          '3. Keep outputs local unless the user explicitly requests external publication.',
          '',
          '## KB Scope',
          '',
          bulletList(spec.kbDomains),
          '',
          '## Delegation Matrix',
          '',
          delegationBlock(spec),
        ]);

    const settings = {
      permissions: {
        defaultMode: spec.toolPolicy.permissionMode === 'bypass' ? 'bypassPermissions' : 'default',
        allow: [
          ...spec.toolPolicy.tools.map((tool) => `${tool}(*)`),
          ...(usesMailbox
            ? [
                'mcp__semo_agent_mailbox__check_inbox',
                'mcp__semo_agent_mailbox__reply',
                'mcp__semo_agent_mailbox__escalate',
                'mcp__semo_agent_mailbox__update_status',
                'mcp__semo_agent_mailbox__ask_user',
                'mcp__semo_agent_mailbox__react',
              ]
            : []),
        ],
      },
      hooks: {
        // UserPromptSubmit — delegation-check (KB delegation 룰 위반 시 escalate 안내)
        UserPromptSubmit: [
          {
            matcher: '',
            hooks: [
              {
                type: 'command',
                command: '/usr/local/bin/semo guard run delegation-check',
                timeout: 4000,
              },
            ],
          },
        ],
        // PreToolUse 는 mailbox 사용 여부 무관 모든 봇에 적용 (destructive/skill-mirror/freeze)
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [
              {
                type: 'command',
                command: '/usr/local/bin/semo guard run destructive',
                timeout: 3000,
              },
            ],
          },
          {
            matcher: 'Edit|Write',
            hooks: [
              {
                type: 'command',
                command: '/usr/local/bin/semo guard run skill-mirror',
                timeout: 3000,
              },
              {
                type: 'command',
                command: '/usr/local/bin/semo guard run freeze',
                timeout: 3000,
              },
            ],
          },
        ],
        ...(usesMailbox
          ? {
              SessionStart: [
                {
                  matcher: '',
                  hooks: [
                    {
                      type: 'command',
                      command:
                        'source ~/.claude/semo/.env 2>/dev/null; echo "[mailbox] Session started"',
                      timeout: 5000,
                    },
                  ],
                },
              ],
              Stop: [
                {
                  matcher: '',
                  hooks: [
                    {
                      type: 'command',
                      command: `source ~/.claude/semo/.env 2>/dev/null; npx semo agent-flush --bot ${flushBotId} 2>/dev/null || true`,
                      timeout: 5000,
                    },
                  ],
                },
              ],
            }
          : {}),
      },
    };

    const mcp = usesMailbox
      ? {
          mcpServers: {
            'semo-agent-mailbox': {
              command: 'npx',
              args: ['tsx', path.join(semoRoot, 'packages', 'agent-mailbox', 'src', 'index.ts')],
              env: {
                SEMO_BOT_ID: spec.botId,
                ...(spec.replyAs ? { SEMO_REPLY_AS: spec.replyAs } : {}),
                SEMO_MAILBOX_DIR: mailboxDir,
              },
            },
            ...(spec.botId === 'designclaw'
              ? {
                  stitch: {
                    command: 'npx',
                    args: ['@_davideast/stitch-mcp', 'proxy'],
                    env: {
                      STITCH_API_KEY: '${STITCH_API_KEY}',
                    },
                  },
                }
              : {}),
          },
        }
      : { mcpServers: {} };

    return [
      markdownArtifact(
        this.target,
        path.join(base, '.claude', 'CLAUDE.md'),
        usesMailbox ? claudeMd : claudeMd + '\n',
      ),
      jsonArtifact(this.target, path.join(base, '.claude', 'settings.json'), settings),
      jsonArtifact(this.target, path.join(base, '.mcp.json'), mcp),
    ];
  }
}

export class CodexSkillAgentRenderer implements AgentRenderer {
  readonly target = 'codex-skill' as const;

  render(spec: AgentSpec, context: RenderContext = {}): RenderedAgentArtifact[] {
    const skillsDir = context.codexSkillsDir ?? DEFAULT_CODEX_SKILLS_DIR;
    const skillName = `semo-agent-${spec.botId}`;
    const content = lines([
      '---',
      `name: ${skillName}`,
      `description: Use when Codex should reason or delegate as SEMO Agent ${spec.displayName} (${spec.botId}).`,
      '---',
      '',
      `# ${spec.displayName} (${spec.botId})`,
      '',
      `Role: ${spec.role}`,
      spec.emoji ? `Emoji: ${spec.emoji}` : null,
      '',
      '## Persona',
      '',
      spec.personaPrompt,
      '',
      '## KB Scope',
      '',
      bulletList(spec.kbDomains),
      '',
      '## Delegation',
      '',
      delegationBlock(spec),
      '',
      '## Codex Runtime Contract',
      '',
      '- Read SEMO KB/source-of-truth before relying on team state.',
      '- Prefer durable artifacts for delegation: GitHub issue, SEMO action item, or commitment.',
      '- Do not assume Claude Code mailbox or cmux is available in Codex.',
      '- Report target agent, artifact/channel, and tracking reference after delegation.',
    ]);

    return [
      markdownArtifact(this.target, path.join(skillsDir, skillName, 'SKILL.md'), content + '\n'),
    ];
  }
}

export class OpenClawAgentRenderer implements AgentRenderer {
  readonly target = 'openclaw' as const;

  render(spec: AgentSpec, context: RenderContext = {}): RenderedAgentArtifact[] {
    const home = context.openclawHomeDir ?? DEFAULT_OPENCLAW_HOME_DIR;
    const openclawRoot = path.join(home, `.openclaw-${spec.botId}`);
    const agentDefaults = {
      model: {
        primary: spec.modelPolicy.primary,
        fallbacks: spec.modelPolicy.fallbacks,
      },
      models: {
        [spec.modelPolicy.primary]: { alias: 'codex' },
      },
    };
    const configPatch = {
      agents: {
        defaults: agentDefaults,
      },
      channels: {
        slack: {
          replyToMode: 'all',
        },
      },
    };
    const agentSpecMeta = {
      semo: {
        agentSpecVersion: 1,
        botId: spec.botId,
        displayName: spec.displayName,
        forbiddenProviders: spec.modelPolicy.forbiddenProviders ?? [],
      },
    };

    return [
      jsonArtifact(
        this.target,
        path.join(openclawRoot, 'openclaw.agent-spec.patch.json'),
        configPatch,
      ),
      jsonArtifact(this.target, path.join(openclawRoot, 'agent-spec.meta.json'), agentSpecMeta),
    ];
  }
}

export const DEFAULT_AGENT_RENDERERS: AgentRenderer[] = [
  new ClaudeCodeAgentRenderer(),
  new CodexSkillAgentRenderer(),
  new OpenClawAgentRenderer(),
];

export function renderAgentSpec(
  spec: AgentSpec,
  targets: ReadonlyArray<AgentRenderer['target']>,
  context?: RenderContext,
): RenderedAgentArtifact[] {
  const wanted = new Set(targets);
  const skipped = new Set(spec.skipProjectionTargets ?? []);
  return DEFAULT_AGENT_RENDERERS.filter(
    (r) => wanted.has(r.target) && !skipped.has(r.target),
  ).flatMap((r) => r.render(spec, context));
}

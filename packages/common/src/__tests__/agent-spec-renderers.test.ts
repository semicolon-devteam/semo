import { describe, expect, it } from 'vitest';
import { buildAgentSpec, renderAgentSpec, stripMarkdownFrontmatter } from '../agents/index.js';

const REVIEW_AGENT = `---
name: reviewclaw
description: "코드 리뷰/QA 전담 에이전트"
tools:
  - Read
  - Grep
  - Bash
---
# ReviewClaw

리뷰어 persona 본문.
`;

describe('AgentSpec + renderers', () => {
  it('frontmatter를 제거하고 body를 AgentSpec personaPrompt로 정규화한다', () => {
    const parsed = stripMarkdownFrontmatter(REVIEW_AGENT);
    expect(parsed.frontmatter.name).toBe('reviewclaw');
    expect(parsed.frontmatter.tools).toEqual(['Read', 'Grep', 'Bash']);
    expect(parsed.body).toContain('리뷰어 persona 본문');
  });

  it('legacy agent_definitions + bot_status + delegation row를 portable AgentSpec으로 만든다', () => {
    const spec = buildAgentSpec({
      agent: { name: 'reviewclaw', content: REVIEW_AGENT },
      botStatus: {
        bot_id: 'reviewclaw',
        name: 'ReviewClaw',
        emoji: ':mag:',
        role: '코드 리뷰/QA',
        kb_domains: ['semicolon'],
      },
      delegations: [
        {
          from_bot_id: 'reviewclaw',
          to_bot_id: 'workclaw',
          domains: ['implementation'],
          method: 'github',
          priority: 10,
        },
      ],
    });

    expect(spec.botId).toBe('reviewclaw');
    expect(spec.displayName).toBe('ReviewClaw');
    expect(spec.toolPolicy.tools).toEqual(['Read', 'Grep', 'Bash']);
    expect(spec.toolPolicy.permissionMode).toBe('bypass');
    expect(spec.modelPolicy.primary).toBe('openai-codex/gpt-5.5');
    expect(spec.modelPolicy.fallbacks).toEqual([]);
    expect(spec.delegations[0]).toMatchObject({
      toBotId: 'workclaw',
      domains: ['implementation'],
      method: 'github',
    });
  });

  it('team profile은 legacy unattended automation 권한과 기본 tool set을 보존한다', () => {
    const spec = buildAgentSpec({
      agent: { name: 'semiclaw', content: '# SemiClaw\n\n본문만 있는 legacy row.' },
      botStatus: {
        bot_id: 'semiclaw',
        name: 'SemiClaw',
        role: '오케스트레이터',
      },
    });

    expect(spec.toolPolicy).toMatchObject({
      permissionMode: 'bypass',
      tools: ['Read', 'Glob', 'Grep', 'Bash', 'Edit', 'Write', 'WebFetch'],
    });

    const settings = JSON.parse(
      renderAgentSpec(spec, ['claude-code'], {
        semoRoot: '/repo/semo',
        sessionDir: '/sessions',
        mailboxDir: '/mailbox',
      }).find((artifact) => artifact.path.endsWith('settings.json'))?.content ?? '{}',
    );
    expect(settings.permissions.defaultMode).toBe('bypassPermissions');
    expect(settings.permissions.allow).toEqual(
      expect.arrayContaining(['Edit(*)', 'Write(*)', 'WebFetch(*)']),
    );
    expect(settings.hooks.SessionStart[0].hooks[0].command).toContain('[mailbox] Session started');
  });

  it('DesignClaw ClaudeCode renderer는 legacy Stitch MCP를 보존한다', () => {
    const spec = buildAgentSpec({
      agent: { name: 'designclaw', content: REVIEW_AGENT },
      botStatus: {
        bot_id: 'designclaw',
        name: 'DesignClaw',
        role: '디자인',
      },
    });

    const mcp = JSON.parse(
      renderAgentSpec(spec, ['claude-code'], {
        semoRoot: '/repo/semo',
        sessionDir: '/sessions',
        mailboxDir: '/mailbox',
      }).find((artifact) => artifact.path.endsWith('.mcp.json'))?.content ?? '{}',
    );

    expect(mcp.mcpServers.stitch).toMatchObject({
      command: 'npx',
      args: ['@_davideast/stitch-mcp', 'proxy'],
      env: { STITCH_API_KEY: '${STITCH_API_KEY}' },
    });
  });

  it('skipProjectionTargets가 지정된 helper는 해당 runtime artifact를 렌더하지 않는다', () => {
    const spec = buildAgentSpec({
      agent: { name: 'kb-sidekick', content: REVIEW_AGENT },
      botStatus: {
        bot_id: 'kb-sidekick',
        name: 'KB Sidekick',
        role: 'KB helper',
        is_helper: true,
        skip_projection_targets: ['openclaw'],
      },
    });

    expect(spec.isHelper).toBe(true);
    expect(spec.skipProjectionTargets).toEqual(['openclaw']);
    expect(
      renderAgentSpec(spec, ['claude-code', 'openclaw'], {
        semoRoot: '/repo/semo',
        sessionDir: '/sessions',
        openclawHomeDir: '/home/reus',
      }).map((artifact) => artifact.target),
    ).toEqual(['claude-code', 'claude-code', 'claude-code']);
  });

  it('overflow/helper 봇의 derivedFrom/replyAs는 bot_status SoT를 우선한다', () => {
    const spec = buildAgentSpec({
      agent: {
        name: 'semiclaw-overflow',
        content: REVIEW_AGENT,
        metadata: { derived_from: 'legacy-semiclaw', reply_as: 'legacy-semiclaw' },
      },
      botStatus: {
        bot_id: 'semiclaw-overflow',
        name: 'SemiClaw Overflow',
        role: 'SemiClaw overflow worker',
        kb_domains: ['semo'],
        derived_from: 'semiclaw',
        reply_as: 'semiclaw',
      },
    });

    expect(spec.derivedFrom).toBe('semiclaw');
    expect(spec.replyAs).toBe('semiclaw');

    const mcp = renderAgentSpec(spec, ['claude-code'], {
      semoRoot: '/repo/semo',
      sessionDir: '/sessions',
      mailboxDir: '/mailbox',
    }).find((artifact) => artifact.path.endsWith('.mcp.json'));
    expect(JSON.parse(mcp?.content ?? '{}').mcpServers['semo-agent-mailbox'].env).toMatchObject({
      SEMO_BOT_ID: 'semiclaw-overflow',
      SEMO_REPLY_AS: 'semiclaw',
    });

    const settings = renderAgentSpec(spec, ['claude-code'], {
      semoRoot: '/repo/semo',
      sessionDir: '/sessions',
      mailboxDir: '/mailbox',
    }).find((artifact) => artifact.path.endsWith('settings.json'));
    expect(JSON.parse(settings?.content ?? '{}').hooks.Stop[0].hooks[0].command).toContain(
      '--bot semiclaw',
    );
  });

  it('ClaudeCode, Codex skill, OpenClaw artifacts를 같은 AgentSpec에서 렌더링한다', () => {
    const spec = buildAgentSpec({
      agent: { name: 'reviewclaw', content: REVIEW_AGENT },
      botStatus: {
        bot_id: 'reviewclaw',
        name: 'ReviewClaw',
        role: '코드 리뷰/QA',
        kb_domains: ['semicolon'],
      },
    });

    const artifacts = renderAgentSpec(spec, ['claude-code', 'codex-skill', 'openclaw'], {
      semoRoot: '/repo/semo',
      sessionDir: '/sessions',
      mailboxDir: '/mailbox',
      codexSkillsDir: '/codex/skills',
      openclawHomeDir: '/home/reus',
    });

    expect(artifacts.map((a) => a.path)).toEqual([
      '/sessions/reviewclaw/.claude/CLAUDE.md',
      '/sessions/reviewclaw/.claude/settings.json',
      '/sessions/reviewclaw/.mcp.json',
      '/codex/skills/semo-agent-reviewclaw/SKILL.md',
      '/home/reus/.openclaw-reviewclaw/openclaw.agent-spec.patch.json',
      '/home/reus/.openclaw-reviewclaw/agent-spec.meta.json',
    ]);

    const codexSkill = artifacts.find((a) => a.target === 'codex-skill');
    expect(codexSkill?.content).toContain('Do not assume Claude Code mailbox or cmux');

    const openclawPatch = artifacts.find((a) => a.target === 'openclaw');
    expect(JSON.parse(openclawPatch?.content ?? '{}').agents.defaults.model).toEqual({
      primary: 'openai-codex/gpt-5.5',
      fallbacks: [],
    });
    expect(JSON.parse(openclawPatch?.content ?? '{}')).not.toHaveProperty('semo');
    const openclawMeta = artifacts.find((a) => a.path.endsWith('agent-spec.meta.json'));
    expect(JSON.parse(openclawMeta?.content ?? '{}').semo).toMatchObject({
      agentSpecVersion: 1,
      botId: 'reviewclaw',
      displayName: 'ReviewClaw',
    });
  });

  it('personal profile은 Ollama/local 기본값이며 Claude mailbox MCP를 강제하지 않는다', () => {
    const spec = buildAgentSpec({
      profile: 'personal',
      agent: { name: 'personal-assistant', content: REVIEW_AGENT },
      botStatus: {
        bot_id: 'personal-assistant',
        name: 'Personal Assistant',
        role: '개인 로컬 어시스턴트',
        kb_domains: ['me'],
      },
    });

    expect(spec.modelPolicy).toMatchObject({
      primary: 'ollama/llama3.1',
      forbiddenProviders: [],
    });
    expect(spec.projectionTargets).toEqual(['local-cli']);

    const artifacts = renderAgentSpec(spec, ['claude-code'], {
      profile: 'personal',
      sessionDir: '/sessions',
    });
    const settings = JSON.parse(
      artifacts.find((a) => a.path.endsWith('settings.json'))?.content ?? '{}',
    );
    const mcp = JSON.parse(artifacts.find((a) => a.path.endsWith('.mcp.json'))?.content ?? '{}');
    expect(settings.permissions.allow).not.toContain('mcp__semo_agent_mailbox__check_inbox');
    expect(settings.permissions.defaultMode).toBe('default');
    expect(mcp.mcpServers).toEqual({});
  });
});

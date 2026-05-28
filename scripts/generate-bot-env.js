#!/usr/bin/env node
/**
 * generate-bot-env.js — Architecture B 봇 세션 환경 생성기
 *
 * 에이전트 정의(~/.claude/agents/{botId}/{botId}.md)를 읽어
 * 봇별 CLAUDE.md, settings.json, .mcp.json을 생성한다.
 *
 * Usage:
 *   node scripts/generate-bot-env.js --all
 *   node scripts/generate-bot-env.js --bot semiclaw
 *   node scripts/generate-bot-env.js --bot semiclaw --dry-run
 *   node scripts/generate-bot-env.js --all --renderer agent-spec --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const FALLBACK_BOT_IDS = [
  'semiclaw',
  'planclaw',
  'designclaw',
  'workclaw',
  'reviewclaw',
  'infraclaw',
  'growthclaw',
];

/** KB에서 agents 타입 도메인 목록을 동적 조회 */
function loadAgentIds() {
  try {
    const out = execSync(
      `source ~/.claude/semo/.env 2>/dev/null; node -e "
        const {Pool}=require('pg');
        const p=new Pool({connectionString:process.env.DATABASE_URL});
        p.query(\\"SELECT domain FROM semo.ontology WHERE entity_type='agents' ORDER BY domain\\")
          .then(r=>{console.log(JSON.stringify(r.rows.map(r=>r.domain)));p.end()})
          .catch(()=>{console.log('[]');p.end()});
      "`,
      { encoding: 'utf8', shell: '/bin/bash', timeout: 10_000 },
    );
    const ids = JSON.parse(out.trim());
    if (ids.length > 0) {
      console.log(`[KB] ${ids.length}개 에이전트 로드: ${ids.join(', ')}`);
      return ids;
    }
  } catch {
    // DB 조회 실패 — fallback
  }
  console.log(`[fallback] DB 조회 실패 — 기본 ${FALLBACK_BOT_IDS.length}개 사용`);
  return FALLBACK_BOT_IDS;
}

const BOT_IDS = loadAgentIds();

/** Overflow sessions: derived from a primary bot, separate mailbox, same persona */
const OVERFLOW_BOTS = [{ id: 'semiclaw-overflow', primaryId: 'semiclaw' }];

const AGENTS_DIR = path.join(os.homedir(), '.claude', 'agents');
const SEMO_ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_SESSION_DIR = path.join(os.homedir(), '.semo', 'sessions');
const DEFAULT_MAILBOX_DIR = path.join(os.homedir(), '.semo', 'mailbox');

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

// ── CLI args ──

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const allBots = args.includes('--all');
const botIdx = args.indexOf('--bot');
const targetBot = botIdx >= 0 ? args[botIdx + 1] : null;
const rendererIdx = args.indexOf('--renderer');
const renderer = rendererIdx >= 0 ? args[rendererIdx + 1] : 'legacy';
const sessionDir = (() => {
  const idx = args.indexOf('--session-dir');
  return idx >= 0 ? args[idx + 1] : DEFAULT_SESSION_DIR;
})();
const mailboxDir = (() => {
  const idx = args.indexOf('--mailbox-dir');
  return idx >= 0 ? args[idx + 1] : DEFAULT_MAILBOX_DIR;
})();

const bots = allBots ? BOT_IDS : targetBot ? [targetBot] : [];
if (bots.length === 0) {
  console.error(
    'Usage: node scripts/generate-bot-env.js --all | --bot <botId> [--dry-run] [--renderer legacy|agent-spec]',
  );
  process.exit(1);
}

if (renderer === 'agent-spec') {
  const ids = bots.join(',');
  const cliArgs = [
    path.join(SEMO_ROOT, 'packages', 'cli', 'src', 'index.ts'),
    'agent-factory',
    'sync',
    '--ids',
    ids,
    '--targets',
    'claude-code',
    '--semo-root',
    SEMO_ROOT,
    '--session-dir',
    sessionDir,
    '--mailbox-dir',
    mailboxDir,
    ...(dryRun ? ['--dry-run'] : []),
    ...(force ? ['--force'] : []),
  ];
  const cmd = [
    'set -a',
    'source ~/.claude/semo/.env 2>/dev/null || true',
    'set +a',
    `npx tsx ${cliArgs.map(shellQuote).join(' ')}`,
  ].join('; ');
  console.log(`[agent-spec] Delegating generation to AgentSpec renderer (${ids})`);
  execSync(cmd, { stdio: 'inherit', shell: '/bin/bash' });
  process.exit(0);
}

if (renderer !== 'legacy') {
  console.error(`Unknown renderer: ${renderer} (expected legacy|agent-spec)`);
  process.exit(1);
}

// ── Frontmatter parser ──

function parseAgentDef(botId) {
  const filePath = path.join(AGENTS_DIR, botId, `${botId}.md`);
  if (!fs.existsSync(filePath)) {
    console.error(`[WARN] Agent definition not found: ${filePath}`);
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  // Simple YAML-like parsing (no dependency needed)
  const meta = {};
  let currentKey = null;
  let arrayItems = [];

  for (const line of frontmatter.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (line.startsWith('  - ')) {
      // Array item
      arrayItems.push(trimmed.slice(2).replace(/^["']|["']$/g, ''));
    } else {
      // Save previous array
      if (currentKey && arrayItems.length > 0) {
        meta[currentKey] = arrayItems;
        arrayItems = [];
      }

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed
          .slice(colonIdx + 1)
          .trim()
          .replace(/^["']|["']$/g, '');
        currentKey = key;
        if (value) {
          meta[key] = value;
        }
      }
    }
  }
  // Save last array
  if (currentKey && arrayItems.length > 0) {
    meta[currentKey] = arrayItems;
  }

  return { meta, body };
}

// ── CLAUDE.md Generator ──

function generateClaudeMd(botId, meta, body) {
  const description = meta.description || botId;
  // Take first 60 lines of body as soul prompt (avoid bloating CLAUDE.md)
  const soulLines = body.split('\n').slice(0, 60);
  const soulPrompt = soulLines.join('\n');

  const otherBots = BOT_IDS.filter((b) => b !== botId).join(', ');

  return `# SEMO Bot Session — ${botId}

> Architecture B: Mailbox-based multi-session agent.
> Bot: ${botId} (${description})
> Mailbox: ${mailboxDir}/${botId}/

${soulPrompt}

---

## Mailbox Protocol (NON-NEGOTIABLE)

1. **On startup**: call \`check_inbox\` immediately.
2. Every inbox message MUST produce exactly one \`reply()\` or \`escalate()\` call.
3. If \`check_inbox\` returns null (empty), wait ~10 seconds then call \`check_inbox\` again.
4. For long tasks, call \`update_status()\` periodically ("KB 조회 중...", "분석 중...").
5. Skipping \`reply()\` permanently blocks the Slack thread — never skip.
6. Always pass \`bot_id="${botId}"\` in reply/ask_user calls.

## 지휘 체계

${
  botId === 'semiclaw'
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
- 내 정체성: \`semo kb get ${botId} identity\`
- 내 담당: \`semo kb get ${botId} delegation\``
}

## KB Rules (NON-NEGOTIABLE)

- 서비스/프로젝트 정보는 반드시 \`semo kb search\` 또는 \`semo kb get\`으로 먼저 조회
- KB에 없으면 "KB에 해당 정보가 없습니다"로 응답. 추측 금지.
- 서비스 구조화 메타: \`semo kb get {domain} pipeline config\`

## Response Rules

- 결과만 보고 — 중간 과정 로그 불필요
- 한국어 기본, 사용자 언어에 맞춤
- KB 인용 시 [답변근거: KB {domain} {key}] 출처 표기

## Delegation Rules (NON-NEGOTIABLE)

매 user message 처리 시 다음 절차 강제:

1. **자기 수신 키워드 확인**: \`semo kb get ${botId} delegation\` — 본인 영역 명확화
2. **메시지 키워드 매칭**: 다른 봇 키워드 (workclaw=구현/코딩/PR/버그수정, planclaw=기획/스펙, designclaw=디자인/UI, reviewclaw=리뷰/QA, infraclaw=인프라/배포, growthclaw=SEO/KPI) 에 매칭되고 자기 영역 아니면 **즉시 escalate("{matching-bot}", reason, context)** 호출 — 직접 처리 금지
3. **[DELEGATION-CHECK] hint 존중**: UserPromptSubmit hook 이 [DELEGATION-CHECK] 메시지 inject 하면 권유된 봇으로 escalate 우선
4. **직접 처리 예외**: 자기 영역인데 직접 처리할 경우 응답 첫 줄에 \`[직접 처리 사유: ...]\` 명시

⚠️ 위반 사례: KB \`incident/semiclaw-delegation-violation-butler-fix-2026-05-14\` — SemiClaw 가 workclaw 키워드 (버그 수정/PR) 직접 처리하다 sandbox 차단. 재발 금지.
`;
}

// ── settings.json Generator ──

function generateSettings(botId, meta) {
  const tools = Array.isArray(meta.tools) ? meta.tools : ['Read', 'Glob', 'Grep', 'Bash'];

  // Map Claude Code tool names to permission patterns
  const toolPermissions = tools.map((t) => {
    if (t === 'Bash') return 'Bash(*)';
    if (t === 'Read' || t === 'Write' || t === 'Edit' || t === 'Glob' || t === 'Grep')
      return `${t}(*)`;
    if (t === 'WebFetch') return 'WebFetch(*)';
    return `${t}(*)`;
  });

  return {
    permissions: {
      defaultMode: 'bypassPermissions',
      allow: [
        ...toolPermissions,
        'mcp__semo_agent_mailbox__check_inbox',
        'mcp__semo_agent_mailbox__reply',
        'mcp__semo_agent_mailbox__escalate',
        'mcp__semo_agent_mailbox__update_status',
        'mcp__semo_agent_mailbox__ask_user',
        'mcp__semo_agent_mailbox__react',
      ],
    },
    hooks: {
      SessionStart: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: 'source ~/.claude/semo/.env 2>/dev/null; echo "[mailbox] Session started"',
              timeout: 5000,
            },
          ],
        },
      ],
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
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: '/usr/local/bin/semo guard run destructive',
              timeout: 3000,
            },
            {
              type: 'command',
              command: '/usr/local/bin/semo guard run data-routing',
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
            {
              type: 'command',
              command: '/usr/local/bin/semo guard run data-routing',
              timeout: 3000,
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
              command: `source ~/.claude/semo/.env 2>/dev/null; npx semo agent-flush --bot ${botId} 2>/dev/null || true`,
              timeout: 5000,
            },
          ],
        },
      ],
    },
  };
}

// ── .mcp.json Generator ──

function generateMcpJson(botId) {
  const agentMailboxPath = path.join(SEMO_ROOT, 'packages', 'agent-mailbox', 'src', 'index.ts');

  const config = {
    mcpServers: {
      'semo-agent-mailbox': {
        command: 'npx',
        args: ['tsx', agentMailboxPath],
        env: {
          SEMO_BOT_ID: botId,
          SEMO_MAILBOX_DIR: mailboxDir,
        },
      },
    },
  };

  if (botId === 'semobot') {
    config.mcpServers['semo-agent-mailbox'].env.SEMO_ALLOW_SEMOBOT_MAILBOX = '1';
  }

  // DesignClaw gets Stitch MCP too
  if (botId === 'designclaw') {
    config.mcpServers.stitch = {
      command: 'npx',
      args: ['@_davideast/stitch-mcp', 'proxy'],
      env: {
        STITCH_API_KEY: '${STITCH_API_KEY}',
      },
    };
  }

  return config;
}

// ── Write files ──

function writeFile(filePath, content) {
  if (dryRun) {
    console.log(`[DRY-RUN] Would write: ${filePath}`);
    console.log(
      typeof content === 'string'
        ? content.slice(0, 200) + '...'
        : JSON.stringify(content, null, 2).slice(0, 200) + '...',
    );
    console.log('');
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n';
  fs.writeFileSync(filePath, text);
  console.log(`  Written: ${filePath}`);
}

// ── Main ──

for (const botId of bots) {
  console.log(`\n[${botId}] Generating environment...`);

  const def = parseAgentDef(botId);
  if (!def) {
    console.error(`  [SKIP] No agent definition found`);
    continue;
  }

  const botSessionDir = path.join(sessionDir, botId);

  // 1. CLAUDE.md
  const claudeMd = generateClaudeMd(botId, def.meta, def.body);
  writeFile(path.join(botSessionDir, '.claude', 'CLAUDE.md'), claudeMd);

  // 2. settings.json
  const settings = generateSettings(botId, def.meta);
  writeFile(path.join(botSessionDir, '.claude', 'settings.json'), settings);

  // 3. .mcp.json (project root level)
  const mcpJson = generateMcpJson(botId);
  writeFile(path.join(botSessionDir, '.mcp.json'), mcpJson);

  // 4. Ensure directories exist
  if (!dryRun) {
    fs.mkdirSync(path.join(botSessionDir, 'memory'), { recursive: true });
    fs.mkdirSync(path.join(botSessionDir, 'workspace'), { recursive: true });
    // Ensure mailbox dirs
    fs.mkdirSync(path.join(mailboxDir, botId, 'archive'), { recursive: true });
  }

  console.log(`  [${botId}] Done`);
}

// ── Overflow bots (derived from primary) ──

if (allBots) {
  for (const overflow of OVERFLOW_BOTS) {
    const primaryDef = parseAgentDef(overflow.primaryId);
    if (!primaryDef) {
      console.error(`  [SKIP] ${overflow.id}: primary ${overflow.primaryId} not found`);
      continue;
    }

    console.log(
      `\n[${overflow.id}] Generating overflow environment (primary: ${overflow.primaryId})...`,
    );

    const botSessionDir = path.join(sessionDir, overflow.id);

    // 1. CLAUDE.md — same as primary with overflow note
    const claudeMd = generateClaudeMd(overflow.primaryId, primaryDef.meta, primaryDef.body).replace(
      `# SEMO Bot Session — ${overflow.primaryId}`,
      `# SEMO Bot Session — ${overflow.id}\n\n> Overflow session for ${overflow.primaryId}. Same persona, separate mailbox.`,
    );
    writeFile(path.join(botSessionDir, '.claude', 'CLAUDE.md'), claudeMd);

    // 2. settings.json — same as primary
    const settings = generateSettings(overflow.primaryId, primaryDef.meta);
    writeFile(path.join(botSessionDir, '.claude', 'settings.json'), settings);

    // 3. .mcp.json — own BOT_ID + REPLY_AS for persona
    const mcpJson = {
      mcpServers: {
        'semo-agent-mailbox': {
          command: 'npx',
          args: ['tsx', path.join(SEMO_ROOT, 'packages', 'agent-mailbox', 'src', 'index.ts')],
          env: {
            SEMO_BOT_ID: overflow.id,
            SEMO_REPLY_AS: overflow.primaryId,
            SEMO_MAILBOX_DIR: mailboxDir,
          },
        },
      },
    };
    writeFile(path.join(botSessionDir, '.mcp.json'), mcpJson);

    // 4. Ensure directories
    if (!dryRun) {
      fs.mkdirSync(path.join(botSessionDir, 'memory'), { recursive: true });
      fs.mkdirSync(path.join(botSessionDir, 'workspace'), { recursive: true });
      fs.mkdirSync(path.join(mailboxDir, overflow.id, 'archive'), { recursive: true });
    }

    console.log(`  [${overflow.id}] Done`);
  }
}

if (dryRun) {
  console.log('\n[DRY-RUN] No files were written.');
} else {
  console.log(`\nAll bot environments generated in ${sessionDir}/`);
}

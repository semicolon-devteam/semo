/**
 * seed-semo-specs.ts — CLAUDE.md 참조 데이터를 KB로 이식
 *
 * CLAUDE.md에 하드코딩되어 있던 아키텍처/인프라/프로세스 문서를
 * semo 서비스 도메인의 KB 엔트리로 이식.
 *
 * Usage: npx tsx packages/cli/scripts/seed-semo-specs.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPool, closeConnection } from '../src/database';
import { kbUpsert } from '../src/kb';

const pool = getPool();

// ── KB 엔트리 정의 ──

const entries: { key: string; subKey: string; content: string }[] = [
  {
    key: 'spec',
    subKey: 'data-flow',
    content: `# SEMO 데이터 흐름

\`\`\`
~/.semo/workspaces/{bot}/  (로컬 전용: 세션 부트 + 실행 파일)
        ↓ sync-agent (1분 주기, 세션 부트 파일만)
Core DB: semo.bot_workspace_files (축소됨: ~100파일)
        ↓
semo-dashboard (KB + bot_workspace_files 병합)
        ↑
Core DB: semo.knowledge_base (KB: bot-config/spec/skill 도메인 포함)
        ↑ kb_upsert (MCP)
봇/사용자가 직접 쓰기
\`\`\`

## KB 접근 경로

| 환경 | KB 접근 방법 |
|------|-------------|
| **로컬 Claude Code 세션** | semo-kb MCP 도구 — 실시간 MCP 프로토콜 |
| **봇 세션** | kb-manager 스킬 → semo CLI (\`semo kb get/search/upsert/ontology\`) |

스킬은 \`skill_definitions\` 테이블에서 관리되며, \`semo context sync\`로 봇 워크스페이스에 자동 배포됩니다.`,
  },
  {
    key: 'spec',
    subKey: 'bot-infrastructure',
    content: `# 봇 인프라 (Agent SDK 기반)

## 아키텍처
Slack Socket Mode → SlackGateway → Router → SessionPool → Claude Agent SDK query()
봇 정의: \`~/.claude/agents/{botId}/{botId}.md\` (YAML frontmatter)
세션 상태: \`~/.semo/sessions/.session-state.json\`
오케스트레이터: \`packages/orchestrator/\`

## 봇 워크스페이스 접근
봇 파일을 읽거나 수정할 때는 \`~/.semo/workspaces/{bot}/\`를 직접 참조.
\`resolveBotWorkspace(botId)\` 헬퍼 사용 (packages/cli/src/paths.ts, packages/platform-common/src/paths.ts).

## 자격증명
\`~/.semo/credentials/{bot}/\` — Google 서비스 계정 등 봇 전용 자격증명.`,
  },
  {
    key: 'spec',
    subKey: 'mcp-server-config',
    content: `# MCP 서버 설정 규칙

- **프로젝트레벨** \`.claude/settings.json\` — semo-kb만 등록 (프로젝트 전용 서버)
- **유저레벨** \`~/.claude/settings.json\` — 공통 서버 (context7, playwright 등) 등록
- \`semo init\`은 공통 서버를 \`claude mcp add -s user\`로 유저레벨에 등록하고, 프로젝트 settings.json에는 semo-kb만 기록
- 공통 서버와 프로젝트 전용 서버를 같은 레벨에 넣으면 충돌 발생 가능`,
  },
  {
    key: 'spec',
    subKey: 'workspace-v2',
    content: `# 봇 워크스페이스 구조 (v3.0)

봇 워크스페이스의 SoT는 \`~/.semo/workspaces/{bot}/\` 디렉토리.

\`\`\`
~/.semo/workspaces/{bot}/
├── SOUL.md              # 봇 고유: 페르소나 + R&R + 행동강령 (< 120줄)
├── AGENTS.md            # 공통: → ~/.semo/shared/AGENTS.md (심링크)
├── USER.md              # 봇 고유: 사용자 컨텍스트 (< 15줄)
├── MEMORY.md            # 봇 고유: KB 도메인 인덱스 (< 30줄, main 세션만)
├── HEARTBEAT.md         # 선택: 크론 작업 (해당 봇만, 현재 semiclaw)
├── hooks/               # Claude Code 훅
├── memory/              # 일일로그 (YYYY-MM-DD.md)
├── shared/              # → ~/.semo/shared/ (심링크)
├── skills/              # 봇 전용 스킬
└── scripts/             # 유틸리티 스크립트
\`\`\`

## 제거된 파일 (v1 → v2)
- IDENTITY.md → SOUL.md ## Identity 섹션으로 흡수
- RULES.md → SOUL.md ## NON-NEGOTIABLE 섹션으로 통합
- TOOLS.md → KB lookup 지시로 대체
- CLAUDE.md (봇 내) → 프로젝트 .claude/CLAUDE.md에 이미 존재

## 파일 규격 SoT
\`bot_workspace_standard\` DB 테이블 (38 규칙, v2.0)에서 관리.
\`semo test run workspace-audit\`로 검증.`,
  },
  {
    key: 'infra',
    subKey: 'env-config',
    content: `# 환경변수 (~/.semo.env)

SEMO는 \`~/.semo.env\` 파일에서 팀 공통 환경변수를 로드합니다.
SessionStart 훅과 OpenClaw 게이트웨이 래퍼에서 자동 source됩니다.

| 변수 | 용도 | 필수 |
|------|------|------|
| DATABASE_URL | 팀 Core DB (PostgreSQL) 연결 | 필수 |
| OPENAI_API_KEY | KB 임베딩용 (text-embedding-3-small) | 선택 |
| SLACK_WEBHOOK | Slack 알림 | 선택 |

키 갱신이 필요하면 \`~/.semo.env\`를 직접 편집하거나 \`semo onboarding -f\`를 실행하세요.`,
  },
  {
    key: 'process',
    subKey: 'recovery',
    content: `# SEMO 복구 명령어

\`\`\`bash
semo doctor              # 환경 진단 (DB 연결, 설치 상태)
semo config db           # DB URL 재설정
semo context sync        # 스킬/에이전트/캐시 동기화 (KB는 MCP 사용)
semo bots status         # 봇 상태 조회
semo bots audit          # 봇 워크스페이스 규격 감사
semo memory sync         # L1(bot workspace) → L2(KB) 메모리 동기화
semo onto types          # 온톨로지 타입 목록
semo onto list --service # 서비스별 도메인 목록
semo test list           # 테스트 스위트 목록
semo test run --all      # 전체 테스트 실행
\`\`\``,
  },
  {
    key: 'process',
    subKey: 'coding-convention',
    content: `# SEMO 코딩 컨벤션

## 기술 스택
- TypeScript strict mode, Node.js (ES2022)
- PostgreSQL (Core DB, semo 스키마) + pgvector (임베딩)
- npm workspaces (packages/*)
- Next.js 15 (semo-dashboard)
- MCP SDK (@modelcontextprotocol/sdk)

## 브랜치 전략
- \`dev\` (기본 브랜치, PR 타겟)

## 코딩 규칙
- ESLint + TypeScript strict
- \`npm run lint && npx tsc --noEmit && npm run build\` 커밋 전 필수
- \`--no-verify\` 사용 금지

## 패키지 구조
- packages/cli — SEMO CLI 도구
- packages/mcp-kb — KB 실시간 벡터 검색 MCP 서버
- packages/semo-dashboard — 팀 대시보드 웹 UI`,
  },
];

async function main() {
  console.log('=== SEMO Specs → KB Seed ===\n');

  for (const entry of entries) {
    const result = await kbUpsert(pool, {
      domain: 'semo',
      key: entry.key,
      sub_key: entry.subKey,
      content: entry.content,
      created_by: 'seed-semo-specs',
    });
    if (result.success) {
      console.log(`  ✅ semo/${entry.key}/${entry.subKey}`);
    } else {
      console.log(`  ❌ semo/${entry.key}/${entry.subKey}: ${result.error}`);
    }
  }

  console.log(`\n${entries.length}개 엔트리 시드 완료`);
  await closeConnection();
}

main().catch((err) => {
  console.error('Fatal:', err);
  closeConnection();
  process.exit(1);
});

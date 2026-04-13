/**
 * GFP Context Builder — Phase별 프로젝트 파이프라인 컨텍스트 생성
 *
 * session-pool.ts의 contextPrompt에 주입하여 봇이 GFP 워크플로우
 * (섹션 제출, 콜백, 승인 안내 등)를 수행할 수 있게 한다.
 */

import type { RouteResult } from './types';

function getDashboardUrl(): string {
  return process.env.SEMO_DASHBOARD_URL || 'https://semo.semi-colon.space';
}

const SAFE_ID = /^[a-z0-9-]{1,64}$/;

function commonBlock(route: RouteResult): string {
  const url = getDashboardUrl();
  return `[프로젝트 파이프라인 컨텍스트]
대시보드: ${url}/projects/${encodeURIComponent(route.serviceId)}
콜백 API: POST ${url}/api/projects/callback

## Data Routing
- 읽기: 서비스 구조화 메타(status, po, tech-stack, url, repo) → semo service get ${route.serviceDomain}
- 읽기: 서비스 자유형 지식(base-info, decision, process) → semo kb get ${route.serviceDomain}
- 읽기: 프로젝트 실행 상태(phase, sections) → Dashboard API
- 쓰기: 섹션 제출/재생성 → POST /api/projects/callback (KB spec/* 직접 쓰기 금지)

## Dashboard API 인증
모든 Dashboard API 호출 시 아래 헤더를 포함하라:
\`\`\`
-H "x-semo-agent-token: \${SEMO_AGENT_SECRET}" -H "x-semo-agent-id: \${BOT_ID}"
\`\`\`
SEMO_AGENT_SECRET 미설정 시 개발 환경에서는 헤더 없이도 동작한다.

## Slack-First 원칙
- 섹션 제출 완료 시: "Slack에서 바로 승인/거절 가능합니다. 시각 산출물은 대시보드에서 확인하세요."`;
}

function callbackBlock(route: RouteResult, botId: string): string {
  return `## 콜백 페이로드
섹션 재생성: { "type": "section-regeneration", "section_id": "<ID>", "content": "<마크다운>", "bot_id": "${botId}" }
체크포인트: { "type": "incubator-checkpoint", "service_id": "${route.serviceId}", "checkpoint": <번호>, "status": "completed", "summary": "<요약>", "bot_id": "${botId}" }`;
}

const PHASE_GUIDES: Record<number, string> = {
  0: `## Phase 0: 온보딩 — PO 기본 정보 수집, 프로파일링, 프리셋 결정`,
  1: `## Phase 1: 디스커버리 — 배경/목표/타겟/경쟁사 분석 → 섹션 제출`,
  2: `## Phase 2: PRD — 기능/비기능 요구사항, 우선순위 매트릭스`,
  3: `## Phase 3: 명확화 — PO에게 불명확 사항 Q&A`,
  4: `## Phase 4: 디자인 시스템 (5-Step)

⚠️ 필수 선행: 작업 시작 전 이전 Phase 산출물을 반드시 조회하라.
- \`semo kb get {serviceDomain} spec/discovery\` (Phase 1 디스커버리)
- \`semo kb get {serviceDomain} spec/prd\` (Phase 2 PRD — 기능/비기능 요구사항)
- \`semo kb get {serviceDomain} spec/clarification\` (Phase 3 명확화 — PO Q&A 결과)
이전 Phase에서 확정된 기능 목록, 기술 결정사항, PO 응답을 기반으로 디자인 작업을 수행해야 한다.
KB 조회 없이 base-information만으로 작업하면 안 된다.

| Step | prefix | 설명 |
|------|--------|------|
| 1 | ref-* | 레퍼런스 탐색 |
| 2 | ds-*, screen-*, design-* | 디자인 시스템 확정 + Stitch DS 동기화 |
| 3 | impl-*, stitch-prompt-*, stitch-result-* | Stitch 생성 + Reus 리뷰 게이트 |
| 4 | review-* | PO 리뷰 + DesignClaw 직접 수정 |
| 5 | handoff-* | 핸드오프 |
section_key에 prefix 없으면 대시보드 미표시. 반드시 해당 Step prefix 사용.

### Step 2 디자인 시스템 → Stitch 동기화
ds-color-palette, ds-typography, ds-components 전부 승인 후:
1. 승인된 디자인 토큰을 Stitch 형식으로 매핑
2. \`mcp__stitch__create_design_system\` (또는 기존 DS있으면 \`mcp__stitch__update_design_system\`)
3. \`mcp__stitch__create_project\` → \`mcp__stitch__apply_design_system\` 으로 적용
4. 콜백 API(type: design-system-confirmed)로 stitch_project_id, stitch_design_system_id 저장

### Step 3 Stitch 생성 + Reus 리뷰 게이트
**생성:**
1. metadata에서 stitch_project_id 읽기
2. 각 화면별 \`mcp__stitch__generate_screen_from_text\` 호출
3. stitch-prompt-{NN} 섹션만 대시보드에 저장 (결과는 아직 가져오지 않음)
4. Slack → Reus에게: "Stitch에서 {N}개 화면 생성 완료. 리뷰 후 '스티치 리뷰 완료'라고 말씀해주세요."
5. Slack → PO에게: "디자인 산출물을 Reus가 확인 중입니다. 잠시 기다려주세요."

**Reus 리뷰 완료 트리거** (Reus가 "스티치 리뷰 완료" 메시지 시):
1. \`mcp__stitch__list_screens\` → 전체 스크린 목록
2. 각 스크린: \`mcp__stitch__get_screen\` → HTML 추출
3. 각 HTML을 콜백 API(type: stitch-export)로 제출 → stitch-result-{NN} 자동 생성
4. PO에게 Slack: "디자인 자료가 준비되었습니다. 대시보드에서 확인하세요."

### Step 4 PO 리뷰 + 직접 수정
stitch-result-* 섹션이 reject되면:
1. metadata에서 stitch_project_id 조회
2. \`mcp__stitch__list_screens\` → 해당 스크린 ID 특정
3. \`mcp__stitch__edit_screens\` 로 PO 피드백 직접 반영
4. \`mcp__stitch__get_screen\` → HTML 재추출 → stitch-export 콜백 재제출

### Stitch MCP 도구 (자동 승인됨)
- \`mcp__stitch__generate_screen_from_text\` — 텍스트 프롬프트로 UI 스크린 생성
- \`mcp__stitch__get_screen\` — 스크린 상세 조회 (HTML/코드 포함)
- \`mcp__stitch__edit_screens\` — 기존 스크린 수정 (PO 피드백 반영용)
- \`mcp__stitch__list_screens\` — 프로젝트 내 전체 스크린 목록
- \`mcp__stitch__create_design_system\` / \`apply_design_system\` / \`update_design_system\` — 디자인 시스템 관리
- \`mcp__stitch__generate_variants\` — 디자인 변형 생성`,
  5: `## Phase 5: 에픽 — 디스커버리+PRD 기반 에픽 구조화, 유저스토리
⚠️ 필수 선행: \`semo kb get {serviceDomain} spec/prd\` + \`semo kb get {serviceDomain} spec/clarification\` 조회 후 작업.`,
  6: `## Phase 6: 기능 스펙 — 에픽 내 기능별 상세 (입출력, 비즈니스 룰)`,
  7: `## Phase 7: 기술 설계 — 아키텍처, 기술 스택, API/DB 스키마`,
  8: `## Phase 8: 태스크 분해 — GitHub 이슈 단위 분해, 스프린트 배치`,
  9: `## Phase 9: 핸드오프 — 전체 산출물 검증, 인수인계 문서`,
};

export function buildGfpContext(route: RouteResult, botId: string): string {
  if (!route.serviceDomain || !route.serviceId || route.phase < 0 || route.phase > 9) {
    return '';
  }
  // 입력 검증 — injection 방지
  if (!SAFE_ID.test(botId) || !SAFE_ID.test(route.serviceId)) {
    return '';
  }

  const guide = (PHASE_GUIDES[route.phase] || '').replace(
    /\{serviceDomain\}/g,
    route.serviceDomain,
  );

  return [commonBlock(route), callbackBlock(route, botId), guide].filter(Boolean).join('\n\n');
}

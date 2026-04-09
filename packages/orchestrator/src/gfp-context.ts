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
- 읽기: 프로젝트 상태 → Dashboard API, 서비스 정보 → semo kb get ${route.serviceDomain}
- 쓰기: 섹션 제출/재생성 → POST /api/projects/callback (KB spec/* 직접 쓰기 금지)

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
| 2 | ds-*, screen-*, design-* | 디자인 시스템 |
| 3 | impl-*, stitch-prompt-*, stitch-result-* | 구현 (Stitch MCP 사용) |
| 4 | review-* | 리뷰 |
| 5 | handoff-* | 핸드오프 |
section_key에 prefix 없으면 대시보드 미표시. 반드시 해당 Step prefix 사용.

### Step 3 Stitch MCP 도구 (자동 연동)
이전 Phase 산출물(PRD, 명확화)을 기반으로 Stitch에 UI 생성을 요청하라.
- \`mcp__stitch__build_site\` — 스크린을 라우트 구조로 빌드, 각 페이지 HTML 반환
- \`mcp__stitch__get_screen_code\` — 특정 스크린의 HTML/Tailwind CSS 코드 조회
- \`mcp__stitch__get_screen_image\` — 스크린샷 base64 다운로드
결과물은 콜백 API(type: stitch-export)로 대시보드에 저장.`,
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

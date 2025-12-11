# SEMO Architecture Decisions

> 주요 아키텍처/기술 결정 기록 (ADR 스타일)

---

## ADR-001: 역할 기반에서 기능 기반 구조로 전환

**날짜**: 2025-12-11
**상태**: Accepted
**리뷰어**: Gemini

### 컨텍스트

기존 SAX는 인간 역할 기반(sax-po, sax-next, sax-qa 등)으로 11개 패키지를 구성했으나:
- 한 명이 여러 역할 수행 시 복수 패키지 설치 필요
- AI Agent에게 불필요한 컨텍스트 스위칭 유발
- 동일 기능(Orchestrator, onboarding)이 11개 패키지에 중복

### 결정

3-Layer 기능 기반 구조로 전환:
- **Layer 0**: semo-core (오케스트레이션, 원칙)
- **Layer 1**: semo-skills (coder, tester, planner, writer, deployer)
- **Layer 2**: semo-integrations (github, slack, supabase, infra)

### 결과

- 패키지 수: 11개 → 3개
- 중복 Orchestrator: 11개 → 1개
- Skills 분류: 역할 기반 → 기능 기반

---

## ADR-002: Claude Code 중심 아키텍처 제약 수용

**날짜**: 2025-12-11
**상태**: Accepted

### 컨텍스트

Claude Code CLI는:
- `ANTHROPIC_API_BASE` 환경변수 미지원
- 내부 API 호출을 외부에서 추적 불가
- 커스텀 프록시 경유 불가

### 결정

- **LiteLLM**: Reserved (MCP/백엔드 직접 호출 시 활성화)
- **LangFuse**: Reserved (동일 조건)
- **Promptfoo**: 자체 테스트 프레임워크로 대체

### 결과

Claude Code `-p` 모드 + JSON + jq 기반 테스트 프레임워크 구현

---

## ADR-003: Test Engine과 Tester Skill 분리

**날짜**: 2025-12-11
**상태**: Accepted
**제안자**: Gemini

### 컨텍스트

"테스트 프레임워크"라는 용어가 모호함:
- 실행기(run-tests.sh)는 도구
- 테스트 작성/분석은 AI 스킬

### 결정

| 컴포넌트 | 위치 | 역할 |
|----------|------|------|
| Test Engine | semo-core/tests/ | 테스트 실행기, 검증 헬퍼 |
| Tester Skills | semo-skills/tester/ | 테스트 작성, 리포트 생성 |

### 결과

명확한 관심사 분리, Layer 0과 Layer 1 역할 구분

---

## ADR-004: Context Mesh 저장소 도입

**날짜**: 2025-12-11
**상태**: Accepted
**제안자**: Gemini

### 컨텍스트

Claude Code 세션 간 컨텍스트가 유실됨

### 결정

`.claude/memory/` 디렉토리에 영속 컨텍스트 저장:
- `context.md`: 프로젝트 기본 정보
- `decisions.md`: 아키텍처 결정 기록
- `rules/`: 프로젝트별 예외 규칙

### 결과

세션 시작 시 memory/ 참조로 컨텍스트 복원 가능

---

*이 문서는 Claude (Opus 4.5)가 작성하고 Gemini가 리뷰했습니다.*

# SEMO 아키텍처 구현 리뷰 및 토론 제안

> 기존 설계 대비 변경 사항 분석 및 향후 구조 개선 토론 요청

---

## 1. 기존 설계 vs 실제 구현 비교

### 1.1 인프라 컴포넌트 상태 변경

| 컴포넌트 | 기존 설계 | 실제 구현 | 상태 |
|----------|----------|----------|------|
| **LiteLLM** | 중앙 LLM 프록시로 활용 | **보류 (Reserved)** | ⏳ |
| **LangFuse** | LLM 호출 추적/비용 분석 | **보류 (Reserved)** | ⏳ |
| **Promptfoo** | 프롬프트 품질 테스트 | **대체됨** → 자체 테스트 프레임워크 | 🔄 |
| **RAG/Vector Store** | 문서 검색 | 유지 (향후 활성화) | ✅ |

### 1.2 핵심 변경: 테스트 프레임워크 전면 재설계

**기존 설계 (Promptfoo 기반)**:
```yaml
# promptfooconfig.yaml - 직접 Anthropic API 호출 가정
providers:
  - id: anthropic:claude-sonnet-4-20250514
prompts:
  - file://agents/orchestrator/orchestrator.md
```

**실제 구현 (Claude Code CLI 기반)**:
```bash
# run-tests.sh - Claude Code 비대화형 모드 활용
claude -p "[next] API 버그 수정해줘" --output-format json
```

---

## 2. 변경 이유: Claude Code 중심 아키텍처

### 2.1 근본적 호환성 문제

SEMO는 **Claude Code CLI 기반**으로 동작합니다. 이로 인해:

| 문제점 | 영향 |
|--------|------|
| Claude Code는 내부적으로 Anthropic API를 직접 호출 | 커스텀 프록시 경유 불가 |
| Claude Code는 `ANTHROPIC_API_BASE` 환경변수 미지원 | LiteLLM 프록시 사용 불가 |
| Claude Code 내부 호출을 외부에서 추적할 방법 없음 | LangFuse 트레이싱 불가 |
| Promptfoo는 직접 API 호출 필요 | Claude Code 환경에서 사용 불가 |

### 2.2 발견 과정

```
[분석 1] LiteLLM 호환성 검토
  → Claude Code가 환경변수 기반 프록시 설정을 지원하지 않음 확인
  → 결론: Reserved (향후 MCP 서버/백엔드에서 직접 LLM 호출 시 활성화)

[분석 2] LangFuse 호환성 검토
  → Claude Code 내부 호출에 SDK 주입 불가
  → 결론: Reserved (LiteLLM과 동일 조건에서 활성화)

[분석 3] Promptfoo 실행 시도
  → ANTHROPIC_API_KEY 직접 필요, Claude Code 경유 불가
  → 결론: 자체 테스트 프레임워크로 대체
```

---

## 3. 대안 분석 및 선택 근거

### 3.1 테스트 프레임워크 대안 비교

| 대안 | 장점 | 단점 | 선택 |
|------|------|------|------|
| **A. Promptfoo 유지** | 성숙한 생태계, LLM-as-Judge 내장 | Claude Code와 호환 불가 | ❌ |
| **B. Bats (Bash 테스트)** | 단순, 의존성 적음 | LLM 응답 변동성 처리 제한 | △ |
| **C. Python 테스트 러너** | 확장성, 풍부한 라이브러리 | PyYAML 등 추가 의존성 | △ |
| **D. JSON + jq + Bash** | 최소 의존성, Claude Code CLI 직접 활용 | 고급 기능 제한적 | ✅ |

### 3.2 선택: JSON + jq + Bash (방안 D)

**선택 이유**:
1. **최소 의존성**: jq만 필요 (macOS/Linux 기본 제공 수준)
2. **Claude Code 네이티브**: `-p` 비대화형 모드 직접 활용
3. **확장 가능**: 향후 LLM-as-Judge 등 고급 기능 추가 여지
4. **실용성**: 드라이런 모드로 즉시 테스트 케이스 검증 가능

### 3.3 검토했으나 채택하지 않은 대안

**대안 E: Claude Code SDK 직접 활용**
- Node.js `@anthropic-ai/claude-code` 패키지로 프로그래매틱 테스트
- 장점: TypeScript 타입 안전성, 풍부한 API
- 단점: Node.js 의존성, 러닝 커브
- 판단: Phase 2에서 고급 기능 필요 시 재검토

**대안 F: MCP 서버를 통한 테스트**
- MCP 서버에서 테스트 도구 노출
- 장점: Claude Code 생태계와 자연스러운 통합
- 단점: 순환 의존성 위험, 복잡도 증가
- 판단: 테스트는 외부에서 독립적으로 실행하는 것이 원칙에 맞음

---

## 4. 더 나은 대안이 있었는가?

### 4.1 회고적 분석

| 질문 | 답변 |
|------|------|
| Promptfoo를 완전히 포기해야 했나? | 현재로선 불가피. Claude Code가 API 프록시를 지원하면 재활성화 가능 |
| LiteLLM/LangFuse를 삭제해야 했나? | 아니오. Reserved로 두고 MCP/백엔드 직접 호출 시 활성화 계획 |
| 자체 프레임워크가 과도한 투자였나? | 아니오. 200줄 이내의 최소 구현으로 핵심 요구사항 충족 |

### 4.2 놓친 가능성

**Claude Code Hooks 활용**:
- Claude Code는 도구 호출 전후에 훅을 실행할 수 있음
- 훅에서 LangFuse SDK를 호출하면 간접적 추적 가능할 수도 있음
- 향후 검토 필요

---

## 5. 토론 제안: AI 협업 시대의 패키지 구조

### 5.1 현재 구조: 인간 역할 기반

```
semo-po/     → PO (Product Owner)
semo-pm/     → PM (Project Manager)
semo-next/   → Frontend Developer
semo-backend/→ Backend Developer
semo-qa/     → QA Engineer
semo-design/ → Designer
semo-infra/  → DevOps/Infra
```

**이 구조의 가정**:
- 각 패키지가 특정 "역할"을 담당하는 팀원에게 배포됨
- 인간이 자신의 역할에 맞는 패키지를 선택하여 설치
- AI Agent는 해당 역할의 보조 도구로 기능

### 5.2 질문: 이 구조가 AI 협업에 최적인가?

**관찰된 현상**:
1. 실제로는 한 명의 인간이 여러 역할을 수행 (1인 스타트업, 풀스택 개발자)
2. AI Agent는 역할 경계를 넘어 다양한 작업 수행 가능
3. `[next | backend]` 같은 복합 패키지 지정이 빈번

**제안하고 싶은 토론 주제**:

---

## 6. 토론 요청: 기능별/도구별 패키징 구조

### 6.1 대안 A: 기능 중심 패키징

```
semo-core/        → 핵심 오케스트레이션, 공통 규칙
semo-code/        → 코드 작성/수정/리뷰 (프론트+백엔드 통합)
semo-test/        → 테스트 작성/실행/분석
semo-docs/        → 문서 생성/관리
semo-deploy/      → 배포/인프라 관리
semo-communicate/ → Slack/이슈/PR 커뮤니케이션
```

**장점**:
- 역할이 아닌 "무엇을 하는가"로 분류
- 한 인간이 필요한 기능만 선택적으로 사용
- AI Agent의 멀티태스킹과 자연스럽게 부합

### 6.2 대안 B: 도구 중심 패키징

```
semo-core/     → 오케스트레이션
semo-github/   → GitHub 연동 (PR, Issue, Actions)
semo-slack/    → Slack 연동
semo-ide/      → IDE 연동 (VSCode, Cursor)
semo-db/       → 데이터베이스 도구
semo-ai/       → LLM 관련 도구 (RAG, 프롬프트 관리)
```

**장점**:
- 외부 시스템 연동 기준으로 명확한 경계
- 필요한 연동만 설치하는 모듈식 구조
- MCP 서버와 1:1 매핑 가능

### 6.3 대안 C: 하이브리드 (레이어 기반)

```
Layer 1 - Core
└── semo-core/          → 필수, 오케스트레이션

Layer 2 - Capabilities
├── semo-code/          → 코드 관련
├── semo-communicate/   → 커뮤니케이션
└── semo-analyze/       → 분석/리포트

Layer 3 - Integrations
├── semo-github/        → GitHub MCP
├── semo-slack/         → Slack MCP
└── semo-notion/        → Notion MCP
```

**장점**:
- 레이어별 독립성
- Core만 필수, 나머지는 선택적
- 확장성과 단순성의 균형

---

## 7. Gemini에게 요청하는 토론 포인트

### 7.1 구현 평가 요청

1. **LiteLLM/LangFuse Reserved 결정**이 적절했는가? 다른 접근법이 있었는가?
2. **자체 테스트 프레임워크**의 설계가 합리적인가? 놓친 기존 도구가 있는가?
3. **Claude Code 중심 아키텍처**의 제약을 어떻게 극복할 수 있을까?

### 7.2 구조 개선 토론 요청

1. **인간 역할 기반 패키징**은 AI 협업 시대에 적합한 구조인가?
2. **기능별/도구별/레이어별** 패키징 중 어떤 것이 더 효과적인가?
3. 제안한 대안들의 **장단점과 트레이드오프**는 무엇인가?
4. **SEMO가 "한 인간이 AI Agent 팀을 다루는 도구"**라면, 구조가 어떻게 바뀌어야 하는가?

### 7.3 추가 고려사항

- AI Agent는 역할 전환이 자유롭지만, 인간은 특정 역할에 익숙함
- 패키지 구조가 인간의 멘탈 모델과 AI의 유연성 사이에서 균형을 잡아야 함
- "1 Human + N AI Agents" 시나리오에서 최적의 오케스트레이션 구조는?

---

## 8. 현재 구현 현황

### 8.1 완료된 작업

| 항목 | 상태 | 위치 |
|------|------|------|
| 테스트 프레임워크 | ✅ 완료 | `infra/tests/` |
| 테스트 케이스 (7개) | ✅ 완료 | `infra/tests/cases/` |
| LiteLLM 문서 업데이트 | ✅ Reserved 표시 | `infra/litellm/README.md` |
| LangFuse 문서 업데이트 | ✅ Reserved 표시 | `infra/langfuse/README.md` |

### 8.2 테스트 프레임워크 구조

```
infra/tests/
├── run-tests.sh          # 실행기 (Bash + jq)
├── cases/
│   ├── orchestrator.json # Orchestrator 라우팅 테스트
│   └── message-format.json # 메시지 포맷 테스트
├── lib/
│   └── assertions.sh     # 검증 헬퍼
└── results/              # JSON 결과 저장
```

### 8.3 테스트 실행 예시

```bash
# 드라이런 결과
$ ./run-tests.sh --dry-run

테스트 파일: 2 개
[DRY-RUN 모드] 실제 Claude 호출 없음

테스트 케이스: 7 개
  ✓ [next] 접두사 라우팅
  ✓ [backend] 접두사 라우팅
  ✓ [next | backend] 복합 패키지 라우팅
  ...

결과: 통과 0 / 실패 0 / 스킵 7
```

---

## 9. 결론 및 다음 단계

### 9.1 이번 구현의 핵심 교훈

1. **아키텍처는 실행 환경에 종속됨**: Claude Code 중심이라는 제약이 모든 설계 결정에 영향
2. **Reserved는 삭제가 아님**: 향후 확장 시 활성화할 수 있도록 문서화하고 유지
3. **최소 구현 우선**: 200줄 Bash로 핵심 요구사항 충족, 과도한 투자 회피

### 9.2 Gemini 피드백 후 예상 액션

| 피드백 유형 | 예상 액션 |
|-------------|----------|
| 구현 개선 제안 | 테스트 프레임워크 고도화 |
| 구조 변경 제안 | SEMO → SEMO 리브랜딩 시 반영 |
| 추가 분석 요청 | 심층 연구 진행 |

---

*이 문서는 Claude Code (Opus 4.5)에 의해 작성되었으며, Gemini의 리뷰와 토론을 요청합니다.*

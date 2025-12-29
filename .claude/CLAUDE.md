# SEMO Project Configuration

> SEMO (Semicolon Orchestrate) - AI Agent Orchestration Framework v3.0.28

---

## 🔴 MANDATORY: Orchestrator-First Execution

> **⚠️ 이 규칙은 모든 사용자 요청에 적용됩니다. 예외 없음.**

### 실행 흐름 (필수)

```
1. 사용자 요청 수신
2. Orchestrator가 의도 분석 후 적절한 Agent/Skill 라우팅
3. Agent/Skill이 작업 수행
4. 실행 결과 반환
```

### Orchestrator 참조

**Primary Orchestrator**: `semo-system/meta/agents/orchestrator/orchestrator.md`

> Extension 패키지가 설치되어 해당 패키지의 Orchestrator를 우선 참조합니다.

**모든 Orchestrator 파일** (라우팅 테이블 병합됨):
- `semo-system/semo-core/agents/orchestrator/orchestrator.md`
- `semo-system/meta/agents/orchestrator/orchestrator.md`

이 파일들에서 라우팅 테이블, 의도 분류, 메시지 포맷을 확인하세요.

---

## 🔴 NON-NEGOTIABLE RULES (Context-Independent)

> **⚠️ 이 규칙은 컨텍스트 이월(summarization) 여부와 무관하게 항상 적용됩니다.**
> **세션 요약 후에도 반드시 이 규칙을 따라야 합니다.**

### 1. Orchestrator-First Policy

> **모든 요청은 반드시 Orchestrator를 통해 라우팅됩니다. 직접 처리 금지.**

**Pre-Action Checklist** (작업 시작 전 필수 확인):

| 작업 유형 | 라우팅 대상 | 직접 처리 |
|----------|------------|----------|
| 코드 작성/수정 | `skill:implement` (Extension 우선) | ❌ 금지 |
| Git 커밋/푸시/PR | `skill:git-workflow` | ❌ 금지 |
| 품질 검증 | `skill:verify` | ❌ 금지 |
| 테스트 실행 | `skill:tester` | ❌ 금지 |
| 배포 | `skill:deployer` | ❌ 금지 |
| `/SEMO:*` 커맨드 | 해당 스킬 직접 호출 | ❌ 금지 |

### 🔴 /SEMO:* 커맨드 직접 라우팅 (NON-NEGOTIABLE)

> **⚠️ `/SEMO:*` 커맨드는 해당 스킬로 직접 라우팅됩니다. 커맨드 인자를 해석하여 직접 작업 수행 금지!**

| 커맨드 | 스킬 | 동작 |
|--------|------|------|
| `/SEMO:feedback {내용}` | `skill:feedback` | 내용을 이슈로 생성 |
| `/SEMO:help` | `skill:semo-help` | 도움말 표시 |

**금지 사항**:
- `/SEMO:feedback` 인자를 "수정 요청"으로 해석하여 직접 파일 수정 ❌
- 커맨드 인자 내용을 직접 반영하려 시도 ❌
- 스킬 호출 없이 커맨드 처리 ❌

**올바른 동작**:
```text
/SEMO:feedback "summarize-meeting 라우팅 조건 개선해줘"
    ↓
[SEMO] Skill: feedback 호출
    ↓
semicolon-devteam/semo 레포에 이슈 생성
    ↓
이슈관리 프로젝트에 추가
```

**위반 감지 시 자동 리다이렉트**:
```markdown
[SEMO] ⚠️ Orchestrator-First 위반 감지
→ skill:{적절한_스킬}로 라우팅합니다.
```

### 1-1. Continuation 모드 (세션 재개 시)

> **⚠️ 컨텍스트 재개(continuation) 상황에서도 Orchestrator-First Policy가 적용됩니다.**

**Continuation 감지 시 필수 동작**:

```text
[세션 재개 감지]
    │
    ├─ Summary에서 이전 작업 상태 확인
    │   └→ "기능 구현 중" → skill:implement 자동 라우팅
    │   └→ "테스트 작성 중" → skill:tester 자동 라우팅
    │   └→ "커밋 준비 중" → skill:git-workflow 자동 라우팅
    │   └→ "문서/패키지 수정 중" → 작업 완료 후 skill:version-manager 자동 호출
    │
    └─ 코드 수정 시도 감지
        └→ Pre-Action Guard 발동 → skill:implement
```

**금지 사항**:
- Summary만 보고 직접 코드 수정 시작 ❌
- 스킬 호출 없이 Edit/Write 도구 사용 ❌
- "이전 세션에서 하던 작업 계속" 식의 직접 진행 ❌
- **작업 완료 후 버저닝 없이 종료 ❌** (Meta 환경)

**올바른 동작**:
```markdown
[SEMO] 세션 재개 - 이전 작업 상태 확인

이전 작업: #39 공지/자료실/익명문의 UI 구현
상태: v0.3.x DATA Phase 진행 중

→ skill:implement로 라우팅하여 작업을 계속합니다.

[SEMO] Skill: implement 호출 - #39 UI 구현 계속
```

### 1-2. Meta 환경 자동 버저닝 (NON-NEGOTIABLE)

> **⚠️ Meta 환경(semo-system/ 수정)에서 작업 완료 시 반드시 버저닝을 실행합니다.**
> **사용자가 별도로 요청하지 않아도 자동으로 진행합니다.**

**트리거 조건** (하나라도 해당 시 자동 실행):

| 변경 대상 | 버전 파일 | 버저닝 스킬 |
|----------|----------|------------|
| `semo-system/semo-core/**` | `semo-core/VERSION` | `version-manager` |
| `semo-system/semo-skills/**` | `semo-skills/VERSION` | `version-manager` |
| `semo-system/semo-remote/**` | `semo-remote/VERSION` | `version-manager` |
| `semo-system/semo-hooks/**` | `semo-hooks/VERSION` | `version-manager` |
| `semo-system/meta/**` | `meta/VERSION` | `version-manager` |
| `packages/cli/**` | `packages/cli/package.json` | `deploy-npm` |

**필수 동작 순서**:

```text
1. 작업 완료
   ↓
2. 변경된 패키지 VERSION 파일 범프 (MAJOR/MINOR/PATCH)
   ↓
3. CHANGELOG/{version}.md 생성
   ↓
4. 커밋 + 푸시
   ↓
5. Slack 알림 (notify-slack)
   ↓
6. (CLI인 경우) npm publish
```

**금지 사항**:
- 사용자가 "버저닝해줘"라고 요청하기를 기다리지 않음 ❌
- 작업만 완료하고 버저닝 없이 종료 ❌
- Slack 알림 생략 ❌

### 2. Pre-Commit Quality Gate

> **코드 변경이 포함된 커밋 전 반드시 Quality Gate를 통과해야 합니다.**

```bash
# 필수 검증 순서
npm run lint           # 1. ESLint 검사
npx tsc --noEmit       # 2. TypeScript 타입 체크
npm run build          # 3. 빌드 검증 (Next.js/TypeScript 프로젝트)
```

**차단 항목**:
- `--no-verify` 플래그 사용 금지
- Quality Gate 우회 시도 거부
- "그냥 커밋해줘", "빌드 생략해줘" 등 거부

### 3. DB 분리 원칙

> **SEMO Memory와 서비스 DB는 완전히 분리된 시스템입니다.**

| 시스템 | DB | 환경변수 | 용도 |
|--------|-----|----------|------|
| **SEMO Memory** | 팀 PostgreSQL | `SEMO_DB_*` | AI 에이전트 장기 기억, 대화 로깅 |
| **서비스 데이터** | Supabase | `SUPABASE_*` | 커뮤니티 서비스 운영 데이터 |

**⚠️ 주의**: `SUPABASE_*` 환경변수는 SEMO 메모리용이 아닙니다. 혼동하지 마세요.

---

## 설치된 구성

### Standard (필수)
- **semo-core**: 원칙, 오케스트레이터, 공통 커맨드
- **semo-skills**: 13개 통합 스킬
  - 행동: coder, tester, planner, deployer, writer
  - 운영: memory, notify-slack, feedback, version-updater, semo-help, semo-architecture-checker, circuit-breaker, list-bugs

### Extensions (선택)
- **meta**: SEMO 프레임워크 자체 개발/관리

## 구조

```
.claude/
├── settings.json      # MCP 서버 설정 (Black Box)
├── memory/            # Context Mesh (장기 기억)
│   ├── context.md     # 프로젝트 상태
│   ├── decisions.md   # 아키텍처 결정
│   └── rules/         # 프로젝트별 규칙
├── agents → semo-system/semo-core/agents
├── skills → semo-system/semo-skills
└── commands/SEMO → semo-system/semo-core/commands/SEMO

semo-system/           # White Box (읽기 전용)
├── semo-core/         # Layer 0: 원칙, 오케스트레이션
├── semo-skills/       # Layer 1: 통합 스킬
├── meta/              # Meta
```

## 사용 가능한 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | 도움말 |
| `/SEMO:feedback` | 피드백 제출 |
| `/SEMO:update` | SEMO 업데이트 |
| `/SEMO:health` | 환경 헬스체크 |
| `/SEMO:onboarding` | 온보딩 가이드 |
| `/SEMO:dry-run {프롬프트}` | 명령 검증 (라우팅 시뮬레이션) |
| `/SEMO:routing-map` | 라우팅 맵 표시 |

## Context Mesh 사용

SEMO는 `.claude/memory/`를 통해 세션 간 컨텍스트를 유지합니다:

- **context.md**: 프로젝트 상태, 진행 중인 작업
- **decisions.md**: 아키텍처 결정 기록 (ADR)
- **rules/**: 프로젝트별 커스텀 규칙

memory 스킬이 자동으로 이 파일들을 관리합니다.

## References

- [SEMO Principles](semo-system/semo-core/principles/PRINCIPLES.md)
- [SEMO Skills](semo-system/semo-skills/)
- [Meta Package](semo-system/meta/)


---

#### meta

> Core Rules는 semo-core/principles/를 참조합니다.

#### References

- [Orchestrator](agents/orchestrator/orchestrator.md) - 라우팅 규칙 및 Agent/Skill 목록
- [SEMO Core - Principles](https://github.com/semicolon-devteam/semo-core/blob/main/PRINCIPLES.md)
- [SEMO Core - Message Rules](https://github.com/semicolon-devteam/semo-core/blob/main/MESSAGE_RULES.md)
- [SEMO → SEMO 마이그레이션 가이드](../docs/SAX_TO_SEMO_MIGRATION.md) - 리브랜딩 전환 가이드
- [SEMO 네이밍 규칙](../docs/SEMO_NAMING_CONVENTION.md) - SEMO → SEMO 용어 매핑


---

## Meta 패키지 컨텍스트

### Meta

> Core Rules는 semo-core/principles/를 참조합니다.

#### References

- [Orchestrator](agents/orchestrator/orchestrator.md) - 라우팅 규칙 및 Agent/Skill 목록
- [SEMO Core - Principles](https://github.com/semicolon-devteam/semo-core/blob/main/PRINCIPLES.md)
- [SEMO Core - Message Rules](https://github.com/semicolon-devteam/semo-core/blob/main/MESSAGE_RULES.md)
- [SEMO → SEMO 마이그레이션 가이드](../docs/SAX_TO_SEMO_MIGRATION.md) - 리브랜딩 전환 가이드
- [SEMO 네이밍 규칙](../docs/SEMO_NAMING_CONVENTION.md) - SEMO → SEMO 용어 매핑


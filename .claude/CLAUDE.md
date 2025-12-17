# SEMO Project Configuration

> SEMO (Semicolon Orchestrate) - AI Agent Orchestration Framework v3.0.0-alpha

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

**반드시 읽어야 할 파일**: `semo-system/semo-core/agents/orchestrator/orchestrator.md`

이 파일에서 라우팅 테이블, 의도 분류, 메시지 포맷을 확인하세요.

---

## 🔴 NON-NEGOTIABLE RULES

### 1. Orchestrator-First Policy

> **모든 요청은 반드시 Orchestrator를 통해 라우팅됩니다. 직접 처리 금지.**

**직접 처리 금지 항목**:
- 코드 작성/수정 → `implementation-master` 또는 `coder` 스킬
- Git 커밋/푸시 → `git-workflow` 스킬
- 품질 검증 → `quality-master` 또는 `verify` 스킬
- 명세 작성 → `spec-master`
- 일반 작업 → Orchestrator 분석 후 라우팅

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

### 3. Meta 환경 체크 (SEMO 수정 요청 시)

> **SEMO 스킬/에이전트 수정 요청 시 환경 확인 필수**

**환경 판별**:
```bash
# Meta 설치 여부: semo-system이 실제 디렉토리인지 확인
if [ -d "semo-system" ] && [ ! -L "semo-system" ]; then
  # Meta 설치됨 → 직접 수정 가능
else
  # 패키지만 설치 → 피드백으로 유도
fi
```

**분기 처리**:
| 환경 | SEMO 수정 요청 | 프로젝트 코드 수정 |
|------|---------------|------------------|
| Meta 설치됨 | 직접 수정 | 직접 수정 |
| 패키지만 설치 | **피드백 유도** | 직접 수정 |

**피드백 유도 키워드**: "스킬 개선", "에이전트 수정", "SEMO 기능 추가" 등

---

## 설치된 구성

### Standard (필수)
- **semo-core**: 원칙, 오케스트레이터, 공통 커맨드
- **semo-skills**: 13개 통합 스킬
  - 행동: coder, tester, planner, deployer, writer
  - 운영: memory, notify-slack, feedback, version-updater, semo-help, semo-architecture-checker, circuit-breaker, list-bugs



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

```

## 사용 가능한 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | 도움말 |
| `/SEMO:feedback` | 피드백 제출 |
| `/SEMO:update` | SEMO 업데이트 |
| `/SEMO:onboarding` | 온보딩 가이드 |
| `/SEMO:dry-run {프롬프트}` | 명령 검증 (라우팅 시뮬레이션) |

## Context Mesh 사용

SEMO는 `.claude/memory/`를 통해 세션 간 컨텍스트를 유지합니다:

- **context.md**: 프로젝트 상태, 진행 중인 작업
- **decisions.md**: 아키텍처 결정 기록 (ADR)
- **projects.md**: 외부 프로젝트 별칭 매핑 (배포용)
- **rules/**: 프로젝트별 커스텀 규칙

memory 스킬이 자동으로 이 파일들을 관리합니다.

## 외부 프로젝트 배포

`.claude/memory/projects.md`에 정의된 별칭으로 외부 프로젝트 배포가 가능합니다:

```
"랜드 stg 배포해줘"  → cm-land STG 배포 (Milestone close)
"오피스 prd 배포"    → cm-office PRD 배포 (source-tag + Milestone close)
```

`deployer` 스킬이 프로젝트 별칭을 인식하고 GitHub API를 통해 배포를 트리거합니다.

## References

- [SEMO Principles](semo-system/semo-core/principles/PRINCIPLES.md)
- [SEMO Skills](semo-system/semo-skills/)



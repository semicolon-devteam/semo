# /SEMO:onboarding

새 프로젝트에 SEMO를 설치하거나, 새 팀원을 위한 온보딩 가이드를 제공합니다.
**설치된 패키지에 따라 동적으로 맞춤형 가이드를 생성합니다.**

## 사용법

```
/SEMO:onboarding
```

## 동작

1. **설치 상태 스캔**: `semo-system/` 디렉토리를 스캔하여 설치된 패키지 감지
2. **동적 가이드 생성**: 설치된 패키지에 맞는 온보딩 가이드 생성
3. **권장 다음 단계**: 미설치 패키지 중 권장 조합 제안

## 실행 프로세스

```
[SEMO] Skill: onboarding 호출

=== SEMO 온보딩 가이드 ===

## 1. 설치된 패키지

### Standard (필수)
✓ semo-core - 원칙, 오케스트레이터
✓ semo-skills - 14개 통합 스킬

### Extensions
{동적으로 설치된 패키지 표시}

---

## 2. 사용 가능한 기능

{설치된 패키지별 주요 기능/스킬 목록}

---

## 3. 빠른 시작

{설치된 패키지별 quickstart 예시}

---

## 4. 권장 다음 단계

{현재 설치 기반 추천 패키지}

[SEMO] Skill: onboarding 완료
```

## 패키지 감지 로직

### 1. 디렉토리 스캔

```bash
# 설치된 패키지 목록 추출
ls -d semo-system/biz/* semo-system/eng/* semo-system/ops/* 2>/dev/null
```

### 2. 패키지별 정보 매핑

| 패키지 | 대상 | 주요 스킬 | onboarding 스킬 |
|--------|------|----------|----------------|
| `biz/discovery` | PO, 기획자 | create-epic, generate-ac | onboarding-po |
| `biz/design` | 디자이너 | generate-mockup, design-handoff | onboarding-design |
| `biz/management` | PM | create-sprint, assign-task | onboarding-pm |
| `biz/poc` | 기획자, 개발자 | implement-mvp, verify-integration | - |
| `eng/nextjs` | 프론트엔드 개발자 | implement, verify, scaffold-domain | onboarding-next |
| `eng/spring` | 백엔드 개발자 | implement, verify-reactive | onboarding-backend |
| `eng/ms` | 마이크로서비스 개발자 | scaffold-service, create-event-schema | onboarding-ms |
| `eng/infra` | DevOps | deploy-service, scaffold-compose | onboarding-infra |
| `ops/qa` | QA 담당자 | execute-test, report-bug | onboarding-qa |
| `ops/monitor` | 운영팀 | health-check, alert-config | - |
| `ops/improve` | 개발팀 | analyze-debt, suggest-improvement | - |
| `semo-hooks` | 시스템 | 로깅, 세션 관리 | - |
| `semo-remote` | 시스템 | 모바일 원격 제어 | - |

## 동적 출력 템플릿

### 설치된 패키지 섹션

```markdown
## 1. 설치된 패키지

### Standard (필수)
✓ semo-core - 원칙, 오케스트레이터
✓ semo-skills - 14개 통합 스킬

### Business Layer
{biz/* 패키지가 있는 경우만 표시}
✓ discovery - 아이템 발굴, Epic/Task 생성
○ design - (미설치)
...

### Engineering Layer
{eng/* 패키지가 있는 경우만 표시}
✓ nextjs - Next.js 프론트엔드 개발
...

### Operations Layer
{ops/* 패키지가 있는 경우만 표시}

### System
{semo-hooks, semo-remote 있는 경우만 표시}
```

### 사용 가능한 기능 섹션

```markdown
## 2. 사용 가능한 기능

### 공통 (semo-core)
- `implement` - 코드 작성/수정 ("로그인 기능 만들어줘")
- `git-workflow` - Git 커밋/PR ("커밋해줘", "PR 만들어줘")
- `tester` - 테스트 작성 ("테스트 작성해줘")

### eng/nextjs (설치됨)
- `scaffold-domain` - 도메인 구조 생성
- `verify` - 구현 검증
- `typescript-review` - 타입스크립트 리뷰

### biz/discovery (설치됨)
- `create-epic` - Epic 생성
- `generate-ac` - AC 자동 생성
...
```

### 빠른 시작 섹션

```markdown
## 3. 빠른 시작

### 기본 사용법
```text
"로그인 기능 만들어줘"     → skill:implement
"커밋하고 PR 만들어줘"     → skill:git-workflow
"테스트 작성해줘"          → skill:tester
```

### eng/nextjs 전용 (설치됨)
```text
"Button 도메인 만들어줘"   → skill:scaffold-domain
"구현 검증해줘"            → skill:verify
```

### 실습이 필요하면:
특정 패키지 온보딩 실습을 원하시면 다음을 요청하세요:
- "Next.js 온보딩 실습해줘" → skill:onboarding-next
- "PO 온보딩 실습해줘" → skill:onboarding-po
```

### 권장 다음 단계 섹션

```markdown
## 4. 권장 다음 단계

현재 설치: eng/nextjs, biz/discovery

### 권장 추가 패키지:
1. `semo add biz/management` - 스프린트 관리 (Epic → Sprint 연결)
2. `semo add ops/qa` - 테스트 프로세스 (구현 → 테스트 연결)

### 설치 명령:
```bash
semo add biz/management,ops/qa
```
```

## 권장 조합 규칙

| 현재 설치 | 권장 추가 | 이유 |
|----------|----------|------|
| `eng/nextjs` only | `biz/discovery`, `ops/qa` | 기획 → 개발 → 테스트 연결 |
| `biz/discovery` only | `biz/management`, `eng/*` | Epic → Sprint → 구현 연결 |
| `eng/*` + `biz/*` | `ops/qa` | 테스트 프로세스 추가 |
| `ops/qa` only | `eng/*` | 테스트할 대상 프로젝트 필요 |
| Full Stack | `semo-hooks`, `semo-remote` | 고급 기능 (로깅, 원격 제어) |

## 패키지별 튜토리얼 연결

설치된 패키지에 onboarding 스킬이 있는 경우, 해당 스킬을 안내합니다:

```markdown
## 5. 상세 튜토리얼

설치된 패키지별 실습 가이드가 있습니다:

| 패키지 | 대상 | 실습 명령 |
|--------|------|----------|
| eng/nextjs | 프론트엔드 개발자 | "Next.js 온보딩 실습해줘" |
| biz/discovery | PO/기획자 | "PO 온보딩 실습해줘" |

실습을 시작하려면 위 명령을 입력하세요.
```

## SEMO Message Format

```markdown
[SEMO] Skill: onboarding 호출 - 설치 상태 스캔

[SEMO] Onboarding: 패키지 감지 완료 (N개 Extension 설치됨)

[SEMO] Skill: onboarding 완료
```

## 참조

- [SEMO CLI](https://www.npmjs.com/package/@team-semicolon/semo-cli)
- [SEMO 원칙](semo-system/semo-core/principles/PRINCIPLES.md)
- [패키지별 onboarding 스킬](#패키지별-튜토리얼-연결)

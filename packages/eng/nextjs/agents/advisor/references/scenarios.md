# Common Advisory Scenarios

> advisor Agent 주요 시나리오

## Scenario 1: Project Kickoff Automation

```
User: 새 프로젝트 세팅을 자동화하고 싶어

Advisor:
## 🎯 프로젝트 킥오프 자동화 방안

### 권장 접근법
CLI 스크립트 + GitHub Template Repository 조합을 추천드립니다.

### 옵션 비교
| 옵션 | 장점 | 단점 | 추천도 |
|------|------|------|--------|
| CLI 스크립트 | 완전 자동화, 플레이스홀더 치환 | 스크립트 유지보수 | ⭐⭐⭐⭐⭐ |
| GitHub Template | 원클릭, GitHub 네이티브 | 수동 수정 필요 | ⭐⭐⭐⭐ |

### 구현 방법
[구체적인 스크립트 및 설정 안내]
```

## Scenario 2: CI/CD Setup

```
User: GitHub Actions로 자동 테스트 설정하고 싶어

Advisor:
## 🎯 GitHub Actions 자동 테스트 설정

### 권장 접근법
PR 트리거 기반 lint + test + build 워크플로우를 권장합니다.

### 세미콜론 팀 기준 적용
- ✅ Team Codex: ESLint 에러 0 필수
- ✅ Team Codex: TypeScript 에러 0 필수
- ✅ Constitution: 테스트 커버리지 80%+

### 구현 방법
[.github/workflows/*.yml 예시]
```

## Scenario 3: Architecture Decision

```
User: 상태 관리 라이브러리 뭐 쓰면 좋을까?

Advisor:
## 🎯 상태 관리 라이브러리 선택

### 현재 프로젝트 컨텍스트
- Server State: React Query (이미 사용 중)
- Client State: ?

### 옵션 비교
| 옵션 | 장점 | 단점 | 추천도 |
|------|------|------|--------|
| Zustand | 간단, 가벼움, React Query와 궁합 | 대규모 앱에선 부족 | ⭐⭐⭐⭐⭐ |
| Redux Toolkit | 강력, 표준화 | 보일러플레이트 | ⭐⭐⭐ |
| Jotai | Atomic, 간단 | 러닝커브 | ⭐⭐⭐ |

### 세미콜론 팀 기준
- Development Philosophy: 복잡도 최소화 원칙
- 권장: Zustand (Simple, React Query 보완)
```

## Scenario 4: Process Improvement

```
User: 코드 리뷰 프로세스 개선하고 싶어

Advisor:
## 🎯 코드 리뷰 프로세스 개선

### 권장 접근법
PR Template + Review Checklist + CODEOWNERS 조합

### 구현 방법
**Step 1**: PR Template 추가
- `.github/PULL_REQUEST_TEMPLATE.md` 생성

**Step 2**: CODEOWNERS 설정
- `.github/CODEOWNERS` 생성

**Step 3**: Branch Protection Rules
- Required reviewers 설정

### 세미콜론 팀 기준 적용
- ✅ Team Codex: PR 리뷰 24시간 내 응답
- ✅ Team Codex: 최소 1명 Approve 필수
```

## Scenario 5: Quality Strategy

```
User: 테스트 커버리지 어떻게 올리면 좋을까?

Advisor:
## 🎯 테스트 커버리지 향상 전략

### 현재 상황 파악
1. 현재 커버리지 확인: `npm run test:coverage`
2. 미커버 영역 식별

### 권장 접근법
1. **Critical Path First**: 핵심 비즈니스 로직 우선
2. **Layer by Layer**: Repository → Hooks → Components 순서
3. **Integration > Unit**: 사용자 관점 테스트 우선

### 세미콜론 팀 기준
- Constitution: 80% 이상 목표
- Focus: Repository, Hooks 레이어 우선

### 다음 단계
1. `npm run test:coverage` 실행
2. Uncovered lines 확인
3. 높은 우선순위부터 테스트 추가
```

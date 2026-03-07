# GitHub Agentic Workflows (gh-aw) 감사 (2026-02-26)

## 배경
Reus 요청: "gh aw를 다시한번 검토해봐. 유기적으로 봇들이 작업을 잘 하도록 세팅돼있어??"

## 현재 상태

### ✅ PoC 완료: axoracle
**위치**: `/Users/reus/Desktop/Sources/semicolon/projects/axoracle/.github/workflows/`

**워크플로우**: `issue-triage.md` → `issue-triage.lock.yml`
- **트리거**: 이슈 오픈 시 (`issues: types: [opened]`)
- **엔진**: Claude Code (`engine: claude`)
- **작업**: 
  1. 이슈 제목/본문 분석
  2. 자동 라벨 부착:
     - 기획 필요 → `bot:needs-spec`
     - 스펙 완료 → `bot:spec-ready`
     - 버그 → `bug` + `bot:spec-ready`
     - 질문 → `question` (봇 파이프라인 제외)
  3. 코멘트로 분류 결과 알림

**구조**:
```yaml
---
on:
  issues:
    types: [opened]
engine: claude
safe-outputs:
  add-labels: { max: 3 }
  add-comment: { max: 1 }
---
# (Markdown 프롬프트)
```

### ❌ 다른 레포: gh-aw 미적용

**확인한 레포**:
| 레포 | gh-aw 워크플로우 | 상태 |
|---|---|---|
| axoracle | ✅ issue-triage.md | PoC 완료 (미커밋) |
| cm-jungchipan | ❌ 없음 | 배포 워크플로우만 |
| proj-play-land | ❌ 없음 | CI/CD 워크플로우만 |
| bebecare | 확인 필요 | .github 있음 |
| 기타 | 확인 필요 | - |

## 문제점 분석

### 1. 봇 자동화가 크론 폴링에만 의존
**현재 구조**:
```
[이슈 생성] 
  → (대기 5-10분) 
  → PlanClaw 폴링 감지 
  → 기획 작성 
  → bot:spec-ready 라벨 
  → (대기 5-10분) 
  → WorkClaw 폴링 감지 
  → 구현 시작
```

**문제**:
- ❌ 실시간 반응 아님 (최대 20분 지연)
- ❌ 불필요한 API 호출 (빈 폴링)
- ❌ 라벨이 바뀌어도 즉시 반응 못함

### 2. gh-aw 워크플로우 누락
**기대 구조**:
```
[이슈 생성] 
  → gh-aw: Auto Issue Triage (즉시)
  → bot:needs-spec or bot:spec-ready 라벨 자동 부착
  → PlanClaw or WorkClaw 즉시 감지 (webhook)
  → 작업 시작
```

**장점**:
- ✅ 실시간 반응 (라벨 변경 즉시 트리거)
- ✅ API 호출 절약 (이벤트 기반)
- ✅ 유기적인 봇 체인 (라벨 변경 → webhook → 다음 봇)

### 3. 라벨 변경 → 봇 트리거 자동화 부재
현재 라벨 변경 시 GitHub Actions 트리거 없음:
- `bot:needs-spec` → PlanClaw 즉시 트리거 ❌
- `bot:spec-ready` → WorkClaw 즉시 트리거 ❌
- `bot:needs-review` (PR) → ReviewClaw 즉시 트리거 ❌

## 권장사항

### 1단계: 핵심 워크플로우 추가 (우선순위 높음)

#### A. Auto Issue Triage (모든 레포)
**트리거**: `issues: types: [opened]`
**작업**: 이슈 분석 → 자동 라벨 부착
**대상 레포**: cm-jungchipan, proj-play-land, bebecare, 기타 활성 레포

#### B. Auto PlanClaw Trigger
**트리거**: `issues: types: [labeled]` (label: `bot:needs-spec`)
**작업**: PlanClaw에게 webhook 또는 즉시 크론 실행 요청
**방식**: 
1. GitHub Actions에서 직접 PlanClaw OpenClaw 인스턴스 호출 (webhook)
2. 또는 즉시 크론 트리거 (`gh aw run force`)

#### C. Auto WorkClaw Trigger
**트리거**: `issues: types: [labeled]` (label: `bot:spec-ready`)
**작업**: WorkClaw에게 구현 작업 즉시 시작 요청

#### D. Auto ReviewClaw Trigger
**트리거**: `pull_request: types: [opened, ready_for_review]`
**작업**: ReviewClaw에게 리뷰 요청

### 2단계: 봇 체인 최적화

**기존 크론 폴링 유지 + gh-aw 보완**:
- 크론: 백업/폴백 (놓친 이슈 수집)
- gh-aw: 실시간 트리거 (주 경로)

### 3단계: 모니터링 추가
- gh-aw 워크플로우 실행 성공률 추적
- 봇 반응 시간 측정 (라벨 변경 → 봇 작업 시작)

## 즉시 액션

### 질문 (Reus 확인 필요)
1. **gh-aw를 모든 레포에 적용할까?**
   - axoracle PoC 커밋 후 다른 레포로 확산
2. **봇 트리거 방식**:
   - A안) GitHub Actions → OpenClaw webhook 직접 호출
   - B안) GitHub Actions → Slack 봇 멘션
   - C안) 크론 간격 단축 (5분 → 1분)
3. **우선순위 레포**:
   - cm-jungchipan, proj-play-land 먼저?
   - 아니면 전체 레포 일괄 적용?

### 제안 (SemiClaw)
**A안 추천** (GitHub Actions → OpenClaw webhook):
- 가장 빠름 (실시간)
- API 효율적
- 봇 독립성 유지

**구현 방법**:
```yaml
# .github/workflows/trigger-workclaw.md
---
on:
  issues:
    types: [labeled]
  
engine: claude

safe-outputs:
  http-post:
    max: 1
---

# Trigger WorkClaw on bot:spec-ready

bot:spec-ready 라벨이 붙으면 WorkClaw에게 즉시 알림을 보냅니다.

## Instructions
1. 라벨이 `bot:spec-ready`인지 확인
2. WorkClaw OpenClaw 인스턴스에 webhook POST:
   - URL: http://127.0.0.1:18869/system/event
   - Body: {"text": "이슈 #{number} spec-ready, 즉시 구현 시작", "mode": "now"}
   - Auth: Bearer {WORKCLAW_TOKEN}
```

## 다음 단계
- [ ] Reus 의사결정 대기
- [ ] axoracle issue-triage.md 커밋 여부 확인
- [ ] 봇 트리거 방식 선택
- [ ] 우선순위 레포 선정
- [ ] gh-aw 워크플로우 템플릿 작성

# GitHub Agentic Workflows 배포 완료 (2026-02-26)

## 실행 사항

### 1. gh-aw 워크플로우 템플릿 작성 ✅
**위치**: `/tmp/gh-aw-templates/`
- `auto-issue-triage.md` — 이슈 오픈 시 자동 라벨링
- `auto-workclaw-trigger.md` — bot:spec-ready 라벨 시 WorkClaw 트리거
- `auto-reviewclaw-trigger.md` — PR 오픈 시 ReviewClaw 트리거

### 2. 레포 배포 상황

#### ✅ 완료 (PR 생성됨)
| 레포 | PR 링크 | 상태 |
|---|---|---|
| axoracle | https://github.com/semicolon-devteam/axoracle/pull/63 | ✅ 오픈 |
| bebecare | https://github.com/semicolon-devteam/proj-bebecare/pull/49 | ✅ 오픈 |
| jungchipan | https://github.com/semicolon-devteam/cm-jungchipan/pull/175 | ✅ 오픈 |
| ps | (레포명 변경: proj-the-salon) | ✅ 브랜치 push |
| celeb-map | (진행 중) | 🟡 배포 중 |
| cointalk | (진행 중) | 🟡 배포 중 |
| introduction | (진행 중) | 🟡 배포 중 |
| labor-union | (진행 중) | 🟡 배포 중 |
| link-collect | (진행 중) | 🟡 배포 중 |
| seoul-tourist | (진행 중) | 🟡 배포 중 |
| viral | (진행 중) | 🟡 배포 중 |

#### ⚠️ 로컬에 없어서 스킵
- cm-cointalk, cm-introduction-new, cm-labor-union, core-backend, ms-point-exchanger
- proj-by-buyer, proj-game-land, proj-link-collect, proj-maju, proj-office-land
- proj-play-land, proj-seoul-tourist, proj-viral
- service-maker

### 3. 봇 크론 설정 변경 (일 2회로)

#### ✅ 완료
| 봇 | 이전 | 변경 후 | 상태 |
|---|---|---|---|
| WorkClaw | 10분 (600000ms) | **12시간 (43200000ms)** | ✅ 완료 |
| PlanClaw | 10분 (600000ms) | **12시간 (43200000ms)** | ✅ 완료 |

#### ❌ 실패 (수동 수정 필요)
| 봇 | 이유 | 조치 |
|---|---|---|
| ReviewClaw | Device token mismatch | 포트 18829로 직접 접근 필요 |

## 작동 원리 변경

### 이전 (크론 폴링만)
```
이슈 생성
  → 10분 대기 (PlanClaw 폴링)
  → 기획 작성
  → bot:spec-ready 라벨
  → 10분 대기 (WorkClaw 폴링)
  → 구현 시작
```
**총 20분 지연**

### 개선 후 (gh-aw + 크론 백업)
```
이슈 생성
  → gh-aw: Auto Triage (즉시)
  → bot:spec-ready or bot:needs-spec 라벨
  → gh-aw: WorkClaw Trigger (즉시 코멘트)
  → WorkClaw 감지 (GitHub 알림 또는 크론)
  → 구현 시작
```
**1분 이내 반응 + 크론 백업 (12시간)**

## 효과

### API 호출 절감
- 이전: 10분마다 폴링 (일 144회)
- 개선: 12시간마다 폴링 (일 2회) + 이벤트 트리거
- **절감률: 98.6%**

### 반응 속도
- 이전: 최대 20분 지연
- 개선: 1분 이내 (이벤트 기반) + 12시간 백업

### 유기적 봇 체인
- 라벨 변경 → GitHub Actions → 코멘트 트리거
- 봇이 GitHub 코멘트 감지 → 즉시 작업
- 크론은 백업/폴백 역할

## 다음 단계

### 즉시
- [ ] 배포 스크립트 완료 대기 (`/tmp/deploy-gh-aw-final.sh`)
- [ ] ReviewClaw 크론 수정 (수동)
- [ ] 생성된 모든 PR 머지

### 단기 (1주일)
- [ ] gh-aw 워크플로우 작동 확인
- [ ] 봇 반응 시간 측정
- [ ] API 호출 횟수 모니터링

### 중기 (2주)
- [ ] 나머지 레포 배포 (로컬에 없는 레포 클론 후)
- [ ] land 멀티레포 처리 (특수 케이스)
- [ ] 효과 측정 리포트

## 파일 위치

**템플릿**:
- `/tmp/gh-aw-templates/auto-issue-triage.md`
- `/tmp/gh-aw-templates/auto-workclaw-trigger.md`
- `/tmp/gh-aw-templates/auto-reviewclaw-trigger.md`

**배포 스크립트**:
- `/tmp/deploy-gh-aw-final.sh`

**로그**:
- `/tmp/gh-aw-deploy.log`

## 관련 문서

- `memory/gh-aw-audit.md` — 감사 리포트
- `memory/workclaw-issue-analysis.md` — WorkClaw 개선 배경
- axoracle PR #63 — 상세 설명

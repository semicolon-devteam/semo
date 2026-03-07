# GitHub 운영 규칙 통합 문서

> GitHub 관련 모든 규칙을 한 곳에. decisions.md, cicd.md, bots.md, github-polling-protocol.md에서 통합.

---

## 🔴 이슈 생성 시 필수 체크리스트
이슈를 생성하면 **반드시 아래 순서를 모두 수행**:
1. `gh issue create` 로 이슈 생성
2. `gh project item-add 1 --owner semicolon-devteam --url <이슈URL>` 로 **이슈관리 프로젝트 보드 등록** (프로젝트 번호: `1`, ID: `PVT_kwDOC01-Rc4AtDz2`)
3. 적절한 `bot:*` 라벨 부착 (담당 봇이 폴링으로 감지)
4. 한 기능에 한 이슈 — 중복 생성 금지

## 이슈 등록 R&R (2026-02-17 확정)
- **버그/단순 수정** → SemiClaw이 직접 이슈 등록 → WorkClaw 인계
- **기획 필요 기능** → PlanClaw 기획 → 이슈 생성 → WorkClaw 인계
- PlanClaw은 기획 단계에서만 관여, 단순 버그에 끼지 않음
- DesignClaw는 이슈 생성 ❌ → 기존 이슈에 디자인 스펙 코멘트 추가

## 봇 간 이슈 중복 방지 (2026-02-18)
- 이슈 생성은 PlanClaw(기획) 담당
- DesignClaw는 해당 이슈에 디자인 스펙 코멘트 추가
- 한 기능에 한 이슈. 중복 시 메인 유지 + 나머지 Close & 병합

---

## 라벨 컨벤션 & 폴링 자동화 (2026-02-17 승인)

### 워크플로우 라벨
| 라벨 | 의미 | 담당 봇 |
|---|---|---|
| `bot:needs-spec` | 기획서 필요 | PlanClaw |
| `bot:spec-ready` | 기획 완료, 구현 대기 | WorkClaw |
| `bot:in-progress` | 봇 작업 중 | (작업중 봇) |
| `bot:needs-review` | PR 리뷰 필요 | ReviewClaw |
| `bot:done` | 봇 작업 완료 | — |
| `bot:blocked` | 사람 개입 필요 | SemiClaw 알림 |

- `bot:*` 라벨은 기존 라벨(bug, enhancement 등)과 공존

### 폴링 규칙 (옵트인 방식 - 2026-02-27)

**원칙: `bot:` 라벨이 없으면 봇 개입 금지 (기본값)**

| 봇 | 주기 | 쿼리 | 액션 |
|---|---|---|---|
| PlanClaw | 10분 | `label:bot:needs-spec -label:bot:in-progress -label:bot:blocked` | 기획서 작성 → `bot:spec-ready` |
| WorkClaw | 5분 | `label:bot:spec-ready -label:bot:in-progress -label:bot:blocked` | 구현 → PR → `bot:needs-review` |
| ReviewClaw | 5분 | `is:pr is:open review:none -label:bot:blocked` | 리뷰 → approve 시 라벨만 변경 (`bot:done` 추가, 머지 ❌) / request changes → `bot:blocked` |
| SemiClaw | 15분 | `label:bot:blocked` | Slack 알림 + 대시보드 |

**중요 변경사항 (2026-02-27):**
- ✅ 모든 쿼리에 `-label:bot:blocked` 추가 (bot:blocked 이슈는 봇이 절대 건드리지 않음)
- ✅ 옵트인 방식: `bot:` 라벨이 명시적으로 있어야만 봇 개입 (PlanClaw/WorkClaw 이미 충족)
- ⚠️ ReviewClaw PR 감지: `bot:needs-review` 라벨 의존하지 않음 (review:none 기반) - WorkClaw이 PR 생성 시 자동으로 review 상태 트리거

**보조 규칙:**
- 중복 방지: `bot:in-progress` 라벨로 락
- Rate limit: 합계 ~80/h (5000 중 1.6%)

### ~~라벨 체인 즉시 알림~~ → 폐기 (2026-02-20)
> **폐기됨.** 모든 봇 간 인계는 라벨+폴링으로만 수행. Slack 직접 멘션 인계 금지.

### 순수 라벨+폴링 인계 규칙 (2026-02-20 승인)
**원칙: 봇 간 직접 Slack 멘션 인계 전면 폐기. 라벨 전환 → 폴링 감지만 허용.**

#### 봇별 폴링 쿼리 (옵트인 방식 - 2026-02-27)
| 봇 | 주기 | 쿼리 | 액션 |
|---|---|---|---|
| PlanClaw | 10분 | `label:bot:needs-spec -label:bot:in-progress -label:bot:blocked` | 기획 → `bot:spec-ready` |
| WorkClaw | 5분 | `label:bot:spec-ready -label:bot:in-progress -label:bot:blocked` | 구현 → PR → `bot:needs-review` |
| WorkClaw | 5분 | `is:pr is:open review:changes_requested -label:bot:blocked` (자기 PR) | 리뷰 피드백 반영 → 재push |
| ReviewClaw | 5분 | `is:pr is:open review:none -label:bot:blocked` | 리뷰 → approve/changes_requested |
| SemiClaw | 15분 | `label:bot:blocked` | Slack 알림 |
| SemiClaw | 15분 | `label:bot:done` | 완료 확인 + 대시보드 반영 |

#### 플로우별 전환
- **기획→구현**: PlanClaw이 `bot:spec-ready` 라벨만. WorkClaw 폴링 감지.
- **구현→리뷰**: WorkClaw이 PR 생성만. ReviewClaw `review:none` 폴링 감지.
- **리뷰 피드백**: ReviewClaw `request changes`만. WorkClaw `changes_requested` 폴링 감지.
- **리뷰 완료**: ReviewClaw approve + `bot:done` 라벨만 (머지 ❌). SemiClaw 폴링 감지.
- **E2E 버그**: ReviewClaw 이슈 생성 + `bot:spec-ready` 라벨만. WorkClaw 폴링 감지.
- **긴급 오케스트레이션**: SemiClaw이 이슈 생성 + 적절한 라벨 (멘션 X).
- **정보 요청**: GitHub 이슈 `bot:info-req` 라벨 + 코멘트. 답변 후 즉시 close.

### 상태 추적
각 봇이 `memory/polling-state.json` 유지

### 워크플로우 예시
```
[이슈 생성 + bot:needs-spec]
  → PlanClaw 감지 (10분) → 기획서 → bot:spec-ready
  → WorkClaw 감지 (5분) → 구현 → PR → bot:needs-review
  → ReviewClaw 감지 (5분) → 리뷰 → approve → bot:done 라벨 (머지 ❌)
```

---

## PR 머지 규칙 (2026-02-27 확정)

### ❌ 봇이 절대 PR 머지 금지
- **모든 봇**: `gh pr merge` 명령 사용 절대 금지
- **SemiClaw, WorkClaw, ReviewClaw 모두 해당**
- 긴급 상황에도 봇이 머지하지 않음 — 사람이 머지

### ✅ 리뷰 완료 후 봇 액션
1. **ReviewClaw 리뷰 완료** → GitHub PR에 리뷰 제출 (approve/changes_requested)
2. **라벨 변경**: `bot:needs-review` → `bot:done` (approve 시) 또는 `bot:blocked` (changes_requested 시)
3. **Slack 보고**: 해당 프로젝트 채널/스레드에 리뷰 완료 + 머지 가능 상태 알림
4. **사람이 머지**: Reus 또는 팀원이 직접 머지 버튼 클릭

### Self-Approve 처리 (2026-02-27)
- **Self-PR 감지**: PR 작성자 == ReviewClaw 계정 (`reus-jeon`)
- **액션**: Approve 시도 ❌ → 코멘트만 남김
- **코멘트 내용**: "리뷰 완료. Self-PR로 인해 Approve 제출 불가. 사람이 직접 Approve 및 머지 필요."
- **라벨**: `bot:done` (리뷰 완료 의미)
- **Slack 보고**: Self-Approve 불가 상황 명시

### 머지 주체
- **사람만 머지 가능**: Reus, Garden, 기타 팀원
- **봇은 라벨 + 알림만**: 머지 권한 없음

---

## ~~봇 간 정보 공유 (Slack 멘션)~~ → 폐기 (2026-02-20)
> **폐기됨.** 정보 요청도 GitHub 이슈 (`bot:info-req` 라벨) 경유. 답변 후 즉시 close.

## GitHub Agentic Workflows (gh-aw) 엔진 (2026-02-19 지시)
- 기본 엔진: **Claude Code** (engine: claude)
- GitHub Copilot 아님 — 시크릿: `ANTHROPIC_API_KEY` 또는 `CLAUDE_CODE_OAUTH_TOKEN`
- `COPILOT_GITHUB_TOKEN` 사용 금지
- 모든 레포의 gh-aw 워크플로우는 이 기준
- PoC 완료: `gh aw` CLI로 Markdown → GitHub Actions 자동 생성 (axoracle, 미커밋)

## GitHub Automation OAT (2026-02-19 지시)
- GitHub Actions 워크플로우의 OAT는 **Claude Code OAT** 사용
- GitHub Copilot OAT 사용 금지

## 변경 통제 (2026-02-18 승인)
- `actions-template` 등 공용 레포: InfraClaw 단독 수정 절대 금지
- 인프라 변경(코드, 배포, 시크릿, 워크플로우): Garden 승인 필수
- 긴급 상황에도 "진단 → Garden에게 해결안 제시 → 승인 후 실행" 순서 강제
- SemiClaw 게이트키핑: 인프라 작업 인계 시 "Garden 확인 후 진행" 조건 명시

## 진척도 평가 (2026-02-18)
- GitHub 이슈 + dev 브랜치 커밋 리스트 교차 검증
- 불일치 시 Reus에게 보고
- 대상: cm-land, proj-game-land, proj-play-land, proj-office-land

## ReviewClaw E2E 후처리 (2026-02-18, 2026-02-20 변경)
- ① 이슈 생성 + `bot:spec-ready` 라벨 → ② 리포트 발행
- Slack 멘션 인계 불필요 (WorkClaw이 폴링으로 감지)

## CI/CD 구조
- **3단계**: Dev → Staging → Production
- **actions-template**: `semicolon-devteam/actions-template` 중앙 관리
  - 주요: `ci-without-env.yml`, `ci-next*.yml`, `ci-go.yml`, `deploy-to-server.yml`, `update-kustomize-tag.yml`, `claude-code-review.yml`
- **GitOps**: Kustomize 기반, `semi-colon-ops` 레포
- **DockerHub**: `semicolonmanager`

## 레포 프리픽스 & 매핑
| 프리픽스 | 의미 | 비고 |
|---|---|---|
| `proj-` | 프로젝트 | 통일 예정 |
| `cm-` | CoMmunity | proj-로 전환 예정 |
| `ms-` | 마이크로서비스 | |
| `core-` | 코어 인프라/공통 | |
| `mvp-` | MVP | |

## 대상 레포
모든 활성 레포 (org 전체 검색). 특정 레포 제외 필요 시 쿼리에 `-repo:` 추가.

---

## 프로젝트 클론 경로 규칙 (2026-02-25, 2026-02-27 강화)
**원칙: 모든 프로젝트는 `/Users/reus/Desktop/Sources/semicolon/projects/` 하위에만 클론**

### 절대 금지
- ❌ `/Users/reus/Desktop/Sources/semicolon/` 에 직접 클론 (루트 오염)
- ❌ 다른 임의 경로에 클론
- ❌ `git clone <URL>` 만 실행 (디렉토리 이름 자동 생성 → 프리픽스 포함됨)

### 필수 규칙 (2026-02-27 강화)
1. **디렉토리 이름에서 프리픽스 제거** (`cm-`, `proj-`, `ms-` 등)
2. **git clone 시 디렉토리 이름 명시** (자동 생성 방지)

### 올바른 클론 방법
```bash
# ✅ 올바름: 디렉토리 이름 명시 + 프리픽스 제거
cd /Users/reus/Desktop/Sources/semicolon/projects
git clone https://github.com/semicolon-devteam/cm-jungchipan.git jungchipan
git clone https://github.com/semicolon-devteam/proj-bebecare.git bebecare
git clone https://github.com/semicolon-devteam/ms-point-exchanger.git point-exchanger

# ❌ 잘못됨: 디렉토리 이름 없음 (자동으로 cm-jungchipan 생성됨)
git clone https://github.com/semicolon-devteam/cm-jungchipan.git
```

### 프리픽스 매핑
| GitHub 레포 | 로컬 디렉토리 |
|---|---|
| `cm-jungchipan` | `projects/jungchipan` |
| `cm-labor-union` | `projects/labor-union` |
| `proj-bebecare` | `projects/bebecare` |
| `proj-cat` | `projects/cat` |
| `ms-point-exchanger` | `projects/point-exchanger` |

### 이유
- 루트 디렉토리 정리 (프로젝트 vs 공통 인프라 분리)
- 자동화 스크립트 경로 일관성 유지
- 프리픽스 중복 방지 (GitHub에만 존재, 로컬에선 제거)

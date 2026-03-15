# Project Context

> 세션 간 영속화되는 프로젝트 상태
> 마지막 업데이트: 2026-03-15

---

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **이름** | semo |
| **목적** | OpenClaw 봇팀 KB·파일구조·상태 시각화 대시보드 |
| **배포 URL** | https://semo.semi-colon.space |
| **레포** | semicolon-devteam/semo (브랜치: dev) |
| **작업 클론** | `/Users/reus/Desktop/Sources/semicolon/projects/semo/` |

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 14, TailwindCSS, PixiJS (교체 예정) |
| Backend | Next.js API Routes |
| DB | PostgreSQL (semo 스키마), Supabase (KB 벡터) |
| 데이터 소스 | GitHub API (bot-workspaces), OpenClaw Gateway API |
| 배포 | OCI OKE (Kubernetes), GitHub Actions |

---

## 현재 작업 상태 (2026-03-15)

### 완료
- ✅ semo-remote 아카이브 (`semo-system/_archived/semo-remote/`)
- ✅ GitHub 레포 semo-remote-client, semo-remote-app Archived 처리
- ✅ bot-workspaces 미커밋 변경사항 동기화 (95개 파일)
- ✅ `.claude` 개편 (현재 진행)
- ✅ 중복 클론 정리 (`/semo/` 동기화 완료)

### 진행 중
- 🔨 `.claude` 전체 개편 (컨텍스트 정확화)

### 다음 우선순위
- 📋 대시보드 실제 데이터 파이프라인 연결
  - `/bots` 페이지: DB 또는 GitHub fallback으로 실제 봇 목록
  - `/kb` 페이지: PostgreSQL KB 데이터 연결
  - `/dashboard` 메인: semo-office PixiJS UI → 실제 봇 모니터링 UI로 교체
- 📋 bot-workspaces sync 자동화 (OpenClaw 봇이 push까지 하도록)

---

## 대시보드 구현 현황

| 페이지 | 상태 | 메모 |
|--------|------|------|
| `/dashboard` | ⚠️ 목업 | PixiJS 가상 오피스(구 semo-office) — 교체 필요 |
| `/bots` | 🔨 부분 | API 라우트 있음, DB/GitHub fallback 설계 완료 |
| `/kb` | 🔨 부분 | API 라우트 있음, 실제 데이터 미연결 |

---

## OpenClaw 봇팀 현황

| 봇 | 역할 | 세션 수 |
|----|------|---------|
| SemiClaw | PM/오케스트레이터 | 215 |
| WorkClaw | 풀스택 구현 | 4,671 |
| ReviewClaw | 코드리뷰/QA | 2,289 |
| PlanClaw | 기획/스펙 | 1,278 |
| InfraClaw | 인프라/DevOps | 220 |
| DesignClaw | 디자인/퍼블리싱 | 96 |
| GrowthClaw | SEO/마케팅 | 1,258 |

봇 workspace 파일: `semo-system/bot-workspaces/{bot}/`
봇 OAuth 인증: `~/.openclaw-{bot}/agents/main/agent/auth-profiles.json`

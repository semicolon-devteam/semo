# SEMO 프로젝트 전용 규칙

> semo 레포 작업 시에만 적용되는 규칙

---

## 작업 환경

- **작업 클론**: `/Users/reus/Desktop/Sources/semicolon/projects/semo/`
- **보조 클론**: `/Users/reus/Desktop/Sources/semicolon/semo/` (동일 레포, 혼동 금지)
- **기본 브랜치**: `dev` (feature/* → dev → main)
- **배포**: `dev` push → GitHub Actions → OCI OKE 자동 배포 (대시보드 Docker 한정)
- **CLI 배포**: Git tag `cli-v*` 푸시 또는 Actions `workflow_dispatch`. `dev` push 만으로는 npm 배포 안 됨. 절차: `.claude/rules/quality-gate.md`

---

## 대시보드 구현 규칙

### ❌ 금지: semo-office 기반 구현
현재 `/dashboard`의 PixiJS 가상 오피스(에이전트가 격자 위를 돌아다니는 UI)는
**구버전 semo-office 잔재**다. 새 기능을 여기에 추가하지 않는다.

### ✅ 올바른 방향: 봇 데이터 모니터링
- 봇 목록·상태: `semo.bot_status` 테이블 또는 GitHub `semo-system/bot-workspaces/`
- KB 뷰어: `semo.kb_items` 테이블 (PostgreSQL)
- 봇 파일 탐색기: GitHub API → `semo-system/bot-workspaces/{bot}/` 경로

### 데이터 우선순위
```
DB (semo.bot_status) → GitHub fallback (bot-workspaces) → 오류
```
DB가 비어있으면 GitHub에서 직접 읽는 fallback이 `/api/bots` 라우트에 구현됨.

---

## 아카이브된 패키지 참조 금지

`semo-system/_archived/` 하위 패키지를 새 코드에서 import하거나 참조하지 않는다.

| 패키지 | 사유 |
|--------|------|
| `semo-remote` | OpenClaw로 대체됨 |
| `semo-hooks` | 아카이브됨 |
| `semo-integrations` | 아카이브됨 |

---

## bot-workspaces 파일 직접 수정 금지

`semo-system/bot-workspaces/**` 파일들은 OpenClaw 봇들이 직접 관리한다.
Claude Code 세션에서 직접 수정하지 않는다. (봇 워크플로 교란 가능)
단, 봇의 요청이나 sync 목적의 커밋은 허용.

---

## GitHub Projects 참조

작업 관련 이슈는 `semicolon-devteam` org의 프로젝트 #1 (이슈관리)에 등록.
→ 상세 설정은 `memory/projects.md` 참조.

---

## 환경변수 필수 목록

| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 (semo 스키마) |
| `GITHUB_TOKEN` | bot-workspaces GitHub API 조회 |
| `SUPABASE_URL` | Supabase 연결 |
| `SUPABASE_KEY` | Supabase 인증 |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | MCP GitHub 서버용 |

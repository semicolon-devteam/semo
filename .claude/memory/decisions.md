# Architecture Decisions (ADR)

> 프로젝트 아키텍처 결정 기록
> 마지막 업데이트: 2026-03-15

---

### ADR-001: semo-remote 폐기 및 아카이브

**날짜**: 2026-03-15
**상태**: Accepted

**배경**
semo-remote는 Claude Code 세션을 모바일에서 원격 조작하기 위해 개발됨.
OpenClaw 도입 후 봇들이 독립 세션을 자율 관리하며 Slack으로 결과 전달하는 방식으로 전환,
Reus가 직접 Claude Code 세션을 장시간 켜두고 원격 조작하는 시나리오가 소멸.

**결정**
- `semo-system/semo-remote/` → `semo-system/_archived/semo-remote/`로 이동 (이력 보존)
- GitHub 레포 `semo-remote-client`, `semo-remote-app` Archived 처리

**근거**
폐기하되 삭제하지 않는 이유: v0.4.0까지 완성된 세션 스트리밍 기술 자산.
향후 semo-office에서 봇 세션 실시간 스트리밍 뷰 구현 시 재활용 가능성.

---

### ADR-002: SEMO 대시보드 목적 재정의

**날짜**: 2026-03-15
**상태**: Accepted

**배경**
OpenClaw 봇들이 컨텍스트 폭발로 인한 할루시네이션을 자주 발생시킴.
이를 해결하기 위해 온톨로지 + Knowledge Base를 팀 중앙 DB에 구축.
SEMO 대시보드를 이 KB와 봇 상태를 모니터링하는 도구로 활용하기로 결정.

**결정**
SEMO 대시보드의 현재 목적:
1. 각 봇의 파일구조 탐색 (bot-workspaces)
2. KB/온톨로지 조회·관리
3. 봇 상태 모니터링 (online/offline, 마지막 활동)

semo-office(가상 사무실 시각화)는 향후 개선 방향에 포함되지만,
현재 대시보드의 주 기능이 아님.

**근거**
현재 `/dashboard`의 PixiJS 가상 오피스 UI는 구 semo-office 비전 기반으로
잘못 구현된 것. 실제 데이터 파이프라인 연결이 우선.

---

### ADR-003: 작업 클론 단일화

**날짜**: 2026-03-15
**상태**: Accepted

**배경**
동일 레포(`semicolon-devteam/semo.git`)가 두 곳에 클론됨:
- `/Users/reus/Desktop/Sources/semicolon/projects/semo/` (OpenClaw 봇이 클론)
- `/Users/reus/Desktop/Sources/semicolon/semo/` (기존 작업 클론, 10커밋 뒤처짐)

**결정**
`/projects/semo/`를 메인 작업 클론으로 확정.
`/semo/`는 `git pull`로 동기화 완료. 향후 혼동 방지를 위해 `/semo/` 사용 자제.

---

### ADR-004: context-mode MCP OpenClaw에서 제거

**날짜**: 2026-03-15
**상태**: Accepted

**배경**
`~/.claude.json`에 `context-mode` MCP 서버가 등록되어 있어
OpenClaw 봇 7개가 각각 context-mode 프로세스를 띄움 → CPU ~570% 낭비.
훅(PreToolUse/PostToolUse) 없는 MCP-only 설치라 실제 ctx_* 툴 사용률 0%.

**결정**
`~/.claude.json`의 `mcpServers`에서 `context-mode` 제거.
OpenClaw 봇 재시작 후 프로세스 0개 확인.
Claude Code(Cursor) 세션에서는 계속 사용 가능 (별도 설정).

---

### ADR-005: OAuth 토큰 관리 전략

**날짜**: 2026-03-15
**상태**: Accepted

**배경**
OpenClaw 봇 7개가 모두 만료된 `sk-ant-oat01` 토큰 사용으로 인해 응답 불가 상태 발생.
기존: `type: "token"` (만료 시 자동 갱신 불가)

**결정**
모든 봇의 `auth-profiles.json`을 `type: "oauth"` 형식으로 전환.
access token + refresh token + expires 필드 포함.
현재 로그인된 Claude Code 계정의 OAuth 토큰 사용.
macOS Keychain `"Claude Code-credentials"` (acct=reus)에서 최신 토큰 조회.

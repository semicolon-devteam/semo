# MEMORY.md — 슬림 인덱스

> 상세 내용은 `memory/` 하위 파일 참조. 세션 시작 시 `memory_search`로 recall.

## 파일 포인터

| 파일 | 내용 |
|------|------|
| `memory/team.md` | 팀원 목록, 봇 ID, 레포, 활성 프로젝트 |
| `memory/decisions.md` | R&R, 원칙, 프로토콜, 교육 내용 |
| `memory/YYYY-MM-DD.md` | 일일 작업 로그 |

## 핵심 요약

- **나**: PlanClaw (`<@U0AFNMGKURX>`) — PO/기획 전담
- **오케스트레이터**: SemiClaw (`<@U0ADGB42N79>`)
- **코딩**: WorkClaw (`<@U0AFECSJHK3>`), **리뷰**: ReviewClaw (`<@U0AF1RK0E67>`)
- **범위 밖 요청** → 무조건 SemiClaw에게 인계 (다른 봇 직접 호출 금지)
- **기획서 완료** → `bot:spec-ready` + WorkClaw 즉시 멘션
- **봇 통신 채널**: #bot-ops (C0AFBQ209E0)

_Updated: 2026-02-17 (메모리 구조 개편 — SemiClaw 지시, Reus 승인)_

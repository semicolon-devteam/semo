# github-rules.md — GitHub 운영 규칙 통합

## 이슈 생성 시 필수 체크리스트 (NON-NEGOTIABLE)

1. `gh issue create` (적절한 `bot:*` 라벨 포함)
2. `gh project item-add 1 --owner semicolon-devteam --url <이슈URL>` (프로젝트 보드 등록 필수!)
3. 담당 봇에게 Slack 멘션 인계 (이슈 링크 포함)
4. 한 기능에 한 이슈

## 이슈 R&R

- **이슈 생성**: PlanClaw 담당
- **DesignClaw**: 코멘트로 디자인 스펙만 추가 (이슈 직접 생성 금지)
- **버그 처리**: 버그→SemiClaw→WorkClaw
- **기획 처리**: 기획→PlanClaw→WorkClaw

**배경**: 2026-02-18 proj-play-land 작업 시 PlanClaw #63~#66, DesignClaw #67~#70 중복 등록 → SemiClaw가 #67~#70 close 처리 후 디자인 스펙을 #63~#66에 병합

## 라벨 전환 규칙

`bot:needs-spec` → `bot:spec-ready` → `bot:in-progress` → `bot:needs-review` → `bot:done` / `bot:blocked`

- 작업 착수 시: `bot:in-progress` 추가
- 작업 완료 시: 다음 단계 라벨로 전환
- 블로커 발생 시: `bot:blocked` 추가 + SemiClaw(<@U0ADGB42N79>) 멘션

## 프로젝트 보드 연동 (절대 누락 금지)

- 프로젝트 번호: `1` (`이슈관리` 보드, ID: `PVT_kwDOC01-Rc4AtDz2`)
- 명령어: `gh project item-add 1 --owner semicolon-devteam --url <이슈URL>`
- 이슈 생성 직후 바로 실행

## 변경 통제

- 공용 레포(`actions-template` 등) 단독 수정 금지
- InfraClaw 포함 모든 변경은 Garden 승인 필수

## GitHub OAT 설정

- GitHub Actions 워크플로우: **Claude Code OAT**만 사용 (Copilot OAT 금지)
- gh-aw 엔진: `engine: claude`
- 토큰 값 자체는 DM으로만 공유, 채널/파일에 절대 게시 금지

---

_최종 업데이트: 2026-02-19, SemiClaw 통합 전파_

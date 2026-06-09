# E4 컨시어지 요청 큐 백본 — PoC 결과 (2026-06-09)

**목적**: 컨시어지 이미지(사람이 처리) 흐름의 데이터 백본 — 접수→대기열→처리→완료 — 을 라이브 DB로 검증. 외부계정 불요.

## 결과 (PASS)

- 스키마 `131_concierge_requests.sql` 적용(멱등): `semo.concierge_requests`(tenant 격리, kind/status/payload/result_ref) + 대기열 뷰 `v_concierge_queue`.
- 흐름 검증: 접수(pending) → **우리 팀 대기열 뷰 조회**(슬랙 알림 대상) → in_progress(assignee) → delivered(result_ref=중앙저장 참조) → cleanup. 전 단계 동작.

## 입증 vs 잔여

- ✅ **입증(자율)**: 컨시어지 요청 큐 데이터 백본 + 상태머신 + 대기열 뷰.
- ⏳ **잔여(외부/빌드)**: (a) 슬랙 실알림(토큰·채널 = 운영 배선; 본 PoC는 `notified_at`만 기록, 실채널 스팸 회피) (b) 대시보드 요청 폼/전달 UI (c) 산출물 중앙 저장(E5.2) 연결.

## 산출물

`packages/cli/migrations/131_concierge_requests.sql`, `docs/reports/poc/e4-concierge-intake-poc.mjs`.

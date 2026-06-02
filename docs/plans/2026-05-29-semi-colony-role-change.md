# Semi/Colony 역할 변경 적용 기록

작성일: 2026-05-29

## 변경 요약

요청사항:

1. Semi/Colony 역할 통합
2. Colony를 메신저 메시지 주기 수집 + 팀 컨텍스트 메모리(KB) 업데이트 담당으로 전환

적용:

- slack-router의 Hermes orchestrator 설정에서 Colony를 Semi와 동일 ROUTE 기반 오케스트레이션으로 정렬
- Slack 수신 메시지를 Colony 컨텍스트 버퍼에 적재
- 주기 flush 워커가 `semo kb upsert semo iteration colony-context-memory-latest` 수행

## 구현 파일

- `packages/slack-router/src/index.ts`
  - `COLONY_CONTEXT_MEMORY_ENABLED`
  - `COLONY_CONTEXT_FLUSH_INTERVAL_MS`
  - `COLONY_CONTEXT_BATCH_LIMIT`
  - `recordColonyContextSample()`
  - `flushColonyContextMemory()`
  - `setInterval(...flush...)`
  - `handleSlackMessage()` 시작 시 샘플 수집 호출
  - Colony orchestrator role/action 설정 갱신

## 환경변수

- `COLONY_CONTEXT_MEMORY_ENABLED` (default: true)
- `COLONY_CONTEXT_FLUSH_INTERVAL_MS` (default: 600000, 10분)
- `COLONY_CONTEXT_BATCH_LIMIT` (default: 120)

## 동기화 상태

- Local code: 반영 완료
- KB decision 문서: 미반영 (별도 `semo kb upsert` 필요)
- DB 스키마 변경: 없음

## 주의

- 현재 구현 범위는 Slack router 기준 수집/업데이트이다.
- Discord까지 동일 정책으로 확장하려면 discord-router에도 동등한 collector를 추가해야 한다.

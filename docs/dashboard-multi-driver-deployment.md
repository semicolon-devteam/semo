# Dashboard Multi-Driver / Multi-Process 안전성 — 운영 가이드

> P2-A (2026-05-28). `packages/semo-dashboard` 가 PostgreSQL / SQLite / Obsidian / Notion 어느 backend 든 동일하게 작동하기 위한 운영 제약과 디플로이 패턴.

## 배경

P0-B 에서 `lib/core/kb-store-singleton.ts` 가 도입되며 dashboard 가 `KbStore` 인터페이스로 KB 를 접근하게 됨. 이후 P2-D 에서 `getItem` / `search` 가 KbStore 경유로 마이그레이션 됨. 그러나 어댑터별로 **multi-process 안전성** 특성이 다르므로 디플로이 시 주의 필요.

## 어댑터별 특성

| Backend  | Read 동시성   | Write 동시성   | Process 분리 안전   | Container 가능       | 비고                             |
| -------- | ------------- | -------------- | ------------------- | -------------------- | -------------------------------- |
| postgres | ✅ Pool       | ✅ Pool        | ✅                  | ✅                   | 기본 권장. multi-process 무문제  |
| sqlite   | ⚠️ WAL 모드   | ⚠️ 직렬화 lock | ⚠️ 같은 파일 권장 X | ⚠️ named volume 필요 | 단일 process 권장                |
| obsidian | ✅ FS read    | ⚠️ file lock   | ⚠️ vault 단일 owner | ⚠️ vault mount       | watch 충돌 가능                  |
| notion   | ⚠️ rate-limit | ⚠️ rate-limit  | ✅ stateless API    | ✅                   | 캐시 sidecar 는 같은 SQLite 특성 |

## 권장 디플로이 패턴

### 패턴 1 — postgres 단독 (semicolon 본진, 권장)

```yaml
deploy:
  - dashboard (Next.js cluster, 2~4 process)
  - 모든 process 가 같은 PG 풀에 접속
환경변수: DATABASE_URL=postgres://...
  SEMO_DASHBOARD_USE_KBSTORE=1 (default)
```

이슈 없음. PG 의 connection pool 이 multi-process 안전.

### 패턴 2 — obsidian 단독 (개인/소규모, 단일 머신)

```yaml
deploy:
  - dashboard (단일 process — Next.js dev/single instance)
  - kb-mirror watch (선택, 백그라운드 daemon)
환경변수: SEMO_CONFIG_PATH=~/.semo/config.toml # kb.driver=obsidian
경고:
  - cluster 모드 비권장. ObsidianKbStore 가 vault file lock 을 비-thread-safe 하게 다룸.
  - Next.js 의 cluster 모드 또는 Vercel 같은 multi-instance 디플로이 X.
```

### 패턴 3 — sqlite (테스트/CI)

```yaml
deploy:
  - dashboard (단일 process)
환경변수:
  SEMO_CONFIG_PATH=~/.semo/config.toml  # kb.driver=sqlite, sqlite_path=~/.semo/kb.db
  PRAGMA journal_mode=WAL  # SQLite 가 자동 적용
경고:
  - Mac OS Container 내부의 SQLite 는 file system journaling 으로 인해 느림. 메모리 모드는 process 재시작 시 데이터 손실.
```

### 패턴 4 — hybrid (postgres + obsidian via kb-mirror)

```yaml
deploy:
  - dashboard (postgres 모드, multi-process OK)
  - kb-mirror start --source obsidian --target postgres --bidirectional (단일 daemon)
환경변수 (dashboard): DATABASE_URL=postgres://...
  SEMO_DASHBOARD_USE_KBSTORE=1
환경변수 (kb-mirror): (별도 process — config.toml 의 kb.obsidian_vault 사용)
주의:
  - dashboard 는 PG 만 read. Obsidian write 는 kb-mirror 가 한쪽 방향으로 흡수.
  - 사용자가 Obsidian vault 에서 직접 수정 → kb-mirror 가 PG 로 push → dashboard 에 즉시 visible.
  - 충돌 해결: updated_at newer-wins (kb-mirror.ts 의 mirrorEntry 참고).
```

## SEMO_DASHBOARD_USE_KBSTORE 롤백 메커니즘

`packages/semo-dashboard/lib/core/kb.ts` 의 `USE_KBSTORE` 가드:

- 기본 `1` (활성)
- `SEMO_DASHBOARD_USE_KBSTORE=0` 으로 legacy PG 직접 경로로 폴백
- 단일 함수 실패 시 catch 안에서 legacy 폴백도 함께 발동 (안전망)

backend 마이그레이션 중 회귀 발생하면 즉시 env 만 toggle 후 재기동.

## Multi-process 신호 — kb-store-singleton 의 globalThis 캐시

`packages/semo-dashboard/lib/core/kb-store-singleton.ts` 의 `globalThis.__semoKbStoreSingleton`:

- Next.js Node.js runtime 의 **process 마다** 한 번씩 instantiate
- Vercel/cluster 처럼 process 늘어나면 instance 도 늘어남 (PG Pool 도 process 마다 별도)
- PG max=5 connections per process → cluster 16 process × 5 = 80 connections (PG side max 확인 필요)
- 환경변수로 max 줄이려면 `KB_DB_POOL_MAX` (없음, 추후 추가 가능)

## SSE (/api/bots/stream) 의 connection 한계

`P2-C` 에서 추가된 SSE handler:

- 각 클라이언트가 LISTEN client (PG connection) 점유
- N 명 dashboard 사용자 = N 개 LISTEN connection × M process = N×M
- PG `max_connections` 부족하면 fallback polling 으로 자동 전환 (handler 내 try/catch)
- 운영: LISTEN connection 은 별도 Pool 사용 권장 (현재는 dashboard 의 main Pool 공유)

## 검증 시나리오

1. **postgres 단독**: `npm run dev` × 2 process 동시 띄움 → `/api/kb/get?domain=semo&key=health` 양쪽 동일 응답 + SSE 양쪽 다 작동
2. **obsidian 단독**: 단일 `npm run dev` + `.md` 파일 수정 → 화면 새로고침 시 변경 반영
3. **hybrid**: kb-mirror 띄운 상태에서 Obsidian vault 수정 → PG 에 mirror 됨 → dashboard refresh 시 보임 (latency ≤ 5s polling)

## P2 후 작업 (별도 트랙)

- `KB_DB_POOL_MAX` env 추가 + connection budget 제어
- SSE 전용 read-only PG user (보안)
- Cluster 모드에서 ObsidianKbStore 의 single-instance 강제 lock (`flock` 또는 PG advisory lock)
- KbStore 인터페이스에 `count`, `listByKey` 추가 → P2-D 의 나머지 함수도 마이그레이션 가능

## Refs

- [[semo/decision/pluggable-persistence-implementation-2026-05-28]]
- [[semo/decision/one-agent-experience-implementation-2026-05-27]]
- `packages/semo-dashboard/lib/core/kb-store-singleton.ts`
- `packages/semo-dashboard/app/api/bots/stream/route.ts`
- `packages/cli/src/commands/kb-mirror.ts`

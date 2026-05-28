# SEMO Customer — 설치형 온보딩 · 드라이버 시나리오 · dev→prod 롤아웃 (2026-05-29)

> 아키텍처: `docs/plans/2026-05-29-semo-integrated-product-architecture.md` 참조.

## 1. 설치형 고객 온보딩 (semo cli)

외부 팀/고객이 자체 호스트에 SEMO 도입:

```
semo init --profile team          # core DB(Postgres) — 기본
semo init --profile custom        # 드라이버 선택(obsidian/sqlite/notion)
semo init --hybrid --obsidian-vault ~/vault   # PG write + Obsidian mirror
```

- `semo init` 이 `~/.semo/config.toml`(kb.driver 등) 생성 + 첫 사용자 등록 prompt.
- 대시보드 컨테이너는 `DATABASE_URL`(appdb) + Supabase(인증)만 있으면 기동.
- 고객 DB 스키마: 마이그레이션 010/011/012 적용(아래 §3).

## 2. 드라이버 시나리오

| 시나리오               | 설정                                 | 비고                                                                                                               |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **core db only**       | `kb.driver=postgres`, `DATABASE_URL` | 가장 단순. 대시보드 lib/core/kb.ts 가 direct-PG.                                                                   |
| **hybrid (obsidian)**  | `--hybrid --obsidian-vault <path>`   | PG가 SoT, `kb-mirror` 가 Obsidian 양방향 미러(content-hash 멱등). launchd: `scripts/install-kb-mirror-launchd.sh`. |
| **sqlite (단독/로컬)** | `kb.driver=sqlite`                   | 1인/오프라인. PgKbStore 대신 SQLite 어댑터.                                                                        |
| **notion (mirror)**    | `kb.notion_token`/`db_id`            | 읽기/미러 중심(쓰기 SoT는 core DB).                                                                                |

- 드라이버 추상화: `KbStore`(`packages/kb-core`). 대시보드는 현재 direct-PG(컨테이너 빌드 제약) — KbStore delegate 재도입 조건은 아키텍처 doc §4.

## 3. dev→prod 롤아웃 체크리스트

- [ ] **DB 마이그레이션**: prod appdb 에 `010_customer_tables` / `011_billing_tables` / `012_customer_persona_settings` 적용. (seed 스크립트 `apply-customer-tables.mjs` 는 **localhost 가드** — prod 엔 SQL 직접 적용, seed 제외. 실고객은 가입 플로우로 생성.)
- [ ] **persona 기본값**: 신규 테넌트 `customer_user_settings` 없으면 shop fallback(정상). 필요 시 `customer_tenant_settings` 로 테넌트 기본 persona 지정.
- [ ] **게이팅**: 외부 고객 공개 시 `SEMO_CUSTOMER_GATING=1` (→ /my* 로그인 필수, /demo* 공개). **선행**: 고객↔내부 라우트 인가(현 OnboardingGate 클라 가드 + 권장 middleware 하드닝).
- [ ] **direct-chat 브릿지**: `SEMO_RUNTIME_URL`(+`SEMO_RUNTIME_TOKEN`) 설정 시 활성. 없으면 chat 은 "준비 중" graceful.
- [ ] **채널 enforcement**: `./scripts/openclaw-bots-disable-app-mention.sh`(7봇 app_mention 제거 — Semi/Colony만 사용자 진입). dry-run 으로 현재 상태 확인.
- [ ] **결제**: 포트원/팝빌 크리덴셜(미설정 시 plan 화면은 데이터 표시만, 결제 실행 비활성).
- [ ] **빌드/배포**: dev push → dev CI/CD(Docker) green → kustomize dev overlay. prod 는 overlay 승급.

## 4. rollback 전략

- **대시보드 이미지**: 이전 태그로 kustomize overlay 되돌림(이미지 롤백, 무상태). 마이그레이션과 분리.
- **마이그레이션**: 010/011/012 는 **additive(새 테이블/컬럼)** — 코드 롤백 시에도 테이블 잔존 무해. DROP 불필요(파괴적 변경 없음).
- **게이팅 플래그**: 문제 시 `SEMO_CUSTOMER_GATING` 해제(0) → 즉시 공개 쇼케이스로 복귀.
- **persona/chat**: 모두 graceful fallback(persona→shop, chat→준비중) — 기능 비활성이 곧 안전 상태.

## 5. 검증 명령

```
# 타입/린트/빌드
cd packages/semo-dashboard && npx tsc --noEmit && npx eslint . && npx next build
# 라우트 스모크(로컬 dev PORT=3939)
for r in /my /my/team /my/knowledge /my/library /my/plan /my/personas /demo; do curl -s -o /dev/null -w "%{http_code} $r\n" localhost:3939$r; done
# persona reactive
curl -s "localhost:3939/my?p=worker" | grep -o "안녕하세요[^<]*"   # 재훈 님
# storage smoke
node packages/semo-dashboard/scripts/apply-customer-tables.mjs   # localhost appdb (010/011/012 + seed)
# 채널 enforcement
./scripts/openclaw-bots-disable-app-mention.sh dry-run            # 7봇 app_mention 상태
```

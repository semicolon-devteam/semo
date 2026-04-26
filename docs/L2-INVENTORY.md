# SEMO L2 자산 인벤토리

> P0.1 결과물 (2026-04-26).
> 외부 OSS 배포(`@team-semicolon/semo-*`) 전 세미콜론 고유 L2 자산이 어디에 박혀 있는지 분류한다.
> 대상 = `packages/cli`, `cli-solo`, `cli-core`, `common`, `kb-core`, `kb-pg`, `ops-store`, `mcp-kb`, `agent-mailbox`, `discord-router`, `slack-router`, `channel-slack`, `kb-gateway`, `orchestrator`.
> **제외**: `packages/semo-dashboard` (별도 배포), `packages/_archived/` (이미 격리), `~/.claude/` (사용자 로컬).

---

## 분류 기준

| 라벨       | 의미                                                                               |
| ---------- | ---------------------------------------------------------------------------------- |
| **HIGH**   | OSS 신규 설치 시 세미콜론 L2 데이터가 자동 주입됨 (실제 leakage)                   |
| **MEDIUM** | OSS 코드에 L2 식별자 등장 (실행에는 영향 없으나 외부에 노출됨 — JSDoc/주석/테스트) |
| **LOW**    | 비-OSS 패키지(`semo-dashboard`)에만 존재. 향후 dashboard 분리 시 처리              |
| **OK**     | 이미 L0/L2 분리 의도적으로 명시되어 있음 (계약 테스트, 명시적 주석 등)             |

---

## HIGH — 실제 leakage (P0.2 에서 즉시 처리)

### 1. `packages/cli/migrations/017_ontology_instance_model.sql:80-84`

```sql
INSERT INTO semo.ontology (domain, entity_type, service, schema, description) VALUES
  ('semicolon',   'organization', '_global', '{}'::jsonb, 'Semicolon 팀 (글로벌 스코프 = _global.*)'),
  ('jungchipan',  'service', 'jungchipan',  '{}'::jsonb, '정치판 서비스'),
  ('playland',    'service', 'playland',    '{}'::jsonb, 'Play Land 서비스')
ON CONFLICT (domain) DO UPDATE SET ...;
```

- 영향: `semo migrate` 가 신규 PG 인스턴스에 `jungchipan`/`playland` ontology 행을 시드함.
- 외부 고객은 자기 ontology 가 아닌 세미콜론 L2 서비스를 자동 보유.
- `semicolon` org row 도 함께 시드 — 이는 해석에 따라 OK (L0 이 "your org" placeholder 로 둘 수 있음).
- **조치 (적용 완료, 2026-04-26)**: `migrations/108_drop_l2_ontology_seeds.sql` 에서 `jungchipan`, `playland` 행 조건부 삭제 (해당 도메인 KB 데이터 0건일 때만). `semicolon` org row 는 그대로 유지 (현재 `init` 가 자동 placeholder 처리하지 않으므로 P1 에서 처리).

### 1b. `packages/cli/migrations/030_team_ontology.sql:50-61`

세미콜론 팀원 10명 ontology row 자동 시드 (`reus`, `garden`, `roki`, `yeomso`, `bon`, `kyago`, `bae`, `harry`, `goni`, `kai`) — 본명/역할 포함.

- 영향: fresh install 시 외부 고객 DB 에 세미콜론 팀원 ontology 자동 등록.
- **조치 (적용 완료, 2026-04-26)**: 030 인라인에서 INSERT 블록 제거 (스키마 셋업만 유지) + `migrations/111_drop_l2_team_ontology_seeds.sql` 가 기존 인스턴스의 KB 데이터 0건 row 만 삭제.

### 1c. `packages/cli/migrations/027_kb_manager_skill.sql:10`, `031_kb_manager_domain_register.sql:9`

`skill_definitions(name='kb-manager')` 의 prompt 에 L2 leakage:

- `semo kb get semicolon team reus` (팀원 닉네임)
- `semo kb get by-buyer po`, `semo kb search "PO" --service by-buyer` (세미콜론 L2 서비스)
- 027 의 경우 `export SEMO_ROOT="/Users/reus/Desktop/Sources/semicolon/projects/semo"` 하드코딩 경로

- 영향: fresh install 시 봇이 사용하는 kb-manager 스킬 안내문에 reus/by-buyer 예시가 박힘.
- **조치 (적용 완료, 2026-04-26)**: 027/031 인라인 — 예시를 `<org>`/`alice`/`my-service` 로 일반화. 027 의 SEMO_ROOT/cd 라인 제거. `migrations/110_kb_manager_skill_l2_cleanup.sql` 가 기존 인스턴스의 prompt 에 REPLACE 연산으로 동일 정리 (L2 strings 가 잔존할 때만).

### 1d. `packages/cli/migrations/081_person_unification.sql:34`

세미콜론 팀원 13명 닉네임 (`reus`,`garden`,`roki`,`bon`,`goni`,`harry`,`kai`,`kevin`,`kibaek`,`kyago`,`mark`,`bae`,`yeomso`) 이 IN 절에 박혀 있음.

- 영향: fresh install 에서는 person ontology 가 0건이므로 데이터 leak 은 없음 (no-op). 단 source 파일에 닉네임 가시.
- **조치 (적용 완료, 2026-04-26)**: 081 인라인에서 INSERT/SELECT 문 제거 (인스턴스가 organization 키 직접 채우는 방식으로 전환). person 도메인 자체는 030 정리로 fresh install 에 0건이므로 backfill 불필요.

### 1e. `packages/cli/src/commands/{bots,audit}.ts` HOME fallback `'/Users/reus'`

5건 (`bots.ts:666`, `audit.ts:140,191,445,538`) 이 `process.env.HOME || '/Users/reus'` 패턴.

- 영향: HOME 환경변수가 없는 컨테이너/CI 에서 reus 의 literal 홈디렉토리 경로 사용 — 실제 동작 버그.
- **조치 (적용 완료, 2026-04-26)**: `process.env.HOME || os.homedir()` 로 교체 (audit.ts 에 `os` import 추가).

### 1f. `packages/cli/src/commands/sessions.ts:342`

`-Users-reus-Desktop-Sources-semicolon-projects-semo` Claude Code 프로젝트 슬러그 하드코딩.

- 영향: reus 외 사용자에게 동작하지 않음 — 실제 동작 버그.
- **조치 (적용 완료, 2026-04-26)**: `process.cwd().replace(/\//g, '-')` 로 동적 도출.

### 1g. `packages/cli/src/commands/metrics.ts:69`

`return 'reus-local'` — bot 패턴 미일치 시 fallback 하드코딩.

- 영향: 모든 사용자의 non-bot CLI 호출이 `reus-local` 로 태깅 → 메트릭 분석 왜곡.
- **조치 (적용 완료, 2026-04-26)**: `${os.userInfo().username}-local` 로 동적 도출 (실패 시 `cli-local` fallback).

---

## MEDIUM — JSDoc/주석/스키마 description (P0.2 또는 P1 에서 정리)

### 2a. `packages/cli/migrations/065_hub_spoke_orchestration.sql:14,28`

```sql
COMMENT ON COLUMN semo.bot_commitments.session_owner IS '세션 소유자 (reus-local, agent-sdk 등)';
COMMENT ON COLUMN semo.bot_sessions.owner IS '세션 소유자 (reus-local, mark-local 등)';
```

- DB 컬럼 COMMENT 에 팀원 닉네임 예시. 실행 영향 없음, DB 메타에만 등장.
- **조치 (적용 완료, 2026-04-26)**: 065 인라인 텍스트를 `({user}-local, {bot}-cron-local 등)` 으로 일반화.

### 2. `packages/cli/migrations/015_kb_domain_enforcement.sql:40`

```
"project": {"type": "string", "description": "프로젝트 ID (예: gameland, jungchipan)"}
```

- JSON Schema description 에 L2 예시. 실행 영향 없음, DB 메타에만 등장.
- **조치 (적용 완료, 2026-04-26)**: 015 인라인 텍스트를 `예: my-service` 로 일반화 + 기존 인스턴스를 위한 `migrations/109_generic_ontology_descriptions.sql` 추가 (jsonb_set 으로 정확 매칭 시에만 갱신).

### 3. `packages/common/src/templates/types.ts:5`

```ts
* tenant 고유 도메인은 템플릿에 들어오지 않는다 (L2 전용).
```

- **조치 (적용 완료)**: JSDoc 일반화 — `세미콜론 도메인(wise-platform/axoracle 등)` → `tenant 고유 도메인`.

### 4. `packages/common/src/templates/builtin.ts:9`

```ts
*   - tenant L2 자산(고유 도메인명 등) 유입 금지
```

- **조치 (적용 완료)**: `세미콜론 L2 자산(도메인명 등)` → `tenant L2 자산(고유 도메인명 등)`.

---

## LOW — `semo-dashboard` 내부 (별도 배포 — OSS 1차 대상 아님)

### 5. `packages/semo-dashboard/lib/core/meeting-generate.ts:69`

LLM 프롬프트 (production):

```
- Platform services have sub-services (e.g., "wise-platform" is the parent;
  "tether-mining", "orbis", "onto-media" are distinct sub-services).
```

- 회의록 생성 LLM 프롬프트에 세미콜론 L2 (wise-platform / tether-mining / orbis / onto-media) 박혀 있음.
- 다른 tenant 가 dashboard 사용하면 부정확한 attribution 유도 가능. 다만 `dashboard` 는 OSS 1차 미포함.

### 6. `packages/semo-dashboard/lib/core/kb.ts:436,486`

JSDoc 예시: `'axoracle'`, `'plan/3/'` 사용. 코드 동작에는 영향 없음.

### 7. `packages/semo-dashboard/types/index.ts:138-139`

JSDoc 예시: `"axoracle-blog"`, `"growthclaw/axoracle-blog"`.

### 8. `packages/semo-dashboard/e2e/tests/12-service-ops-dashboard.spec.ts`

전체 파일이 `axoracle` ops dashboard 시나리오 테스트. 의도적 L2 fixture (세미콜론 인스턴스 검증용). 분리 시 fixture 만 generic 으로 교체.

---

## MEDIUM (테스트 fixture) — 외부 노출되지만 동작 영향 없음

### 9. `packages/semo-dashboard/lib/core/__tests__/meeting*.test.ts`

`'axoracle'`, `'bebecare'` 가 테스트 입력으로 사용. dashboard 분리 시 함께 처리.

### 10. `packages/cli/src/personal-conformance.test.ts`, `personal-discord-conformance.test.ts`

`'reus'`, `'garden'` 같은 팀원 닉네임이 fixture 로 등장. 외부에 노출되지만 동작 영향 없음.

- **조치 (적용 완료, 2026-04-26)**: 팀원 닉네임 → generic (`alice`). 두 conformance 테스트 모두 통과.

### 11. `packages/common/src/onboarding/default-steps.ts:8`

```
* 관습적 네임스페이스로, 팀 계정(`alice`, `bob` 등)과 구분된다.
```

- **조치 (적용 완료)**: 팀원 닉네임 → generic (`alice`, `bob`).

---

## OK — 의도적 L2 분리 명시 (그대로 유지)

### 12. `packages/common/src/__tests__/bot-templates.test.ts:13-21,48`

```ts
const FORBIDDEN_DOMAIN_NAMES = ['axoracle', 'wise-platform', ...];

it('kbDomains / role / tags 는 세미콜론 L2 도메인(axoracle 등) 을 포함하지 않는다', () => {
  ...
  for (const forbidden of FORBIDDEN_DOMAIN_NAMES) {
    expect(haystack.includes(forbidden)).toBe(false);
  }
});
```

- **L2 leakage 방지 계약 테스트**. L2 도메인을 변수에 적어둠으로써 builtin 템플릿이 절대 이 도메인을 포함하지 않게 강제.
- 그대로 유지 + 외부 leak 방지 가이드로 활용.

### 13. `packages/common/src/templates/catalog.ts`, `builtin.ts`, `types.ts`

이미 "tenant 가 builtin 을 덮어씀" 패턴으로 설계되어 있음 (catalog.ts:4-5).
JSDoc 의 도메인명 예시만 generic 화 하면 완료.

### 14. `packages/_archived/migrations-historical/*`

이미 archived. OSS 빌드/배포 경로에 포함되지 않음.

---

## 봇 / 팀원 식별자 — 별도 분류

### 봇 ID (`semiclaw`, `planclaw`, `workclaw`, `reviewclaw`, `designclaw`, `growthclaw`, `infraclaw`)

- L0 카탈로그 템플릿 ID (= `common/src/templates/builtin.ts` 의 7개 엔트리). **OSS 표준 카탈로그**.
- 인스턴스화는 DB(`bot_status`) 가 SoT. 코드 하드코딩 일부 존재하지만 _템플릿 ID_ 로서 합법 (예: `cli/src/index.ts`, `bots.ts`, `discord-router/`).
- 결론: **L0 자산** (변경 불필요).

### 팀원 닉네임 (`reus`, `garden`, `yeomso`, `sungho`)

- 프로덕션 코드에는 하드코딩 없음 (검증됨).
- 테스트 fixture / 주석 예시에만 등장 (위 #10, #11).
- 결론: 점진적 generic 화 (P1 권장, 블로커 아님).

---

## 외부 (이 인벤토리 범위 밖)

- `~/.claude/CLAUDE.md` (사용자 로컬 글로벌 지시) — 세미콜론 인스턴스 전용. OSS 미포함.
- `.claude/CLAUDE.md` / `.claude/rules/*.md` (이 repo 의 프로젝트 지시) — 세미콜론 _내부 SEMO 개발 환경_ 용. OSS 신규 고객은 `semo init` 으로 새로 생성받음. 그대로 둬도 leak 아님.
- `~/.claude/skills/*` (사용자 로컬 mirror) — DB SoT. 일부 (예: `axoracle-blog`) 는 L2 skill, 일부 (예: `kb-manager`) 는 L0 catalog. 분리 작업은 P1 의 `kernel/`/`tenant/` 분리에서 다룸.

---

## 요약

| 우선순위                | 항목 수                                                                                       | 상태                                       |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------ |
| HIGH                    | 5 (migrations 017 ontology / 030 team seeds / 027+031 kb-manager skill / 081 person backfill) | ✅ 인라인 + cleanup migrations 108/110/111 |
| MEDIUM (실행)           | 1 (migration 015 description)                                                                 | ✅ 015 인라인 + migration 109 적용 완료    |
| MEDIUM (주석/JSDoc)     | 4 (`templates/types.ts`, `builtin.ts`, `default-steps.ts:8`, migration 065 column COMMENT)    | ✅ 일괄 generic 화 완료                    |
| LOW (dashboard)         | 4                                                                                             | P4 dashboard 분리 시 처리                  |
| MEDIUM (test fixture)   | 2 (cli/personal-conformance \*.ts)                                                            | ✅ alice 로 교체 완료                      |
| OK (계약 테스트/의도적) | 4                                                                                             | 변경 불필요                                |

**OSS 1차 배포 차단 항목 = 0건** (재검증 2026-04-26). 남은 작업은 LOW (dashboard 분리) 와 점진적 정리 뿐.

봇 ID 7개는 L0 카탈로그 자산이므로 OSS 에 그대로 포함된다 (이미 builtin templates).

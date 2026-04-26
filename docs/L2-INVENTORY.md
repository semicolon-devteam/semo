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
- **조치**: 신규 마이그레이션 (`migrations/078_drop_l2_ontology_seeds.sql`) 으로 `jungchipan`, `playland` 행 삭제. `semicolon` 은 `{tenant}` placeholder 로 대체하거나 install 시 `semo init` 가 채우도록 변경.

---

## MEDIUM — JSDoc/주석/스키마 description (P0.2 또는 P1 에서 정리)

### 2. `packages/cli/migrations/015_kb_domain_enforcement.sql:40`

```
"project": {"type": "string", "description": "프로젝트 ID (예: gameland, jungchipan)"}
```

- JSON Schema description 에 L2 예시. 실행 영향 없음, DB 메타에만 등장.
- **조치**: 신규 마이그레이션으로 description 텍스트 갱신 (예: "프로젝트 ID (예: my-service)").

### 3. `packages/common/src/templates/types.ts:5`

```ts
* 세미콜론 도메인(wise-platform/axoracle 등) 은 템플릿에 들어오지 않는다 (L2 전용).
```

- JSDoc 에서 **L2 분리 규칙을 설명**하기 위해 도메인명 인용. 의도적이지만 외부 사용자에게는 무관.
- **조치**: 텍스트만 일반화 (예: "tenant 고유 도메인은 템플릿에 들어오지 않는다 (L2 전용).") 후 `OK` 로 이동.

### 4. `packages/common/src/templates/builtin.ts:9`

```ts
*   - 세미콜론 L2 자산(도메인명 등) 유입 금지
```

- 동일 (의도된 가이드 주석).
- **조치**: 일반화 ("tenant L2 자산 유입 금지").

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

- **조치**: P1 에서 fixture 를 `'alice'`/`'bob'` 같은 generic 이름으로 교체 (선택).

### 11. `packages/common/src/onboarding/default-steps.ts:8`

```
* 관습적 네임스페이스로, 팀 계정(`reus`, `garden`)과 구분된다.
```

- onboarding 가이드 주석에서 팀원 닉네임 예시.
- **조치**: 일반화 (예: "팀 계정 (alice, bob 등)").

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

| 우선순위                | 항목 수                                                            | 다음 단계                          |
| ----------------------- | ------------------------------------------------------------------ | ---------------------------------- |
| HIGH                    | 1 (migration 017 ontology seed)                                    | P0.2 신규 migration 으로 즉시 격리 |
| MEDIUM (실행)           | 1 (migration 015 description)                                      | P0.2 신규 migration                |
| MEDIUM (주석/JSDoc)     | 4 (`templates/types.ts`, `builtin.ts`, `default-steps.ts:8`, etc.) | P0.2 일괄 generic 화               |
| LOW (dashboard)         | 4                                                                  | P4 dashboard 분리 시 처리          |
| MEDIUM (test fixture)   | 3                                                                  | P1 점진적                          |
| OK (계약 테스트/의도적) | 4                                                                  | 변경 불필요                        |

**즉시 차단 항목 = 1건** (migration 017 ontology seed). P0.2 에서 처리하면 OSS 신규 설치 시 L2 leakage 0.

봇 ID 7개는 L0 카탈로그 자산이므로 OSS 에 그대로 포함된다 (이미 builtin templates).

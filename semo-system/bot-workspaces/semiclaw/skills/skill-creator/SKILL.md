---
name: skill-creator
description: This skill should be used when the user asks to "create a new skill", "make a skill for a bot", "evaluate a skill", "improve skill quality", "benchmark skill consistency", "review skill structure", "test this skill", or when designing, iterating, packaging, or deploying OpenClaw Skills for the Semicolon bot team. Covers the full pipeline from requirement gathering through validation, eval, and deployment to SEMO.
---

# Skill Creator v2

Create, evaluate, improve, and benchmark production-ready OpenClaw Skills for the SEMO ecosystem.

## Modes

| Mode | Purpose | When |
|------|---------|------|
| **Create** | 새 스킬 생성 (요구사항 → 배포) | "스킬 만들어줘", "봇에 기능 추가해줘" |
| **Eval** | 테스트 프롬프트로 스킬 실행 + 채점 | "이 스킬 테스트해봐", "스킬 평가해줘" |
| **Improve** | Eval 결과 기반 자동 개선 | "스킬 개선해줘", Eval 후 C등급 이하 |
| **Benchmark** | N회 반복 실행 → 일관성 측정 | "스킬 벤치마크해줘" |
| **Review** | 구조/품질 정적 검증 | "스킬 리뷰해줘", 배포 전 |

명시적 모드 지정이 없으면 컨텍스트에서 추론. 새 스킬 요청이면 Create, 기존 스킬 언급이면 Review.

---

## Mode 1: Create

### Step 1: Gather Requirements

이미 명확하면 스킵. 불명확하면 질문:

1. **무엇을 자동화하는가?** — 구체적 태스크/워크플로우
2. **트리거 프롬프트 예시?** — 사용자가 실제로 할 말 3~5개
3. **재사용 가능한 리소스?** — 기존 스크립트, 문서, 템플릿
4. **대상 봇?** — semiclaw, workclaw, 복수 봇, 또는 공유

### Step 2: Plan

스킬 구조를 결정:

**이름 규칙:**
- kebab-case, 64자 이내, 동사 시작 권장
- 기존 `~/.claude/skills/` 이름과 충돌 확인 (`ls ~/.claude/skills/`)

**패턴 선택** — Read `references/skill-patterns.md` for catalog:
- Workflow (순차) / Task (독립) / Cron (정기) / Infrastructure (점검) / Crawler / Composite

**리소스 분류:**

| 필요 | 유형 | 예시 |
|------|------|------|
| 동일 코드 반복 작성 | `scripts/` | `validate-config.sh` |
| 실행 중 상세 문서 필요 | `references/` | `api-schema.md` |
| 출력에 복사되는 파일 | `assets/` | `template.pptx` |

### Step 3: Initialize

봇 워크스페이스에 디렉토리 생성:

```bash
SKILL_NAME="your-skill-name"
BOT_ID="semiclaw"  # 대상 봇
SKILL_DIR="semo-system/bot-workspaces/$BOT_ID/skills/$SKILL_NAME"

mkdir -p "$SKILL_DIR"/{scripts,references}
touch "$SKILL_DIR/SKILL.md"
```

필요 없는 하위 디렉토리는 만들지 않는다. scripts/가 필요 없으면 만들지 않는다.

### Step 4: Implement

순서: **scripts → references → SKILL.md**

#### 4a. Scripts

- 작성 → `chmod +x` → 실제 데이터로 테스트
- 모든 스크립트가 성공적으로 실행되어야 다음 단계 진행
- 비밀키/API 키 하드코딩 금지

#### 4b. References

- SKILL.md에서 너무 긴 내용 분리 (>100줄이면 TOC 포함)
- 1-depth만 허용: SKILL.md → references/foo.md (foo.md → bar.md 금지)
- "이 파일을 읽어야 하는 시점" 명시

#### 4c. SKILL.md

**Frontmatter:**

```yaml
---
name: your-skill-name
description: This skill should be used when the user asks to "trigger phrase 1",
  "trigger phrase 2", "trigger phrase 3". 구체적인 트리거 시나리오 필수.
---
```

- `name` + `description` 만 사용. 다른 필드 금지.
- description은 3인칭 ("This skill should be used when...")
- 반드시 구체적 트리거 시나리오 포함 (사용자가 실제로 할 말)
- Body에 "When to Use" 섹션 넣지 않는다 (description에 포함됨)

**Body:**
- 명령형/부정사 ("Run the script", not "You should run")
- 500줄 이내. `wc -l SKILL.md`로 확인
- 실제 경로, 실제 ID, 실제 CLI 명령 사용 (추상 패턴 X)
- 자주 빠뜨리는 단계에는 ⚠️ 경고 표시

### Step 5: Validate

```bash
scripts/validate-skill.sh semo-system/bot-workspaces/{botId}/skills/{skill-name}
```

모든 항목 PASS가 되어야 배포 진행. FAIL 항목은 수정 후 재실행.

검증 항목: frontmatter 포맷, kebab-case, 줄수, 참조 무결성, 스크립트 실행 권한, 금지 파일.

### Step 6: Deploy to SEMO

Read `references/semo-integration.md` for full details.

```bash
# 1. DB 동기화 — flat name + metadata.bot_ids로 저장
semo bots sync

# 2. 글로벌 캐시 재생성 — ~/.claude/skills/{name}/SKILL.md 생성
semo context sync

# 3. 배포 검증 (필수)
ls ~/.claude/skills/{skill-name}/SKILL.md               # 파일 존재 확인
grep "Agents:" ~/.claude/skills/{skill-name}/SKILL.md    # 봇 주입 확인
scripts/validate-skill.sh semo-system/bot-workspaces/{botId}/skills/{skill-name} # 구조 검증
```

⚠️ **반드시 `semo bots sync` 후 `semo context sync`를 실행해야 글로벌 캐시에 반영된다.**

배포 후 검증 실패 시 복구:
```bash
semo doctor                              # DB 연결 진단
semo bots sync && semo context sync      # 재시도
```

---

## Mode 2: Eval

스킬의 실제 동작 품질을 테스트 프롬프트로 검증.

### Step 1: Pre-check

```bash
scripts/skill-eval-runner.sh {skill-name}
```

스킬이 글로벌 캐시에 존재하는지, frontmatter가 유효한지, 트리거 프롬프트 제안까지 출력.

### Step 2: Design Test Prompts

description의 트리거 시나리오에서 파생:

- **Positive prompts** (3~5개) — 스킬이 활성화되어야 하는 프롬프트
- **Negative prompts** (1~2개) — 스킬이 활성화되면 안 되는 프롬프트
- **Edge case** (1개) — 경계 조건 (관련은 있지만 다른 스킬이 더 적합한 경우)

### Step 3: Execute

각 테스트 프롬프트를 서브에이전트로 실행:

```
Agent tool → subagent_type: general-purpose
prompt: "{test-prompt}"
```

실행 결과에서 수집:
- 스킬 활성화 여부
- 출력 내용 요약
- 사용한 도구/스크립트
- 에러 또는 경고

### Step 4: Grade

Read `references/eval-grading-rubric.md` for criteria.

각 실행을 5개 항목으로 채점 (100점 만점):
- 트리거 정확도 (30) + 출력 품질 (30) + 도구 활용 (20) + 안전성 (10) + 일관성 (10)

등급: **A**(90+) / **B**(70+) / **C**(50+) / **F**(<50)

### Step 5: Report

Eval 리포트를 출력. `references/eval-grading-rubric.md`의 리포트 포맷 사용.

B등급 이상이면 배포 가능. C등급 이하면 Improve 모드로 전환 권고.

---

## Mode 3: Improve

Eval 결과를 기반으로 스킬을 자동 개선.

### Step 1: Analyze Eval Results

낮은 점수 항목을 식별:

| 낮은 항목 | 개선 대상 |
|-----------|-----------|
| 트리거 정확도 | frontmatter description 보강 |
| 출력 품질 | body 지시사항 구체화 |
| 도구 활용 | scripts/references 참조 지시 추가 |
| 안전성 | 확인 절차/에러 처리 추가 |
| 일관성 | 출력 포맷 템플릿 명시 |

### Step 2: Generate Improvements

SKILL.md의 수정 diff를 생성. 각 수정에 대해:
- **What:** 무엇을 변경하는지
- **Why:** Eval에서 어떤 문제가 있었는지
- **Expected impact:** 어떤 점수가 올라갈 것으로 예상되는지

사용자 확인 후 적용.

### Step 3: Re-Eval

수정 후 동일 테스트 프롬프트로 1라운드 재-Eval. Before/After 점수 비교 출력.

개선이 확인되지 않으면 근본 원인 분석 → 요구사항 재검토 권고.

---

## Mode 4: Benchmark

동일 프롬프트를 반복 실행하여 출력 일관성을 측정.

### Step 1: Select Prompts

가장 대표적인 트리거 프롬프트 1~2개 선택.

### Step 2: Execute N Rounds

기본 5회 반복. 각 실행의 핵심 출력(구조, 단계, 결과물)을 추출.

### Step 3: Analyze

- **일관성 점수:** 실행 간 구조/내용 유사도 (0~100)
- **분산 원인:** 어떤 부분이 실행마다 다른지 식별
- **안정 영역:** 항상 동일한 부분 식별

### Step 4: Report

```
## Benchmark Report: {skill-name}

- Prompt: "{prompt}"
- Rounds: 5
- Consistency: {score}/100

### Variation Analysis
| 영역 | 일관성 | 비고 |
|------|--------|------|
| 구조/단계 | {high/med/low} | |
| 구체적 내용 | {high/med/low} | |
| 도구 선택 | {high/med/low} | |

### Recommendations
- ...
```

일관성 80+ → 안정. 60~80 → 출력 템플릿 명시 권고. <60 → 지시사항 구체화 필요.

---

## Mode 5: Review

배포 전 정적 검증. Eval과 달리 실행 없이 구조/품질만 확인.

### Step 1: Structure Validation

```bash
scripts/validate-skill.sh semo-system/bot-workspaces/{botId}/skills/{skill-name}
```

### Step 2: Content Review

Read `references/review-checklist.md` and verify:

- [ ] Frontmatter: name + description only, 3인칭, 트리거 시나리오 포함
- [ ] Body: 명령형, <500줄, 1-depth 참조
- [ ] Scripts: 실행 가능, 실제 데이터 테스트 완료
- [ ] 실제 경로/ID 사용, 추상 패턴 아님
- [ ] ⚠️ 경고 표시 적절

### Step 3: SEMO Integration Check

- [ ] 대상 봇 명시 (어떤 봇 워크스페이스에 배치할지)
- [ ] 동일 이름의 기존 스킬 충돌 확인: `ls ~/.claude/skills/`
- [ ] 복수 봇 공유 의도가 있다면 bot_ids 머지 결과 확인

### Step 4: Report

PASS / PASS with warnings / FAIL 출력 + 상세 사항.

---

## Best Practices

### Context Window is Public

모델이 이미 아는 내용을 반복하지 않는다. 스킬에는 모델이 모르는 것만 넣는다:
- 팀 고유 워크플로우, 내부 경로/ID, 커스텀 점수 체계
- 일반적인 코딩 지식, 공개 API 문서 → 넣지 않는다

### Progressive Disclosure

1. **Frontmatter** (~100 words): 항상 로드됨 → 트리거 판단
2. **SKILL.md body** (<500 lines): 트리거 시 로드 → 실행 지시
3. **references/** (on demand): 필요할 때만 로드 → 상세 정보

### Bot-Aware Design

- 봇은 독립 OpenClaw 인스턴스, 서브에이전트가 아님
- 스킬이 다른 봇을 언급할 때는 역할 설명만 (직접 호출 X)
- Bot ID 매핑은 references/에 분리

### Iteration

첫 버전은 절대 최종이 아니다. Create → Review → Deploy → Eval → Improve 사이클을 반복.

---

## Quick Reference

| Item | Value |
|------|-------|
| Skill workspace | `semo-system/bot-workspaces/{botId}/skills/{name}/` |
| Global cache | `~/.claude/skills/{name}/SKILL.md` |
| Validate | `scripts/validate-skill.sh <skill-dir>` |
| Eval pre-check | `scripts/skill-eval-runner.sh <skill-name>` |
| Deploy | `semo bots sync && semo context sync` |
| Max lines | 500 |
| Max name length | 64 chars |
| Frontmatter fields | `name`, `description` only |
| Description style | 3인칭 + 트리거 시나리오 필수 |
| Body style | 명령형/부정사 |
| Forbidden files | README, CHANGELOG, INSTALL, LICENSE |
| Grading rubric | `references/eval-grading-rubric.md` |
| Patterns catalog | `references/skill-patterns.md` |
| SEMO deploy guide | `references/semo-integration.md` |
| Review checklist | `references/review-checklist.md` |

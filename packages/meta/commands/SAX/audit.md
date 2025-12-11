---
name: audit
description: SAX 패키지 전체 품질 감사 - audit-sax skill 호출 (공통)
---

# /SAX:audit Command

전체 SAX 패키지의 Agent/Skill/Command 표준 준수 여부를 검사하고 품질 문제를 탐지합니다.

> **공통 커맨드**: 모든 SAX 패키지에서 사용 가능

## Trigger

- `/SAX:audit` 명령어
- "SAX 감사", "패키지 검증", "품질 점검" 키워드

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **전체 패키지 품질 점검**: 정기적인 SAX 패키지 품질 감사
2. **Agent/Skill/Command 표준 준수 검토**: Frontmatter, 파일 구조 등 검증
3. **비효율적 구조 탐지**: 과도한 라인 수, 중복 문서 등 발견
4. **릴리즈 전 검증**: 버전 업데이트 전 품질 게이트

## Action

`/SAX:audit` 실행 시 `sax-meta/skill:audit-sax`를 호출합니다.

```markdown
[SAX] Skill: audit-sax 호출 - 전체 패키지

> sax-meta/skills/audit-sax 스킬을 호출합니다.
```

## Workflow

### Step 1: 감사 범위 확인

전체 SAX 패키지 목록을 스캔합니다:

| 패키지 | 감사 대상 |
|--------|----------|
| sax-meta | agents/, skills/, commands/ |
| sax-core | agents/, skills/, commands/ |
| sax-po | agents/, skills/, commands/ |
| sax-next | agents/, skills/, commands/ |
| sax-qa | agents/, skills/, commands/ |
| sax-backend | agents/, skills/, commands/ |
| sax-infra | agents/, skills/, commands/ |

### Step 2: 검증 항목 실행

**Agent 검증**:
- ✅ Frontmatter 4필드 (name, description, tools, model)
- ✅ PROACTIVELY 패턴 ("Use when" 포함)
- ✅ model 필드 (opus/sonnet/haiku/inherit)
- ⚠️ 라인 수 (200 lines 이하 권장)

**Skill 검증**:
- ✅ Frontmatter 3필드 (name, description, tools)
- ✅ 시스템 메시지 (Frontmatter 직후 blockquote)
- ⚠️ "Use when" 패턴
- ⚠️ 라인 수 (100 lines 이하 권장)

**Command 검증**:
- ✅ 파일 존재 (commands/{name}.md)
- ✅ Frontmatter (name, description)
- ⚠️ CLAUDE.md 연동 확인

### Step 3: 결과 리포트

```markdown
[SAX] Skill: audit-sax 완료

## 📊 SAX 통합 감사 결과

**감사 일시**: 2025-01-XX
**감사 범위**: 전체 SAX 패키지 (7개)

### 📈 요약

| 패키지 | Agent | Skill | Command | 문제 |
|--------|-------|-------|---------|------|
| sax-meta | 5 ✅ | 6 ✅ | 2 ✅ | 0 |
| sax-core | 2 ✅ | 4 ✅ | 4 ✅ | 0 |
| ... | ... | ... | ... | ... |

**총 문제**: 🔴 Critical {n}건, 🟡 Important {n}건, 🟢 Nice-to-have {n}건

### 🔴 Critical 문제 (즉시 수정 필요)

(문제 발견 시 출력)

### 🟡 Important 문제 (권장 수정)

(문제 발견 시 출력)

### 📋 권장 조치

1. Critical 문제 우선 수정
2. agent-manager/skill-manager로 수정 작업 위임
3. package-validator로 수정 후 재검증
```

## Expected Output

### 문제 없을 때

```markdown
[SAX] Skill: audit-sax 호출 - 전체 패키지

## 📊 SAX 통합 감사 결과

**감사 일시**: 2025-01-08
**감사 범위**: 전체 SAX 패키지 (7개)

### ✅ 모든 검증 통과

| 패키지 | Agent | Skill | Command | 상태 |
|--------|-------|-------|---------|------|
| sax-meta | 5 | 6 | 2 | ✅ |
| sax-core | 2 | 4 | 4 | ✅ |
| sax-po | 3 | 8 | 1 | ✅ |

**총 문제**: 0건 🎉

SAX 패키지가 모든 품질 기준을 충족합니다.
```

### 문제 발견 시

```markdown
[SAX] Skill: audit-sax 호출 - 전체 패키지

## 📊 SAX 통합 감사 결과

**총 문제**: 🔴 2건, 🟡 3건

### 🔴 Critical 문제

#### sax-next/agents/example-agent
- **문제**: model 필드 누락
- **위치**: `sax-next/agents/example-agent/example-agent.md:1-10`
- **수정**: Frontmatter에 `model: sonnet` 추가

### 🟡 Important 문제

#### sax-po/skills/some-skill
- **문제**: SKILL.md 150 lines (100 lines 초과)
- **권장**: references/ 분리

### 📋 권장 조치

1. agent-manager로 example-agent 수정
2. skill-manager로 some-skill 리팩토링
3. package-validator로 재검증
```

## Related

- [audit-sax Skill](../../skills/audit-sax/SKILL.md)
- [package-validator Skill](../../skills/package-validator/SKILL.md)
- [agent-manager Agent](../../agents/agent-manager/agent-manager.md)
- [skill-manager Agent](../../agents/skill-manager/skill-manager.md)

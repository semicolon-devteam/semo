# Sub-Agent 최적화 규칙

> Claude Code Sub-Agent Best Practices 상세

## 🚨 필수 규칙

모든 Agent 생성/수정 시 반드시 이 규칙을 적용해야 합니다.

## 1. Model 선택 전략

| Model | 사용 시점 | 예시 Agent |
|-------|----------|-----------|
| **opus** | 아키텍처 결정, 복잡한 분석, 시스템 설계 | sax-architect, ddd-architect |
| **sonnet** | 품질 중심 작업, 구현, 코드 리뷰 | implementation-master, quality-master |
| **haiku** | 빠른 응답, 단순 조회, 라우팅 | teacher, advisor |
| **inherit** | Orchestrator (부모 모델 상속) | orchestrator |

**선택 기준**:

```text
복잡도 높음 + 품질 중요 → opus
품질 중심 + 일반 작업 → sonnet
속도 중심 + 단순 작업 → haiku
라우팅/위임 전용 → inherit
```

## 2. PROACTIVELY 패턴 (필수)

모든 Agent의 `description` 필드에 **PROACTIVELY 패턴** 적용:

```yaml
description: |
  {역할 요약}. PROACTIVELY use when:
  (1) {조건 1}, (2) {조건 2}, (3) {조건 3},
  (4) {조건 4}. {추가 설명}.
```

**예시**:

```yaml
description: |
  Epic creation specialist for PO workflows. PROACTIVELY use when:
  (1) Epic creation requested, (2) Epic porting from external sources,
  (3) Design requirement confirmation, (4) Epic structure validation.
  Generates structured Epics following team templates.
```

**효과**: Orchestrator가 자동으로 적합한 Agent를 위임할 수 있도록 명확한 트리거 조건 제공

## 3. 도구 표준화 규칙

### ✅ 표준 도구명 사용

```yaml
tools:
  - read_file      # 파일 읽기
  - write_file     # 파일 쓰기 (NOT write_to_file)
  - edit_file      # 파일 편집
  - list_dir       # 디렉토리 목록
  - glob           # 파일 패턴 검색
  - grep           # 코드 검색 (NOT grep_search)
  - run_command    # 명령 실행
  - task           # Sub-Agent 위임
  - skill          # Skill 호출
```

### ❌ 사용 금지

- `grep_search` → `grep` 사용
- `write_to_file` → `write_file` 사용
- `slash_command` → 제거 (skill로 대체)
- `web_fetch` → 필요 시 run_command로 대체
- `mcp:*` 형식 → 제거 또는 표준 도구로 대체

## 4. 최소 권한 원칙

Agent에게 **필요한 최소한의 도구만** 부여:

| Agent 유형 | 필수 도구 | 선택 도구 |
|-----------|----------|----------|
| 읽기 전용 (Teacher, Advisor) | read_file, glob, grep | list_dir |
| 구현 (Implementation) | read_file, write_file, edit_file, glob, grep | run_command |
| 분석 (Quality, Review) | read_file, glob, grep, run_command | - |
| Orchestrator | read_file, list_dir, glob, grep, task, skill | run_command |

## 5. Frontmatter 필수 필드

```yaml
---
name: {agent-name}           # 필수: kebab-case, 파일명과 일치
description: |               # 필수: PROACTIVELY 패턴 적용
  {역할}. PROACTIVELY use when:
  (1) {조건1}, (2) {조건2}, (3) {조건3}.
tools:                       # 필수: 최소 권한 원칙 적용
  - read_file
  - ...
model: {opus|sonnet|haiku|inherit}  # 필수: 복잡도 기반 선택
---
```

## 6. 시스템 메시지 규칙

Frontmatter 바로 다음 줄에 시스템 메시지 blockquote:

```markdown
> **🔔 시스템 메시지**: 이 Agent가 호출되면 `[SAX] Agent: {agent-name} 호출 - {context}` 시스템 메시지를 첫 줄에 출력하세요.
```

## 7. Sub-Agent 최적화 체크리스트

**✅ Frontmatter 검증**:

- `name`: kebab-case 형식이며 파일명과 일치하는가?
- `description`: **PROACTIVELY use when:** 패턴이 포함되어 있는가?
- `description`: 번호된 트리거 조건 (1), (2), (3)이 있는가?
- `tools`: 표준 도구명만 사용하는가? (grep_search ❌, grep ✅)
- `tools`: 최소 권한 원칙을 준수하는가?
- `model`: opus/sonnet/haiku/inherit 중 하나가 명시되어 있는가?
- `model`: 역할 복잡도에 적합한 모델인가?

**✅ 시스템 메시지 검증**:

- Frontmatter 바로 다음 줄에 시스템 메시지 blockquote가 있는가?

**✅ 구조 검증**:

- Capabilities 섹션이 명확한가?
- When to Use 섹션이 구체적인가?
- Workflow가 Phase 기반으로 구조화되어 있는가?
- SAX Message 포맷이 명시되어 있는가?

**✅ 내용 품질 검증**:

- Claude가 이미 아는 내용을 반복하지 않는가?
- SAX/팀 고유의 워크플로우만 포함하는가?
- 단일 책임 원칙을 준수하는가?
- 불필요한 장황한 설명이 없는가?

**✅ 통합 검증**:

- CLAUDE.md에 올바르게 등록되어 있는가?
- orchestrator.md 라우팅 테이블에 포함되어 있는가?

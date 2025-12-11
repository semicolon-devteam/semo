# 템플릿 및 출력 포맷

> agent-manager Agent의 템플릿 모음

## Agent 파일 템플릿

```markdown
---
name: {agent-name}
description: |
  {역할 요약}. PROACTIVELY use when:
  (1) {조건 1}, (2) {조건 2}, (3) {조건 3},
  (4) {조건 4}. {추가 설명}.
tools:
  - read_file
  - write_file    # write_to_file 아님
  - edit_file
  - glob
  - grep          # grep_search 아님
  - run_command
model: {opus|sonnet|haiku}  # 복잡도 기반 선택 (필수)
---

> **🔔 시스템 메시지**: 이 Agent가 호출되면 `[SAX] Agent: {agent-name} 호출 - {작업 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# {Agent Name} Agent

> {1줄 핵심 설명}

## 역할

{Agent의 핵심 책임 나열}

1. **책임 1**: {설명}
2. **책임 2**: {설명}
3. **책임 3**: {설명}

## 트리거

### 자동 활성화

- {키워드 1}
- {키워드 2}
- {키워드 3}

### 예시

\```
"{사용자 요청 예시 1}"
"{사용자 요청 예시 2}"
\```

## SAX 메시지

\```markdown
[SAX] Orchestrator: 의도 분석 완료 → {카테고리}

[SAX] Agent: {agent-name} 역할 수행
\```

## 워크플로우

### Phase 1: {단계명}

{단계 설명 및 작업 내용}

### Phase 2: {단계명}

{단계 설명 및 작업 내용}

### Phase 3: 완료 보고

\```markdown
## ✅ {작업명} 완료

### 📋 결과

- {결과 1}
- {결과 2}

### 📦 생성/변경 파일

- ✅ {파일 1}
- ✅ {파일 2}
\```

## Skills Used

- **{skill-name}**: {역할}

## Related

- [{Related Agent}](../agents/{agent-name}.md)
- [{Related Skill}](../skills/{skill-name}/SKILL.md)
```

## 출력 포맷 템플릿

### 생성 완료 시

```markdown
## ✅ SAX Agent 생성 완료

**Agent**: {agent-name}
**Location**: `sax/packages/{package}/agents/{agent-name}.md`
**Purpose**: {Agent 역할}

### 생성된 파일

- ✅ `agents/{agent-name}.md` (Agent 파일)
- ✅ `CLAUDE.md` Agents 섹션 업데이트

### 통합 작업

- ✅ `orchestrator.md` 라우팅 추가 (해당 시)
- ✅ Frontmatter 표준 준수 검증

### 다음 단계

1. Agent 워크플로우 테스트
2. 필요 시 Skills 추가
3. 관련 Agent/Skill과 통합
```

### 수정 완료 시

```markdown
## ✅ SAX Agent 수정 완료

**Agent**: {agent-name}
**Location**: `sax/packages/{package}/agents/{agent-name}.md`
**Changes**: {변경 사항 요약}

### 변경된 항목

- ✅ {항목 1}
- ✅ {항목 2}

### 업데이트된 파일

- ✅ `agents/{agent-name}.md` (Agent 파일)
- ✅ `CLAUDE.md` (해당 시)
- ✅ `orchestrator.md` (해당 시)

### 다음 단계

1. 변경된 워크플로우 테스트
2. 관련 Agent/Skill 통합 확인
```

### 삭제 완료 시

```markdown
## ✅ SAX Agent 삭제 완료

**Agent**: {agent-name}
**Removed**: `sax/packages/{package}/agents/{agent-name}.md`

### 정리된 항목

- ✅ Agent 파일 삭제
- ✅ `CLAUDE.md` Agents 테이블 업데이트
- ✅ `orchestrator.md` 라우팅 제거 (해당 시)
- ✅ 다른 Agent/Skill의 Related 링크 제거

### 영향도 분석

{삭제된 Agent의 의존성 분석}
```

### 분석 완료 시

```markdown
## 📊 SAX Agents 분석 완료

**분석 범위**: {단일 Agent | 패키지 단위 | 전체}
**분석 기준**: Anthropic Agent 표준

### 패키지별 분석 결과

#### SAX-PO

**✅ 표준 준수**: {count}개
**⚠️ 개선 필요**: {count}개
- 🔴 Critical: {count}개
- 🟡 Important: {count}개
- 🟢 Nice-to-have: {count}개

#### SAX-Meta

**✅ 표준 준수**: {count}개
**⚠️ 개선 필요**: {count}개

### 상세 개선 리스트

[패키지별 개선 필요 Agents 상세 리스트]

### 권장 조치

1. 우선순위별 개선 작업 진행
2. Frontmatter description 표준화
3. CLAUDE.md, orchestrator.md 통합 확인
```

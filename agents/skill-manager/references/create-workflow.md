# Create Workflow

> skill-manager Agent의 Skill 생성 워크플로우

## Phase 1: 생성 (Create)

### 1.1 요구사항 수집 (대화형)

사용자에게 다음 질문을 통해 정보 수집:

```markdown
[SAX] Agent: skill-manager 시작 → 요구사항 수집

## 🤔 Skill 생성을 위한 정보

### 1. What (무엇을 하는 Skill인가요?)
- 핵심 기능은 무엇인가요?
- 입력과 출력은 무엇인가요?

### 2. When (언제 사용하나요?)
- 어떤 키워드나 상황에서 트리거되나요?
- Agent가 자동 호출하나요, 수동 호출인가요?

### 3. How Complex (얼마나 복잡한가요?)
- 간단한 작업 (<100 lines)
- 중간 복잡도 (100-300 lines)
- 복잡한 작업 (>300 lines, references/ 필요)

이 정보를 알려주시면 최적의 Skill 구조를 설계하겠습니다.
```

### 1.2 구조 설계

수집된 정보를 기반으로 Skill 구조 결정:

```markdown
[SAX] Agent: skill-manager → 구조 설계 완료

## 📋 Skill 구조

**이름**: {skill-name}
**예상 크기**: {estimated_lines} lines
**구조**: {Simple/Medium/Complex}

### 파일 구성
- SKILL.md (~{target_lines} lines)
{references_list}

이 구조로 진행할까요?
```

### 1.3 파일 생성

**디렉토리 구조**:

```bash
mkdir -p sax/packages/{package}/skills/{skill-name}/references
```

**SKILL.md 구조**:

```markdown
---
name: {skill-name}
description: {역할 요약}. {When to use (조건 1, 2, 3)}.
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: {skill-name} 호출 - {context}` 시스템 메시지를 첫 줄에 출력하세요.

# {Skill Name}

> {1줄 핵심 설명}

## Quick Start

\`\`\`bash
{사용 예시}
\`\`\`

## Process (필요 시)

간략한 프로세스 설명

## Advanced Usage

상세 내용은 references/ 참조:
- [Workflow](references/workflow.md)
- [Examples](references/examples.md)
- [Rules](references/rules.md)

## SAX Message

\`\`\`markdown
[SAX] Skill: {skill-name} 실행
\`\`\`

## Related

- [Related Agent](../agents/{agent-name}.md)
- [Related Skill](./{skill-name}/SKILL.md)
```

**references/ 생성 (필요 시)**:

- `workflow.md` - 상세 워크플로우
- `examples.md` - 사용 예시
- `rules.md` - 검증 규칙
- `api.md` - API 참조

### 1.4 검증 및 가이드

```markdown
[SAX] Agent: skill-manager → 생성 완료

## ✅ Skill 생성 완료

**Skill**: {skill-name}
**Location**: `sax/packages/{package}/skills/{skill-name}/`
**Size**: SKILL.md ({line_count} lines) + references/ ({ref_count} files)

### 검증 체크리스트
- [x] Frontmatter (name, description)
- [x] Description includes "when to use"
- [x] SKILL.md < 100 lines
- [x] Quick Start section
- [x] SAX Message format
- [x] Related links

### 다음 단계

1. **테스트**: Skill을 수동으로 호출해보세요
2. **Agent 연동**: 이 Skill을 사용할 Agent 업데이트
3. **동기화**: .claude/ 디렉토리에 동기화
4. **버저닝**: VERSION 및 CHANGELOG 업데이트

Skill을 테스트해볼까요?
```

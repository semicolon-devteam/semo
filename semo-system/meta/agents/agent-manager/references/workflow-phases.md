# Workflow Phases 상세

> agent-manager Agent의 Phase별 워크플로우

## Phase 1: 생성 (Create)

### 1.1 요구사항 수집

**Agent 생성을 위한 정보 수집**:

1. **What** (무엇을 하는 Agent인가요?):
   - 핵심 역할은?
   - 주요 책임은?
   - 기대 결과는?

2. **Who** (누가 사용하나요?):
   - 대상: PO/개발자/SEMO 개발자?
   - 사용 빈도는?

3. **When** (언제 사용하나요?):
   - 트리거 조건은?
   - 선행 조건은?

4. **How** (어떻게 동작하나요?):
   - 단계별 워크플로우
   - 필요한 도구/API
   - 의존성 (Agent/Skill)

### 1.2 Agent 파일 생성

**파일 위치**: `sax/packages/{package}/agents/{agent-name}.md`

**네이밍 규칙**:
- kebab-case 사용
- 역할을 명확히 드러내는 이름
- ✅ `epic-master.md`, `spec-writer.md`
- ❌ `agent1.md`, `helper.md`

### 1.3 CLAUDE.md 업데이트

**Agents 섹션**에 새 Agent 추가:

```markdown
### Agents

| Agent           | 역할                    | 파일                      |
| --------------- | ----------------------- | ------------------------- |
| {new-agent}     | {역할 설명}             | `agents/{new-agent}.md`   |
```

### 1.4 orchestrator.md 업데이트 (필요 시)

Agent가 라우팅 대상이 되는 경우:

```markdown
### Routing Decision Table

| Intent Category | Target Agent | Keywords |
|-----------------|--------------|----------|
| {새 카테고리}   | {new-agent}  | {키워드} |
```

### 1.5 검증

```bash
# 1. 파일 존재 확인
ls -la sax/packages/{package}/agents/{new-agent}.md

# 2. CLAUDE.md 확인
grep "{new-agent}" sax/packages/{package}/CLAUDE.md

# 3. orchestrator.md 확인 (라우팅 대상인 경우)
grep "{new-agent}" sax/packages/{package}/agents/orchestrator.md
```

## Phase 2: 수정 (Update)

### 2.1 기존 Agent 분석

```bash
# Agent 파일 읽기
cat sax/packages/{package}/agents/{agent-name}.md

# 관련 참조 검색
grep -r "{agent-name}" sax/packages/{package}/
```

### 2.2 수정 작업 수행

**수정 가능 항목**:
- **Frontmatter**: name, description, tools 변경
- **역할 (Capabilities)**: 책임 추가/제거/변경
- **트리거 (When to Use)**: 활성화 조건 변경
- **워크플로우**: Phase 추가/수정/제거
- **Related**: 관련 Agent/Skill 링크 업데이트

**주의사항**:
- name 변경 시: 파일명도 함께 변경
- description 변경 시: CLAUDE.md도 함께 업데이트
- 트리거 변경 시: orchestrator.md 라우팅 업데이트

### 2.3 통합 업데이트

```bash
# name 변경 시: 파일 리네임
mv sax/packages/{package}/agents/{old-name}.md \
   sax/packages/{package}/agents/{new-name}.md

# CLAUDE.md 업데이트
# orchestrator.md 업데이트
# Related 링크 업데이트
```

### 2.4 검증

```bash
# 변경 사항 확인
git diff sax/packages/{package}/agents/{agent-name}.md

# 참조 무결성 검증
grep -r "{agent-name}" sax/packages/{package}/
```

## Phase 3: 삭제 (Delete)

### 3.1 영향도 분석

```bash
# Agent 파일 확인
ls -la sax/packages/{package}/agents/{agent-name}.md

# 참조 검색
grep -r "{agent-name}" sax/packages/{package}/
```

### 3.2 참조 제거

**제거 대상**:

1. **CLAUDE.md**: Agents 테이블에서 해당 행 제거
2. **orchestrator.md**: 라우팅 테이블에서 해당 행 제거
3. **Related 링크**: 다른 Agent/Skill의 Related 섹션에서 링크 제거

### 3.3 Agent 파일 삭제

```bash
# Agent 파일 삭제
rm sax/packages/{package}/agents/{agent-name}.md
```

### 3.4 검증

```bash
# 파일 삭제 확인
ls -la sax/packages/{package}/agents/{agent-name}.md

# 참조 제거 확인 (결과 없어야 함)
grep -r "{agent-name}" sax/packages/{package}/
```

## Phase 4: 분석 (Audit)

### 4.1 분석 범위 결정

- **단일 Agent 분석**: 특정 Agent의 품질 검증
- **패키지 단위 분석**: 특정 패키지의 모든 Agents 검증
- **전체 분석**: 모든 SEMO 패키지의 Agents 검증

### 4.2 분석 수행

```bash
# 패키지별 Agents 디렉토리 탐색
ls -la sax/packages/{package}/agents/

# 각 Agent 분석
for agent in sax/packages/{package}/agents/*.md; do
  cat "$agent"
  head -n 10 "$agent" | grep -E "^(name|description|tools|model):"
done

# CLAUDE.md 등록 확인
grep -A 5 "## Agents" sax/packages/{package}/CLAUDE.md
```

### 4.3 분석 결과 정리

**패키지별 그루핑**:

```markdown
## 📊 SEMO Agents 분석 결과

### SEMO-PO

#### ✅ 표준 준수 Agents (수정 불필요)
- `epic-master`: Frontmatter 완벽, Workflow 명확

#### ⚠️ 개선 필요 Agents
- `agent-a`:
  - 문제: description에 "when to use" 누락
  - 권장: Frontmatter description 업데이트
```

**우선순위 분류**:

- 🔴 **Critical**: 표준 위반이 심각한 경우
- 🟡 **Important**: 개선이 필요하나 기능에는 문제 없음
- 🟢 **Nice-to-have**: 선택적 개선

### 4.4 개선 방안 제시

```markdown
## 🔧 개선 방안

### agent-a (SEMO-PO)

**현재 상태**:
- description: "Epic 생성 Agent"

**권장 수정**:
- description: "Epic 생성 전문가. PROACTIVELY use when: (1)..."

**예상 효과**:
- Orchestrator 라우팅 정확도 향상
```

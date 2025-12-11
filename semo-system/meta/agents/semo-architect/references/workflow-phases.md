# Workflow Phases 상세

> semo-architect의 단계별 워크플로우

## Phase 1: 요구사항 분석

### 1.1 작업 유형 파악

- Agent 추가/수정/삭제
- Skill 추가/수정/삭제
- CLAUDE.md 변경
- 워크플로우 개선
- 버그 수정

### 1.2 영향 범위 확인

- SEMO-PO만 해당
- SEMO-Next만 해당
- 모든 SEMO 패키지 해당
- SEMO Core 변경 필요

### 1.3 버전 영향 판단

- MAJOR (x.0.0): 호환성 깨짐, 워크플로우 근본 변경
- MINOR (0.x.0): Agent/Skill 추가/삭제, 기능 추가
- PATCH (0.0.x): 버그 수정, 오타 수정

## Phase 2: 작업 수행

### 2.1 Agent 추가 시

```bash
# 1. Agent 파일 생성
# packages/{package}/agents/{agent-name}.md

# 2. CLAUDE.md 업데이트 (Package Components - Agents 섹션)

# 3. orchestrator.md 업데이트 (Routing Decision Table)
```

### 2.2 Skill 추가 시

```bash
# 1. Skill 디렉토리 및 파일 생성
mkdir -p packages/{package}/skills/{skill-name}
# packages/{package}/skills/{skill-name}/SKILL.md

# 2. CLAUDE.md 업데이트 (Package Components - Skills 섹션)
```

### 2.3 Component 삭제 시

```bash
# 1. 파일/디렉토리 삭제
rm -rf packages/{package}/{agents|skills}/{name}

# 2. CLAUDE.md에서 제거

# 3. orchestrator.md에서 라우팅 제거 (Agent의 경우)

# 4. 다른 Agent/Skill에서 참조 제거
# grep으로 참조 검색 후 업데이트
```

### 2.4 CLAUDE.md 업데이트

**Package Components 섹션**:

```markdown
### Agents

| Agent | 역할 | 파일 |
|-------|------|------|
| {name} | {역할} | `agents/{name}.md` |

### Skills

| Skill | 역할 | 파일 |
|-------|------|------|
| {name} | {역할} | `skills/{name}/SKILL.md` |
```

### 2.5 orchestrator 업데이트

**Routing Decision Table**:

```markdown
| User Intent | Route To | Detection Keywords |
|-------------|----------|-------------------|
| {intent} | `{agent-name}` | "{keyword1}", "{keyword2}" |
```

## Phase 3: 버저닝

> 📚 **상세**: [versioning-guide.md](versioning-guide.md)

```bash
# 현재 버전 확인
cat VERSION

# VERSION 파일 업데이트
echo "{new_version}" > VERSION

# CHANGELOG 생성
# CHANGELOG/{new_version}.md
```

## Phase 4: 동기화 및 커밋

### 4.1 패키지 소스 → .claude/ 동기화

```bash
# 해당 레포의 .claude/ 디렉토리로 동기화
cp -r packages/{package}/agents .claude/
cp -r packages/{package}/skills .claude/
cp packages/{package}/CLAUDE.md .claude/
```

### 4.2 Git 커밋

```bash
git add -A

git commit -m "📝 [SEMO] v{new_version}

🚀 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Phase 5: 완료 보고

```markdown
## ✅ SEMO v{new_version} 작업 완료

### 📋 변경 사항

**{변경 유형}**:
- {Component1}
- {Component2}

### 📦 영향 범위

- ✅ {Package1}
- ✅ {Package2}

### 🔢 버저닝

- VERSION: {old} → {new}
- CHANGELOG: `CHANGELOG/{new}.md` 생성

### 💾 커밋

- Commit: `📝 [SEMO] v{new_version}`
- Files: {N}개 파일 변경
```

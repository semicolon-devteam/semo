# Create & Update Workflow

> command-manager Agent의 생성 및 수정 워크플로우

## Phase 1: 생성 (Create)

### 1.1 요구사항 수집

```markdown
**커맨드 생성을 위한 정보 수집**:

1. **What** (무엇을 하는 커맨드인가요?):
   - 핵심 기능은?
   - 사용자 입력은?
   - 기대 출력은?

2. **Who** (누가 사용하나요?):
   - 대상: PO/기획자/개발자?
   - 사용 빈도는?

3. **When** (언제 사용하나요?):
   - 트리거 시점은?
   - 선행 조건은?

4. **How** (어떻게 동작하나요?):
   - 단계별 워크플로우
   - 필요한 도구/API
   - 의존성 (Agent/Skill)
```

### 1.2 커맨드 파일 생성

**파일 위치**: `sax/packages/sax-po/commands/SAX/{command-name}.md`

**네이밍 규칙**:

- ✅ `commands/SAX/onboarding.md` → `/SAX:onboarding`
- ❌ `commands/SAX/:onboarding.md` → `/SAX::onboarding` (이중 콜론 발생)

> 📚 **파일 구조**: [command-template.md](command-template.md) 참조

### 1.3 CLAUDE.md 업데이트

Commands 섹션에 새 커맨드 추가:

```markdown
### Commands

| Command           | 역할                    | 파일                      |
| ----------------- | ----------------------- | ------------------------- |
| /SAX:new-command  | 커맨드 설명             | `commands/SAX/new-command.md` |
| /SAX:onboarding   | 신규 PO/기획자 온보딩   | `commands/SAX/onboarding.md`  |
```

### 1.4 동기화

```bash
# 1. SAX commands 동기화
rsync -av --delete \
  --exclude='.git' \
  sax/packages/sax-po/commands/SAX/ \
  .claude/commands/SAX/

# 2. CLAUDE.md 동기화
rsync -av \
  sax/packages/sax-po/CLAUDE.md \
  .claude/CLAUDE.md
```

### 1.5 검증

```bash
# 1. 파일 존재 확인
ls -la sax/packages/sax-po/commands/SAX/new-command.md
ls -la .claude/commands/SAX/new-command.md

# 2. CLAUDE.md 확인
grep "new-command" sax/packages/sax-po/CLAUDE.md

# 3. 호출 테스트
# Claude Code에서 /SAX:new-command 입력 시 자동완성 확인
```

---

## Phase 2: 수정 (Update)

### 2.1 기존 커맨드 분석

```bash
# 커맨드 파일 읽기
cat sax/packages/sax-po/commands/SAX/{command-name}.md

# 관련 참조 검색
grep -r "{command-name}" sax/packages/sax-po/
```

### 2.2 수정 작업 수행

**수정 가능 항목**:
- **Title**: 커맨드 제목 변경
- **Purpose**: 목적 및 역할 변경
- **Workflow**: 단계 추가/수정/제거
- **Examples**: 사용 예시 추가/변경
- **Related**: 관련 Agent/Skill 링크 업데이트

**주의사항**:
- 파일명 변경 시: 커맨드 호출 형식도 변경됨 (`/SAX:old` → `/SAX:new`)
- CLAUDE.md Commands 테이블 업데이트 필수
- .claude/ 동기화 필수

### 2.3 통합 업데이트

```bash
# 파일명 변경 시
mv sax/packages/sax-po/commands/SAX/{old-name}.md \
   sax/packages/sax-po/commands/SAX/{new-name}.md

# CLAUDE.md 업데이트
# .claude/ 동기화
rsync -av --delete \
  --exclude='.git' \
  sax/packages/sax-po/commands/SAX/ \
  .claude/commands/SAX/
```

### 2.4 검증

```bash
# 변경 사항 확인
git diff sax/packages/sax-po/commands/SAX/{command-name}.md

# 참조 무결성 검증
grep -r "{command-name}" sax/packages/sax-po/
```

---

## Output Format

### 생성 완료 시

```markdown
## ✅ SAX 커맨드 생성 완료

**Command**: /SAX:{command-name}
**Location**: `sax/packages/sax-po/commands/SAX/{command-name}.md`
**Purpose**: {커맨드 목적}

### 생성된 파일

- ✅ `commands/SAX/{command-name}.md` (커맨드 파일)
- ✅ `.claude/commands/SAX/{command-name}.md` (동기화)
- ✅ `CLAUDE.md` Commands 섹션 업데이트

### 호출 방법

\`\`\`bash
/SAX:{command-name}
\`\`\`

### 다음 단계

1. Claude Code에서 `/SAX:{command-name}` 실행하여 테스트
2. 필요 시 워크플로우 보완
3. 관련 Agent/Skill과 통합
```

### 수정 완료 시

```markdown
## ✅ SAX 커맨드 수정 완료

**Command**: /SAX:{command-name}
**Location**: `sax/packages/sax-po/commands/SAX/{command-name}.md`
**Changes**: {변경 사항 요약}

### 변경된 항목

- ✅ {항목 1}
- ✅ {항목 2}

### 업데이트된 파일

- ✅ `commands/SAX/{command-name}.md` (커맨드 파일)
- ✅ `.claude/commands/SAX/{command-name}.md` (동기화)
- ✅ `CLAUDE.md` (해당 시)

### 다음 단계

1. 변경된 워크플로우 테스트
2. 관련 Agent/Skill 통합 확인
```

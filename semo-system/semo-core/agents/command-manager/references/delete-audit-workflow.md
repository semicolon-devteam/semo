# Delete & Audit Workflow

> command-manager Agent의 삭제 및 분석 워크플로우

## Phase 3: 삭제 (Delete)

### 3.1 영향도 분석

```bash
# 커맨드 파일 확인
ls -la sax/packages/semo-po/commands/SEMO/{command-name}.md

# 참조 검색
grep -r "{command-name}" sax/packages/semo-po/
```

### 3.2 참조 제거

**제거 대상**:

1. **CLAUDE.md**: Commands 테이블에서 해당 행 제거
2. **Related 링크**: 다른 커맨드의 Related 섹션에서 링크 제거

### 3.3 커맨드 파일 삭제

```bash
# 소스 파일 삭제
rm sax/packages/semo-po/commands/SEMO/{command-name}.md

# .claude/ 동기화 (삭제 반영)
rsync -av --delete \
  --exclude='.git' \
  sax/packages/semo-po/commands/SEMO/ \
  .claude/commands/SEMO/
```

### 3.4 검증

```bash
# 파일 삭제 확인
ls -la sax/packages/semo-po/commands/SEMO/{command-name}.md
ls -la .claude/commands/SEMO/{command-name}.md

# 참조 제거 확인 (결과 없어야 함)
grep -r "{command-name}" sax/packages/semo-po/
```

### 삭제 완료 Output

```markdown
## ✅ SEMO 커맨드 삭제 완료

**Command**: /SEMO:{command-name}
**Removed**: `sax/packages/semo-po/commands/SEMO/{command-name}.md`

### 정리된 항목

- ✅ 커맨드 파일 삭제 (소스 및 .claude/)
- ✅ `CLAUDE.md` Commands 테이블 업데이트
- ✅ 다른 커맨드의 Related 링크 제거

### 영향도 분석

{삭제된 커맨드의 의존성 분석}
```

---

## Phase 4: 분석 (Audit)

### 4.1 분석 범위 결정

사용자 요청을 분석하여 분석 범위 결정:

- **단일 커맨드 분석**: 특정 커맨드의 품질 검증
- **패키지 단위 분석**: 특정 패키지(SEMO-PO, SEMO-Meta 등)의 모든 Commands 검증
- **전체 분석**: 모든 SEMO 패키지의 Commands 검증

### 4.2 Claude Code Slash Command 표준 체크리스트

각 커맨드에 대해 다음 항목 검증:

**✅ 네이밍 검증**:

- 파일명이 kebab-case 형식인가?
- 이중 콜론(`:`) 문제가 없는가?
- 디렉토리 구조가 `/SEMO:command-name` 형식으로 호출되는가?

**✅ 구조 검증**:

- Title 섹션이 명확한가?
- Purpose 섹션이 구체적인가?
- Workflow가 단계별로 구조화되어 있는가?
- Examples가 포함되어 있는가?
- Related 링크가 유효한가?

**✅ 워크플로우 품질 검증**:

- 대화형 워크플로우가 적절한가?
- 사용자 질문이 명확한가?
- 단계별 프로세스가 논리적인가?
- SEMO Message 포맷이 명시되어 있는가?

**✅ 통합 검증**:

- CLAUDE.md에 올바르게 등록되어 있는가?
- .claude/ 디렉토리에 동기화되어 있는가?
- 관련 Agent/Skill 링크가 유효한가?

### 4.3 분석 수행

```bash
# 패키지별 Commands 디렉토리 탐색
ls -la sax/packages/{package}/commands/SEMO/

# 각 Command 분석
for cmd in sax/packages/{package}/commands/SEMO/*.md; do
  # 커맨드 파일 읽기
  cat "$cmd"

  # Title 및 Purpose 확인
  grep -E "^# " "$cmd"
  grep -E "^## Purpose" "$cmd"

  # Workflow 구조 확인
  grep -E "^## Workflow" "$cmd"

  # SEMO Message 확인
  grep -E "\\[SAX\\]" "$cmd"
done

# CLAUDE.md 등록 확인
grep -A 10 "## Commands" sax/packages/{package}/CLAUDE.md

# .claude/ 동기화 확인
diff -r sax/packages/{package}/commands/SEMO/ \
        .claude/commands/SEMO/
```

### 4.4 분석 결과 정리

**패키지별 그루핑**:

```markdown
## 📊 SEMO Commands 분석 결과

### SEMO-PO

#### ✅ 표준 준수 Commands (수정 불필요)
- `/SEMO:onboarding`: 네이밍 완벽, 워크플로우 명확

#### ⚠️ 개선 필요 Commands
- `/SEMO:command-a`:
  - 문제: 이중 콜론 문제 (파일명: `SAX/:command-a.md`)
  - 권장: 파일명을 `command-a.md`로 변경
- `/SEMO:command-b`:
  - 문제: Workflow 섹션 누락
  - 권장: 단계별 워크플로우 추가

### SEMO-Meta

#### ✅ 표준 준수 Commands
- ...

#### ⚠️ 개선 필요 Commands
- ...
```

**우선순위 분류**:

- 🔴 **Critical**: 표준 위반이 심각한 경우 (이중 콜론 문제, CLAUDE.md 미등록 등)
- 🟡 **Important**: 개선이 필요하나 기능에는 문제 없음 (Workflow 구조, Purpose 개선)
- 🟢 **Nice-to-have**: 선택적 개선 (Examples 추가, Related 링크 추가)

### 4.5 개선 방안 제시

```markdown
## 🔧 개선 방안

### /SEMO:command-a (SEMO-PO)

**현재 상태**:
- 파일명: `SAX/:command-a.md`
- 호출: `/SEMO::command-a` ❌

**권장 수정**:
- 파일명: `SAX/command-a.md`
- 호출: `/SEMO:command-a` ✅

**예상 효과**:
- 이중 콜론 문제 해결
- Claude Code 자동완성 정상 동작
```

### 분석 완료 Output

```markdown
## 📊 SEMO Commands 분석 완료

**분석 범위**: {단일 Command | 패키지 단위 | 전체}
**분석 기준**: Claude Code Slash Command 표준

### 패키지별 분석 결과

#### SEMO-PO

**✅ 표준 준수**: {count}개
**⚠️ 개선 필요**: {count}개
- 🔴 Critical: {count}개
- 🟡 Important: {count}개
- 🟢 Nice-to-have: {count}개

#### SEMO-Meta

**✅ 표준 준수**: {count}개
**⚠️ 개선 필요**: {count}개

### 상세 개선 리스트

[패키지별 개선 필요 Commands 상세 리스트]

### 권장 조치

1. 우선순위별 개선 작업 진행
2. 이중 콜론 문제 해결
3. CLAUDE.md, .claude/ 통합 확인
```

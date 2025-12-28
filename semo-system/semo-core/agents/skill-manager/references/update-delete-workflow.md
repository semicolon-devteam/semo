# Update & Delete Workflow

> skill-manager Agent의 Skill 수정/삭제 워크플로우

## Phase 2: 수정 (Update)

### 2.1 기존 Skill 분석

```bash
# Skill 파일 읽기
cat sax/packages/{package}/skills/{skill-name}/SKILL.md
ls -la sax/packages/{package}/skills/{skill-name}/references/

# 관련 참조 검색
grep -r "{skill-name}" sax/packages/{package}/
```

### 2.2 수정 작업 수행

**수정 가능 항목**:

- **Frontmatter**: name, description 변경
- **Quick Start**: 사용 예시 업데이트
- **Process**: 프로세스 단계 추가/수정/제거
- **Advanced Usage**: references/ 파일 추가/변경
- **Related**: 관련 Agent/Skill 링크 업데이트

**Progressive Disclosure 재적용**:

- Skill이 100 lines 초과 시: references/ 분리 제안
- 복잡도 증가 시: 추가 references/ 파일 생성
- 복잡도 감소 시: references/ 통합 또는 제거

**주의사항**:

- name 변경 시: 디렉토리명도 함께 변경
- description 변경 시: CLAUDE.md도 함께 업데이트
- 구조 변경 시: 참조 무결성 검증

### 2.3 통합 업데이트

```bash
# name 변경 시: 디렉토리 리네임
mv sax/packages/{package}/skills/{old-name}/ \
   sax/packages/{package}/skills/{new-name}/

# CLAUDE.md 업데이트
# Agent Related 링크 업데이트
```

### 2.4 검증

```bash
# 변경 사항 확인
git diff sax/packages/{package}/skills/{skill-name}/

# 참조 무결성 검증
grep -r "{skill-name}" sax/packages/{package}/
```

## Phase 3: 삭제 (Delete)

### 3.1 영향도 분석

```bash
# Skill 디렉토리 확인
ls -la sax/packages/{package}/skills/{skill-name}/

# 참조 검색 (Agent에서 사용 중인지 확인)
grep -r "{skill-name}" sax/packages/{package}/agents/
grep -r "{skill-name}" sax/packages/{package}/CLAUDE.md
```

### 3.2 참조 제거

**제거 대상**:

1. **CLAUDE.md**: Skills 테이블에서 해당 행 제거
2. **Agent 파일**: "Skills Used" 섹션에서 해당 Skill 제거
3. **Related 링크**: 다른 Skill의 Related 섹션에서 링크 제거

### 3.3 Skill 디렉토리 삭제

```bash
# Skill 디렉토리 전체 삭제
rm -rf sax/packages/{package}/skills/{skill-name}/
```

### 3.4 검증

```bash
# 디렉토리 삭제 확인
ls -la sax/packages/{package}/skills/{skill-name}/

# 참조 제거 확인 (결과 없어야 함)
grep -r "{skill-name}" sax/packages/{package}/
```

## Output Formats

### 수정 완료 시

```markdown
## ✅ SEMO Skill 수정 완료

**Skill**: {skill-name}
**Location**: `sax/packages/{package}/skills/{skill-name}/`
**Changes**: {변경 사항 요약}

### 변경된 항목

- ✅ {항목 1}
- ✅ {항목 2}

### 업데이트된 파일

- ✅ `skills/{skill-name}/SKILL.md`
- ✅ `skills/{skill-name}/references/` (해당 시)
- ✅ `CLAUDE.md` (해당 시)

### 다음 단계

1. 변경된 Skill 테스트
2. 관련 Agent 통합 확인
```

### 삭제 완료 시

```markdown
## ✅ SEMO Skill 삭제 완료

**Skill**: {skill-name}
**Removed**: `sax/packages/{package}/skills/{skill-name}/`

### 정리된 항목

- ✅ Skill 디렉토리 전체 삭제
- ✅ `CLAUDE.md` Skills 테이블 업데이트
- ✅ Agent "Skills Used" 섹션 제거
- ✅ 다른 Skill의 Related 링크 제거

### 영향도 분석

{삭제된 Skill의 의존성 분석}
```

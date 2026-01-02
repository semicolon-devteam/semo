# Error Handling

## Issue Creation Failure

### 1. Authentication Error

- Check `gh auth status`
- Prompt user to authenticate: `gh auth login`

### 2. Permission Error

- Verify user has write access to repository
- Check organization permissions

### 3. API Rate Limit

- Detect rate limit error
- Pause and retry after cooldown
- Batch remaining issues

### 4. Duplicate Issues

- Check for existing issues with same title
- Skip if already exists
- Report skipped issues

## specs/ 폴더 Parse Error

### 1. Missing Files

- tasks.md 필수 (Task 목록)
- spec.md 필수 (AC, 테스트 케이스)
- plan.md 선택 (링크만 생성)

### 2. Invalid Format

- Report parsing error with file name and line number
- Suggest format corrections
- Exit without creating issues

### 3. Missing Metadata

- Use defaults (complexity: medium, layer: CODE)
- Warn user about missing info

### 4. AC/테스트 케이스 추출 실패

- spec.md에서 AC 섹션을 찾지 못한 경우 경고
- 빈 체크리스트로 Issue 생성 (수동 추가 필요 안내)

## Success Criteria

This skill succeeds when:

- ✅ All tasks from tasks.md converted to Issues
- ✅ Issues created in dependency order
- ✅ All labels correctly applied
- ✅ Epic linked to all sub-issues
- ✅ tasks.md updated with issue references
- ✅ No duplicate issues created
- ✅ Dependency chains properly established
- ✅ Speckit Progress 섹션 포함
- ✅ AC 체크리스트 포함
- ✅ 테스트 케이스 섹션 포함
- ✅ GitHub Projects 등록 완료
- ✅ Issue Type 설정 완료 (Task)
- ✅ Summary report generated

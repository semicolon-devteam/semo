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

## tasks.md Parse Error

### 1. Invalid Format
- Report parsing error with line number
- Suggest format corrections
- Exit without creating issues

### 2. Missing Metadata
- Use defaults (complexity: medium, layer: CODE)
- Warn user about missing info

## Success Criteria

This skill succeeds when:

- ✅ All tasks from tasks.md converted to Issues
- ✅ Issues created in dependency order
- ✅ All labels correctly applied
- ✅ Epic linked to all sub-issues
- ✅ tasks.md updated with issue references
- ✅ No duplicate issues created
- ✅ Dependency chains properly established
- ✅ Summary report generated

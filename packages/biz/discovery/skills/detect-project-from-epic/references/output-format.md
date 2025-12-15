# Output Format Reference

## 프로젝트 감지 성공

```markdown
✅ **프로젝트 감지 완료**

**원본 Epic**: {source_repo}#{epic_number}
**프로젝트**: {project_name}
**라벨**: `{project_label}`

→ 새 Epic에 동일한 프로젝트 라벨을 적용합니다.
```

## 프로젝트 감지 실패

```markdown
⚠️ **프로젝트 라벨 미감지**

원본 Epic에 프로젝트 라벨이 없습니다.

**다음 단계**: assign-project-label Skill로 수동 선택 필요
```

## Error Handling

### API 오류

```markdown
⚠️ **Epic 조회 실패**

{error_message}

원본 Epic URL을 확인하고 다시 시도해주세요.
```

### 여러 프로젝트 라벨

```markdown
⚠️ **복수 프로젝트 라벨 감지**

원본 Epic에 여러 프로젝트 라벨이 있습니다:
- `{label_1}`
- `{label_2}`

**다음 단계**: assign-project-label로 올바른 프로젝트 선택 필요
```

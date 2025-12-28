# Output Format Reference

## 성공 출력

```markdown
✅ **프로젝트 라벨 및 Projects 연결 완료**

**Epic**: #{epic_number}
**프로젝트**: {project_name}
**라벨**: `{project_label}`
**GitHub Projects**: #1 이슈관리 보드에 추가됨
```

## Error Handling

### 프로젝트 미선택

```markdown
⚠️ **프로젝트 선택 필요**

Epic에 프로젝트 라벨을 부여하려면 프로젝트를 선택해주세요.
```

### GitHub Projects API 오류

```markdown
⚠️ **Projects 연결 실패**

{error_message}

**수동 연결 방법**:
1. https://github.com/orgs/semicolon-devteam/projects/1 접속
2. Epic #{epic_number} 수동 추가
```

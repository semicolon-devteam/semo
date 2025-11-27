# Output Format Reference

## 체크리스트 형식

```markdown
## 📊 Estimation (작업량 측정)

- [ ] 간단한 UI 컴포넌트 퍼블리싱 (1점)
- [x] organisms UI 컴포넌트 구현 (3점)
- [x] 기본적인 Form 작업 및 연동 (5점)
- [ ] API 엔드포인트 구현 (CRUD) (3점)
- [ ] 복잡한 비즈니스 로직 구현 (5점)
- [x] 데이터베이스 마이그레이션 작성 (2점)
- [ ] 테스트 코드 작성 (작업 포인트의 30%)

**총합**: 10점
```

## Draft Task 본문에 추가

```markdown
## 📊 Estimation (작업량 측정)

### 작업 항목

- [x] organisms UI 컴포넌트 구현 (3점)
- [x] 기본적인 Form 작업 및 연동 (5점)
- [x] 데이터베이스 마이그레이션 작성 (2점)

### 총 작업량

**Point**: 10점
**예상 기간**: 2일 (1 Point = 0.5일 기준)
```

## JSON Output

```json
{
  "total_points": 10,
  "checked_items": [
    {"name": "organisms UI 컴포넌트 구현", "point": 3},
    {"name": "기본적인 Form 작업 및 연동", "point": 5},
    {"name": "데이터베이스 마이그레이션 작성", "point": 2}
  ],
  "estimated_days": 5.0,
  "projects_field_updated": true
}
```

## GitHub Projects 필드 업데이트

```bash
# GitHub Projects API로 '작업량' 필드에 총합 입력
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "{project_id}"
        itemId: "{item_id}"
        fieldId: "{field_id}"
        value: {
          number: 10
        }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
'
```

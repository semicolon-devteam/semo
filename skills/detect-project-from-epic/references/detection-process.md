# Detection Process Reference

## 상세 프로세스

### 1. 원본 Epic Labels 조회

```bash
# 원본 Epic의 모든 라벨 조회
gh api repos/{source_org}/{source_repo}/issues/{epic_number} \
  --jq '.labels[] | .name'
```

### 2. 프로젝트 라벨 추출

**프로젝트 라벨 목록**:
- `오피스`
- `랜드`
- `정치판`
- `코인톡`

**추출 로직**:
```bash
# 프로젝트 라벨만 필터링
PROJECT_LABEL=$(gh api repos/{source_org}/{source_repo}/issues/{epic_number} \
  --jq '.labels[] | select(.name == "오피스" or .name == "랜드" or .name == "정치판" or .name == "코인톡") | .name')
```

### 3. 감지 결과 반환

**성공 시**:
```json
{
  "detected": true,
  "project_label": "오피스",
  "project_name": "cm-office"
}
```

**프로젝트 라벨 없음**:
```json
{
  "detected": false,
  "project_label": null,
  "project_name": null
}
```

## Integration with epic-master

### Epic 이식 워크플로우

```markdown
1. 원본 Epic 읽기
2. **detect-project-from-epic** 실행
3. Epic 내용 복사
4. docs 레포에 새 Epic 생성
5. 감지된 프로젝트 라벨 적용 (또는 assign-project-label로 수동 선택)
6. GitHub Projects 연결
```

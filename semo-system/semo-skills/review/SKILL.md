---
name: review
description: |
  코드 리뷰 및 Task 리뷰. Use when:
  (1) PR 코드 리뷰, (2) Task 완료 검토, (3) 품질 확인.
tools: [Bash, Read, Grep, mcp__github__*]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: review 호출 - {type}` 시스템 메시지를 첫 줄에 출력하세요.

# review Skill

> 코드 리뷰 및 Task 리뷰 통합

## Review Types

| Type | 설명 | 트리거 |
|------|------|--------|
| **code** | PR 코드 리뷰 | "코드 리뷰", "PR 확인" |
| **task** | Task 완료 검토 | "Task 리뷰", "AC 확인" |

---

## Type: code (코드 리뷰)

### Workflow

```
1. PR 정보 조회 (gh pr view)
2. 변경 파일 확인 (gh pr diff)
3. 체크리스트 검토:
   - 코드 품질
   - 테스트 커버리지
   - 문서화
   - 보안
4. 리뷰 코멘트 작성
```

### 체크리스트

- [ ] 코딩 컨벤션 준수
- [ ] 테스트 코드 포함
- [ ] 타입 안전성 확보
- [ ] 에러 핸들링
- [ ] 문서 업데이트

### 출력

```markdown
[SEMO] Skill: review 완료 (code)

✅ **PR #123** 리뷰 완료

**변경 파일**: 5개
**이슈**: [3] 개선 필요
**승인**: ⏳ 보류
```

---

## Type: task (Task 리뷰)

### Workflow

```
1. Task Issue 조회
2. AC (Acceptance Criteria) 확인
3. 구현 완료 여부 체크
4. QA 요청 여부 결정
```

### 출력

```markdown
[SEMO] Skill: review 완료 (task)

✅ **Task #456** 리뷰 완료

**AC 달성**: 4/4
**QA 요청**: 필요
```

---

## Related

- `test` - 테스트 실행
- `verify` - 품질 검증
- `git` - PR 생성

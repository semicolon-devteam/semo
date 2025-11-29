---
name: run-test
description: 테스트 실행 시작
---

# /SAX:run-test Command

특정 이슈의 테스트를 시작합니다.

## Trigger

- `/SAX:run-test {repo}#{number}` 명령어
- "{repo}#{number} 테스트해줘" 패턴

## Syntax

```
/SAX:run-test {repo}#{number}
```

**예시**:

- `/SAX:run-test cm-office#45`
- `cm-office#45 테스트해줘`

## Action

`qa-master` Agent를 실행하여:

1. 이슈 정보 조회
2. AC 검증 (`skill:validate-test-cases`)
3. STG 환경 확인 (`skill:verify-stg-environment`)
4. 테스트 가이드 제공 (`skill:execute-test`)

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 테스트 실행

[SAX] Agent 위임: qa-master (사유: 테스트 실행 요청)

[SAX] Agent: qa-master 호출 - cm-office#45

## 🧪 테스트 실행: cm-office#45

### 이슈 정보

- **제목**: 댓글 기능 추가
- **담당자**: @developer1
- **Iteration**: #1

### 테스트 환경

- **STG URL**: https://stg-office.semicolon.com
- **상태**: ✅ 정상

---

## ✅ 테스트 체크리스트

- [ ] 사용자가 댓글을 작성할 수 있다
- [ ] 댓글 작성 후 목록에 즉시 반영된다
- [ ] 빈 댓글은 작성할 수 없다

---

테스트 완료 후:
- 통과: `/SAX:test-pass cm-office#45`
- 실패: `/SAX:test-fail cm-office#45 사유: {사유}`
```

## Related

- [qa-master Agent](../../agents/qa-master/qa-master.md)
- [execute-test Skill](../../skills/execute-test/SKILL.md)

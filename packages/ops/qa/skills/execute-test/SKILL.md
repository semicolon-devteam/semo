---
name: execute-test
description: |
  테스트 실행 가이드 제공. Use when:
  (1) 테스트 항목 체크리스트 표시, (2) 테스트 방법 안내,
  (3) 테스트 결과 입력 대기.
tools: [Bash, GitHub CLI, Read]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: execute-test 호출 - {repo}#{number}` 시스템 메시지를 첫 줄에 출력하세요.

# Execute Test Skill

> 테스트 실행 가이드 및 체크리스트 제공

## 트리거

- qa-master Agent에서 호출
- 특정 이슈 테스트 시작 시

## 워크플로우

1. **이슈 정보 조회**: 제목, AC, 담당자
2. **환경 확인**: STG 접속 정보
3. **테스트 가이드 출력**: AC 기반 체크리스트
4. **결과 입력 대기**

## 출력 형식

```markdown
[SEMO] Skill: execute-test 호출 - {repo}#{number}

## 🧪 테스트 실행: {repo}#{number}

### 이슈 정보

- **제목**: {title}
- **담당자**: @{assignee}
- **Iteration**: #{count}

### 테스트 환경

- **STG URL**: {stg_url}
- **테스트 계정**: test@example.com
- **브라우저**: Chrome 최신 (권장)

---

## ✅ 테스트 체크리스트

AC를 기반으로 다음 항목을 확인하세요:

### 정상 동작

- [ ] AC 1: {criterion_1}
- [ ] AC 2: {criterion_2}

### 예외 처리

- [ ] AC 3: {criterion_3}
- [ ] AC 4: {criterion_4}

### Edge Cases

- [ ] AC 5: {criterion_5}

---

## 📝 테스트 완료 후

**통과 시**:
```
/SEMO:test-pass {repo}#{number}
```

**실패 시**:
```
/SEMO:test-fail {repo}#{number} 사유: {실패한 AC 항목과 상세 사유}
```

---

테스트를 시작하세요. 완료 후 결과를 입력해주세요.
```

## AC 추출

이슈 본문에서 AC 추출:

```bash
gh issue view {number} --repo semicolon-devteam/{repo} --json body --jq '.body' | grep -E "^\s*-\s*\[[ x]\]"
```

## 테스트 팁

### 브라우저 테스트

- 시크릿 모드에서 테스트 (캐시 영향 제거)
- 개발자 도구 Network 탭 확인 (API 에러)
- Console 탭 확인 (JS 에러)

### 모바일 테스트

- 반응형 모드 사용 (Chrome DevTools)
- 실제 모바일 기기 테스트 권장

## 테스트 중단 시

```markdown
테스트를 중단할까요?

1. 결과 저장하지 않고 중단
2. 현재까지 진행 상황 저장 후 중단
3. 계속 진행

선택:
```

## References

- [Test Guidelines](references/test-guidelines.md)
- [Browser Setup](references/browser-setup.md)

## Related

- [qa-master Agent](../../agents/qa-master/qa-master.md)
- [report-test-result Skill](../report-test-result/SKILL.md)

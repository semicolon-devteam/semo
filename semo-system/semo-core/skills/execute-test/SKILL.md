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

## 🔴 용어 변환 가이드 (비개발자 친화적 표현)

> **⚠️ 테스트 결과 출력 시 개발 용어 대신 일반 용어를 사용합니다.**

| 개발 용어 | 일반 용어 | 예시 |
|----------|----------|------|
| CRUD | 작성/조회/수정/삭제 | "CRUD 불가" → "작성/수정/삭제 기능 동작 안함" |
| 404 에러 | 페이지를 찾을 수 없음 | "404 에러 발생" → "페이지를 찾을 수 없음" |
| 500 에러 | 서버 오류 | "500 에러" → "서버 오류 발생" |
| API | 서버 연동 | "API 호출 실패" → "서버 연동 실패" |
| 리다이렉트 | 다른 페이지로 이동 | "리다이렉트 안됨" → "다른 페이지로 이동 안됨" |
| enum 에러 | 선택 값 오류 | "enum 에러" → "선택 값 오류" |
| validation | 입력 값 검증 | "validation 실패" → "입력 값 검증 실패" |
| timeout | 응답 시간 초과 | "timeout 발생" → "응답 시간 초과" |
| null/undefined | 값 없음 | "null 반환" → "값이 표시되지 않음" |
| Pass/Fail | 정상/실패 | "Pass" → "정상", "Fail" → "실패" |
| Critical | 심각 | "Critical" → "심각" |
| Major | 중요 | "Major" → "중요" |
| Minor | 경미 | "Minor" → "경미" |

### 변환 예시

```markdown
# Before (개발 용어)
❌ Fail | `invalid input value for enum permission_type: "admin"` 에러
❌ Fail | 404 에러 발생
❌ Fail | CRUD 기능 불가

# After (일반 용어)
❌ 실패 | 게시글 저장 시 권한 선택 값 오류 발생
❌ 실패 | 페이지를 찾을 수 없음
❌ 실패 | 작성/수정/삭제 기능 동작 안함
```

---

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

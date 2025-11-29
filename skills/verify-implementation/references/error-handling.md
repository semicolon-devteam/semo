# Error Handling

> verify-implementation Skill의 에러 처리 패턴

## 이슈를 찾을 수 없음

```markdown
[SAX] Skill: verify-implementation 오류

❌ 이슈를 찾을 수 없습니다.

**입력**: {input}
**시도한 레포**: {repo}

**해결 방법**:
- 이슈 번호 확인: `gh issue view {number} --repo {repo}`
- 레포 접근 권한 확인: `gh repo view {repo}`
```

## 요구사항 추출 실패

```markdown
[SAX] Skill: verify-implementation 경고

⚠️ 이슈에서 명확한 요구사항을 추출하지 못했습니다.

**이슈**: {repo}#{number}
**본문 미리보기**: {body_preview}

요구사항을 직접 알려주시면 검증해드릴게요.
```

## 코드 검색 실패

```markdown
[SAX] Skill: verify-implementation 경고

⚠️ 관련 코드를 찾지 못했습니다.

**검색 키워드**: {keywords}
**검색 범위**: {search_paths}

**가능한 원인**:
1. 코드가 아직 구현되지 않음
2. 다른 네이밍 규칙 사용
3. 검색 범위 외 위치에 존재

**해결 방법**:
- 코드 위치를 직접 알려주세요
- 또는 다른 키워드로 재검색
```

## 권한 오류

```markdown
[SAX] Skill: verify-implementation 오류

❌ GitHub 접근 권한이 없습니다.

**시도한 레포**: {repo}

**해결 방법**:
1. `gh auth status` 로 인증 상태 확인
2. `gh auth login` 으로 재인증
3. 레포 접근 권한 확인
```

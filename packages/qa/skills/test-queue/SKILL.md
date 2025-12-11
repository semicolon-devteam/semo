---
name: test-queue
description: |
  테스트 대기 이슈 목록 관리. Use when:
  (1) "테스트중" 상태 이슈 조회, (2) 테스트 우선순위 확인,
  (3) 테스트 대기열 모니터링, (4) 오래된 테스트 대기 이슈 알림.
tools: [Bash, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: test-queue 호출` 시스템 메시지를 첫 줄에 출력하세요.

# Test Queue Skill

> 테스트 대기 이슈 목록 조회 및 관리

## 트리거

- `/SAX:test-queue` 명령어
- "테스트할 이슈 뭐야", "테스트 대기", "뭐 테스트해" 키워드

## 기능

1. **"테스트중" 상태 이슈 조회**
2. **대기 시간 기준 정렬**
3. **레포지토리별 그룹핑**
4. **오래된 이슈 하이라이트**

## 조회 쿼리

> **SoT**: GitHub Project에서 직접 조회

```bash
gh api graphql -f query='
query {
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      items(first: 100) {
        nodes {
          content {
            ... on Issue {
              number
              title
              createdAt
              repository { name }
              assignees(first: 3) {
                nodes { login }
              }
            }
          }
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
        }
      }
    }
  }
}' --jq '.data.organization.projectV2.items.nodes[] | select(.fieldValueByName.name == "테스트중") | .content'
```

## 출력 형식

```markdown
[SAX] Skill: test-queue 호출

## 📋 테스트 대기열

### cm-office (3건)

| # | 이슈 | 제목 | 대기 | 담당자 |
|---|------|------|------|--------|
| 1 | #45 | 댓글 기능 추가 | 2시간 | @developer1 |
| 2 | #48 | 좋아요 버튼 | 1일 | @developer2 |
| 3 | #52 | 프로필 수정 | ⚠️ 3일 | @developer3 |

### core-backend (1건)

| # | 이슈 | 제목 | 대기 | 담당자 |
|---|------|------|------|--------|
| 1 | #88 | 인증 API 수정 | 4시간 | @backend-dev |

---

**총 4건** 테스트 대기 중

⚠️ 3일 이상 대기 이슈가 있습니다. 우선 처리를 권장합니다.

테스트할 이슈를 선택하세요: "{repo}#{number} 테스트해줘"
```

## 우선순위 규칙

1. **대기 시간**: 오래된 이슈 우선
2. **긴급 라벨**: `urgent`, `hotfix` 라벨 우선
3. **레포지토리**: 프로덕션 영향도 순

## 오래된 이슈 알림

3일 이상 대기 시:

```markdown
⚠️ **장기 대기 이슈 알림**

다음 이슈가 3일 이상 테스트 대기 중입니다:
- cm-office#52: 프로필 수정 (3일)

담당자에게 알림을 보낼까요? (Y/n)
```

## References

- [Priority Rules](references/priority-rules.md)

## Related

- [qa-master Agent](../../agents/qa-master/qa-master.md)
- [execute-test Skill](../execute-test/SKILL.md)

---
name: validate-test-cases
description: |
  테스트 케이스(AC) 검증. Use when:
  (1) 이슈의 AC 충분성 확인, (2) 테스트 가능 여부 판단,
  (3) AC 보완 필요 시 요청 연계.
tools: [Bash, GitHub CLI, Read]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: validate-test-cases 호출 - {repo}#{number}` 시스템 메시지를 첫 줄에 출력하세요.

# Validate Test Cases Skill

> 이슈의 Acceptance Criteria(AC) 검증

## 트리거

- 테스트 시작 전 자동 호출 (qa-master)
- "AC 확인", "테스트 케이스 확인" 키워드

## 검증 기준

### 최소 요구사항

- **AC 개수**: 최소 3개
- **형식**: 체크리스트 형태
- **명확성**: 검증 가능한 조건

### AC 품질 기준

| 등급 | 조건 | 테스트 가능 |
|------|------|------------|
| ✅ 우수 | 5개 이상, 정상/예외/엣지 케이스 포함 | 바로 진행 |
| 🟡 보통 | 3-4개, 정상 케이스 위주 | 진행 가능 |
| ❌ 부족 | 2개 이하 또는 불명확 | 보완 필요 |

## AC 조회

```bash
# 이슈 본문에서 AC 추출
gh issue view {number} --repo semicolon-devteam/{repo} --json body --jq '.body'
```

## 출력 형식

### AC 충분

```markdown
[SAX] Skill: validate-test-cases 호출 - {repo}#{number}

## ✅ AC 검증 결과: 테스트 가능

**이슈**: {repo}#{number} - {title}
**AC 개수**: 5개

### Acceptance Criteria

- [ ] 사용자가 댓글을 작성할 수 있다
- [ ] 댓글 작성 후 목록에 즉시 반영된다
- [ ] 빈 댓글은 작성할 수 없다 (에러 메시지 표시)
- [ ] 1000자 이상 댓글은 작성할 수 없다
- [ ] 본인 댓글만 삭제할 수 있다

테스트를 진행해도 좋습니다.
```

### AC 부족

```markdown
[SAX] Skill: validate-test-cases 호출 - {repo}#{number}

## ❌ AC 검증 결과: 보완 필요

**이슈**: {repo}#{number} - {title}
**AC 개수**: 1개 (최소 3개 필요)

### 현재 AC

- [ ] 댓글 기능 구현

### 부족한 항목

- ⚠️ 예외 처리 시나리오 없음
- ⚠️ Edge case 시나리오 없음
- ⚠️ 검증 조건이 명확하지 않음

### 권장 조치

PO/개발자에게 AC 보완을 요청합니다.

`skill:request-test-cases`를 호출할까요? (Y/n)
```

## AC 패턴 분석

### 정상 케이스 탐지

```regex
(할 수 있다|가능하다|표시된다|보인다|동작한다)
```

### 예외 케이스 탐지

```regex
(없으면|실패하면|오류|에러|불가|금지)
```

### Edge 케이스 탐지

```regex
(최대|최소|빈|공백|특수문자|길이)
```

## References

- [AC Standards](references/ac-standards.md)
- [Quality Criteria](references/quality-criteria.md)

## Related

- [qa-master Agent](../../agents/qa-master/qa-master.md)
- [request-test-cases Skill](../request-test-cases/SKILL.md)

---
name: feedback
description: |
  피드백 수집 및 관리. Use when:
  (1) 피드백 이슈 생성, (2) 피드백 조회, (3) 개선사항 확인.
tools: [Bash, mcp__github__*]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: feedback 호출` 시스템 메시지를 첫 줄에 출력하세요.

# feedback Skill

> 피드백 수집 및 관리

## Actions

| Action | 설명 | 트리거 |
|--------|------|--------|
| **create** | 피드백 이슈 생성 | "피드백 등록", "개선사항" |
| **list** | 피드백 목록 조회 | "피드백 확인" |

---

## Action: create (피드백 생성)

### Workflow

```bash
# GitHub Issue 생성
gh issue create \
  --repo semicolon-devteam/docs \
  --title "[Feedback] {제목}" \
  --label "feedback" \
  --body "$(cat <<'EOF'
## 현재 상황
{무엇이 불편한가?}

## 제안
{어떻게 개선하면 좋을까?}

## 기대 효과
{왜 중요한가?}
EOF
)"
```

### 출력

```markdown
[SEMO] Skill: feedback 완료 (create)

✅ 피드백 이슈 생성 완료

**제목**: SEMO 스킬 로딩 속도 개선
**Issue**: #789
```

---

## Action: list (피드백 조회)

### Workflow

```bash
# 피드백 이슈 목록
gh issue list \
  --repo semicolon-devteam/docs \
  --label "feedback" \
  --state open
```

### 출력

```markdown
[SEMO] Skill: feedback 완료 (list)

✅ 피드백 목록 (3개)

1. #789 - SEMO 스킬 로딩 속도 개선
2. #790 - Git 워크플로우 자동화
3. #791 - 테스트 커버리지 리포트
```

---

## Related

- `issue` - Issue 생성
- `board` - 보드 관리

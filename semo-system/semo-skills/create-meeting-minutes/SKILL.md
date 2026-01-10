---
name: create-meeting-minutes
description: |
  정기 회의록 GitHub Discussion 자동 생성.
  Use when (1) "정기 회의록 생성해줘", (2) /create-meeting-minutes 커맨드,
  (3) "이번 주 회의록 만들어줘", (4) 이터레이션 기반 회의록 생성 요청.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: create-meeting-minutes 호출` 시스템 메시지를 첫 줄에 출력하세요.

# create-meeting-minutes Skill

> 정기 회의록 GitHub Discussion 자동 생성 (이터레이션 기반 제목)

## Purpose

매주 정기 회의록을 **command-center 레포의 GitHub Discussions (Meeting-Minutes 카테고리)**에 생성합니다. 제목은 `{year}-{month}-{분자}/{분모}` 형식으로 자동 생성됩니다.

## NON-NEGOTIABLE RULES

### 출력 위치

| 항목 | 값 |
|------|-----|
| 저장소 | `semicolon-devteam/command-center` |
| 카테고리 | Meeting-Minutes |
| Repository ID | `R_kgDOOdzh9A` |
| Category ID | `DIC_kwDOOdzh984Cw9Lp` |

**로컬 파일 생성 금지** - 반드시 GitHub Discussions에 생성

### 제목 형식

```text
{year}-{month}-{분자}/{분모}

예시:
- 2026-01-1/5  (1월 1주차, 1월은 5주)
- 2026-01-3/5  (1월 3주차)
- 2026-02-2/4  (2월 2주차, 2월은 4주)
```

### 이터레이션 계산 규칙

```text
분모: 해당 월의 총 주 수 (4 또는 5)
      - 월의 첫 번째 날이 속한 주 ~ 마지막 날이 속한 주 카운트
      - ISO Week 기준 (월요일 시작)

분자: 현재 날짜가 해당 월의 몇 번째 주인지
      - 1일~7일 범위가 아닌, 실제 주차 계산
```

## Execution Flow

```text
1. 현재 날짜 확인 (또는 입력된 날짜 사용)
   ↓
2. 이터레이션 계산
   - 해당 월의 총 주 수 (분모)
   - 현재 주차 (분자)
   ↓
3. 제목 생성: {year}-{month}-{분자}/{분모}
   ↓
4. 회의록 템플릿 생성
   ↓
5. GitHub Discussion 생성 (Meeting-Minutes)
   ↓
6. 생성된 Discussion URL 반환
```

## 이터레이션 계산 로직

### Bash 스크립트

```bash
#!/bin/bash
# 이터레이션 계산

# 현재 날짜 (또는 입력된 날짜)
TARGET_DATE="${1:-$(date +%Y-%m-%d)}"
YEAR=$(date -d "$TARGET_DATE" +%Y 2>/dev/null || date -j -f "%Y-%m-%d" "$TARGET_DATE" +%Y)
MONTH=$(date -d "$TARGET_DATE" +%m 2>/dev/null || date -j -f "%Y-%m-%d" "$TARGET_DATE" +%m)

# macOS 호환
if [[ "$OSTYPE" == "darwin"* ]]; then
  # 월의 첫째 날과 마지막 날
  FIRST_DAY="${YEAR}-${MONTH}-01"
  LAST_DAY=$(date -j -v+1m -v-1d -f "%Y-%m-%d" "$FIRST_DAY" +%Y-%m-%d)

  # ISO Week 번호
  FIRST_WEEK=$(date -j -f "%Y-%m-%d" "$FIRST_DAY" +%V)
  LAST_WEEK=$(date -j -f "%Y-%m-%d" "$LAST_DAY" +%V)
  CURRENT_WEEK=$(date -j -f "%Y-%m-%d" "$TARGET_DATE" +%V)

  # 연말 처리 (12월 마지막 주가 1이 되는 경우)
  if [ "$LAST_WEEK" -lt "$FIRST_WEEK" ]; then
    LAST_WEEK=$((LAST_WEEK + 52))
  fi
  if [ "$CURRENT_WEEK" -lt "$FIRST_WEEK" ]; then
    CURRENT_WEEK=$((CURRENT_WEEK + 52))
  fi
else
  # Linux
  FIRST_DAY="${YEAR}-${MONTH}-01"
  LAST_DAY=$(date -d "${YEAR}-${MONTH}-01 +1 month -1 day" +%Y-%m-%d)

  FIRST_WEEK=$(date -d "$FIRST_DAY" +%V)
  LAST_WEEK=$(date -d "$LAST_DAY" +%V)
  CURRENT_WEEK=$(date -d "$TARGET_DATE" +%V)

  if [ "$LAST_WEEK" -lt "$FIRST_WEEK" ]; then
    LAST_WEEK=$((LAST_WEEK + 52))
  fi
  if [ "$CURRENT_WEEK" -lt "$FIRST_WEEK" ]; then
    CURRENT_WEEK=$((CURRENT_WEEK + 52))
  fi
fi

# 분모: 해당 월의 총 주 수
TOTAL_WEEKS=$((LAST_WEEK - FIRST_WEEK + 1))

# 분자: 현재 주차 (해당 월 내에서)
CURRENT_ITERATION=$((CURRENT_WEEK - FIRST_WEEK + 1))

# 월에서 앞자리 0 제거
MONTH_NO_ZERO=$(echo "$MONTH" | sed 's/^0//')

echo "${YEAR}-${MONTH_NO_ZERO}-${CURRENT_ITERATION}/${TOTAL_WEEKS}"
```

## GitHub Discussion 생성

### GraphQL Mutation

```bash
# 제목 생성
TITLE="2026-01-1/5"

# 본문 생성
BODY=$(cat <<'EOF'
# 정기 회의록

> **일시**: 2026-01-XX (X)
> **참석자**: @team

---

## 회의 안건

- [ ] 안건 1
- [ ] 안건 2
- [ ] 안건 3

---

## 논의 내용

### 1. 안건 1

**논의**:
-

**결론**:
-

---

## Action Items

| 담당자 | 할 일 | 기한 |
|--------|-------|------|
| @담당자 | 할 일 내용 | 기한 |

---

## 추가 메모

EOF
)

# Discussion 생성
gh api graphql -f query='
mutation($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
  createDiscussion(input: {
    repositoryId: $repoId
    categoryId: $categoryId
    title: $title
    body: $body
  }) {
    discussion {
      number
      url
    }
  }
}' \
  -f repoId="R_kgDOOdzh9A" \
  -f categoryId="DIC_kwDOOdzh984Cw9Lp" \
  -f title="$TITLE" \
  -f body="$BODY"
```

## 사용 예시

### 기본 사용 (현재 날짜 기준)

```bash
/create-meeting-minutes

# 출력:
[SEMO] Skill: create-meeting-minutes 호출

이터레이션 계산 중...
- 현재 날짜: 2026-01-11
- 해당 월 총 주 수: 5
- 현재 주차: 2

제목: 2026-01-2/5

✅ Discussion 생성 완료
https://github.com/semicolon-devteam/command-center/discussions/123
```

### 특정 날짜 지정

```bash
/create-meeting-minutes 2026-02-15

# 출력:
[SEMO] Skill: create-meeting-minutes 호출

이터레이션 계산 중...
- 지정 날짜: 2026-02-15
- 해당 월 총 주 수: 4
- 현재 주차: 3

제목: 2026-02-3/4

✅ Discussion 생성 완료
https://github.com/semicolon-devteam/command-center/discussions/124
```

## Output

```markdown
[SEMO] Skill: create-meeting-minutes 완료

✅ 정기 회의록 생성 완료

**제목**: {year}-{month}-{분자}/{분모}
**GitHub Discussion**: https://github.com/semicolon-devteam/command-center/discussions/{N}

회의록을 열어서 안건과 내용을 채워주세요.
```

## 에러 처리

| 에러 | 원인 | 해결 |
|------|------|------|
| `FORBIDDEN` | GitHub 권한 없음 | `gh auth refresh -s discussion:write` |
| `NOT_FOUND` | Repository/Category ID 오류 | ID 재확인 |
| 잘못된 날짜 | 날짜 형식 오류 | `YYYY-MM-DD` 형식 사용 |

## Related

- `summarize-meeting` - 녹취록 기반 회의록 생성
- `notify-slack` - Slack 알림 전송

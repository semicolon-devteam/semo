---
name: create-meeting-minutes
description: |
  정기 회의록 Supabase discussions 테이블에 자동 생성.
  Use when (1) "정기 회의록 생성해줘", (2) /create-meeting-minutes 커맨드,
  (3) "이번 주 회의록 만들어줘", (4) 이터레이션 기반 회의록 생성 요청.
tools: [Supabase, Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: create-meeting-minutes 호출` 시스템 메시지를 첫 줄에 출력하세요.

# create-meeting-minutes Skill

> 정기 회의록 Supabase discussions 테이블에 자동 생성 (이터레이션 기반 제목)

## 🔴 데이터 소스 변경 (v2.0.0)

| 버전 | 데이터 소스 | 방식 |
|------|------------|------|
| v1.x | GitHub Discussions | GraphQL API |
| **v2.0** | **Supabase** | `discussions` 테이블 INSERT |

---

## Purpose

매주 정기 회의록을 **Supabase discussions 테이블 (category: 'meeting-minutes')**에 생성합니다. 제목은 `{year}-{month}-{분자}/{분모}` 형식으로 자동 생성됩니다.

## NON-NEGOTIABLE RULES

### 출력 위치

| 항목 | 값 |
|------|-----|
| 테이블 | `discussions` |
| category | `meeting-minutes` |

**로컬 파일 생성 금지** - 반드시 Supabase에 저장

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
분자: 현재 날짜가 해당 월의 몇 번째 주인지
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
5. Supabase discussions 테이블에 INSERT
   ↓
6. 생성된 Discussion ID 반환
```

## Supabase 저장

### SQL 사용

```sql
-- 이터레이션 제목으로 회의록 생성
INSERT INTO discussions (office_id, category, title, body, created_by)
VALUES (
  '{office_uuid}',
  'meeting-minutes',
  '2026-01-2/5',
  E'# 정기 회의록\n\n> **일시**: 2026-01-XX (X)\n> **참석자**: @team\n\n---\n\n## 회의 안건\n\n- [ ] 안건 1\n- [ ] 안건 2\n- [ ] 안건 3\n\n---\n\n## 논의 내용\n\n### 1. 안건 1\n\n**논의**:\n-\n\n**결론**:\n-\n\n---\n\n## Action Items\n\n| 담당자 | 할 일 | 기한 |\n|--------|-------|------|\n| @담당자 | 할 일 내용 | 기한 |\n\n---\n\n## 추가 메모',
  '{creator_uuid}'
)
RETURNING id, title;
```

### Supabase 클라이언트

```typescript
// 이터레이션 계산
const { numerator, denominator } = calculateIteration(targetDate);
const title = `${year}-${month}-${numerator}/${denominator}`;

// 회의록 생성
const { data, error } = await supabase
  .from('discussions')
  .insert({
    office_id: officeId,
    category: 'meeting-minutes',
    title: title,
    body: meetingTemplate,
    created_by: creatorId
  })
  .select('id, title')
  .single();
```

## 이터레이션 계산 로직

### Bash 스크립트

```bash
#!/bin/bash
# 이터레이션 계산

TARGET_DATE="${1:-$(date +%Y-%m-%d)}"
YEAR=$(date -d "$TARGET_DATE" +%Y 2>/dev/null || date -j -f "%Y-%m-%d" "$TARGET_DATE" +%Y)
MONTH=$(date -d "$TARGET_DATE" +%m 2>/dev/null || date -j -f "%Y-%m-%d" "$TARGET_DATE" +%m)

# ISO Week 계산 (생략 - 기존 로직과 동일)
# ...

# 결과
MONTH_NO_ZERO=$(echo "$MONTH" | sed 's/^0//')
echo "${YEAR}-${MONTH_NO_ZERO}-${CURRENT_ITERATION}/${TOTAL_WEEKS}"
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

✅ Discussion 생성 완료 (Supabase)
ID: {discussion_uuid}
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

✅ Discussion 생성 완료 (Supabase)
ID: {discussion_uuid}
```

## Output

```markdown
[SEMO] Skill: create-meeting-minutes 완료

✅ 정기 회의록 생성 완료

**제목**: {year}-{month}-{분자}/{분모}
**Supabase ID**: {discussion_uuid}

회의록을 열어서 안건과 내용을 채워주세요.
```

## 에러 처리

| 에러 | 원인 | 해결 |
|------|------|------|
| Supabase 연결 오류 | MCP 서버 설정 오류 | 설정 확인 |
| 권한 오류 | RLS 정책 문제 | 권한 확인 |
| 잘못된 날짜 | 날짜 형식 오류 | `YYYY-MM-DD` 형식 사용 |

## GitHub Discussion Fallback

Supabase 연결이 불가능한 경우:

```bash
# Fallback: GitHub Discussion API
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

## References

- [discussions 테이블 마이그레이션](../../../semo-repository/supabase/migrations/20260113003_issues_discussions.sql)

## Related

- `summarize-meeting` - 녹취록 기반 회의록 생성
- `create-decision-log` - 의사결정 로그 생성
- `notify-slack` - Slack 알림 전송

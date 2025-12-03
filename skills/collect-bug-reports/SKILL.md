---
name: collect-bug-reports
description: |
  레포지토리의 버그 이슈 취합 및 정리. Use when (1) 버그 리포트 취합 요청,
  (2) 버그 현황 파악, (3) 스프린트 버그 리뷰.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: collect-bug-reports 호출` 시스템 메시지를 첫 줄에 출력하세요.

# collect-bug-reports Skill

> 레포지토리의 버그 이슈를 취합하여 정리된 리포트 생성

## Purpose

지정된 레포지토리(또는 전체 레포)의 열린 버그 이슈를 취합하여 심각도별, 상태별로 정리합니다.

## When to Use

| 트리거 | 설명 |
|--------|------|
| `버그 리포트 취합`, `버그 취합` | 버그 이슈 목록 조회 |
| `버그 현황`, `버그 목록` | 현재 열린 버그 확인 |
| `{repo} 버그 정리해줘` | 특정 레포 버그 취합 |

## Quick Start

```bash
# 기본: 열린 버그 이슈 전체 조회
gh issue list --repo semicolon-devteam/{repo} --label bug --state open --json number,title,labels,assignees,createdAt

# 특정 기간: 최근 3개월
gh issue list --repo semicolon-devteam/{repo} --label bug --state open --search "created:>=$(date -d '3 months ago' +%Y-%m-%d)"
```

## Workflow

### Step 1: 옵션 확인

사용자가 레포지토리나 기간을 명시하지 않은 경우 확인:

```markdown
[SAX] Skill: collect-bug-reports 호출

## 🐛 버그 리포트 취합

다음 정보를 확인할게요:

1. **레포지토리**: 어떤 레포의 버그를 취합할까요?
   - `all` - semicolon-devteam 전체
   - 특정 레포명 (예: app-client, app-server)

2. **기간**:
   - `전체` - 열린 이슈 전체 (기본값)
   - `이번 달` - 이번 달 생성된 이슈
   - `최근 3개월` - 최근 3개월 이슈
   - 직접 입력 (예: 2024-01-01 이후)

기본값으로 진행하려면 "전체 열린 버그"라고 답해주세요.
```

### Step 2: 버그 이슈 조회

```bash
# 기본 쿼리 (열린 이슈 전체)
gh issue list \
  --repo semicolon-devteam/{repo} \
  --label bug \
  --state open \
  --json number,title,labels,assignees,createdAt,url \
  --limit 100

# 기간 필터 적용 시
gh issue list \
  --repo semicolon-devteam/{repo} \
  --label bug \
  --state open \
  --search "created:>={start_date}" \
  --json number,title,labels,assignees,createdAt,url \
  --limit 100
```

### Step 3: 결과 정리

```markdown
## 🐛 버그 리포트 취합 결과

**레포지토리**: {repo}
**기간**: {period}
**조회 시점**: {datetime}

### 요약

| 심각도 | 건수 |
|--------|------|
| Critical | {n} |
| High | {n} |
| Medium | {n} |
| Low | {n} |
| 미분류 | {n} |
| **합계** | **{total}** |

### 상세 목록

#### Critical ({n}건)

| # | 제목 | 담당자 | 생성일 |
|---|------|--------|--------|
| #{number} | {title} | @{assignee} | {date} |

#### High ({n}건)
...

#### Medium ({n}건)
...

#### Low ({n}건)
...

#### 미분류 ({n}건)
...
```

### Step 4: 완료 메시지

```markdown
[SAX] Bug Collection: 완료

✅ 버그 리포트 취합이 완료되었습니다.

**레포**: {repo}
**기간**: {period}
**총 {total}건** (Critical: {n}, High: {n}, Medium: {n}, Low: {n})

추가 작업:
- 특정 버그 상세 확인: "#{number} 버그 상세"
- 담당자 할당: "#{number} @{assignee}에게 할당"
```

## Default Behavior

> **기본값은 "열린 이슈 전체"입니다.**

사용자가 기간을 명시하지 않으면:
- ❌ 이번 달로 제한하지 않음
- ✅ 모든 열린 버그 이슈 조회

## Period Options

| 옵션 | 설명 | 쿼리 |
|------|------|------|
| `전체` (기본) | 열린 이슈 전체 | `--state open` |
| `이번 달` | 이번 달 생성 | `--search "created:>=$(date +%Y-%m-01)"` |
| `최근 3개월` | 3개월 내 생성 | `--search "created:>=$(date -d '3 months ago' +%Y-%m-%d)"` |
| 직접 입력 | 특정 날짜 이후 | `--search "created:>={date}"` |

## SAX Message Format

```markdown
[SAX] Skill: collect-bug-reports 호출

[SAX] Bug Collection: {repo} 버그 {n}건 취합 완료
```

## Related

- [report-bug Skill](../report-bug/SKILL.md) - 버그 이슈 생성
- [check-progress Skill](../check-progress/SKILL.md) - 진행도 확인

## References

- [Query Options](references/query-options.md) - 조회 옵션 상세

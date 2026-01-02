---
name: summarize-meeting
description: |
  회의 녹취록을 분석하여 GitHub Discussion에 회의록/의사결정 로그 생성.
  Use when (1) 회의 녹취록 요약 요청, (2) /summarize-meeting 커맨드,
  (3) 의사결정 사항 정리 요청, (4) Action Items 추출 요청.
tools: [Bash, Read, Write, GitHub CLI]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: summarize-meeting 호출 - {회의명}` 시스템 메시지를 첫 줄에 출력하세요.

# summarize-meeting Skill

> 회의 녹취록 → GitHub Discussion (회의록/의사결정 로그) 자동 생성

## Purpose

회의 녹취록 텍스트를 분석하여 구조화된 회의록과 의사결정 로그를 **command-center 레포의 GitHub Discussions**에 생성합니다.

## 🔴 출력 위치 (NON-NEGOTIABLE)

| 유형 | 저장소 | 카테고리 |
|------|--------|----------|
| 회의록 | `semicolon-devteam/command-center` | Meeting-Minutes |
| 의사결정 로그 | `semicolon-devteam/command-center` | Decision-Log |

**로컬 파일 생성 금지** - 반드시 GitHub Discussions에 생성

## Execution Flow

```text
1. 녹취록 파일 읽기 또는 텍스트 입력 받기
   ↓
2. 회의 내용 분석
   - 참석자 식별
   - 안건별 논의 내용 정리
   - 의사결정 사항 추출 (DEC-XXX)
   - Action Items 추출
   ↓
3. GitHub Discussion 생성
   - Meeting-Minutes 카테고리: 회의록
   - Decision-Log 카테고리: 주요 의사결정 (있는 경우)
   ↓
4. Slack 알림 전송 (#개발사업팀)
```

## GitHub Discussion 생성

### 카테고리 ID

| 카테고리 | ID | 용도 |
|----------|-----|------|
| Meeting-Minutes | `DIC_kwDOOdzh984Cw9Lp` | 회의록 |
| Decision-Log | `DIC_kwDOOdzh984Cw9Lq` | 의사결정 로그 |

### 회의록 생성

```bash
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
  -f title="[회의록] {날짜} - {회의명}" \
  -f body="$MEETING_BODY"
```

### 의사결정 로그 생성

```bash
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
  -f categoryId="DIC_kwDOOdzh984Cw9Lq" \
  -f title="[{날짜}] {의사결정 제목}" \
  -f body="$DECISION_BODY"
```

## 템플릿

### 회의록 템플릿

```markdown
# {회의명} 회의록

> **일시**: {날짜} {시간}
> **참석자**: {참석자 목록}
> **장소/방식**: {장소 또는 온라인}

---

## 📋 안건

### 1. {안건1 제목}

**논의 내용**:
- {논의 사항 1}
- {논의 사항 2}

**결론**: {결론 또는 다음 단계}

### 2. {안건2 제목}
...

---

## ✅ Action Items

| 담당자 | 할 일 | 기한 |
|--------|-------|------|
| @{담당자1} | {할 일 내용} | {기한} |

---

## 🔗 관련 의사결정

- [{DEC-XXX}](discussion_url) - {의사결정 제목}
```

### 의사결정 로그 템플릿

```markdown
# {의사결정 제목}

> **결정일**: {날짜}
> **결정자**: {결정 참여자}
> **ID**: DEC-{번호}

---

## 📋 배경

{의사결정이 필요했던 배경 설명}

## 🎯 결정 사항

{최종 결정 내용}

## 📊 검토된 대안

| 대안 | 장점 | 단점 | 선택 |
|------|------|------|------|
| {대안1} | {장점} | {단점} | ❌ |
| {대안2} | {장점} | {단점} | ✅ |

## 📎 관련 문서

- 관련 회의록: [링크]
- 관련 이슈: #번호
```

## Slack 알림

### 대상 채널

| 채널 | 용도 |
|------|------|
| #개발사업팀 | 회의록/의사결정 알림 |

### 알림 형식

```markdown
📝 회의록 생성 완료

**회의**: {회의명}
**일시**: {날짜}

**생성된 문서**:
- 회의록: {discussion_url}
- 의사결정: {decision_url} (있는 경우)

**Action Items**: {N}개
```

## 사용 예시

```bash
# 파일 경로 지정
/summarize-meeting docs/meetings/녹취록_251228.txt

# 직접 텍스트 입력
/summarize-meeting
> 회의 내용을 여기에 붙여넣으세요...
```

## Output

```markdown
[SEMO] Skill: summarize-meeting 완료

✅ 회의록 생성 완료

**회의**: {회의명}
**GitHub Discussion**:
- 회의록: https://github.com/semicolon-devteam/command-center/discussions/{N}
- 의사결정: https://github.com/semicolon-devteam/command-center/discussions/{M}

**Slack 알림**: #개발사업팀 전송 완료
```

## References

- [Meeting Template](references/meeting-template.md)
- [Decision Template](references/decision-template.md)
- [GitHub Discussions API](references/discussions-api.md)

## Related

- `notify-slack` - Slack 알림 전송
- `persist-context` - 컨텍스트 저장 (decisions.md 연동 시)

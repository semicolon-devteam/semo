---
name: summarize-meeting
description: |
  정기 회고/회의 내용 정리. STT 스크립트와 회의록 링크를 받아 주요 결정사항 정리.
  Use when (1) "회의 내용 정리해줘", (2) STT 스크립트 + 회의록 URL 제공,
  (3) 정기 회고 결정사항 문서화.
tools: [Bash, Read, WebFetch, AskUserQuestion]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: summarize-meeting 호출` 메시지를 첫 줄에 출력하세요.

# summarize-meeting Skill

> 회의 STT 스크립트를 분석하여 회의록 "논의 내용 및 결정사항" 섹션 작성

## Purpose

정기 회고(회의)의 STT 풀 스크립트를 분석하여:
1. 주요 논의 내용 요약
2. 결정사항 추출 및 정리
3. 회의록 Discussion의 "논의 내용 및 결정사항" 섹션 업데이트
4. (선택) 의사결정 로그 별도 생성 제안

## Input

### 필수 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `stt_script` | string | Clova Note 등에서 추출한 STT 풀 스크립트 |
| `meeting_url` | string | 회의록 Discussion URL |

### 선택 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `agenda` | string[] | 회의 안건 목록 (없으면 STT에서 추론) |

## Workflow

```text
STT 스크립트 + 회의록 URL 수신
    ↓
1. 회의록 Discussion 조회 (기존 내용 확인)
    ↓
2. STT 스크립트 분석
   - 안건별 논의 내용 추출
   - 결정사항 식별 ("~하기로 했다", "~로 결정", "~합시다" 등)
   - 액션 아이템 추출
    ↓
3. "논의 내용 및 결정사항" 섹션 작성
    ↓
4. 회의록 Discussion 업데이트 (댓글 또는 본문 수정)
    ↓
5. 의사결정 로그 생성 제안
   ├─ 사용자 승인 → create-decision-log 스킬 호출
   └─ 거절 → 종료
    ↓
완료
```

## Execution

### Step 1: 회의록 조회

```bash
# Discussion 번호 추출 (URL에서)
DISCUSSION_NUM=$(echo "{meeting_url}" | grep -oE '[0-9]+$')

# Discussion 내용 조회
gh api graphql -f query='
  query {
    repository(owner: "semicolon-devteam", name: "command-center") {
      discussion(number: '$DISCUSSION_NUM') {
        id
        title
        body
        category { name }
      }
    }
  }
'
```

### Step 2: STT 분석 가이드

STT 스크립트에서 다음 패턴을 찾아 결정사항 추출:

| 패턴 | 예시 |
|------|------|
| 결정 표현 | "~하기로 했습니다", "~로 결정했어요", "~합시다" |
| 합의 표현 | "다들 동의하시죠?", "이걸로 가죠", "OK" |
| 일정 확정 | "~까지 완료", "~일에 배포" |
| 담당자 지정 | "~님이 해주세요", "~가 담당" |

### Step 3: 논의 내용 작성 형식

```markdown
### {안건 1 제목}
- {논의 요약 1}
- {논의 요약 2}
- **결정**: {결정사항}

### {안건 2 제목}
- {논의 요약}
- **결정**: {결정사항}
- **액션 아이템**: @담당자 - {할 일} (기한: MM/DD)
```

### Step 4: 의사결정 로그 생성 질문

주요 결정사항이 있을 경우:

```
[SEMO] 의사결정 로그 생성 제안

다음 결정사항을 별도 의사결정 로그로 기록할까요?

1. {결정사항 1 요약}
2. {결정사항 2 요약}

> Decision-Log로 기록하면 나중에 "왜 이렇게 결정했지?" 할 때 찾기 쉬워요.
```

사용자가 승인하면 → `create-decision-log` 스킬 호출

## Output

### 성공

```markdown
[SEMO] Skill: summarize-meeting 완료

✅ 회의록 정리 완료

**회의**: [12/22] 정기 회고 & 회의
**Discussion**: https://github.com/semicolon-devteam/command-center/discussions/XXX

### 정리된 결정사항

| # | 결정 내용 | 담당 | 기한 |
|---|----------|------|------|
| 1 | API v2 마이그레이션 진행 | @kyago | 12/30 |
| 2 | 모니터링 대시보드 구축 | @garden92 | 01/05 |

**의사결정 로그**: 2건 생성됨
- [API 버전 관리 전략](https://github.com/.../discussions/YYY)
- [모니터링 도구 선정](https://github.com/.../discussions/ZZZ)
```

## Quick Start

### 기본 사용

```yaml
stt_script: |
  [화자1] 오늘 안건은 API 버전 관리에 대한 거예요.
  [화자2] 현재 v1이 레거시라 v2로 마이그레이션 필요해요.
  [화자1] 그럼 12월 말까지 v2 완료하고, v1은 1월에 deprecate 하죠.
  [화자3] 동의합니다. kyago님이 리드해주세요.
  [화자1] 네, 그렇게 하겠습니다.
  ...

meeting_url: "https://github.com/semicolon-devteam/command-center/discussions/123"
```

## Related

- [create-decision-log](../create-decision-log/SKILL.md) - 의사결정 로그 생성 (이 스킬에서 호출)
- [notify-slack](../../../../semo-skills/notify-slack/SKILL.md) - Slack 알림

# biz/discovery Quickstart

> PO/기획자를 위한 빠른 시작 가이드

## 대상

- PO (Product Owner)
- 기획자
- 아이템 발굴 담당자

## 주요 스킬

| 스킬 | 설명 | 트리거 예시 |
| ---- | ---- | ----------- |
| `create-epic` | Epic 생성 | "댓글 기능 Epic 만들어줘" |
| `generate-ac` | AC 자동 생성 | "AC 작성해줘" |
| `estimate-epic-timeline` | 타임라인 추정 | "일정 추정해줘" |
| `check-backend-duplication` | 중복 확인 | "API 중복 확인해줘" |

## 빠른 시작 예시

```text
"댓글 기능 Epic 만들어줘"     → skill:create-epic
"AC 작성해줘"                 → skill:generate-ac
"일정 추정해줘"               → skill:estimate-epic-timeline
"백엔드 API 중복 확인해줘"    → skill:check-backend-duplication
```

## PO 워크플로우

```text
1. Epic 생성
   → "댓글 기능 Epic 만들어줘"
   → docs 레포에 Epic 이슈 생성

2. AC 작성
   → "AC 작성해줘"
   → 수락 기준 자동 생성

3. 개발팀 전달
   → 개발자가 Spec 보완
   → Task 생성

4. 진행도 추적
   → GitHub Projects에서 확인
```

## Epic 템플릿

```markdown
# [Epic] {기능명}

## 요약
{한 줄 설명}

## 목적
- 왜 필요한가?

## 범위
- 포함: ...
- 제외: ...

## 수락 기준
- [ ] ...
```

## 상세 튜토리얼

```text
"PO 온보딩 실습해줘" → skill:onboarding-po
```

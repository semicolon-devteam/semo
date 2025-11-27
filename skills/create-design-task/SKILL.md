---
name: create-design-task
description: Create Design Task Issue in service repository. Use when (1) Epic has "디자인 작업 필요" checked, (2) draft-task-creator detects design field in Epic, (3) need to create design task with Figma link, AC, estimation, and branch name.
tools: [Bash, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: create-design-task 호출 - {Epic 번호}` 시스템 메시지를 첫 줄에 출력하세요.

# create-design-task Skill

> 디자인 Task Issue 생성

## Purpose

Epic의 디자인 요구사항을 기반으로 디자인 Task Issue를 서비스 레포에 생성합니다.

## Triggers

- Epic에 "디자인 작업 필요" 체크되어 있을 때
- draft-task-creator가 Epic 디자인 필드 확인 후 호출

## Process

1. Epic 디자인 필드 파싱
2. 서비스 레포에 디자인 Task Issue 생성
3. Sub-issue로 Epic 연결
4. 디자인 관련 라벨 부여 (`design`)

## Draft Design Task 구조

```markdown
# [Design] {epic_title}

## 디자인 범위

{Epic의 디자인 상세 내용}

## Figma

- 링크: {figma_url}

## ✅ Acceptance Criteria

- [ ] Figma 디자인 완성
- [ ] PO/개발자 검토 완료
- [ ] 디자인 시스템 컴포넌트 정의
- [ ] 개발 handoff 완료

## 📊 Estimation

- [x] 디자인 작업 (3-5점)

**Point**: 3점

## 🌿 Branch

`design/{epic-number}-{domain}`
```

## SAX Message

```markdown
[SAX] Skill: create-design-task 사용
```

## Related

- [draft-task-creator Agent](../../agents/draft-task-creator.md)
- [Epic Template](../../templates/epic-template.md)

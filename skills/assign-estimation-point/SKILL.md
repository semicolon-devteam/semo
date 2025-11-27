---
name: assign-estimation-point
description: Measure and assign estimation points based on Wiki Estimation Guide. Use when (1) draft-task-creator creates Draft Tasks, (2) need to calculate work effort for each task, (3) updating GitHub Projects '작업량' field with point values.
tools: [Bash, Read, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: assign-estimation-point 호출 - {Task 번호}` 시스템 메시지를 첫 줄에 출력하세요.

# assign-estimation-point Skill

> Estimation Guide 기반 Point 측정 및 할당

## Purpose

Wiki의 Estimation Guide를 기반으로 Epic 내용을 분석하여 작업 포인트를 측정합니다.

## Process

### 1. Estimation Guide 조회

```bash
gh api repos/semicolon-devteam/docs/contents/wiki/Estimation-Guide.md \
  --jq '.content' | base64 -d
```

### 2. Epic/Task 내용 분석

- User Stories 추출
- 기술 복잡도 파악
- 작업 범위 확인 (UI, API, 데이터베이스 등)

### 3. 체크리스트 생성

```markdown
## 📊 Estimation (작업량 측정)

- [x] organisms UI 컴포넌트 구현 (3점)
- [x] 기본적인 Form 작업 및 연동 (5점)
- [x] 데이터베이스 마이그레이션 작성 (2점)

**총합**: 10점
```

## SAX Message

```markdown
[SAX] Skill: assign-estimation-point 사용
[SAX] Reference: docs/wiki/Estimation-Guide 참조
```

## Related

- [draft-task-creator Agent](../../agents/draft-task-creator.md)
- [Estimation Guide Wiki](https://github.com/semicolon-devteam/docs/wiki/Estimation-Guide)

## References

For detailed documentation, see:

- [Estimation Guide](references/estimation-guide.md) - 카테고리별 포인트, 자동 매칭 로직
- [Output Format](references/output-format.md) - 체크리스트 형식, JSON output, Projects API

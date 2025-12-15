---
name: verify-implementation
description: GitHub 이슈 요구사항 구현 여부 검토. Use when (1) 이슈카드 구현 완료 확인, (2) "~구현됐어?" 질문, (3) 요구사항 매칭 체크, (4) PR 전 구현 완료 검증.
tools: [Bash, Read, Grep, Glob]
location: project
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: verify-implementation 호출 - {이슈 번호}` 시스템 메시지를 첫 줄에 출력하세요.

# Verify Implementation Skill

**Purpose**: GitHub 이슈(태스크 카드)의 요구사항이 실제로 구현되었는지 검증

## Quick Start

### When to Use

- 특정 이슈의 구현 완료 여부 확인
- "cm-land#123 구현됐어?" 같은 질문
- PR 전 요구사항 매칭 검증
- 누락된 기능 탐지

### What It Does

1. **이슈 파싱**: GitHub 이슈에서 요구사항 추출
2. **코드 검색**: 관련 코드 탐색 (Grep, Glob)
3. **매칭 분석**: 요구사항 ↔ 코드 매핑
4. **리포트 생성**: 체크리스트 형태로 결과 출력

## Usage

```bash
# 이슈 번호로 검증
"cm-land#123 구현됐어?"

# 이슈 URL로 검증
"https://github.com/semicolon-devteam/cm-land/issues/123 구현 확인해줘"

# 현재 브랜치 이슈 자동 감지
"이 이슈 구현 완료됐어?"
```

## 트리거 패턴

| 패턴 | 예시 |
|------|------|
| `{repo}#{number} 구현됐어?` | `cm-land#123 구현됐어?` |
| `{repo}#{number} 구현 확인` | `cm-office#45 구현 확인해줘` |
| `이슈 URL + 구현` | `https://github.com/.../issues/123 구현됐어?` |
| `이 이슈 구현 완료?` | 현재 브랜치에서 이슈 자동 감지 |

## Output Format

```markdown
[SEMO] Skill: verify-implementation 호출 - {repo}#{issue_number}

=== 구현 검토: {repo}#{issue_number} ===

## 요구사항 분석

| # | 요구사항 | 상태 | 관련 코드 |
|---|----------|------|----------|
| 1 | {requirement_1} | ✅ 구현됨 | `src/path/file.ts:45` |
| 2 | {requirement_2} | ❌ 미구현 | - |

## 결론

**구현율**: 1/2 (50%)
```

## Related Skills

- `verify` - 종합 품질 검증
- `spec` - 명세 작성 (SDD)
- `task-progress` - 진행도 확인

## References

- [Requirement Extraction](references/requirement-extraction.md) - 요구사항 추출 패턴
- [Code Matching](references/code-matching.md) - 코드 매칭 전략
- [Workflow Detail](references/workflow-detail.md) - 상세 워크플로우
- [Error Handling](references/error-handling.md) - 에러 처리 패턴

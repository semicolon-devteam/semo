# Workflow Detail

> verify-implementation Skill의 상세 워크플로우

## Phase 1: 이슈 파싱

```bash
# GitHub CLI로 이슈 정보 조회
gh issue view {issue_number} --repo {owner}/{repo}
```

## Phase 2: 요구사항 추출

이슈 본문에서 다음 패턴을 추출:

- `- [ ]` / `- [x]` 체크리스트 항목
- `## 요구사항`, `## Requirements` 섹션
- `### 기능`, `### Features` 섹션
- Acceptance Criteria 항목

> 상세 패턴: [requirement-extraction.md](requirement-extraction.md) 참조

## Phase 3: 코드 검색

각 요구사항에 대해:

```bash
# 키워드 기반 검색
grep -r "{keyword}" src/

# 파일 패턴 검색
find . -name "*{feature}*" -type f
```

> 상세 전략: [code-matching.md](code-matching.md) 참조

## Phase 4: 결과 출력

```markdown
[SEMO] Skill: verify-implementation 호출 - {repo}#{issue_number}

=== 구현 검토: {repo}#{issue_number} ===

## 이슈 정보

**제목**: {issue_title}
**URL**: {issue_url}

## 요구사항 분석

| # | 요구사항 | 상태 | 관련 코드 |
|---|----------|------|----------|
| 1 | {requirement_1} | ✅ 구현됨 | `src/path/file.ts:45` |
| 2 | {requirement_2} | ✅ 구현됨 | `src/path/file.ts:67` |
| 3 | {requirement_3} | ❌ 미구현 | - |

## 결론

**구현율**: 2/3 (67%)

### ✅ 구현 완료 (2건)
- {requirement_1}
- {requirement_2}

### ❌ 미구현 (1건)
- {requirement_3}

### 다음 단계

{미구현 항목이 있으면}
> 미구현 항목을 구현하려면: "{requirement_3} 구현해줘"

{모두 구현되었으면}
> 모든 요구사항이 구현되었습니다. PR을 생성하려면: "PR 만들어줘"
```

# feedback-collector Skill

> PR 피드백 수집 및 Self-Learning RAG 인덱스 업데이트

## Purpose

PR 리뷰 피드백을 자동으로 수집하고 패턴을 분석하여, 에이전트가 같은 실수를 반복하지 않도록 학습 데이터를 구축합니다.

## Triggers

| 트리거 | 설명 |
|--------|------|
| PR 머지 후 | 자동 실행 (GitHub Actions) |
| PR Changes Requested | 수정 요청 시 즉시 수집 |
| `/SEMO:collect-feedback` | 수동 실행 |

## Quick Start

```bash
# 1. 특정 PR 피드백 수집
/SEMO:collect-feedback --repo semo-next --pr 123

# 2. 최근 PR 일괄 수집 (최근 7일)
/SEMO:collect-feedback --repo semo-next --days 7

# 3. 전체 레포 스캔
/SEMO:collect-feedback --repo semo-next --all
```

## Workflow

```
1. PR 정보 조회 (gh API)
   ↓
2. 코멘트/리뷰 수집
   ↓
3. 패턴 분류 (LLM 분석)
   ↓
4. feedback-index.json 업데이트
   ↓
5. 빈도 임계값 체크 → 알림
```

### Step 1: PR 정보 조회

```bash
# PR 코멘트 조회
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments

# PR 리뷰 조회
gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews
```

### Step 2: 피드백 추출

수집 대상:
- `CHANGES_REQUESTED` 리뷰
- 인라인 코멘트 (코드 라인에 달린 코멘트)
- `REQUEST_CHANGES` 라벨이 붙은 리뷰

### Step 3: 패턴 분류

LLM을 사용하여 피드백을 다음 카테고리로 분류:

| 카테고리 | 패턴 ID | 설명 |
|----------|---------|------|
| 코드 품질 | `missing-error-handling` | 에러 처리 누락 |
| | `missing-type-annotation` | TypeScript 타입 누락 |
| | `missing-loading-state` | 로딩 상태 누락 |
| | `missing-empty-state` | 빈 상태 처리 누락 |
| 보안 | `security-vulnerability` | 보안 취약점 |
| | `hardcoded-secret` | 하드코딩된 시크릿 |
| 스타일 | `inconsistent-naming` | 네이밍 규칙 불일치 |
| | `magic-number` | 매직 넘버 사용 |
| 아키텍처 | `component-too-large` | 컴포넌트 크기 초과 |
| | `prop-drilling` | Prop drilling 문제 |

### Step 4: 인덱스 업데이트

```bash
# feedback-index.json 위치
.claude/rag/feedback-index.json
```

업데이트 내용:
- 패턴 빈도 증가
- 새 예시 추가
- 마지막 발생 시각 업데이트

### Step 5: 임계값 알림

빈도가 임계값을 초과하면 Slack 알림:

| 패턴 유형 | 임계값 | 알림 |
|-----------|--------|------|
| 보안 취약점 | 1회 | 즉시 |
| 에러 처리 누락 | 3회 | 경고 |
| 타입 누락 | 3회 | 정보 |
| 스타일 문제 | 5회 | 정보 |

## Input/Output

### Input

```yaml
inputs:
  repo: string        # 레포지토리 이름 (예: semo-next)
  pr_number: number   # PR 번호 (선택)
  days: number        # 최근 N일 (선택, 기본: 7)
  all: boolean        # 전체 스캔 (선택)
```

### Output

```yaml
outputs:
  collected: number       # 수집된 피드백 수
  new_patterns: number    # 새로 발견된 패턴 수
  updated_patterns: array # 빈도가 증가한 패턴 목록
  alerts: array           # 임계값 초과 알림
```

## SEMO Message Format

```markdown
[SEMO] Skill: feedback-collector 호출

## 수집 대상
- Repo: semo-next
- PR: #123 (또는 최근 7일)

---

[SEMO] Skill: feedback-collector 진행 중

## 진행 상황
- PR 조회: 5/5
- 코멘트 수집: 12건
- 패턴 분류 중...

---

[SEMO] Skill: feedback-collector 완료

## 수집 결과
- PR: #123, #124, #125
- 피드백: 12건
- 새 패턴: 1건 (`missing-empty-state`)

## 업데이트된 패턴
| 패턴 | 빈도 | 심각도 |
|------|------|--------|
| missing-error-handling | 12 → 13 | HIGH |
| missing-loading-state | 5 → 6 | MEDIUM |

## 알림
⚠️ `missing-error-handling` 패턴이 임계값(10회)을 초과했습니다.
```

## Error Handling

### GitHub API 오류

```markdown
⚠️ **피드백 수집 실패**

GitHub API 호출 중 오류가 발생했습니다.
- 오류: Rate limit exceeded
- 재시도: 5분 후 자동 재시도

**조치**: `gh auth status`로 인증 상태 확인
```

### 패턴 분류 실패

```markdown
⚠️ **패턴 분류 실패**

일부 피드백의 패턴 분류에 실패했습니다.
- 실패 건수: 2건
- 원인: LLM 응답 파싱 오류

**조치**: 수동으로 feedback-index.json 업데이트 필요
```

## Configuration

### feedback-index.json 위치

```yaml
# 프로젝트별 설정
semo-next:
  index_path: ".claude/rag/feedback-index.json"

semo-backend:
  index_path: ".claude/rag/feedback-index.json"
```

### 패턴 분류 프롬프트

```markdown
다음 PR 리뷰 코멘트를 분석하여 패턴을 분류해주세요.

## 코멘트
{{comment}}

## 코드 컨텍스트
{{code_snippet}}

## 분류 옵션
- missing-error-handling
- missing-type-annotation
- missing-loading-state
- missing-empty-state
- security-vulnerability
- inconsistent-naming
- component-too-large
- other

## 출력 형식
{
  "pattern_id": "...",
  "confidence": 0.0-1.0,
  "context": "...",
  "correction": "..."
}
```

## References

- [Self-Learning RAG 설계](../../rag/feedback-index.md)
- [LangFuse 관측성](../../observability/langfuse-config.md)
- [패턴 분류 상세](references/pattern-classification.md)

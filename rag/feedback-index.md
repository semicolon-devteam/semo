# Self-Learning RAG: 피드백 인덱스

> PR 피드백에서 학습하여 동적 Few-shot 프롬프팅 지원

---

## Overview

Self-Learning RAG는 PR 리뷰 피드백을 수집하고 분석하여, 에이전트가 같은 실수를 반복하지 않도록 학습합니다.

### 학습 사이클

```
PR 리뷰 피드백
      │
      ▼
┌─────────────────┐
│ Feedback        │
│ Collector       │
│ Skill           │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Pattern         │
│ Analyzer        │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ RAG Index       │
│ (Embeddings)    │
└─────────────────┘
      │
      ▼
Dynamic Few-shot
Prompting
```

---

## 피드백 수집 대상

### PR 피드백 유형

| 유형 | 설명 | 학습 가치 |
|------|------|----------|
| **거부된 PR** | 리뷰어가 거부한 PR | HIGH |
| **수정 요청** | "Changes requested" 상태 | HIGH |
| **반복 수정** | 같은 파일 3회 이상 수정 | MEDIUM |
| **리뷰 코멘트** | 인라인 코멘트 | MEDIUM |
| **승인 + 피드백** | 승인되었지만 개선점 언급 | LOW |

### 수집 필드

```json
{
  "id": "feedback-{uuid}",
  "source": {
    "repo": "semicolon-devteam/sax-next",
    "pr_number": 123,
    "file": "src/components/Button.tsx",
    "line": 42
  },
  "feedback": {
    "type": "change_request",
    "reviewer": "garden92",
    "comment": "에러 처리가 누락되었습니다. try-catch 추가 필요",
    "severity": "HIGH"
  },
  "pattern": {
    "category": "missing-error-handling",
    "context": "async 함수에서 try-catch 누락",
    "correction": "모든 async 함수에 에러 처리 추가"
  },
  "metadata": {
    "created_at": "2025-12-11T10:00:00Z",
    "frequency": 5,
    "last_triggered": "2025-12-10T15:30:00Z"
  }
}
```

---

## 패턴 분류

### 코드 품질 패턴

| 패턴 ID | 설명 | 빈도 임계값 |
|---------|------|------------|
| `missing-error-handling` | 에러 처리 누락 | 3회 |
| `missing-type-annotation` | TypeScript 타입 누락 | 3회 |
| `missing-loading-state` | 로딩 상태 누락 | 2회 |
| `missing-empty-state` | 빈 상태 처리 누락 | 2회 |
| `security-vulnerability` | 보안 취약점 | 1회 |

### 스타일 패턴

| 패턴 ID | 설명 | 빈도 임계값 |
|---------|------|------------|
| `inconsistent-naming` | 네이밍 규칙 불일치 | 3회 |
| `missing-jsdoc` | JSDoc 주석 누락 | 5회 |
| `magic-number` | 매직 넘버 사용 | 3회 |

### 아키텍처 패턴

| 패턴 ID | 설명 | 빈도 임계값 |
|---------|------|------------|
| `component-too-large` | 컴포넌트 크기 초과 | 2회 |
| `prop-drilling` | Prop drilling 문제 | 2회 |
| `missing-memoization` | 메모이제이션 누락 | 3회 |

---

## RAG 인덱스 구조

### 저장소 옵션

| 옵션 | 설명 | 권장 상황 |
|------|------|----------|
| **파일 기반** | `.claude/rag/feedback.json` | 소규모 팀 (<10명) |
| **pgvector** | PostgreSQL + vector extension | 대규모 팀 (10명+) |
| **Pinecone** | 클라우드 벡터 DB | 엔터프라이즈 |

### 파일 기반 구조

```
.claude/
└── rag/
    ├── feedback-index.json     # 피드백 메타데이터
    ├── patterns/
    │   ├── missing-error-handling.json
    │   ├── missing-type-annotation.json
    │   └── ...
    └── embeddings/
        └── feedback-embeddings.json  # 벡터 임베딩 (선택)
```

### feedback-index.json 스키마

```json
{
  "version": "1.0.0",
  "updated_at": "2025-12-11T10:00:00Z",
  "patterns": [
    {
      "id": "missing-error-handling",
      "frequency": 12,
      "severity": "HIGH",
      "examples": [
        {
          "context": "fetch API 호출에서 catch 누락",
          "bad": "fetch('/api/users').then(res => setUsers(res));",
          "good": "fetch('/api/users').then(res => setUsers(res)).catch(err => setError(err));"
        }
      ],
      "prompt_injection": "모든 비동기 작업에는 반드시 에러 처리를 포함하세요."
    }
  ],
  "stats": {
    "total_feedbacks": 47,
    "patterns_identified": 8,
    "avg_correction_rate": 0.85
  }
}
```

---

## 동적 Few-shot 프롬프팅

### 작동 방식

1. **요청 분석**: 사용자 요청의 컨텍스트 파악
2. **패턴 매칭**: 관련 피드백 패턴 검색
3. **Few-shot 주입**: 프롬프트에 예시 추가

### 프롬프트 주입 예시

```markdown
## System Context

당신은 React 컴포넌트를 작성하는 개발자입니다.

### 주의사항 (과거 피드백 기반)

⚠️ 다음 패턴에서 자주 실수가 발생합니다:

1. **에러 처리 누락** (빈도: 높음)
   - Bad: `fetch('/api').then(res => setData(res))`
   - Good: `fetch('/api').then(res => setData(res)).catch(err => setError(err))`

2. **로딩 상태 누락** (빈도: 중간)
   - Bad: 바로 데이터 렌더링
   - Good: `if (loading) return <Spinner />`

---

## 요청

{{user_request}}
```

---

## Skill: feedback-collector

### 트리거

- PR 머지 후 자동 실행
- `/SEMO:collect-feedback` 수동 실행

### 워크플로우

```yaml
name: feedback-collector
triggers:
  - on: pr_merged
  - on: pr_changes_requested

steps:
  1. PR 코멘트 수집
  2. 패턴 분석 (LLM 활용)
  3. 기존 패턴과 매칭
  4. feedback-index.json 업데이트
  5. 빈도 임계값 초과 시 알림
```

### 출력

```markdown
[SEMO] Skill: feedback-collector 완료

## 수집 결과
- PR: #123 (sax-next)
- 피드백: 3건
- 새 패턴: 1건 (`missing-empty-state`)

## 업데이트된 패턴
| 패턴 | 빈도 | 심각도 |
|------|------|--------|
| missing-error-handling | 12 → 13 | HIGH |
| missing-loading-state | 5 → 6 | MEDIUM |
```

---

## 구현 로드맵

### Phase 1: 기본 수집 (현재)

- [x] feedback-index.json 스키마 정의
- [ ] feedback-collector Skill 구현
- [ ] 파일 기반 저장소

### Phase 2: 패턴 분석

- [ ] LLM 기반 패턴 분류
- [ ] 빈도 분석 자동화
- [ ] Few-shot 주입 로직

### Phase 3: 벡터 검색 (선택)

- [ ] 임베딩 생성
- [ ] 유사도 검색
- [ ] pgvector 연동 (대규모)

---

## References

- [LangFuse 관측성 설정](../observability/langfuse-config.md)
- [Promptfoo Evaluation](../evaluation/promptfoo.yaml)
- [SAX → SEMO 전환 계획](../../.claude/plans/prancy-scribbling-falcon.md)

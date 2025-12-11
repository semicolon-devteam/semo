# Teaching Methodology

> teacher Agent 교육 방법론

## Step 1: 질문 도메인 파악

| Domain | Examples | Primary Resource |
|--------|----------|------------------|
| DDD 아키텍처 | "Repository 패턴 뭐야?" | skill:validate-architecture |
| Supabase 통합 | "RPC 함수 어떻게 써?" | skill:fetch-supabase-example + MCP |
| 팀 규칙 | "커밋 컨벤션 알려줘" | skill:check-team-codex |
| Constitution | "Constitution 원칙 뭐야?" | skill:constitution |
| 일반 기술 | "React hooks 설명해줘" | General knowledge |

## Step 2: 현재 이해도 파악 (선택적)

```markdown
💡 질문을 더 잘 이해하기 위해 여쭤볼게요:

1. [관련 기초 개념]에 대해 알고 계신가요?
2. 이 개념이 필요한 맥락이 어떤 건가요? (구현 중? 리뷰 중? 학습 중?)
```

## Step 3: 구조화된 설명

```markdown
## 📚 [Concept Name] 설명

### 한 줄 요약
[간결한 핵심 설명 - 1-2문장]

### 기본 개념
[전제 지식 없이도 이해할 수 있는 설명]

### Semicolon 프로젝트에서는?
[프로젝트 내 구체적인 적용 예시]
- 파일 위치: `path/to/example`
- 사용 예시: [코드 스니펫]

### 왜 이렇게 하나요?
[설계 이유, 장점, 대안과의 비교]

### 더 알아보기
- 📖 [관련 문서 링크]
- 🔍 관련 개념: [연관 주제들]
```

## Step 4: 스킬 활용

| Question About | Invoke Skill / Tool |
|----------------|---------------------|
| DDD 4-Layer 구조 | `skill:validate-architecture` |
| Supabase RPC/패턴 | `skill:fetch-supabase-example` |
| Supabase 스키마/테이블 | **Supabase MCP** (`mcp__supabase__*`) |
| 커밋/코드 품질 규칙 | `skill:check-team-codex` |
| Constitution 원칙 | `skill:constitution` |

## Step 5: 이해 확인

```markdown
---

✅ **이해 확인**

[설명한 개념]에 대해 이해가 되셨나요?

추가로 궁금한 점이 있으시면 질문해주세요:
- [관련 후속 질문 예시 1]
- [관련 후속 질문 예시 2]
```

## Learner Level Adaptation

| Level | Approach |
|-------|----------|
| **초보자** | 비유, 다이어그램, 단계별 설명 |
| **중급자** | 코드 예시, 설계 이유, 대안 비교 |
| **고급자** | 트레이드오프, 성능 고려사항, 아키텍처 결정 |

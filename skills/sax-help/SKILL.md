---
name: sax-help
description: SAX-Next 패키지 사용 가이드 및 도움말. Use when (1) "/SAX:help" 명령어, (2) "도움말", "뭘 해야 하지" 키워드, (3) SAX 사용법 질문.
tools: [Read]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: sax-help 실행` 시스템 메시지를 첫 줄에 출력하세요.

# sax-help Skill

> SAX-Next 패키지 사용 가이드 및 워크플로우 안내

## Purpose

SAX-Next 패키지 사용자(Next.js 개발자)에게 사용 가능한 기능과 워크플로우를 안내합니다.

## 출력 포맷

```markdown
[SAX] Skill: sax-help 실행

/

# SAX-Next 도움말

**패키지**: SAX-Next v{version}
**대상**: Next.js 개발자

## 📋 사용 가능한 명령어

### 구현
| 명령어 | 설명 |
|--------|------|
| `구현해줘` | 기능 구현 (ADD Phase 4) |
| `Spec 작성해줘` | 명세 작성 (ADD Phase 1-3) |
| `검증해줘` | 구현 검증 (ADD Phase 5) |

### 환경 관리
| 명령어 | 설명 |
|--------|------|
| `환경 확인해줘` | 개발 환경 검증 |
| `SAX 업데이트해줘` | SAX 패키지 업데이트 |

### 학습
| 명령어 | 설명 |
|--------|------|
| `알려줘`, `설명해줘` | 개념/패턴 학습 |

### Git
| 명령어 | 설명 |
|--------|------|
| `커밋해줘` | Git 커밋 |
| `푸시해줘` | Git 푸시 |

### 피드백
| 명령어 | 설명 |
|--------|------|
| `/SAX:feedback` | SAX 피드백/버그 신고 |

## 📌 ADD (Agent-Driven Development) 워크플로우

### Phase 1-3: Specification (spec Skill)

```
Spec 작성해줘
→ spec.md: 요구사항 정의
→ plan.md: 기술 설계
→ tasks.md: 작업 분해
```

### Phase 4: Implementation (implement Skill)

```
구현해줘
→ v0.0.x: CONFIG (의존성)
→ v0.1.x: PROJECT (DDD 구조)
→ v0.2.x: TESTS (TDD)
→ v0.3.x: DATA (모델, 스키마)
→ v0.4.x: CODE (4 Layer 구현)
```

### Phase 5: Verification (verify Skill)

```
검증해줘
→ 타입 체크
→ 린트 체크
→ 테스트 실행
→ 빌드 검증
```

## 📐 DDD 4-Layer Architecture

```
app/{domain}/
├── _repositories/    # Server-side Supabase
├── _api-clients/     # Browser-side HTTP
├── _hooks/           # React Query
└── _components/      # UI Components
```

## 🔗 참조 문서

- [SAX Core Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [Team Codex](https://github.com/semicolon-devteam/docs/wiki/Team-Codex)
- [core-supabase 문서](https://github.com/semicolon-devteam/core-supabase)
```

## Execution Flow

1. VERSION 파일에서 현재 버전 읽기
2. 위 출력 포맷으로 도움말 출력
3. 사용자 추가 질문 대기

## 대화형 워크플로우

### Step 1: 상황 파악

사용자의 현재 상황을 파악합니다:

```markdown
[SAX] Skill: sax-help 실행

## 🤝 SAX 도우미 (Next.js 개발자)

무엇을 도와드릴까요?

### 💭 질문 유형을 선택하세요

1. **📍 현재 작업 상태**: "내가 어디까지 했는지 모르겠어요"
2. **🔄 다음 단계**: "다음에 뭘 해야 하나요?"
3. **📚 프로세스 학습**: "팀 협업 방식을 알고 싶어요"
4. **🎯 특정 개념**: "SDD, ADD, DDD 같은 개념이 궁금해요"
5. **🛠️ 도구 사용법**: "GitHub, Slack, Claude Code 사용법"
6. **❓ 기타**: "다른 질문이 있어요"

번호를 선택하거나 자유롭게 질문해주세요.
```

### Step 2: 맞춤형 응답

사용자 선택에 따라 적절한 정보 제공:

- **1️⃣ 현재 상태**: task-progress skill 활용
- **2️⃣ 다음 단계**: 워크플로우 분석 및 다음 단계 추천
- **3️⃣ 프로세스 학습**: teacher Agent 위임
- **4️⃣ 특정 개념**: teacher Agent 위임
- **5️⃣ 도구 사용법**: 도구별 명령어 안내
- **6️⃣ 기타**: 자유 질문 응답

### Step 3: 추가 질문 유도

```markdown
---

**도움이 되셨나요?**

다른 궁금한 점이 있으시면 언제든 물어보세요:
- "다음에 뭐해?" → 다음 단계 안내
- "이 개념 더 알려줘" → 상세 설명
- "/SAX:help" → 도움말 처음으로

**단축키**:
- `/SAX:task-progress` - 빠른 진행도 확인
- `/SAX:health-check` - 환경 재검증
```

## Integration with Other Tools

### skill:task-progress

```markdown
User: "내가 어디까지 했지?"
→ [SAX] Skill: task-progress 사용
→ 10단계 체크리스트 표시
→ 다음 단계 자동 추천
```

### teacher Agent

```markdown
User: "SDD가 뭐야?"
→ [SAX] Agent: teacher 호출 (트리거: 개념 학습 요청)
→ SDD 개념 설명
→ 예시 제공
→ 실습 제안
```

## SAX Message Format

```markdown
[SAX] Skill: sax-help 실행

## 🤝 SAX 도우미 (Next.js 개발자)
...
```

## Critical Rules

1. **대화형 접근**: 사용자가 질문을 선택하거나 자유롭게 물어볼 수 있도록
2. **맥락 유지**: 사용자의 현재 작업 상태를 기반으로 응답
3. **단계적 안내**: 한 번에 한 단계씩, 명확하게
4. **추가 질문 유도**: 항상 "더 궁금한 점?" 질문
5. **Agent 위임**: 복잡한 질문은 적절한 Agent로 위임

## Related

- [feedback Skill](../feedback/SKILL.md) - SAX 피드백 수집
- [health-check Skill](../health-check/SKILL.md) - 환경 검증
- [implement Skill](../implement/SKILL.md) - 구현 워크플로우

## References

- [Help Content](references/help-content.md) - 도움말 상세 내용

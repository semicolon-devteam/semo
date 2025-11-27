---
name: sax-help
description: SAX-PO 패키지 사용 가이드 및 도움말. Use when (1) "/SAX:help" 명령어, (2) "도움말", "뭘 해야 하지" 키워드, (3) SAX 사용법 질문.
tools: [Read]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: sax-help 실행` 시스템 메시지를 첫 줄에 출력하세요.

# sax-help Skill

> SAX-PO 패키지 사용 가이드 및 워크플로우 안내

## Purpose

SAX-PO 패키지 사용자(PO, 기획자)에게 사용 가능한 기능과 워크플로우를 안내합니다.

## 출력 포맷

```markdown
[SAX] Skill: sax-help 실행

/

# SAX-PO 도움말

**패키지**: SAX-PO v{version}
**대상**: PO, 기획자

## 📋 사용 가능한 명령어

### Epic 관리
| 명령어 | 설명 |
|--------|------|
| `Epic 작성해줘` | Epic 초안 작성 |
| `Epic 수정해줘` | Epic 피드백 반영 |
| `Epic 검토해줘` | Epic 품질 검증 |

### Task 관리
| 명령어 | 설명 |
|--------|------|
| `Task로 나눠줘` | Epic → Task 분해 |
| `Task 생성해줘` | GitHub Issue 생성 |
| `진행 상황 알려줘` | 작업 진행도 확인 |

### Spec 관리
| 명령어 | 설명 |
|--------|------|
| `Spec 초안 작성해줘` | 개발자용 명세 초안 |

### 학습 및 도움
| 명령어 | 설명 |
|--------|------|
| `알려줘`, `설명해줘` | 개념/방법 학습 |
| `다음 뭐해?` | 워크플로우 안내 |

### 피드백
| 명령어 | 설명 |
|--------|------|
| `/SAX:feedback` | SAX 피드백/버그 신고 |

## 📌 워크플로우

### 기본 흐름

```
Epic 작성 → Epic 검토 → Task 분해 → GitHub Issue 생성 → Spec 초안
```

### 상세 단계

1. **Epic 초안**: `Epic 작성해줘` - 기획 의도 전달
2. **Epic 검토**: `Epic 검토해줘` - 품질 검증 및 피드백
3. **Task 분해**: `Task로 나눠줘` - 개발 단위로 분리
4. **Issue 생성**: `Task 생성해줘` - GitHub에 이슈 생성
5. **Spec 전달**: `Spec 초안 작성해줘` - 개발자에게 전달

## 🔗 참조 문서

- [SAX Core Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [Epic 작성 가이드](https://github.com/semicolon-devteam/docs/wiki/Epic-Guide)
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

## 🤝 SAX 도우미 (PO/기획자)

무엇을 도와드릴까요?

### 💭 질문 유형을 선택하세요

1. **📍 PO 워크플로우**: "PO가 뭘 하는지 알고 싶어요"
2. **🎯 Epic 생성**: "Epic을 만들고 싶어요"
3. **📝 Spec 초안**: "개발자에게 전달할 명세가 필요해요"
4. **🔄 개발팀 협업**: "개발자와 어떻게 협업하나요?"
5. **📊 진행도 확인**: "프로젝트 진행 상황을 보고 싶어요"
6. **❓ 기타**: "다른 질문이 있어요"

번호를 선택하거나 자유롭게 질문해주세요.
```

### Step 2: 맞춤형 응답

사용자 선택에 따라 적절한 정보 제공:

- **1️⃣ PO 워크플로우**: PO 역할 및 프로세스 설명
- **2️⃣ Epic 생성**: epic-master Agent 위임
- **3️⃣ Spec 초안**: spec-writer Agent 위임
- **4️⃣ 개발팀 협업**: 협업 방법 안내
- **5️⃣ 진행도 확인**: GitHub Projects 활용법 안내
- **6️⃣ 기타**: 자유 질문 응답

### Step 3: 추가 질문 유도

```markdown
---

**도움이 되셨나요?**

다른 궁금한 점이 있으시면 언제든 물어보세요:
- "Epic 만들어줘" → Epic 생성
- "Spec 초안 작성해줘" → Spec 초안
- "/SAX:help" → 도움말 처음으로

**단축키**:
- `/SAX:health-check` - 환경 재검증
- `epic-master` - Epic 전문 Agent
```

## Integration with Other Tools

### epic-master Agent

```markdown
User: "Epic을 어떻게 만들어?"
→ [SAX] Agent: epic-master 호출 (트리거: Epic 학습 요청)
→ Epic 개념 설명
→ Epic 생성 예시
→ 실습 제안
```

### spec-writer Agent

```markdown
User: "Spec 초안은 뭐야?"
→ [SAX] Agent: spec-writer 호출 (트리거: Spec 학습 요청)
→ Spec 초안 개념 설명
→ 작성 방법 안내
```

### teacher Agent

```markdown
User: "PO 협업 방식을 알고 싶어요"
→ [SAX] Agent: teacher 호출 (트리거: 프로세스 학습 요청)
→ PO 워크플로우 상세 설명
→ 예시 제공
→ 실습 제안
```

## SAX Message Format

```markdown
[SAX] Skill: sax-help 실행

## 🤝 SAX 도우미 (PO/기획자)
...
```

## Critical Rules

1. **대화형 접근**: 사용자가 질문을 선택하거나 자유롭게 물어볼 수 있도록
2. **PO 맥락 유지**: PO/기획자 관점의 응답
3. **단계적 안내**: 한 번에 한 단계씩, 명확하게
4. **추가 질문 유도**: 항상 "더 궁금한 점?" 질문
5. **Agent 위임**: 복잡한 질문은 적절한 Agent로 위임

## Related

- [feedback Skill](../feedback/SKILL.md) - SAX 피드백 수집
- [health-check Skill](../health-check/SKILL.md) - 환경 검증

## References

- [Help Content](references/help-content.md) - 도움말 상세 내용

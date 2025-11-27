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

## SAX Message Format

```markdown
[SAX] Skill: sax-help 실행

/

# SAX-PO 도움말
...
```

## Related

- [feedback Skill](../feedback/SKILL.md) - SAX 피드백 수집
- [health-check Skill](../health-check/SKILL.md) - 환경 검증

## References

- [Help Content](references/help-content.md) - 도움말 상세 내용

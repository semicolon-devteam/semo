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

## SAX Message Format

```markdown
[SAX] Skill: sax-help 실행

/

# SAX-Next 도움말
...
```

## Related

- [feedback Skill](../feedback/SKILL.md) - SAX 피드백 수집
- [health-check Skill](../health-check/SKILL.md) - 환경 검증
- [implement Skill](../implement/SKILL.md) - 구현 워크플로우

## References

- [Help Content](references/help-content.md) - 도움말 상세 내용

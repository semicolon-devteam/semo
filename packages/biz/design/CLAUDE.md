# SEMO Business - Design Package

> 컨셉 설계, 목업, UX 핸드오프

## Package Info

- **Package**: biz/design
- **Version**: [../VERSION](../VERSION) 참조
- **Audience**: UI/UX 디자이너, 프로덕트 디자이너, PO

---

## 핵심 역할

| 기능 | 설명 |
|------|------|
| 컨셉 설계 | 서비스/제품 컨셉 정의 |
| 목업 생성 | AI 기반 UI 목업 생성 |
| UX 리서치 | 사용자 경험 연구 |
| 핸드오프 | 개발팀 전달용 디자인 문서 |
| Figma 연동 | Figma 디자인 시스템 활용 |

---

## Routing Keywords

| 키워드 | 트리거 |
|--------|--------|
| 목업, mockup, UI | 목업 생성 |
| 핸드오프, handoff | 개발 전달 작업 |
| Figma, 피그마 | Figma 연동 |
| 컨셉, concept | 컨셉 설계 |
| UX, 사용자경험 | UX 리서치 |
| 디자인, design | 디자인 작업 총괄 |

---

## Antigravity 연동

| 도구 | 역할 |
|------|------|
| **Claude Code** | 로직 작성, 코드 생성, 핸드오프 문서 |
| **Antigravity** | UI 목업 생성, 브라우저 테스트, 이미지 생성 |

### 권장 워크플로우

```text
1. Claude Code → 디자인 요구사항 정리 → 스펙 문서 생성
2. Antigravity → /mockup 워크플로우 → UI 목업 생성
3. Claude Code → 생성된 목업 기반 컴포넌트 코드 작성
```

---

## Agents

| Agent | 역할 | 원본 |
|-------|------|------|
| orchestrator | design 작업 라우팅 | design/orchestrator |
| design-master | 디자인 작업 총괄 | design/design-master |
| spec-writer | 명세 작성 | po/spec-writer |

---

## Skills

| Skill | 역할 | 원본 |
|-------|------|------|
| generate-mockup | AI 목업 생성 | design/generate-mockup |
| design-handoff | 핸드오프 문서 생성 | design/design-handoff |
| create-design-task | 디자인 Task 생성 | po/create-design-task |
| health-check | 디자인 환경 검증 | design/health-check |

---

## 이전/다음 단계 연동

```text
biz/discovery (요구사항)
    ↓
design (목업/스펙 완성)
    ↓
biz/management (스프린트 할당)
    ↓
eng/platforms/* (구현)
```

---

## References

- [biz 레이어](../CLAUDE.md)
- [discovery 패키지](../discovery/CLAUDE.md)
- [management 패키지](../management/CLAUDE.md)

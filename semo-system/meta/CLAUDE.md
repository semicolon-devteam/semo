# SEMO-Meta Package

> SEMO 패키지 자체 관리 및 개발을 위한 메타 패키지

## Package Info

- **Package**: SEMO-Meta
- **Version**: [VERSION](./VERSION) 참조
- **Audience**: SEMO 개발자, SEMO 패키지 관리자

---

## Core Rules (상속)

> 📄 다음 규칙은 [semo-core/principles/](../semo-core/principles/)에서 참조합니다.

| 규칙 | 참조 |
|------|------|
| Orchestrator-First | [ORCHESTRATOR_FIRST.md](../semo-core/principles/ORCHESTRATOR_FIRST.md) |
| Quality Gate | [QUALITY_GATE.md](../semo-core/principles/QUALITY_GATE.md) |
| Session Init | [SESSION_INIT.md](../semo-core/principles/SESSION_INIT.md) |
| Versioning | [VERSIONING.md](../semo-core/principles/VERSIONING.md) |
| Prefix Routing | [PREFIX_ROUTING.md](../semo-core/principles/PREFIX_ROUTING.md) |

---

## 🔴 Meta 고유: 작업 완료 후 자동 배포 (NON-NEGOTIABLE)

> **⚠️ Meta 환경에서 작업 완료 시 반드시 전체 배포 플로우를 실행합니다.**
> **사용자가 별도로 요청하지 않아도 자동으로 진행합니다.**

### 배포 대상 감지

| 변경 파일 | 배포 대상 | 버전 파일 |
|----------|----------|----------|
| `packages/cli/**` | npm publish | `packages/cli/package.json` |
| `packages/mcp-server/**` | npm publish | `packages/mcp-server/package.json` |
| `semo-core/**` | GitHub | `semo-core/VERSION` |
| `semo-skills/**` | GitHub | `semo-skills/VERSION` |
| `packages/{ext}/**` | GitHub | `packages/{ext}/VERSION` |

### 필수 동작 순서

**CLI 변경 시**:
```
작업 완료 → 버전 범프 → npm run build → 커밋 + 푸시 → npm publish
```

**semo-core/semo-skills/Extension 변경 시**:
```
작업 완료 → VERSION 파일 범프 → 커밋 + 푸시
```

---

## Meta 고유: 신규 패키지 추가

새로운 SEMO 패키지 생성 시 반드시 3가지를 함께 업데이트:

| 항목 | 파일 | 내용 |
|------|------|------|
| 접두사 라우팅 | `PREFIX_ROUTING.md` | 접두사 추가 |
| CLI 스크립트 | `packages/cli/src/index.ts` | 패키지 정의 추가 |
| 설치 스크립트 | `scripts/install-sax.sh` | 3곳 수정 |

> 상세: [semo-architect Agent](agents/semo-architect/semo-architect.md)

---

## Meta 고유: 세션 컨텍스트 비의존

SEMO는 세션 컨텍스트에 의지하지 않습니다. 모든 정보는 Reference Chain으로 접근:

```
Agent/Skill → references/ → semo-core/ → docs
```

---

## Orchestrator

**Primary**: [agents/orchestrator/orchestrator.md](agents/orchestrator/orchestrator.md)

## References

- [SEMO Core Principles](../semo-core/principles/PRINCIPLES.md)
- [SEMO Core Orchestrator](../semo-core/agents/orchestrator/orchestrator.md)

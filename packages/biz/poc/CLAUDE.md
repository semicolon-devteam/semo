# SEMO Business - PoC Package

> 빠른 PoC, 프로토타입, 패스트트랙 개발

## Package Info

- **Package**: biz/poc
- **Version**: [../VERSION](../VERSION) 참조
- **Target**: Greenfield MVP projects
- **Audience**: 기획자, 개발자 (빠른 검증 목적)

---

## 핵심 역할

| 기능 | 설명 |
|------|------|
| PoC 검증 | 아이디어의 기술적 실현 가능성 검증 |
| 프로토타입 | 빠른 프로토타입 개발 |
| 패스트트랙 | 최소 컨벤션으로 빠른 개발 |
| MVP 아키텍처 | MVP 전용 아키텍처 설계 |

---

## Routing Keywords

| 키워드 | 트리거 |
|--------|--------|
| PoC, poc | PoC 검증 |
| 프로토타입, prototype | 프로토타입 개발 |
| MVP, mvp | MVP 개발 |
| 빠른검증, 패스트트랙 | 패스트트랙 모드 |
| 빠르게, 간단히 | 속도 우선 개발 |

---

## 🔴 핵심 규칙 (NON-NEGOTIABLE)

### Schema Extension Strategy (우선순위 순)

| 우선순위 | 전략 | 조건 |
|---------|------|------|
| 1순위 | metadata JSONB 확장 | 기존 테이블에 데이터 추가 시 |
| 2순위 | 컬럼 추가 | metadata로 불가능하거나 쿼리 성능 필요 시 |
| 3순위 | 신규 테이블 생성 | 완전히 새로운 도메인/엔티티 필요 시 |

### 패스트트랙 규칙

| 항목 | 적용 |
|------|------|
| 테스트 | 선택적 (필수 아님) |
| 코드 리뷰 | 생략 가능 |
| DDD 4계층 | 2계층 허용 |
| 타입 정의 | 간소화 허용 |
| 문서화 | 최소화 |

### 유지되는 필수 규칙

| 항목 | 적용 |
|------|------|
| 기본 폴더 구조 | 필수 |
| 네이밍 컨벤션 | 필수 |
| Git 커밋 규칙 | 필수 |
| 보안 규칙 | 필수 |

---

## Agents

| Agent | 역할 | 원본 |
|-------|------|------|
| orchestrator | poc 작업 라우팅 | mvp/orchestrator |
| mvp-architect | MVP 아키텍처 설계 | mvp/mvp-architect |
| implementation-master | Phase-gated 구현 | mvp/implementation-master |

---

## Skills

| Skill | 역할 | 원본 |
|-------|------|------|
| scaffold-mvp-domain | MVP 도메인 구조 생성 | mvp/scaffold-mvp-domain |
| implement-mvp | MVP 구현 | mvp/implement-mvp |
| sync-interface | core-interface 타입 동기화 | mvp/sync-interface |
| supabase-fallback | Supabase GraphQL 쿼리 | mvp/supabase-fallback |
| verify-integration | 통합 검증 | mvp/verify-integration |
| health-check | 환경 및 MCP 검증 | 공통 |

---

## Antigravity 연동

| 도구 | 역할 |
|------|------|
| **Claude Code** | Logic, API integration, code generation |
| **Antigravity** | Visual mockups, browser testing, image generation |

### 권장 워크플로우

```text
1. Claude Code → Task card 확인 → Domain 설계
2. Antigravity → /mockup → UI 목업 생성
3. Claude Code → 목업 기반 컴포넌트 구현
4. Antigravity → /browser-test → 시각적 검증
5. Claude Code → skill:verify-integration → 통합 준비
```

---

## PoC → Production 마이그레이션

PoC 검증 완료 후 실서비스로 전환 시:

```text
biz/poc (PoC 완료)
    ↓
eng/platforms/* (mode: mvp)
    ↓ 마이그레이션
eng/platforms/* (mode: prod)
```

### 마이그레이션 체크리스트

- [ ] 2계층 → 4계층 리팩토링
- [ ] 타입 정의 강화
- [ ] 테스트 추가 (커버리지 80%)
- [ ] 에러 핸들링 강화
- [ ] 문서화 완성

---

## References

- [biz 레이어](../CLAUDE.md)
- [eng/modes/mvp.md](../../eng/modes/mvp.md)
- [eng/modes/prod.md](../../eng/modes/prod.md)

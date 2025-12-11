# SEMO Skill: Coder

> 코드 작성, 수정, 검증을 담당하는 스킬 그룹

**위치**: `semo-skills/coder/`
**Layer**: Layer 1 (Capabilities)

---

## 개요

Coder는 모든 코드 관련 작업을 처리하는 스킬 그룹입니다.
플랫폼(Next.js, Spring, MVP 등)에 따라 분기 로직이 적용됩니다.

---

## 하위 스킬

| 스킬 | 역할 | 플랫폼 분기 |
|------|------|-------------|
| **implement** | 코드 구현 | ✅ (nextjs, spring, mvp) |
| **scaffold** | 도메인/컴포넌트 스캐폴딩 | ✅ |
| **review** | 코드 리뷰 | ❌ |
| **verify** | 구현 검증 | ❌ |

---

## 플랫폼 감지

Orchestrator가 `detect-context.sh`를 호출하여 플랫폼을 자동 감지합니다:

```bash
platform=$(semo-core/shared/detect-context.sh .)
# 결과: nextjs | spring | microservice | mvp
```

---

## 사용 예시

### 자동 라우팅 (권장)

```
사용자: 댓글 기능 구현해줘

[SEMO] Orchestrator: 플랫폼 감지 → nextjs
[SEMO] Skill: coder/implement 호출 (platform: nextjs)
```

### 레거시 접두사 (호환성)

```
사용자: [next] 댓글 기능 구현해줘

[SEMO] Warning: [next] 접두사는 Deprecated 예정
[SEMO] Skill: coder/implement 호출 (platform: nextjs)
```

---

## 디렉토리 구조

```
semo-skills/coder/
├── SKILL.md              # 이 파일
├── implement/
│   ├── SKILL.md          # 공통 인터페이스
│   └── platforms/
│       ├── nextjs.md     # Next.js 특화
│       ├── spring.md     # Spring 특화
│       └── mvp.md        # MVP 특화
├── scaffold/
│   └── SKILL.md
├── review/
│   └── SKILL.md
└── verify/
    └── SKILL.md
```

---

## 매핑 정보 (SEMO → SEMO)

| 기존 패키지 | 기존 스킬 | 새 위치 |
|-------------|----------|---------|
| semo-next | implement | coder/implement (platform: nextjs) |
| semo-backend | implement | coder/implement (platform: spring) |
| semo-mvp | implement-mvp | coder/implement (platform: mvp) |
| semo-next | scaffold-domain | coder/scaffold |
| semo-next | typescript-review | coder/review |
| semo-next | verify-implementation | coder/verify |

---

## 참조

- [SEMO Principles](../../semo-core/principles/PRINCIPLES.md)
- [detect-context.sh](../../semo-core/shared/detect-context.sh)

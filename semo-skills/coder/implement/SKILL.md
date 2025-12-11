# SEMO Skill: Coder / Implement

> 코드 구현 스킬 - 플랫폼별 분기 지원

**위치**: `semo-skills/coder/implement/`
**트리거**: "구현해줘", "만들어줘", "코드 작성해줘"

---

## 개요

사용자의 요구사항을 분석하고 플랫폼에 맞는 코드를 구현합니다.

---

## 플랫폼 분기

| 플랫폼 | 파일 | 트리거 조건 |
|--------|------|-------------|
| Next.js | `platforms/nextjs.md` | next.config.js 존재 |
| Spring | `platforms/spring.md` | pom.xml 또는 build.gradle |
| MVP | `platforms/mvp.md` | 기타 (기본값) |

---

## 공통 워크플로우

```
1. 요구사항 분석
   ↓
2. 플랫폼 감지 (detect-context.sh)
   ↓
3. 플랫폼별 스킬 로드
   ↓
4. 구현 계획 수립
   ↓
5. 코드 작성
   ↓
6. 검증 (verify 스킬 호출)
```

---

## 출력 형식

### SEMO 메시지

```markdown
[SEMO] Skill: implement 시작 (platform: {platform})

[SEMO] Reference: {schema/spec} 참조

## 구현 계획

1. ...
2. ...

## 구현 코드

...

[SEMO] Skill: implement 완료
```

---

## 플랫폼별 상세

### Next.js (`platforms/nextjs.md`)

- Server Components / Client Components 분리
- App Router 기반 구조
- Supabase 연동 패턴

### Spring (`platforms/spring.md`)

- Layered Architecture (Controller → Service → Repository)
- JPA/Hibernate 패턴
- Spring Security 연동

### MVP (`platforms/mvp.md`)

- 빠른 프로토타이핑 우선
- 최소 기능 구현
- 리팩토링 용이성 고려

---

## 참조

- [Coder SKILL.md](../SKILL.md)
- [SEMO Principles](../../../semo-core/principles/PRINCIPLES.md)

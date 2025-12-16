---
name: scaffold-mvp-domain
description: DDD 4-layer MVP 도메인 구조 생성. Use when (1) 새 도메인 구조 필요, (2) MVP 스캐폴딩, (3) 4-layer 아키텍처 적용.
tools: [Bash, Write, Glob]
---

> **시스템 메시지**: `[SEMO] Skill: scaffold-mvp-domain 호출 - 도메인 구조 생성`

# Scaffold MVP Domain Skill

## Purpose

DDD 4-layer 아키텍처 기반의 MVP 도메인 구조를 자동 생성합니다.

## Quick Start

```bash
/SEMO:scaffold {domain-name}

# 예시
/SEMO:scaffold office
/SEMO:scaffold reservation
```

## 생성되는 구조

```
app/{domain}/
├── _repositories/
│   ├── {Domain}Repository.ts
│   └── index.ts
├── _api-clients/
│   ├── {Domain}ApiClient.ts
│   └── index.ts
├── _hooks/
│   ├── use{Domain}.ts
│   └── index.ts
├── _components/
│   ├── {Domain}List.tsx
│   ├── {Domain}Card.tsx
│   └── index.ts
├── _types/
│   ├── {domain}.types.ts
│   ├── {domain}.dto.ts
│   └── index.ts
└── page.tsx
```

## 출력 형식

```markdown
# 🏗️ MVP 도메인 구조 생성 완료

## 도메인: {domain}

### 다음 단계
1. `_types/{domain}.types.ts`에서 실제 core 테이블과 metadata 필드 정의
2. `_repositories/{Domain}Repository.ts`에서 테이블명 수정
3. `implementation-master`로 Phase-gated 구현 시작
```

## References

- [Templates](references/templates.md) - 상세 템플릿 코드

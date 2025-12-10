---
name: scaffold
description: DDD 4-layer MVP 도메인 구조 생성
---

# /SAX:scaffold {domain}

DDD 4-layer 아키텍처 기반의 MVP 도메인 구조를 생성합니다.

## 사용법

```bash
/SAX:scaffold office
/SAX:scaffold reservation
```

## 실행

`skill:scaffold-mvp-domain`을 호출하여 도메인 구조를 생성합니다.

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
│   ├── use{Domain}Mutation.ts
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

## 프롬프트

```
[SAX] Skill: scaffold-mvp-domain 호출 - {domain} 도메인 구조 생성

DDD 4-layer 구조를 생성합니다.
```

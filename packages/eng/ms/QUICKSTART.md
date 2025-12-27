# eng/ms Quickstart

> 마이크로서비스 개발자를 위한 빠른 시작 가이드

## 대상

- 마이크로서비스 개발자
- 이벤트 기반 아키텍처 담당자

## 주요 스킬

| 스킬 | 설명 | 트리거 예시 |
| ---- | ---- | ----------- |
| `scaffold-service` | 서비스 스캐폴딩 | "새 서비스 만들어줘" |
| `create-event-schema` | 이벤트 스키마 생성 | "이벤트 스키마 만들어줘" |
| `setup-prisma` | Prisma 설정 | "Prisma 설정해줘" |

## 빠른 시작 예시

```text
"새 서비스 만들어줘"          → skill:scaffold-service
"이벤트 스키마 만들어줘"      → skill:create-event-schema
"Prisma 설정해줘"             → skill:setup-prisma
```

## 마이크로서비스 구조

```text
ms-{service}/
├── src/
│   ├── events/          # 이벤트 핸들러
│   ├── services/        # 비즈니스 로직
│   └── prisma/          # DB 스키마
├── docker-compose.yml
└── package.json
```

## 상세 튜토리얼

```text
"마이크로서비스 온보딩 실습해줘" → skill:onboarding-ms
```

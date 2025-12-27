# eng/spring Quickstart

> Spring Boot 백엔드 개발자를 위한 빠른 시작 가이드

## 대상

- 백엔드 개발자
- Spring Boot, Kotlin, WebFlux 프로젝트

## 주요 스킬

| 스킬 | 설명 | 트리거 예시 |
| ---- | ---- | ----------- |
| `implement` | 코드 작성/수정 | "API 엔드포인트 만들어줘" |
| `scaffold-domain` | 도메인 구조 생성 | "User 도메인 만들어줘" |
| `verify-reactive` | Reactive 검증 | "Reactive 패턴 검증해줘" |
| `sync-openapi` | OpenAPI 동기화 | "OpenAPI 스펙 업데이트해줘" |

## 빠른 시작 예시

```text
"API 엔드포인트 만들어줘"     → skill:implement
"User 도메인 만들어줘"        → skill:scaffold-domain
"Reactive 검증해줘"           → skill:verify-reactive
"커밋하고 PR 만들어줘"        → skill:git-workflow
```

## CQRS Architecture

```text
src/main/kotlin/{package}/
├── {domain}/
│   ├── command/          # 쓰기 작업
│   │   ├── CommandService.kt
│   │   └── CommandHandler.kt
│   ├── query/            # 읽기 작업
│   │   ├── QueryService.kt
│   │   └── QueryHandler.kt
│   ├── entity/           # 도메인 엔티티
│   ├── dto/              # DTO
│   └── repository/       # 레포지토리
```

## 핵심 규칙

| 금지 | 권장 |
| ---- | ---- |
| `.block()` | `awaitSingle()` |
| `enum class` | `String const pattern` |
| `@Transactional` | Saga 패턴 |

## 상세 튜토리얼

```text
"Spring 온보딩 실습해줘" → skill:onboarding-backend
```

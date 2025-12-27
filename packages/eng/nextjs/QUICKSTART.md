# eng/nextjs Quickstart

> Next.js 프론트엔드 개발자를 위한 빠른 시작 가이드

## 대상

- 프론트엔드 개발자
- Next.js 15, React 19, TypeScript 프로젝트

## 주요 스킬

| 스킬 | 설명 | 트리거 예시 |
| ---- | ---- | ----------- |
| `implement` | 코드 작성/수정 | "로그인 기능 만들어줘" |
| `scaffold-domain` | 도메인 구조 생성 | "Button 도메인 만들어줘" |
| `verify` | 구현 검증 | "구현 검증해줘" |
| `typescript-review` | TS 리뷰 | "타입스크립트 리뷰해줘" |

## 빠른 시작 예시

```text
"로그인 기능 만들어줘"        → skill:implement
"Button 도메인 만들어줘"      → skill:scaffold-domain
"구현 검증해줘"               → skill:verify
"커밋하고 PR 만들어줘"        → skill:git-workflow
```

## DDD 4-Layer Architecture

```text
src/app/{domain}/
├── _repositories/     # Layer 1: 서버사이드 데이터
├── _api-clients/      # Layer 2: 브라우저 HTTP
├── _hooks/            # Layer 3: React 상태 관리
├── _components/       # Layer 4: 도메인 UI
└── page.tsx
```

## ADD Phase (버전별 개발)

| Phase | 버전 | 작업 내용 |
| ----- | ---- | --------- |
| CONFIG | v0.0.x | 환경 설정 |
| PROJECT | v0.1.x | 도메인 구조 생성 |
| TESTS | v0.2.x | TDD 테스트 작성 |
| DATA | v0.3.x | 타입/인터페이스 정의 |
| CODE | v0.4.x | 구현 코드 작성 |
| E2E | v0.5.x | E2E 테스트 |

## 상세 튜토리얼

```text
"Next.js 온보딩 실습해줘" → skill:onboarding-next
```

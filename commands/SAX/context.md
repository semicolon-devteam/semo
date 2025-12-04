---
name: context
description: 컨텍스트 빠른 파악 - load-context Skill 호출
---

# /SAX:context Command

프로젝트 컨텍스트를 빠르게 파악하기 위한 load-context Skill을 호출합니다.

> **SuperClaude 대응**: `/sc:load`

## Trigger

- `/SAX:context` 명령어
- `/SAX:context {도메인 또는 경로}`

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **새 세션 시작**: 프로젝트 전체 컨텍스트 로드
2. **도메인 파악**: 특정 도메인의 구조 이해
3. **작업 전 준비**: 코드 수정 전 관련 컨텍스트 확인
4. **의존성 파악**: 관련 파일 및 모듈 식별

## Action

`/SAX:context` 실행 시 `load-context` Skill을 호출합니다.

```markdown
[SAX] Skill: load-context 호출 - {scope}
```

## Workflow

### Step 1: 범위 결정

| Scope | 설명 | 로드 대상 |
|-------|------|----------|
| `project` | 프로젝트 전체 | 디렉토리 구조, 핵심 설정 |
| `domain` | 특정 도메인 | 도메인 폴더 전체 분석 |
| `file` | 특정 파일 | 파일 + 의존성 |

### Step 2: 정보 수집

```text
컨텍스트 수집
├─ 디렉토리 구조 탐색
├─ 핵심 파일 읽기
│   ├─ build.gradle.kts
│   ├─ application.yml
│   └─ 도메인 엔티티
├─ 의존성 그래프 구성
└─ 최근 변경 사항
```

### Step 3: 요약 생성

수집된 정보를 구조화된 형태로 요약합니다.

## Expected Output

```markdown
[SAX] Skill: load-context 완료

## 📁 프로젝트 구조

```
src/main/kotlin/com/example/
├── domain/
│   ├── user/
│   ├── post/
│   └── comment/
├── infrastructure/
└── application/
```

## ⚙️ 기술 스택

| 항목 | 값 |
|------|-----|
| Framework | Spring Boot 3.2 |
| Language | Kotlin 1.9 |
| Reactive | WebFlux + R2DBC |
| DB | PostgreSQL |

## 🔗 주요 의존성

- spring-boot-starter-webflux
- spring-boot-starter-data-r2dbc
- kotlinx-coroutines-reactor

## 📝 최근 변경

| 파일 | 변경 |
|------|------|
| UserService.kt | 3시간 전 |
| PostRepository.kt | 1일 전 |

---
✅ 컨텍스트 로드 완료. 작업을 시작할 준비가 되었습니다.
```

## Usage Examples

```bash
# 프로젝트 전체 컨텍스트
/SAX:context

# 특정 도메인
/SAX:context user

# 특정 경로
/SAX:context src/main/kotlin/com/example/domain/post
```

## Related

- [load-context Skill](../../skills/load-context/SKILL.md)
- [debug-master Agent](../../agents/debug-master/debug-master.md)

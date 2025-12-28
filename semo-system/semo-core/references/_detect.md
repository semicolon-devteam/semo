# Runtime Auto-Detection

> 프로젝트 런타임 자동 감지 규칙

## Detection Flow

```text
1. .claude/memory/runtime.md 확인
   └─ Primary 설정됨 → 해당 Runtime 사용

2. 프로젝트 파일 스캔
   ├─ next.config.* → nextjs
   ├─ build.gradle.kts + application.yml → spring
   ├─ go.mod → go
   ├─ pyproject.toml → python
   └─ docker-compose.yml (only) → infra

3. 다중 감지 또는 불명확 → 사용자에게 질문
   → 선택 결과를 .claude/memory/runtime.md에 저장
```

## File Detection Matrix

| Runtime | 필수 파일 | 보조 파일 | 신뢰도 |
|---------|----------|----------|--------|
| **nextjs** | `next.config.*` | `package.json` (next 의존성), `tailwind.config.*` | 🟢 확정 |
| **spring** | `build.gradle.kts` | `application.yml`, `src/main/kotlin/` | 🟢 확정 |
| **go** | `go.mod` | `cmd/`, `internal/`, `pkg/` | 🟢 확정 |
| **python** | `pyproject.toml` | `requirements.txt`, `setup.py` | 🟢 확정 |
| **ms** | `package.json` + `prisma/schema.prisma` | EventEnvelope 타입 정의 | 🟡 추론 |
| **infra** | `docker-compose.yml` | `.github/workflows/`, `nginx/` | 🟡 추론 |

## Keyword Fallback

파일 감지 실패 시 사용자 입력에서 키워드 추출:

| 키워드 | Runtime |
|--------|---------|
| React, Next.js, 컴포넌트, UI, Supabase, 프론트 | nextjs |
| Spring, Kotlin, API, CQRS, Reactive, 백엔드 | spring |
| Go, goroutine, channel, Golang | go |
| Python, FastAPI, Django, ML, 머신러닝 | python |
| Docker, nginx, CI/CD, 배포, 인프라 | infra |
| 이벤트, 마이크로서비스, EventEnvelope, Worker | ms |

## Domain Keywords

| 키워드 | Domain |
|--------|--------|
| PoC, MVP, 빠르게, 프로토타입 | biz/poc |
| 현황, 모니터링, 이슈, 장애 | ops/monitor |
| 테스트, QA, 릴리스, stg, prd | ops/qa |
| 기술부채, 리팩토링, 개선 | ops/improve |
| 스프린트, 백로그, 로드맵, 할당 | biz/management |
| Epic, 기획, PO, 태스크 | biz/discovery |
| 디자인, Figma, 목업 | biz/design |

## Runtime 저장 형식

`.claude/memory/runtime.md`:

```markdown
# Runtime Configuration

## Active Runtime

| 항목 | 값 |
|------|-----|
| **Primary** | nextjs |
| **Detected** | 2025-12-28 |
| **Method** | auto (next.config.ts) |

## Manual Override

```yaml
override: null  # 또는 "spring", "go" 등
```
```

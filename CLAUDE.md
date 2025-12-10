# SAX-MS Package Configuration

> 마이크로서비스 개발을 위한 SAX 패키지

## Package Info

- **Package**: SAX-MS
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Audience**: 마이크로서비스 개발자 (ms-* 레포지토리)

---

## 🔴 핵심 규칙 (NON-NEGOTIABLE)

### 1. 세션 초기화

> 📖 상세: [sax-core/_shared/INIT_SETUP.md](sax-core/_shared/INIT_SETUP.md)

### 2. SAX Core 참조

> 📖 상세: [sax-core/_shared/SAX_CORE_REFERENCE.md](sax-core/_shared/SAX_CORE_REFERENCE.md)

| 파일 | 용도 |
|------|------|
| `sax-core/_shared/microservice-conventions.md` | 마이크로서비스 공통 규약 |

### 3. Orchestrator 위임

> 📖 상세: [sax-core/_shared/ORCHESTRATOR_RULES.md](sax-core/_shared/ORCHESTRATOR_RULES.md)

| 패턴 | 라우팅 |
|------|--------|
| 서비스 설계, 아키텍처 | → `service-architect` |
| 이벤트, 알림, 봉투 | → `event-designer` |
| 워커, 백그라운드, 큐 | → `worker-architect` |
| Prisma, 스키마, 마이그레이션 | → `setup-prisma` Skill |

---

## Agents & Skills

### Agents

| Agent | 역할 |
|-------|------|
| service-architect | 마이크로서비스 전체 설계 |
| event-designer | 이벤트 기반 통신 설계 |
| worker-architect | 백그라운드 워커 설계 |

### Skills

| Skill | 역할 |
|-------|------|
| scaffold-service | 서비스 보일러플레이트 생성 |
| create-event-schema | 이벤트 스키마 TypeScript 타입 생성 |
| setup-prisma | Prisma 스키마 및 마이그레이션 설정 |

---

## 서비스 코드 체계

| 서비스 | 코드 | 테이블 Prefix | 포트 |
|--------|------|---------------|------|
| ms-notifier | NF | nf_ | 3000 |
| ms-scheduler | SC | sc_ | 3003 |
| ms-ledger | LG | lg_ | 3000 |
| ms-media-processor | MP | - | 3001 |
| ms-crawler | CR | - | 3333 |

---

## Quick Reference

### 이벤트 봉투 표준

```typescript
interface EventEnvelope {
  metadata: { eventId, service, type, severity, occurredAt };
  context: { env, tenantId?, traceId?, resource? };
  data: Record<string, unknown>;
  notification: { channels, targets, template?, policy? };
}
```

### 디렉토리 구조

```text
src/
├── app/api/         # API 라우트
├── services/        # 비즈니스 로직
├── workers/         # 백그라운드 워커
├── adapters/        # 외부 연동
├── repositories/    # 데이터 액세스
└── types/           # TypeScript 타입
```

---

## References

- [Orchestrator](agents/orchestrator/orchestrator.md)
- [SAX Core - Microservice Conventions](https://github.com/semicolon-devteam/sax-core/blob/main/_shared/microservice-conventions.md)

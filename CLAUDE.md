# SAX-MS Package Configuration

> 마이크로서비스 개발을 위한 SAX 패키지

## Package Info

- **Package**: SAX-MS
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Audience**: 마이크로서비스 개발자 (ms-* 레포지토리)

---

## 🔴 Orchestrator-First (최우선 규칙)

> **⚠️ 이 규칙은 예외 없이 적용됩니다. 직접 처리 절대 금지.**

### 트리거 패턴

| 패턴 | 라우팅 |
|------|--------|
| 서비스 설계, 아키텍처 | → `service-architect` |
| 이벤트, 알림, 봉투 | → `event-designer` |
| 워커, 백그라운드, 큐 | → `worker-architect` |
| Prisma, 스키마, 마이그레이션 | → `setup-prisma` Skill |
| 보일러플레이트, 스캐폴드 | → `scaffold-service` Skill |

### 필수 출력

```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Agent 위임: {agent_name} (사유: {reason})
```

---

## 🔴 SAX Core 필수 참조

> **모든 작업 전 sax-core 문서를 참조합니다.**

| 파일 | 용도 |
|------|------|
| `sax-core/PRINCIPLES.md` | SAX 핵심 원칙 |
| `sax-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 |
| `sax-core/_shared/microservice-conventions.md` | 마이크로서비스 공통 규약 |

---

## Agents

### service-architect

마이크로서비스 전체 설계 및 아키텍처 담당

**트리거**:
- "서비스 설계해줘"
- "아키텍처 구성"
- "새 마이크로서비스 만들어줘"

**참조**:
- [마이크로서비스 규약](../sax-core/_shared/microservice-conventions.md)
- [마이크로서비스 생태계](../sax-meta/contexts/microservice-ecosystem.md)

### event-designer

이벤트 기반 통신 및 이벤트 봉투 설계

**트리거**:
- "이벤트 설계"
- "알림 이벤트 만들어줘"
- "이벤트 스키마"

**참조**:
- 이벤트 봉투 표준 (microservice-conventions.md)
- ms-notifier 패턴

### worker-architect

백그라운드 워커 및 작업 큐 설계

**트리거**:
- "워커 만들어줘"
- "백그라운드 작업"
- "작업 큐 설계"

**참조**:
- 워커 패턴 (microservice-conventions.md)
- ms-scheduler 패턴

---

## Skills

### scaffold-service

서비스 보일러플레이트 생성

**사용**:
```
skill:scaffold-service
```

### create-event-schema

이벤트 스키마 TypeScript 타입 생성

**사용**:
```
skill:create-event-schema
```

### setup-prisma

Prisma 스키마 및 마이그레이션 설정

**사용**:
```
skill:setup-prisma
```

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

### 디렉토리 구조 (권장)

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
- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Microservice Conventions](https://github.com/semicolon-devteam/sax-core/blob/main/_shared/microservice-conventions.md)

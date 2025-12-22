# SEMO Engineering - Microservice Platform

> 마이크로서비스 아키텍처 개발

## Package Info

- **Package**: eng/platforms/ms
- **Version**: [../../VERSION](../../VERSION) 참조
- **Target**: ms-notifier, ms-scheduler, ms-ledger, ms-media-processor, ms-crawler, ms-collector, ms-allocator, ms-gamer
- **Audience**: Backend 개발자 (마이크로서비스 담당)

---

## 서비스 코드 체계

| 서비스 | 코드 | 테이블 Prefix | 포트 | 기술 스택 |
|--------|------|---------------|------|-----------|
| ms-notifier | NF | nf_ | 3000 | Next.js |
| ms-scheduler | SC | sc_ | 3003 | Next.js |
| ms-ledger | LG | lg_ | 3000 | Next.js |
| ms-media-processor | MP | - | 3001 | Node.js |
| ms-crawler | CR | - | 3333 | Node.js |
| ms-collector | AG | ag_ | 3002 | Node.js |
| ms-allocator | AL | al_ | 3004 | Next.js |
| ms-gamer | GM | ladder_ | 8080 | Go |
| ms-template | - | - | 3000 | Next.js (템플릿) |

---

## Mode Support

| 모드 | 용도 |
|------|------|
| `mvp` | 빠른 서비스 프로토타입 |
| `prod` | 프로덕션 마이크로서비스 (기본값) |

---

## Agents

| Agent | 역할 |
|-------|------|
| orchestrator | MS 작업 라우팅 |
| service-architect | 마이크로서비스 설계 |
| event-designer | 이벤트 봉투 설계 |
| worker-architect | 백그라운드 워커 설계 |

---

## Skills

| Skill | 역할 |
|-------|------|
| scaffold-service | 서비스 보일러플레이트 생성 |
| create-event-schema | 이벤트 스키마 생성 |
| setup-prisma | Prisma 스키마 설정 |
| health-check | 환경 검증 |

---

## 이벤트 설계 패턴

### 이벤트 봉투 구조

```typescript
interface EventEnvelope<T> {
  id: string;           // UUID
  type: string;         // 이벤트 타입
  source: string;       // 발신 서비스
  timestamp: Date;
  data: T;              // 페이로드
  metadata?: Record<string, unknown>;
}
```

### 이벤트 명명 규칙

```text
{domain}.{action}.{version}
예: user.created.v1, order.completed.v1
```

---

## References

- [eng 레이어](../../CLAUDE.md)
- [spring 패키지](../spring/CLAUDE.md)

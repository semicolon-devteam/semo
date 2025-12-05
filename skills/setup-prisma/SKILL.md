# setup-prisma Skill

> Prisma 스키마 및 마이그레이션 설정

## Usage

```
skill:setup-prisma
```

## Input

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| serviceName | ✅ | 서비스명 (스키마명으로 사용) |
| serviceCode | ✅ | 2글자 코드 (테이블 prefix) |
| models | ❌ | 모델 정의 목록 |

## Output

### prisma/schema.prisma

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["{serviceName}"]
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

// ============================================
// {ServiceName} Service Models
// ============================================

model Config {
  id        String   @id @default(uuid())
  key       String   @unique
  value     Json
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@schema("{serviceName}")
  @@map("{serviceCode}_configs")
}

model AuditLog {
  id        String   @id @default(uuid())
  action    String
  entityType String  @map("entity_type")
  entityId  String   @map("entity_id")
  payload   Json?
  userId    String?  @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")

  @@schema("{serviceName}")
  @@map("{serviceCode}_audit_logs")
}

model JobQueue {
  id           String    @id @default(uuid())
  jobType      String    @map("job_type")
  payload      Json
  status       String    @default("pending")
  priority     Int       @default(0)
  attempts     Int       @default(0)
  maxAttempts  Int       @default(3) @map("max_attempts")
  scheduledFor DateTime  @default(now()) @map("scheduled_for")
  startedAt    DateTime? @map("started_at")
  completedAt  DateTime? @map("completed_at")
  errorMessage String?   @map("error_message")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  @@index([status, priority(sort: Desc), scheduledFor])
  @@schema("{serviceName}")
  @@map("{serviceCode}_job_queue")
}

// Add your domain models below...
```

### src/libs/database.ts

```typescript
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error']
  });
};

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export default prisma;
```

## Setup Commands

```bash
# 1. Prisma 클라이언트 생성
npx prisma generate

# 2. 스키마 적용 (개발)
npx prisma db push

# 3. 마이그레이션 생성 (프로덕션)
npx prisma migrate dev --name init

# 4. Prisma Studio 실행
npx prisma studio
```

## Environment Variables

```bash
# Primary DB (읽기/쓰기)
DATABASE_URL="postgresql://{user}:{password}@localhost:5432/{db}?schema={serviceName}"

# Replica DB (읽기 전용, 선택)
DATABASE_URL_REPLICA="postgresql://{user}:{password}@localhost:5433/{db}?schema={serviceName}"
```

## Model Naming Convention

```prisma
model YourModel {
  // 필드 정의...

  @@schema("{serviceName}")        // 스키마 지정
  @@map("{serviceCode}_your_model") // 테이블명 (prefix 포함)
}
```

## Common Patterns

### Soft Delete

```prisma
model Entity {
  id        String    @id @default(uuid())
  deletedAt DateTime? @map("deleted_at")
  // ...
}
```

### Timestamps

```prisma
model Entity {
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
}
```

### JSON Fields

```prisma
model Entity {
  metadata Json?
  payload  Json
}
```

## Reference

- [마이크로서비스 규약](../../sax-core/_shared/microservice-conventions.md)
- [Prisma 공식 문서](https://www.prisma.io/docs)

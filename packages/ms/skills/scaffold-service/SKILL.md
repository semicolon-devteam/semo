---
name: scaffold-service
description: |
  마이크로서비스 보일러플레이트 생성. Use when: 새 마이크로서비스 디렉토리 구조 및 기본 파일 생성 필요 시
tools: [Write, Bash]
---

# scaffold-service Skill

> **🔔 시스템 메시지**: 이 Skill이 호출되면 마이크로서비스 전체 디렉토리 구조와 boilerplate 파일들을 생성합니다.

> 마이크로서비스 보일러플레이트 생성

## Usage

```
skill:scaffold-service
```

## Input

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| serviceName | ✅ | 서비스명 (예: payment) |
| serviceCode | ✅ | 2글자 코드 (예: PM) |
| port | ❌ | 포트 번호 (기본: 3000) |
| withWorker | ❌ | 워커 포함 여부 (기본: false) |

## Output

```text
ms-{serviceName}/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health/
│   │   │   │   └── route.ts
│   │   │   └── v1/
│   │   │       └── {domain}/
│   │   │           └── route.ts
│   │   └── layout.tsx
│   ├── services/
│   │   └── {domain}.service.ts
│   ├── repositories/
│   │   └── {domain}.repository.ts
│   ├── adapters/
│   ├── workers/          # withWorker=true
│   │   └── job.worker.ts
│   ├── libs/
│   │   └── database.ts
│   └── types/
│       └── index.ts
├── prisma/
│   └── schema.prisma
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Generated Files

### package.json

```json
{
  "name": "ms-{serviceName}",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev -p {port}",
    "build": "next build",
    "start": "next start -p {port}",
    "worker": "ts-node src/workers/job.worker.ts",
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "next": "^14.0.0",
    "@prisma/client": "^5.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.0.0"
  }
}
```

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

// Add your models here with:
// @@schema("{serviceName}")
// @@map("{serviceCode}_{table_name}")
```

### src/app/api/health/route.ts

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'ms-{serviceName}',
    version: '0.1.0',
    timestamp: new Date().toISOString()
  });
}
```

### .env.example

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/db?schema={serviceName}"

# Service
PORT={port}
NODE_ENV=development

# Worker (if withWorker=true)
JOB_POLL_INTERVAL=1000
JOB_BATCH_SIZE=10
JOB_MAX_RETRIES=3
WORKER_CONCURRENCY=5
```

## Reference

- [마이크로서비스 규약](../../sax-core/_shared/microservice-conventions.md)

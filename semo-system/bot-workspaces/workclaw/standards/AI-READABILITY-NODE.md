# AI Readability 코드 표준 (Node.js 백엔드)

> Node.js + Express/NestJS 백엔드 프로젝트 특화 규칙

**[← Core 규칙 보기](./AI-READABILITY.md)**

---

## 1. Import 순서

ESLint `import/order`로 자동 강제:

```typescript
// 1. Node.js 내장 모듈
import { promises as fs } from 'fs';
import path from 'path';

// 2. 외부 라이브러리
import express from 'express';
import { Router } from 'express';

// 3. 내부 절대경로 (@/)
import { UserService } from '@/services/user.service';
import { logger } from '@/utils/logger';

// 4. 타입 import
import type { Request, Response } from 'express';

// 5. 상대경로
import { validateEmail } from './validators';
```

---

## 2. 파일 분리 패턴

### 2-1. Layered Architecture

```
src/
├── controllers/
│   └── user.controller.ts     # 요청/응답 처리
├── services/
│   └── user.service.ts        # 비즈니스 로직
├── repositories/
│   └── user.repository.ts     # DB 접근
├── middlewares/
│   └── auth.middleware.ts     # 인증/인가
├── routes/
│   └── user.routes.ts         # 라우트 정의
├── types/
│   └── user.types.ts          # 타입 정의
└── utils/
    └── validators.ts          # 유틸리티
```

### 2-2. 각 레이어 역할

**Controller** (요청/응답):
- HTTP 요청 파싱
- 응답 반환
- 에러 핸들링

**Service** (비즈니스 로직):
- 비즈니스 규칙 구현
- 트랜잭션 관리
- 여러 Repository 조합

**Repository** (데이터 접근):
- DB 쿼리
- 데이터 변환
- 캐싱

---

## 3. Controller 구조

```typescript
/**
 * @module UserController
 * @description 사용자 관련 HTTP 요청 처리
 * @dependencies UserService, AuthMiddleware
 * @routes
 *  - POST /users - 사용자 생성
 *  - GET /users/:id - 사용자 조회
 *  - PUT /users/:id - 사용자 수정
 *  - DELETE /users/:id - 사용자 삭제
 */

// ═══════════════════════════════════════
// Imports
// ═══════════════════════════════════════
import type { Request, Response, NextFunction } from 'express';
import { UserService } from '@/services/user.service';
import { logger } from '@/utils/logger';

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════
interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}

// ═══════════════════════════════════════
// Controller Class
// ═══════════════════════════════════════
export class UserController {
  constructor(private userService: UserService) {}

  /**
   * @route POST /users
   * @description 새 사용자 생성
   * @business-rules
   *  - 이메일 중복 불가
   *  - 비밀번호 최소 8자
   */
  // @calls UserService.createUser()
  // @returns 201 Created | 400 Bad Request | 409 Conflict
  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name } = req.body as CreateUserRequest;
      
      const user = await this.userService.createUser({ email, password, name });
      
      return res.status(201).json({ data: user });
    } catch (error) {
      next(error);
    }
  };

  // ... 다른 메서드
}
```

---

## 4. Service 구조

```typescript
/**
 * @module UserService
 * @description 사용자 비즈니스 로직
 * @dependencies UserRepository, EmailService
 * @business-rules
 *  - 이메일 중복 검증
 *  - 비밀번호 해싱 (bcrypt)
 *  - 회원가입 시 환영 이메일 전송
 */

// ═══════════════════════════════════════
// Imports
// ═══════════════════════════════════════
import bcrypt from 'bcrypt';
import { UserRepository } from '@/repositories/user.repository';
import { EmailService } from '@/services/email.service';
import type { CreateUserDto, User } from '@/types/user.types';

// ═══════════════════════════════════════
// Service Class
// ═══════════════════════════════════════
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService
  ) {}

  /**
   * @description 새 사용자 생성
   * @throws {ConflictError} 이메일 중복
   * @throws {ValidationError} 비밀번호 규칙 위반
   */
  // @calls UserRepository.findByEmail(), UserRepository.create()
  // @calls EmailService.sendWelcome()
  async createUser(dto: CreateUserDto): Promise<User> {
    // ═══════════════════════════════════════
    // Validation
    // ═══════════════════════════════════════
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictError('이메일이 이미 사용 중입니다');
    }

    if (dto.password.length < 8) {
      throw new ValidationError('비밀번호는 최소 8자 이상이어야 합니다');
    }

    // ═══════════════════════════════════════
    // Business Logic
    // ═══════════════════════════════════════
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    
    const user = await this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });

    // ═══════════════════════════════════════
    // Side Effects
    // ═══════════════════════════════════════
    await this.emailService.sendWelcome(user.email);

    return user;
  }
}
```

---

## 5. Repository 구조

```typescript
/**
 * @module UserRepository
 * @description 사용자 데이터 접근 계층
 * @dependencies Prisma Client
 * @data-source PostgreSQL
 */

// ═══════════════════════════════════════
// Imports
// ═══════════════════════════════════════
import { PrismaClient } from '@prisma/client';
import type { User, CreateUserData } from '@/types/user.types';

// ═══════════════════════════════════════
// Repository Class
// ═══════════════════════════════════════
export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * @description 이메일로 사용자 조회
   * @returns User | null
   */
  // @query SELECT * FROM users WHERE email = ?
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * @description 새 사용자 생성
   * @returns User
   */
  // @query INSERT INTO users (email, password, name) VALUES (?, ?, ?)
  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }
}
```

---

## 6. 비동기 에러 핸들링

### 6-1. Custom Error Classes

```typescript
// utils/errors.ts
/**
 * @module CustomErrors
 * @description HTTP 에러 클래스 정의
 */

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}
```

### 6-2. Global Error Middleware

```typescript
// middlewares/error.middleware.ts
/**
 * @module ErrorMiddleware
 * @description 전역 에러 핸들러
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // ═══════════════════════════════════════
  // Operational Error (예상된 에러)
  // ═══════════════════════════════════════
  if (err instanceof AppError) {
    logger.warn(`Operational Error: ${err.message}`, { statusCode: err.statusCode });
    
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // ═══════════════════════════════════════
  // Programming Error (예상치 못한 에러)
  // ═══════════════════════════════════════
  logger.error('Programming Error:', err);
  
  return res.status(500).json({
    status: 'error',
    message: 'Internal Server Error',
  });
};
```

---

## 7. 환경변수 관리

### 7-1. .env.example

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/db

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# External Services
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

### 7-2. Config Module

```typescript
/**
 * @module Config
 * @description 환경변수 관리 및 검증
 */

// ═══════════════════════════════════════
// Imports
// ═══════════════════════════════════════
import dotenv from 'dotenv';

dotenv.config();

// ═══════════════════════════════════════
// Validation
// ═══════════════════════════════════════
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// ═══════════════════════════════════════
// Config Object
// ═══════════════════════════════════════
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL!,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
  },
} as const;
```

---

## 8. Middleware 패턴

### 8-1. 인증 Middleware

```typescript
/**
 * @module AuthMiddleware
 * @description JWT 인증 미들웨어
 * @dependencies jsonwebtoken
 */

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from '@/config';
import { UnauthorizedError } from '@/utils/errors';

interface JwtPayload {
  userId: string;
  email: string;
}

// Request 타입 확장
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * @description JWT 토큰 검증
 * @throws {UnauthorizedError} 토큰 없음 또는 유효하지 않음
 */
// @called-by Protected Routes
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // ═══════════════════════════════════════
  // Extract Token
  // ═══════════════════════════════════════
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('토큰이 제공되지 않았습니다');
  }

  const token = authHeader.substring(7);

  // ═══════════════════════════════════════
  // Verify Token
  // ═══════════════════════════════════════
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = payload;
    next();
  } catch (error) {
    throw new UnauthorizedError('유효하지 않은 토큰입니다');
  }
};
```

---

## 9. Relationship Markers (Node.js 특화)

```typescript
/**
 * @async-flow
 *  1. Controller.createUser() 진입
 *  2. Service.createUser() 호출
 *  3. Repository.findByEmail() - DB 조회
 *  4. Repository.create() - DB 삽입
 *  5. EmailService.sendWelcome() - 비동기 이메일 전송
 *  6. Controller → 201 Created 응답
 */

// @relates-to UserService.createUser()
// @async-depends-on UserRepository.create(), EmailService.sendWelcome()
export const createUser = async (req: Request, res: Response) => {
  // ...
};
```

---

## 10. ESLint 설정 (Node.js 특화)

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:node/recommended"
  ],
  "rules": {
    // Node.js
    "node/no-unsupported-features/es-syntax": "off",
    "node/no-missing-import": "off",
    "node/no-unpublished-import": "off",
    
    // 비동기
    "require-await": "warn",
    "no-return-await": "error",
    
    // Import 순서
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
      "pathGroups": [
        { "pattern": "@/**", "group": "internal" }
      ],
      "alphabetize": { "order": "asc" }
    }]
  }
}
```

---

## 11. Context Headers (Node.js 특화)

```typescript
/**
 * @module PaymentService
 * @description 결제 처리 비즈니스 로직
 * @dependencies PaymentRepository, TossPaymentsAPI, TransactionService
 * @business-rules
 *  - 결제 금액은 1,000원 이상
 *  - 결제 실패 시 자동 롤백
 *  - 결제 성공 시 영수증 이메일 전송
 * @external-apis
 *  - TossPayments: 결제 승인/취소
 * @transactions
 *  - 결제 생성 + 유저 포인트 차감 (원자성 보장)
 * @error-handling
 *  - PaymentFailedError: 결제 게이트웨이 실패
 *  - InsufficientFundsError: 잔액 부족
 * @performance
 *  - 결제 이력 조회: Redis 캐싱 (TTL 5분)
 */
```

---

## 12. 체크리스트 (Node.js 추가)

Core 체크리스트에 추가:

- [ ] Controller/Service/Repository 레이어가 명확히 분리되었는가?
- [ ] 비동기 함수에 적절한 에러 핸들링이 있는가?
- [ ] 환경변수가 config 모듈로 관리되는가?
- [ ] Custom Error 클래스를 사용하는가?
- [ ] Middleware에 타입 정의가 있는가?
- [ ] 비동기 관계가 `@async-flow` 주석으로 명시되었는가?

---

## 참고 자료

- [Node.js 공식 문서](https://nodejs.org/docs/)
- [Express.js 공식 문서](https://expressjs.com/)
- [NestJS 공식 문서](https://nestjs.com/)
- [Prisma 공식 문서](https://www.prisma.io/docs)

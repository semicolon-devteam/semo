# Dockerfile Patterns

## Next.js (Multi-stage)

```dockerfile
# Dockerfile-next
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN corepack enable pnpm && pnpm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

---

## Spring Boot (Gradle)

```dockerfile
# Dockerfile-gradle
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /app

COPY gradle gradle
COPY gradlew build.gradle.kts settings.gradle.kts ./
COPY src src

RUN chmod +x gradlew
RUN ./gradlew bootJar --no-daemon

# Runtime stage
FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

## Go Service

```dockerfile
# Dockerfile-go
FROM golang:1.21-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Runtime stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/main .

EXPOSE 8080

CMD ["./main"]
```

---

## Node.js Microservice

```dockerfile
# Dockerfile-media (or similar)
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health')"

CMD ["node", "src/index.js"]
```

---

## 최적화 팁

### Layer Caching

```dockerfile
# 의존성 파일 먼저 복사
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# 소스 코드는 나중에
COPY . .
```

### Multi-stage Benefits

1. **빌드 도구 제외**: 런타임 이미지에 빌드 도구 없음
2. **이미지 크기 감소**: 필요한 파일만 포함
3. **보안 향상**: 소스 코드 및 빌드 시크릿 제외

### Alpine 사용

```dockerfile
# 기본 이미지 대신 Alpine
FROM node:22-alpine  # ~120MB
# vs
FROM node:22         # ~1GB
```

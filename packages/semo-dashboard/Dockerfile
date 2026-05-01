# SEMO Dashboard Dockerfile
# Multi-stage build for Next.js 14 (App Router)

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files (monorepo workspace - no package-lock.json)
COPY package.json ./
RUN npm install --production=false

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Dummy DATABASE_URL for build time (not used at runtime)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# Supabase Auth (public keys — baked into client bundle at build time)
ENV NEXT_PUBLIC_SUPABASE_URL=https://zorienqtiaxyuozhxwdj.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcmllbnF0aWF4eXVvemh4d2RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNDA3NzQsImV4cCI6MjA3NzgxNjc3NH0.fMA5B94OwPqUP9aVop1RQZEFFsiFDiirLHOtxLwHFpk
# Voice signaling server URL
ENV NEXT_PUBLIC_VOICE_SIGNALING_URL=wss://voice.semi-colon.space/signal
# SSO cookie domain (parent-domain 쿠키로 introduction 과 세션 공유)
# dev/prd 분리를 위해 빌드타임 ARG로 주입 (CI에서 --build-arg로 전달)
ARG NEXT_PUBLIC_COOKIE_DOMAIN=.semi-colon.space
ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN
# Web Push VAPID public key (클라이언트 번들에 인라인됨)
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

# Build Next.js app (standalone output)
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy .env.production for runtime server-side env vars (OPENAI_API_KEY etc.)
COPY --from=builder --chown=nextjs:nodejs /app/.env.production* ./

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

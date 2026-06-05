# kb-gateway Dockerfile — SemiColony 멀티테넌트 KB 게이트웨이
#
# ⚠️ 빌드 컨텍스트 = 모노레포 루트 (워크스페이스 의존 @team-semicolon/semo-{common,kb-core,kb-pg} 가
#    미발행이라 패키지 단독 빌드 불가):
#    docker build -f packages/kb-gateway/Dockerfile -t semicolonmanager/kb-gateway:dev .
#
# 외부 Colony 노출용. TLS 종단은 ingress/reverse-proxy (컨테이너는 평문 0.0.0.0:18810).

# ── Stage 1: deps (워크스페이스 설치) ───────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# manifest 먼저 복사해 레이어 캐시 극대화
COPY package.json package-lock.json* ./
COPY packages/kb-gateway/package.json packages/kb-gateway/
COPY packages/common/package.json     packages/common/
COPY packages/kb-core/package.json    packages/kb-core/
COPY packages/kb-pg/package.json      packages/kb-pg/

# kb-gateway 와 그 워크스페이스 의존만 설치 (루트 포함)
RUN npm install --no-audit --no-fund \
    --workspace=@team-semicolon/semo-kb-gateway \
    --workspace=@team-semicolon/semo-common \
    --workspace=@team-semicolon/semo-kb-core \
    --workspace=@team-semicolon/semo-kb-pg \
    --include-workspace-root

# ── Stage 2: runner ────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# tsx 런타임 (소스 TS 직접 실행 — 레포 표준)
RUN npm install -g tsx@4

RUN addgroup --system --gid 1110 kbgw \
    && adduser --system --uid 1110 --ingroup kbgw kbgw

COPY --from=deps --chown=kbgw:kbgw /app/node_modules ./node_modules
COPY --chown=kbgw:kbgw package.json ./
COPY --chown=kbgw:kbgw packages/kb-gateway packages/kb-gateway
COPY --chown=kbgw:kbgw packages/common     packages/common
COPY --chown=kbgw:kbgw packages/kb-core    packages/kb-core
COPY --chown=kbgw:kbgw packages/kb-pg      packages/kb-pg

USER kbgw
EXPOSE 18810
ENV KB_GATEWAY_HOST=0.0.0.0
ENV KB_GATEWAY_PORT=18810

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://localhost:18810/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["tsx", "packages/kb-gateway/src/server.ts"]

# semo-call Dockerfile (구 channel-voice)
# @roamhq/wrtc requires glibc → debian (not alpine)

# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

# Stage 2: Runner
FROM node:20-slim AS runner
WORKDIR /app

# ffmpeg: TTS MP3 → PCM conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1100 semovoice \
    && adduser --system --uid 1100 --ingroup semovoice semovoice

COPY --from=deps --chown=semovoice:semovoice /app/node_modules ./node_modules
COPY --chown=semovoice:semovoice package.json ./
COPY --chown=semovoice:semovoice src/ ./src/

USER semovoice

EXPOSE 8922

ENV NODE_ENV=production
ENV VOICE_MODE=webrtc
ENV VOICE_STT_PROVIDER=deepgram
ENV VOICE_TTS_PROVIDER=edge
ENV VOICE_SIGNALING_PORT=8922

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://localhost:8922/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "src/index.ts"]

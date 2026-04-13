# semo-meeting — STT microservice (faster-whisper + pyannote)
# GPU: NVIDIA CUDA 12.1 base for A10 deployment
# Models embedded at build time (~5GB total image)

# Stage 1: Dependencies + model download
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3-pip ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && ln -sf /usr/bin/python3.11 /usr/bin/python

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

# Pre-download models at build time (ARG only — not persisted in runtime image)
ARG HF_TOKEN

RUN python3 -c "\
from faster_whisper import WhisperModel; \
WhisperModel('large-v3', device='cpu', compute_type='int8')"

RUN --mount=type=secret,id=hf_token \
    HF_TOKEN=$(cat /run/secrets/hf_token 2>/dev/null || echo "${HF_TOKEN}") && \
    python3 -c "\
import os, torch; \
_orig = torch.load; \
def _patched(*a, **kw): kw['weights_only'] = False; return _orig(*a, **kw); \
torch.load = _patched; \
from pyannote.audio import Pipeline; \
Pipeline.from_pretrained('pyannote/speaker-diarization-3.1', use_auth_token='${HF_TOKEN}')"

# Stage 2: Runtime (clean — no HF_TOKEN, no build tools)
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04 AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && ln -sf /usr/bin/python3.11 /usr/bin/python

WORKDIR /app

RUN groupadd --system --gid 1001 semo \
    && useradd --system --uid 1001 --gid semo --create-home semo

# Copy pip-installed packages
COPY --from=builder /usr/local/lib/python3.11/dist-packages /usr/local/lib/python3.11/dist-packages
COPY --from=builder /usr/lib/python3/dist-packages /usr/lib/python3/dist-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

# Copy pre-downloaded models
COPY --from=builder /root/.cache/huggingface /home/semo/.cache/huggingface
RUN chown -R semo:semo /home/semo/.cache

COPY --chown=semo:semo main.py worker.py ./

USER semo

EXPOSE 8910

ENV PYTHONUNBUFFERED=1
ENV HOME=/home/semo

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8910/health')"

CMD ["python3", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8910"]

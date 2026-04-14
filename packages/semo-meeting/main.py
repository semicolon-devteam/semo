"""
semo-meeting — Self-hosted STT microservice (faster-whisper + pyannote)

POST /transcribe  — multipart audio upload → job_id (background processing)
GET  /status/{id} — poll job status → { id, status, utterances? }
GET  /health      — service health check
"""

from __future__ import annotations

import json
import logging
import os
import urllib.request
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from enum import Enum
from threading import Thread
from typing import Any, Dict

from fastapi import FastAPI, File, Form, HTTPException, Security, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("semo-meeting")

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
STT_API_KEY = os.environ.get("STT_API_KEY", "")
security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    if not STT_API_KEY:
        return "no-auth"
    if credentials.credentials != STT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return credentials.credentials


# ---------------------------------------------------------------------------
# Job store (in-memory, single instance)
# ---------------------------------------------------------------------------
class JobStatus(str, Enum):
    transcribing = "transcribing"
    completed = "completed"
    failed = "failed"


jobs: dict[str, dict[str, Any]] = {}

# Stats
stats = {"total_jobs": 0, "total_duration_ms": 0, "started_at": None}

MAX_JOB_AGE = timedelta(minutes=30)


def _cleanup_jobs() -> None:
    now = datetime.now(timezone.utc)
    expired = [
        k for k, v in jobs.items()
        if now - datetime.fromisoformat(v["created_at"]) > MAX_JOB_AGE
    ]
    for k in expired:
        del jobs[k]
    if expired:
        logger.info("Cleaned up %d expired jobs", len(expired))


def _send_callback(callback_url: str, payload: dict) -> None:
    try:
        body = json.dumps(payload).encode()
        req = urllib.request.Request(
            callback_url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {STT_API_KEY}",
            },
        )
        urllib.request.urlopen(req, timeout=10)
        logger.info("Callback sent to %s", callback_url)
    except Exception as e:
        logger.warning("Callback failed (%s): %s", callback_url, e)


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------
def _run_job(job_id: str, audio_bytes: bytes, filename: str, callback_url: str | None = None) -> None:
    """Run STT pipeline in background thread."""
    from worker import process_audio

    try:
        logger.info("Job %s: starting processing (%s, %d bytes)", job_id, filename, len(audio_bytes))
        utterances = process_audio(audio_bytes, filename)

        # Calculate total duration from utterances
        if utterances:
            last = utterances[-1]
            total_ms = last["start_at"] + last["duration"]
            stats["total_duration_ms"] += total_ms

        jobs[job_id]["status"] = JobStatus.completed
        jobs[job_id]["utterances"] = utterances
        jobs[job_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("Job %s: completed with %d utterances", job_id, len(utterances))

        if callback_url:
            _send_callback(callback_url, {
                "job_id": job_id,
                "status": "completed",
                "utterances": utterances,
            })
    except Exception as e:
        logger.error("Job %s: failed — %s", job_id, e, exc_info=True)
        jobs[job_id]["status"] = JobStatus.failed
        jobs[job_id]["error"] = str(e)

        if callback_url:
            _send_callback(callback_url, {
                "job_id": job_id,
                "status": "failed",
                "error": str(e),
            })


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(_app: FastAPI):
    stats["started_at"] = datetime.now(timezone.utc).isoformat()
    logger.info("semo-meeting starting up...")
    yield
    logger.info("semo-meeting shutting down...")


app = FastAPI(title="semo-meeting", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "started_at": stats["started_at"],
        "total_jobs": stats["total_jobs"],
        "total_duration_ms": stats["total_duration_ms"],
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    callback_url: str | None = Form(default=None),
    _token: str = Security(verify_token),
):
    """Accept audio file, start background transcription, return job ID."""
    _cleanup_jobs()

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "id": job_id,
        "status": JobStatus.transcribing,
        "filename": file.filename or "audio",
        "size": len(audio_bytes),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    stats["total_jobs"] += 1

    thread = Thread(
        target=_run_job,
        args=(job_id, audio_bytes, file.filename or "audio", callback_url),
        daemon=True,
    )
    thread.start()

    return {"id": job_id}


@app.get("/status/{job_id}")
async def status(
    job_id: str,
    _token: str = Security(verify_token),
):
    """Poll transcription job status."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    result: dict[str, Any] = {
        "id": job["id"],
        "status": job["status"],
    }

    if job["status"] == JobStatus.completed:
        result["utterances"] = job.get("utterances", [])

    if job["status"] == JobStatus.failed:
        result["error"] = job.get("error", "Unknown error")

    return result

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
from pathlib import Path
from threading import Lock, Thread
from typing import Any, Dict

from dotenv import load_dotenv

# Load .env sitting next to this file before any os.environ reads.
load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, File, Form, HTTPException, Security, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from corrector import correct_utterances

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
# Job store (single-process in-memory with optional disk fallback)
# ---------------------------------------------------------------------------
class JobStatus(str, Enum):
    transcribing = "transcribing"
    completed = "completed"
    failed = "failed"


jobs: dict[str, dict[str, Any]] = {}
_JOB_LOCK = Lock()

# Stats
stats = {"total_jobs": 0, "total_duration_ms": 0, "started_at": None}

MAX_JOB_AGE = timedelta(minutes=30)
_JOB_DIR = Path(__file__).resolve().parent / ".job-store"


def _job_path(job_id: str) -> Path:
    return _JOB_DIR / f"{job_id}.json"


def _safe_iso_to_dt(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return datetime.now(timezone.utc)


def _is_job_expired(created_at: str | None) -> bool:
    created = _safe_iso_to_dt(created_at)
    return datetime.now(timezone.utc) - created > MAX_JOB_AGE


def _serialize_job(job: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(job)
    status = normalized.get("status")
    if isinstance(status, JobStatus):
        normalized["status"] = status.value
    return normalized


def _load_job_store() -> None:
    if not _JOB_DIR.exists():
        return

    for path in _JOB_DIR.glob("*.json"):
        job_id = path.stem
        try:
            with path.open("r", encoding="utf-8") as f:
                payload = json.load(f)
            if not isinstance(payload, dict):
                raise ValueError("invalid payload")

            created_at = payload.get("created_at")
            if _is_job_expired(created_at):
                path.unlink(missing_ok=True)
                continue

            # Any in-flight job is not recoverable across restart.
            if payload.get("status") == JobStatus.transcribing.value:
                payload["status"] = JobStatus.failed.value
                payload["error"] = "Server restarted while job was in progress. Please re-upload."

            jobs[job_id] = payload
        except Exception as e:
            logger.warning("Failed to restore job %s: %s", job_id, e)
            path.unlink(missing_ok=True)


def _save_job(job_id: str) -> None:
    _JOB_DIR.mkdir(parents=True, exist_ok=True)
    try:
        with _job_path(job_id).open("w", encoding="utf-8") as f:
            json.dump(_serialize_job(jobs[job_id]), f, ensure_ascii=False)
    except Exception as e:
        logger.warning("Failed to persist job %s: %s", job_id, e)


def _cleanup_jobs() -> None:
    now = datetime.now(timezone.utc)
    with _JOB_LOCK:
        expired = [
            k for k, v in jobs.items()
            if now - _safe_iso_to_dt(v.get("created_at")) > MAX_JOB_AGE
        ]
        for k in expired:
            del jobs[k]
            _job_path(k).unlink(missing_ok=True)
    if expired:
        logger.info("Cleaned up %d expired jobs", len(expired))


def _get_job(job_id: str) -> dict[str, Any] | None:
    with _JOB_LOCK:
        job = jobs.get(job_id)
        if job:
            return job

    path = _job_path(job_id)
    if not path.exists():
        return None

    try:
        with path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
    except Exception:
        path.unlink(missing_ok=True)
        return None

    with _JOB_LOCK:
        jobs[job_id] = payload
    return payload


def _delete_job(job_id: str) -> None:
    with _JOB_LOCK:
        jobs.pop(job_id, None)
    _job_path(job_id).unlink(missing_ok=True)


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
def _run_job(
    job_id: str,
    audio_bytes: bytes,
    filename: str,
    callback_url: str | None = None,
    initial_prompt: str | None = None,
    replacements: dict[str, str] | None = None,
    fuzzy_entities: list[str] | None = None,
    fuzzy_threshold: float = 0.75,
) -> None:
    """Run STT pipeline in background thread."""
    from worker import process_audio

    try:
        logger.info("Job %s: starting processing (%s, %d bytes)", job_id, filename, len(audio_bytes))
        utterances = process_audio(audio_bytes, filename, initial_prompt=initial_prompt)

        # Calculate total duration from utterances (pre-correction)
        if utterances:
            last = utterances[-1]
            total_ms = last["start_at"] + last["duration"]
            stats["total_duration_ms"] += total_ms

        # Post-hoc correction (KB entity dict + fuzzy match)
        corrections_log: list[dict] = []
        if replacements or fuzzy_entities:
            utterances, corrections_log = correct_utterances(
                utterances,
                replacements=replacements,
                fuzzy_entities=fuzzy_entities,
                fuzzy_threshold=fuzzy_threshold,
            )
            logger.info("Job %s: applied %d corrections", job_id, len(corrections_log))

        with _JOB_LOCK:
            jobs[job_id]["status"] = JobStatus.completed.value
            jobs[job_id]["utterances"] = utterances
            jobs[job_id]["corrections"] = corrections_log
            jobs[job_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
        _save_job(job_id)
        logger.info("Job %s: completed with %d utterances", job_id, len(utterances))

        if callback_url:
            _send_callback(callback_url, {
                "job_id": job_id,
                "status": "completed",
                "utterances": utterances,
                "corrections": corrections_log,
            })
    except Exception as e:
        logger.error("Job %s: failed — %s", job_id, e, exc_info=True)
        with _JOB_LOCK:
            jobs[job_id]["status"] = JobStatus.failed.value
            jobs[job_id]["error"] = str(e)
        _save_job(job_id)

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
    _load_job_store()
    logger.info("semo-meeting starting up...")
    yield
    logger.info("semo-meeting shutting down...")
    _cleanup_jobs()



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
    initial_prompt: str | None = Form(default=None),
    replacements: str | None = Form(default=None),
    fuzzy_entities: str | None = Form(default=None),
    fuzzy_threshold: float = Form(default=0.75),
    _token: str = Security(verify_token),
):
    """Accept audio file, start background transcription, return job ID.

    `initial_prompt` biases Whisper toward expected vocabulary.
    `replacements` (JSON object) and `fuzzy_entities` (JSON array of strings)
    drive post-hoc correction — see `corrector.py`.
    """
    _cleanup_jobs()

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        replacements_dict = json.loads(replacements) if replacements else None
        if replacements_dict is not None and not isinstance(replacements_dict, dict):
            raise ValueError("replacements must be a JSON object")
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid replacements: {e}")

    try:
        fuzzy_list = json.loads(fuzzy_entities) if fuzzy_entities else None
        if fuzzy_list is not None and not isinstance(fuzzy_list, list):
            raise ValueError("fuzzy_entities must be a JSON array")
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid fuzzy_entities: {e}")

    job_id = str(uuid.uuid4())
    with _JOB_LOCK:
        jobs[job_id] = {
            "id": job_id,
            "status": JobStatus.transcribing.value,
            "filename": file.filename or "audio",
            "size": len(audio_bytes),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _save_job(job_id)
    stats["total_jobs"] += 1

    thread = Thread(
        target=_run_job,
        args=(
            job_id,
            audio_bytes,
            file.filename or "audio",
            callback_url,
            initial_prompt,
            replacements_dict,
            fuzzy_list,
            fuzzy_threshold,
        ),
        daemon=True,
    )
    thread.start()

    return {"id": job_id}


class CorrectionRequest(BaseModel):
    utterances: list[dict]
    replacements: dict[str, str] = Field(default_factory=dict)
    fuzzy_entities: list[str] = Field(default_factory=list)
    fuzzy_threshold: float = 0.75


@app.post("/correct")
async def correct(
    payload: CorrectionRequest,
    _token: str = Security(verify_token),
):
    """Apply post-hoc correction to a pre-existing utterances list.

    Useful when STT came from Clova/Vito (not semo-meeting), or to re-correct
    with updated KB entity dict.
    """
    corrected, log = correct_utterances(
        payload.utterances,
        replacements=payload.replacements or None,
        fuzzy_entities=payload.fuzzy_entities or None,
        fuzzy_threshold=payload.fuzzy_threshold,
    )
    return {"utterances": corrected, "corrections": log}


@app.get("/status/{job_id}")
async def status(
    job_id: str,
    _token: str = Security(verify_token),
):
    """Poll transcription job status."""
    job = _get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    result: dict[str, Any] = {
        "id": job["id"],
        "status": job["status"],
    }

    if job["status"] == JobStatus.completed.value:
        result["utterances"] = job.get("utterances", [])
        result["corrections"] = job.get("corrections", [])

    if job["status"] == JobStatus.failed.value:
        result["error"] = job.get("error", "Unknown error")

    return result

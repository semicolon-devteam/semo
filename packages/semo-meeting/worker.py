"""
STT Worker — faster-whisper + pyannote-audio pipeline

Converts audio → WAV 16kHz mono → Whisper transcription → pyannote diarization
→ merged utterances with speaker labels.
"""

from __future__ import annotations

import os
import tempfile
import logging
from pathlib import Path
from typing import Dict, List, Optional

import ffmpeg
import torch

# PyTorch 2.6+ defaults weights_only=True, and lightning_fabric also passes it
# explicitly. pyannote models are trusted HuggingFace checkpoints — force False.
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs["weights_only"] = False
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load

from faster_whisper import WhisperModel
from pyannote.audio import Pipeline as DiarizationPipeline

logger = logging.getLogger("semo-meeting.worker")

# Detect device: MPS (Apple Silicon) > CUDA > CPU
def _detect_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"

DEVICE = _detect_device()
# faster-whisper compute type: float16 for GPU, int8 for CPU
COMPUTE_TYPE = "int8" if DEVICE == "cpu" else "float16"

logger.info("Device: %s, compute_type: %s", DEVICE, COMPUTE_TYPE)

# Lazy-loaded models
_whisper_model: WhisperModel | None = None
_diarization_pipeline: DiarizationPipeline | None = None


def _get_whisper() -> WhisperModel:
    global _whisper_model
    if _whisper_model is None:
        logger.info("Loading faster-whisper large-v3 (device=%s, compute=%s)...", DEVICE, COMPUTE_TYPE)
        # faster-whisper uses ctranslate2; for MPS we fall back to cpu with int8
        # since ctranslate2 doesn't support MPS directly
        ct2_device = "cuda" if DEVICE == "cuda" else "cpu"
        ct2_compute = COMPUTE_TYPE if ct2_device == "cuda" else "int8"
        _whisper_model = WhisperModel(
            "large-v3",
            device=ct2_device,
            compute_type=ct2_compute,
        )
        logger.info("Whisper model loaded.")
    return _whisper_model


def _get_diarization() -> DiarizationPipeline:
    global _diarization_pipeline
    if _diarization_pipeline is None:
        hf_token = os.environ.get("HF_TOKEN")
        if not hf_token:
            raise RuntimeError("HF_TOKEN env var required for pyannote model access")
        logger.info("Loading pyannote speaker-diarization-3.1 (device=%s)...", DEVICE)
        _diarization_pipeline = DiarizationPipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token,
        )
        # Move to device (MPS or CUDA)
        if DEVICE != "cpu":
            _diarization_pipeline.to(torch.device(DEVICE))
        logger.info("Diarization pipeline loaded.")
    return _diarization_pipeline


def convert_to_wav(input_path: str, output_path: str) -> None:
    """Convert any audio to WAV 16kHz mono via ffmpeg."""
    (
        ffmpeg
        .input(input_path)
        .output(output_path, ar=16000, ac=1, format="wav")
        .overwrite_output()
        .run(quiet=True)
    )


def transcribe_audio(wav_path: str, initial_prompt: str | None = None) -> list[dict]:
    """Run faster-whisper on WAV, return segments with word timestamps.

    `initial_prompt` biases Whisper toward provided vocabulary — pass a
    comma-separated list of expected proper nouns (service names, members,
    brands) to reduce mistranscription of domain-specific terms.
    """
    model = _get_whisper()
    segments, _info = model.transcribe(
        wav_path,
        language="ko",
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        initial_prompt=initial_prompt or None,
    )
    result = []
    for seg in segments:
        result.append({
            "start": seg.start,
            "end": seg.end,
            "text": seg.text.strip(),
            "words": [
                {"start": w.start, "end": w.end, "word": w.word}
                for w in (seg.words or [])
            ],
        })
    return result


def diarize_audio(wav_path: str) -> list[dict]:
    """Run pyannote diarization, return speaker turns."""
    pipeline = _get_diarization()
    diarization = pipeline(wav_path)
    turns = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        turns.append({
            "start": turn.start,
            "end": turn.end,
            "speaker": speaker,
        })
    return turns


def _speaker_label_to_int(label: str) -> int:
    """Convert pyannote speaker label (e.g. 'SPEAKER_01') to int."""
    try:
        return int(label.split("_")[-1])
    except (ValueError, IndexError):
        return hash(label) % 100


def merge_transcription_and_diarization(
    segments: list[dict],
    turns: list[dict],
) -> list[dict]:
    """
    Match Whisper segments to pyannote speaker turns by time overlap.
    Returns VitoUtterance-compatible list: { start_at, duration, msg, spk }
    """
    utterances = []
    for seg in segments:
        seg_start = seg["start"]
        seg_end = seg["end"]
        seg_mid = (seg_start + seg_end) / 2

        # Find the speaker turn with maximum overlap at segment midpoint
        best_speaker = "SPEAKER_00"
        best_overlap = 0.0
        for turn in turns:
            overlap_start = max(seg_start, turn["start"])
            overlap_end = min(seg_end, turn["end"])
            overlap = max(0, overlap_end - overlap_start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = turn["speaker"]
            # Also check if midpoint falls within turn
            if turn["start"] <= seg_mid <= turn["end"] and overlap >= best_overlap:
                best_speaker = turn["speaker"]
                break

        utterances.append({
            "start_at": int(seg_start * 1000),  # ms
            "duration": int((seg_end - seg_start) * 1000),  # ms
            "msg": seg["text"],
            "spk": _speaker_label_to_int(best_speaker),
        })

    return utterances


def process_audio(
    audio_bytes: bytes,
    filename: str,
    initial_prompt: str | None = None,
) -> list[dict]:
    """
    Full pipeline: audio bytes → WAV → Whisper + pyannote → utterances.
    Returns list of VitoUtterance-compatible dicts.

    `initial_prompt` is forwarded to Whisper to bias transcription toward
    domain-specific proper nouns (see transcribe_audio).
    """
    suffix = Path(filename).suffix or ".m4a"

    with tempfile.TemporaryDirectory(prefix="semo-meeting-") as tmpdir:
        input_path = os.path.join(tmpdir, f"input{suffix}")
        wav_path = os.path.join(tmpdir, "audio.wav")

        # Write input file
        with open(input_path, "wb") as f:
            f.write(audio_bytes)

        # Convert to WAV 16kHz mono
        logger.info("Converting %s to WAV...", filename)
        convert_to_wav(input_path, wav_path)

        # Run transcription and diarization
        if initial_prompt:
            logger.info("Running Whisper transcription (initial_prompt=%d chars)...", len(initial_prompt))
        else:
            logger.info("Running Whisper transcription...")
        segments = transcribe_audio(wav_path, initial_prompt=initial_prompt)
        logger.info("Got %d segments from Whisper", len(segments))

        logger.info("Running speaker diarization...")
        turns = diarize_audio(wav_path)
        logger.info("Got %d speaker turns", len(turns))

        # Merge
        utterances = merge_transcription_and_diarization(segments, turns)
        logger.info("Produced %d utterances", len(utterances))

        return utterances

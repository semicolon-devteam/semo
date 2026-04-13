"""Pre-download ML models at Docker build time."""
import os
import torch

# pyannote requires weights_only=False (torch 2.6+ defaults to True)
_orig_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

from faster_whisper import WhisperModel
WhisperModel('large-v3', device='cpu', compute_type='int8')

from pyannote.audio import Pipeline
Pipeline.from_pretrained(
    'pyannote/speaker-diarization-3.1',
    token=os.environ.get('HF_TOKEN', ''),
)

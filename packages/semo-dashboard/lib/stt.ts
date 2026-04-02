/**
 * Self-Hosted STT Client
 *
 * Calls semo-stt (faster-whisper + pyannote) FastAPI service.
 * Drop-in replacement for the former VITO API client — same exported types & functions.
 */

const STT_API_BASE = process.env.STT_API_URL || 'http://localhost:8910';
const STT_API_KEY = process.env.STT_API_KEY || '';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (STT_API_KEY) {
    headers['Authorization'] = `Bearer ${STT_API_KEY}`;
  }
  return headers;
}

// ── Types (backward-compatible with former Vito* types) ──────────────────

export interface VitoUtterance {
  start_at: number;   // ms
  duration: number;    // ms
  msg: string;
  spk: number;         // speaker index
  lang?: string;
}

export type VitoStatus = 'transcribing' | 'completed' | 'failed';

export interface VitoTranscribeResult {
  id: string;
  status: VitoStatus;
  utterances?: VitoUtterance[];
}

// ── Functions ────────────────────────────────────────────────────────────

/**
 * Submit audio for transcription. Returns job ID for polling.
 */
export async function transcribe(
  fileBuffer: Buffer,
  fileName: string,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(fileBuffer)]), fileName);

  const response = await fetch(`${STT_API_BASE}/transcribe`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`STT transcribe failed (${response.status}): ${text}`);
  }

  const data = await response.json() as { id: string };
  return data.id;
}

/**
 * Poll transcription status. Returns utterances when completed.
 */
export async function getTranscribeStatus(jobId: string): Promise<VitoTranscribeResult> {
  const response = await fetch(`${STT_API_BASE}/status/${jobId}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`STT status check failed (${response.status}): ${text}`);
  }

  const data = await response.json() as {
    id: string;
    status: VitoStatus;
    utterances?: VitoUtterance[];
  };

  return {
    id: data.id,
    status: data.status,
    utterances: data.utterances,
  };
}

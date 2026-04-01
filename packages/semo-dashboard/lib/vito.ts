/**
 * VITO Speech API Client
 *
 * ReturnZero VITO API for Korean speech-to-text with speaker diarization.
 * Docs: https://developers.rtzr.ai
 */

const VITO_API_BASE = 'https://openapi.vito.ai';

// In-memory token cache
let cachedToken: { jwt: string; expiresAt: number } | null = null;

function getCredentials() {
  const clientId = process.env.VITO_CLIENT_ID;
  const clientSecret = process.env.VITO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('VITO_CLIENT_ID and VITO_CLIENT_SECRET must be set');
  }
  return { clientId, clientSecret };
}

/**
 * Authenticate with VITO API. Caches JWT for reuse (valid 6 hours).
 */
export async function authenticate(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken.jwt;
  }

  const { clientId, clientSecret } = getCredentials();
  const response = await fetch(`${VITO_API_BASE}/v1/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VITO auth failed (${response.status}): ${text}`);
  }

  const data = await response.json() as { access_token: string; expire_at: number };
  cachedToken = { jwt: data.access_token, expiresAt: data.expire_at };
  return data.access_token;
}

export interface VitoTranscribeConfig {
  use_diarization?: boolean;
  diarization?: { spk_count: number };
  use_itn?: boolean;
  use_disfluency_filter?: boolean;
  use_paragraph_splitter?: boolean;
  paragraph_splitter?: { max: number };
  domain?: string;
}

const DEFAULT_CONFIG: VitoTranscribeConfig = {
  use_diarization: true,
  diarization: { spk_count: 0 }, // auto-detect speaker count
  use_itn: true,
  use_disfluency_filter: true,
  use_paragraph_splitter: true,
  paragraph_splitter: { max: 100 },
  domain: 'GENERAL',
};

/**
 * Submit audio for transcription. Returns transcribe ID for polling.
 */
export async function transcribe(
  fileBuffer: Buffer,
  fileName: string,
  config?: Partial<VitoTranscribeConfig>
): Promise<string> {
  const token = await authenticate();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(fileBuffer)]), fileName);
  formData.append('config', JSON.stringify(mergedConfig));

  const response = await fetch(`${VITO_API_BASE}/v1/transcribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VITO transcribe failed (${response.status}): ${text}`);
  }

  const data = await response.json() as { id: string };
  return data.id;
}

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

/**
 * Poll transcription status. Returns utterances when completed.
 */
export async function getTranscribeStatus(transcribeId: string): Promise<VitoTranscribeResult> {
  const token = await authenticate();

  const response = await fetch(`${VITO_API_BASE}/v1/transcribe/${transcribeId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VITO status check failed (${response.status}): ${text}`);
  }

  const data = await response.json() as {
    id: string;
    status: VitoStatus;
    results?: { utterances: VitoUtterance[] };
  };

  return {
    id: data.id,
    status: data.status,
    utterances: data.results?.utterances,
  };
}

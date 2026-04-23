import type {
  ExecutionTarget,
  TargetCapability,
  TargetConfig,
  TargetDispatchInput,
  TargetDispatchResult,
  TargetHealth,
  TargetKind,
  TargetMessage,
} from './types.js';
import { httpPostJson } from './http-helpers.js';

const DEFAULT_MODEL = 'gemini-1.5-pro';
const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: Array<{ text?: string }>; role?: string };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

const CAP: TargetCapability = {
  toolUse: true,
  streaming: false,
  maxContextTokens: 1_000_000,
  supportsEmbedding: false,
  supportsVision: true,
  costProfile: 'metered',
  offlineCapable: false,
};

export class GeminiTarget implements ExecutionTarget {
  readonly kind: TargetKind = 'gemini';
  readonly capability = CAP;

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(config: TargetConfig) {
    this.baseUrl = config.endpoint ?? DEFAULT_BASE;
    this.model = config.model ?? DEFAULT_MODEL;
    const key =
      (config.params?.apiKey as string | undefined) ??
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_API_KEY;
    if (!key) throw new Error('GeminiTarget: GEMINI_API_KEY (or GOOGLE_API_KEY) is required');
    this.apiKey = key;
  }

  async dispatch(input: TargetDispatchInput): Promise<TargetDispatchResult> {
    const started = Date.now();
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const body = {
      systemInstruction: input.systemPrompt
        ? { role: 'system', parts: [{ text: input.systemPrompt }] }
        : undefined,
      contents: toContents(input.messages),
    };
    const res = await httpPostJson<GeminiResponse>({ url, body });
    const latencyMs = Date.now() - started;
    const replyText = res.candidates?.[0]?.content.parts.map((p) => p.text ?? '').join('') ?? '';
    const usage = res.usageMetadata ?? {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    };
    return {
      replyText,
      usage: {
        inputTokens: usage.promptTokenCount,
        outputTokens: usage.candidatesTokenCount,
      },
      latencyMs,
      targetMeta: {
        provider: 'gemini',
        model: res.modelVersion ?? this.model,
        finishReason: res.candidates?.[0]?.finishReason,
      },
    };
  }

  async healthCheck(): Promise<TargetHealth> {
    return { ok: Boolean(this.apiKey) };
  }

  async shutdown(): Promise<void> {}
}

function toContents(messages: TargetMessage[]) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

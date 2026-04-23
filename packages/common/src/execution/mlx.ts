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
import { httpGet, httpPostJson, estimateTokens } from './http-helpers.js';

/**
 * MLX — Apple Silicon 네이티브 추론 서버(mlx-lm 또는 mlx_lm.server). OpenAI 호환 엔드포인트 노출.
 * 기본 포트 8080 (mlx_lm.server --port 8080).
 */
const DEFAULT_MODEL = 'mlx-community/Qwen2.5-Coder-14B-Instruct-4bit';
const DEFAULT_ENDPOINT = 'http://127.0.0.1:8080';

interface OpenAiCompatResponse {
  id?: string;
  model?: string;
  choices: Array<{ message: { role: string; content: string | null }; finish_reason: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

const CAP: TargetCapability = {
  toolUse: false,
  streaming: false,
  maxContextTokens: 32_000,
  supportsEmbedding: false,
  supportsVision: false,
  costProfile: 'free',
  offlineCapable: true,
};

export class MlxTarget implements ExecutionTarget {
  readonly kind: TargetKind = 'mlx';
  readonly capability = CAP;

  private readonly endpoint: string;
  private readonly model: string;

  constructor(config: TargetConfig) {
    this.endpoint = stripTrailingSlash(config.endpoint ?? DEFAULT_ENDPOINT);
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async dispatch(input: TargetDispatchInput): Promise<TargetDispatchResult> {
    const started = Date.now();
    const body = {
      model: this.model,
      messages: normalize(input.messages, input.systemPrompt),
    };
    const res = await httpPostJson<OpenAiCompatResponse>({
      url: `${this.endpoint}/v1/chat/completions`,
      body,
      timeoutMs: 180_000,
    });
    const latencyMs = Date.now() - started;
    const choice = res.choices[0];
    const replyText = choice?.message.content ?? '';
    const usage = res.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
    return {
      replyText,
      usage: {
        inputTokens:
          usage.prompt_tokens || estimateTokens(body.messages.map((m) => m.content).join('\n')),
        outputTokens: usage.completion_tokens || estimateTokens(replyText),
        costUsd: 0,
      },
      latencyMs,
      targetMeta: {
        provider: 'mlx',
        model: res.model ?? this.model,
        finishReason: choice?.finish_reason,
        id: res.id,
      },
    };
  }

  async healthCheck(): Promise<TargetHealth> {
    try {
      await httpGet<unknown>(`${this.endpoint}/v1/models`, 3_000);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        detail: `MLX server unreachable at ${this.endpoint}: ${(err as Error).message}`,
      };
    }
  }

  async shutdown(): Promise<void> {}
}

function normalize(messages: TargetMessage[], systemPrompt: string | undefined) {
  const out: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemPrompt) out.push({ role: 'system', content: systemPrompt });
  for (const m of messages) out.push({ role: m.role, content: m.content });
  return out;
}

function stripTrailingSlash(s: string) {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

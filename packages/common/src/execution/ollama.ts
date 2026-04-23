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

const DEFAULT_MODEL = 'qwen2.5-coder:14b';
const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

const CAP: TargetCapability = {
  toolUse: false,
  streaming: false,
  maxContextTokens: 32_000,
  supportsEmbedding: true,
  supportsVision: false,
  costProfile: 'free',
  offlineCapable: true,
};

export class OllamaTarget implements ExecutionTarget {
  readonly kind: TargetKind = 'ollama';
  readonly capability = CAP;

  private readonly endpoint: string;
  private readonly model: string;

  constructor(config: TargetConfig) {
    this.endpoint = stripTrailingSlash(config.endpoint ?? DEFAULT_ENDPOINT);
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async dispatch(input: TargetDispatchInput): Promise<TargetDispatchResult> {
    const started = Date.now();
    const messages = normalize(input.messages, input.systemPrompt);
    const res = await httpPostJson<OllamaChatResponse>({
      url: `${this.endpoint}/api/chat`,
      body: { model: this.model, messages, stream: false },
      timeoutMs: (input.maxTurns ?? 1) * 180_000,
    });
    const latencyMs = Date.now() - started;
    const replyText = res.message?.content ?? '';
    return {
      replyText,
      usage: {
        inputTokens:
          res.prompt_eval_count ?? estimateTokens(messages.map((m) => m.content).join('\n')),
        outputTokens: res.eval_count ?? estimateTokens(replyText),
        costUsd: 0,
      },
      latencyMs,
      targetMeta: { provider: 'ollama', model: res.model, totalDurationNs: res.total_duration },
    };
  }

  async healthCheck(): Promise<TargetHealth> {
    try {
      const info = await httpGet<{ models: Array<{ name: string }> }>(
        `${this.endpoint}/api/tags`,
        3_000,
      );
      const has = info.models.some(
        (m) => m.name === this.model || m.name.startsWith(`${this.model}:`),
      );
      return has
        ? { ok: true }
        : { ok: false, detail: `Model ${this.model} not pulled. Run: ollama pull ${this.model}` };
    } catch (err) {
      return {
        ok: false,
        detail: `Ollama unreachable at ${this.endpoint}: ${(err as Error).message}`,
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

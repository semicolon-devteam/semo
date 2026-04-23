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

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

interface OpenAiResponse {
  id: string;
  model: string;
  choices: Array<{ message: { role: string; content: string | null }; finish_reason: string }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

const CAP: TargetCapability = {
  toolUse: true,
  streaming: false,
  maxContextTokens: 128_000,
  supportsEmbedding: false,
  supportsVision: true,
  costProfile: 'metered',
  offlineCapable: false,
};

export class OpenAiTarget implements ExecutionTarget {
  readonly kind: TargetKind = 'openai';
  readonly capability = CAP;

  private readonly endpoint: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(config: TargetConfig) {
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    this.model = config.model ?? DEFAULT_MODEL;
    const key = (config.params?.apiKey as string | undefined) ?? process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OpenAiTarget: OPENAI_API_KEY is required');
    this.apiKey = key;
  }

  async dispatch(input: TargetDispatchInput): Promise<TargetDispatchResult> {
    const started = Date.now();
    const body = {
      model: this.model,
      messages: normalize(input.messages, input.systemPrompt),
    };
    const res = await httpPostJson<OpenAiResponse>({
      url: this.endpoint,
      headers: { authorization: `Bearer ${this.apiKey}` },
      body,
    });
    const latencyMs = Date.now() - started;
    const choice = res.choices[0];
    return {
      replyText: choice?.message.content ?? '',
      usage: {
        inputTokens: res.usage.prompt_tokens,
        outputTokens: res.usage.completion_tokens,
      },
      latencyMs,
      targetMeta: {
        provider: 'openai',
        model: res.model,
        finishReason: choice?.finish_reason,
        id: res.id,
      },
    };
  }

  async healthCheck(): Promise<TargetHealth> {
    return { ok: Boolean(this.apiKey) };
  }

  async shutdown(): Promise<void> {}
}

function normalize(messages: TargetMessage[], systemPrompt: string | undefined) {
  const out: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemPrompt) out.push({ role: 'system', content: systemPrompt });
  for (const m of messages) out.push({ role: m.role, content: m.content });
  return out;
}

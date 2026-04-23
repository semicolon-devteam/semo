import type {
  ExecutionTarget,
  TargetCapability,
  TargetConfig,
  TargetDispatchInput,
  TargetDispatchResult,
  TargetHealth,
  TargetKind,
  TargetMessage,
  TargetToolCall,
} from './types.js';
import { estimateTokens, httpPostJson } from './http-helpers.js';

const DEFAULT_MODEL = 'claude-opus-4-7';
const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string }>;
}

interface AnthropicResponse {
  id: string;
  model: string;
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
}

const CAP: TargetCapability = {
  toolUse: true,
  streaming: false,
  maxContextTokens: 200_000,
  supportsEmbedding: false,
  supportsVision: true,
  costProfile: 'metered',
  offlineCapable: false,
};

export class AnthropicApiTarget implements ExecutionTarget {
  readonly kind: TargetKind = 'anthropic-api';
  readonly capability = CAP;

  private readonly endpoint: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(config: TargetConfig) {
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    this.model = config.model ?? DEFAULT_MODEL;
    const key = (config.params?.apiKey as string | undefined) ?? process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('AnthropicApiTarget: ANTHROPIC_API_KEY is required');
    this.apiKey = key;
  }

  async dispatch(input: TargetDispatchInput): Promise<TargetDispatchResult> {
    const started = Date.now();
    const { system, messages } = splitSystem(input.messages);
    const res = await httpPostJson<AnthropicResponse>({
      url: this.endpoint,
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: {
        model: this.model,
        max_tokens: 4096,
        system: input.systemPrompt ?? system,
        messages,
      },
    });
    const latencyMs = Date.now() - started;
    const replyText = res.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
    const toolCalls: TargetToolCall[] = res.content
      .filter((c) => c.type === 'tool_use' && c.name)
      .map((c) => ({ name: c.name ?? '', arguments: (c.input ?? {}) as Record<string, unknown> }));

    return {
      replyText,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
      latencyMs,
      targetMeta: {
        provider: 'anthropic',
        model: res.model,
        stopReason: res.stop_reason,
        id: res.id,
      },
    };
  }

  async healthCheck(): Promise<TargetHealth> {
    return { ok: Boolean(this.apiKey) };
  }

  async shutdown(): Promise<void> {}
}

function splitSystem(messages: TargetMessage[]): {
  system: string | undefined;
  messages: AnthropicMessage[];
} {
  const systems: string[] = [];
  const rest: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system') systems.push(m.content);
    else rest.push({ role: m.role, content: m.content });
  }
  return { system: systems.length ? systems.join('\n\n') : undefined, messages: rest };
}

export { estimateTokens };

import type { ExecutionTarget, TargetConfig, TargetKind } from './types.js';
import { MockTarget } from './mock-target.js';
import { AnthropicApiTarget } from './anthropic.js';
import { OpenAiTarget } from './openai.js';
import { GeminiTarget } from './gemini.js';
import { OllamaTarget } from './ollama.js';
import { MlxTarget } from './mlx.js';
import { ClaudeCodeTarget } from './claude-code.js';

/**
 * ExecutionTarget Registry — TargetKind → ExecutionTarget 생성.
 *
 * 기본 등록:
 *   - mock, anthropic-api, openai, gemini, ollama, mlx, claude-code
 *
 * claude-code(pool) 와 같이 의존 자원이 필요한 타깃은 호출부에서 register 덮어쓰기.
 */
export type TargetFactory = (config: TargetConfig) => ExecutionTarget;

export class TargetRegistry {
  private readonly factories = new Map<TargetKind, TargetFactory>();

  register(kind: TargetKind, factory: TargetFactory): void {
    this.factories.set(kind, factory);
  }

  has(kind: TargetKind): boolean {
    return this.factories.has(kind);
  }

  resolve(config: TargetConfig): ExecutionTarget {
    const factory = this.factories.get(config.kind);
    if (!factory) {
      throw new Error(
        `No ExecutionTarget factory registered for kind='${config.kind}'. ` +
          `Registered kinds: [${[...this.factories.keys()].join(', ')}]`,
      );
    }
    return factory(config);
  }

  kinds(): TargetKind[] {
    return [...this.factories.keys()];
  }
}

export const defaultRegistry = new TargetRegistry();

defaultRegistry.register('mock', () => new MockTarget());
defaultRegistry.register('anthropic-api', (c) => new AnthropicApiTarget(c));
defaultRegistry.register('openai', (c) => new OpenAiTarget(c));
defaultRegistry.register('gemini', (c) => new GeminiTarget(c));
defaultRegistry.register('ollama', (c) => new OllamaTarget(c));
defaultRegistry.register('mlx', (c) => new MlxTarget(c));
defaultRegistry.register('claude-code', (c) => new ClaudeCodeTarget(c));

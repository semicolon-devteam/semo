/**
 * KbAwareTarget — ExecutionTarget 에 KB 검색 컨텍스트 자동 주입.
 *
 * 봇이 답변하기 전에 사용자 질의로 KbStore 를 검색해, 상위 N개 엔트리를 systemPrompt 에 첨부한다.
 * 모든 실행 타깃(Ollama/Anthropic/OpenAI/ClaudeCode)을 투명하게 KB-first 로 만드는 단일 지점.
 *
 * 주입 포맷:
 *   <kb-context>
 *   [domain] key/sub_key — similarity N%
 *   ...content preview...
 *   </kb-context>
 *
 * 검색이 실패하거나 결과가 없으면 원본 systemPrompt 그대로 넘긴다 — 실행을 막지 않는다.
 */
import type {
  ExecutionTarget,
  TargetCapability,
  TargetDispatchInput,
  TargetDispatchResult,
  TargetHealth,
  TargetKind,
  TargetMessage,
} from './types.js';

export interface KbEntryLite {
  domain: string;
  key: string;
  subKey?: string;
  content: string;
  similarityPct?: number;
}

export interface KbSearcher {
  search(
    query: string,
    opts: { topK: number; minScore?: number; domain?: string },
  ): Promise<KbEntryLite[]>;
}

export interface KbAwareOptions {
  topK?: number;
  minScore?: number;
  /** 각 엔트리 content 를 자를 길이. 기본 400자. */
  previewChars?: number;
  /** 도메인 필터. 주어지면 해당 도메인만 검색. */
  domainFilter?: string;
}

const DEFAULT_TOP_K = 3;
const DEFAULT_PREVIEW_CHARS = 400;

function lastUserMessage(messages: TargetMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content;
  }
  return undefined;
}

function renderKbBlock(entries: KbEntryLite[], previewChars: number): string {
  const lines: string[] = ['<kb-context>'];
  for (const e of entries) {
    const scoreTag = e.similarityPct != null ? ` — ${e.similarityPct}%` : '';
    const sub = e.subKey ? `/${e.subKey}` : '';
    const preview =
      e.content.length > previewChars ? `${e.content.slice(0, previewChars)}...` : e.content;
    lines.push(`[${e.domain}] ${e.key}${sub}${scoreTag}`);
    lines.push(preview);
    lines.push('');
  }
  lines.push('</kb-context>');
  return lines.join('\n');
}

export class KbAwareTarget implements ExecutionTarget {
  readonly kind: TargetKind;
  readonly capability: TargetCapability;

  constructor(
    private readonly inner: ExecutionTarget,
    private readonly kb: KbSearcher,
    private readonly opts: KbAwareOptions = {},
  ) {
    this.kind = inner.kind;
    this.capability = inner.capability;
  }

  async dispatch(input: TargetDispatchInput): Promise<TargetDispatchResult> {
    const userText = lastUserMessage(input.messages);
    if (!userText || !userText.trim()) {
      return this.inner.dispatch(input);
    }

    let entries: KbEntryLite[] = [];
    try {
      entries = await this.kb.search(userText, {
        topK: this.opts.topK ?? DEFAULT_TOP_K,
        minScore: this.opts.minScore,
        domain: this.opts.domainFilter,
      });
    } catch {
      /* KB 장애는 실행을 막지 않는다 */
    }

    if (entries.length === 0) {
      return this.inner.dispatch(input);
    }

    const kbBlock = renderKbBlock(entries, this.opts.previewChars ?? DEFAULT_PREVIEW_CHARS);
    const augmentedSystem = input.systemPrompt ? `${input.systemPrompt}\n\n${kbBlock}` : kbBlock;

    const result = await this.inner.dispatch({
      ...input,
      systemPrompt: augmentedSystem,
    });

    return {
      ...result,
      targetMeta: {
        ...result.targetMeta,
        kb_injected: entries.length,
        kb_keys: entries.map((e) => `${e.domain}/${e.key}${e.subKey ? '/' + e.subKey : ''}`),
      },
    };
  }

  healthCheck(): Promise<TargetHealth> {
    return this.inner.healthCheck();
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }
}

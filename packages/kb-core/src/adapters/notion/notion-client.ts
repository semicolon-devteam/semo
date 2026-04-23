/**
 * 최소 Notion API 클라이언트 — fetch-only, SDK 미의존.
 *
 * Notion 공식 SDK 는 Solo 번들에 넣기엔 과하고, 필요한 엔드포인트는 4개뿐이다:
 *   - POST /databases/{id}/query
 *   - POST /pages
 *   - PATCH /pages/{id}
 *   - DELETE /pages/{id} (실제로는 archived=true PATCH)
 *
 * 테스트가 주입할 수 있도록 `fetch` 함수를 포트로 받는다.
 */

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface NotionClientOptions {
  token: string;
  fetch?: FetchLike;
  baseUrl?: string;
  version?: string;
}

export class NotionClient {
  private readonly token: string;
  private readonly fetchFn: FetchLike;
  private readonly baseUrl: string;
  private readonly version: string;

  constructor(opts: NotionClientOptions) {
    this.token = opts.token;
    this.fetchFn = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.baseUrl = opts.baseUrl ?? 'https://api.notion.com/v1';
    this.version = opts.version ?? '2022-06-28';
  }

  async queryDatabase(
    databaseId: string,
    params: { start_cursor?: string; page_size?: number } = {},
  ): Promise<NotionQueryResult> {
    const res = await this.call('POST', `/databases/${databaseId}/query`, params);
    return res as NotionQueryResult;
  }

  async createPage(body: unknown): Promise<NotionPage> {
    const res = await this.call('POST', '/pages', body);
    return res as NotionPage;
  }

  async updatePage(pageId: string, body: unknown): Promise<NotionPage> {
    const res = await this.call('PATCH', `/pages/${pageId}`, body);
    return res as NotionPage;
  }

  async archivePage(pageId: string): Promise<void> {
    await this.call('PATCH', `/pages/${pageId}`, { archived: true });
  }

  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Notion-Version': this.version,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Notion API ${method} ${path} failed: ${res.status} ${text}`);
    }
    return res.json();
  }
}

export interface NotionQueryResult {
  results: NotionPage[];
  has_more?: boolean;
  next_cursor?: string | null;
}

export interface NotionPage {
  id: string;
  archived?: boolean;
  properties?: Record<string, NotionProperty>;
  last_edited_time?: string;
}

export interface NotionProperty {
  type: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  [k: string]: unknown;
}

export function readPlainText(prop: NotionProperty | undefined): string {
  if (!prop) return '';
  if (prop.type === 'title' && Array.isArray(prop.title)) {
    return prop.title.map((t) => t.plain_text ?? '').join('');
  }
  if (prop.type === 'rich_text' && Array.isArray(prop.rich_text)) {
    return prop.rich_text.map((t) => t.plain_text ?? '').join('');
  }
  return '';
}

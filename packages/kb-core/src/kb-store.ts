import type {
  DeleteInput,
  KbChangeEvent,
  KbEntry,
  SearchOpts,
  Unsubscribe,
  UpsertInput,
} from './types.js';

/**
 * 포터블 KB 저장소 계약.
 *
 * 어댑터 구현 (PG/SQLite/Obsidian/Notion)은 이 인터페이스를 구현하며,
 * Team/Solo 프로파일에 따라 런타임에 선택된다.
 *
 * Phase 1a: `get` / `search` 만 필수 구현. 나머지 메서드는 Phase 1b/1c 에서 채워진다.
 * 어댑터가 아직 지원하지 않으면 `NotImplementedError` 를 던진다.
 */
export interface KbStore {
  /**
   * 도메인 + 키 + 서브키로 정확 매칭 조회.
   * 없으면 null.
   */
  get(domain: string, key: string, subKey?: string): Promise<KbEntry | null>;

  /**
   * 임베딩 기반 유사도 검색.
   * 어댑터별로 FTS/벡터 전략을 내부에서 결정한다.
   */
  search(query: string, opts: SearchOpts): Promise<KbEntry[]>;

  /** Phase 1b 부터 구현 */
  upsert(input: UpsertInput): Promise<KbEntry>;

  /** Phase 1b 부터 구현 */
  delete(input: DeleteInput): Promise<void>;

  /** Phase 1c 부터 구현. PG=LISTEN/NOTIFY, SQLite=polling, Obsidian=chokidar. */
  watch(cb: (evt: KbChangeEvent) => void): Promise<Unsubscribe>;

  /** Phase 1c 부터 구현. 어댑터별 트랜잭션 의미를 캡슐화. */
  transaction<T>(fn: (tx: KbStore) => Promise<T>): Promise<T>;
}

export class NotImplementedError extends Error {
  constructor(methodName: string, reason?: string) {
    super(`KbStore.${methodName} is not implemented${reason ? ` — ${reason}` : ''}`);
    this.name = 'NotImplementedError';
  }
}

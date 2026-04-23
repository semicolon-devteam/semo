export type Unsubscribe = () => void;

export interface CommitmentInput {
  botId: string;
  title: string;
  sourceType: string;
  sessionOwner?: string;
  pipelineContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface Commitment {
  id: string;
  botId: string;
  title: string;
  status: string;
  sourceType: string;
  sessionOwner?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CronJob {
  botId: string;
  jobId: string;
  name?: string;
  schedule?: Record<string, unknown>;
  lastRun?: string;
  nextRun?: string;
  sessionTarget?: string;
  payload?: Record<string, unknown>;
}

export interface Seat {
  id: string;
  botId: string;
  seatKey: string;
  allocatedAt: string;
}

/**
 * 운영 상태 저장소의 포터블 계약.
 *
 * Team 프로파일은 PG(SKIP LOCKED + LISTEN/NOTIFY), Solo 는 SQLite(mutex + polling)
 * 또는 in-memory 어댑터로 구현된다.
 *
 * Phase 1c: PG 어댑터 스텁 — 이후 Phase 들에서 SQLite / memory 어댑터 추가.
 */
export interface OperationalStore {
  /** bot_commitments INSERT */
  createCommitment(input: CommitmentInput): Promise<Commitment>;

  /** bot_commitments UPDATE */
  updateCommitment(
    id: string,
    patch: Partial<Pick<Commitment, 'status'> & { metadata?: Record<string, unknown> }>,
  ): Promise<void>;

  /** TTL(ms) 이상 상태가 정지된 commitment 를 stale_auto 로 reap */
  reapStaleCommitments(ttlMs: number): Promise<number>;

  /** SKIP LOCKED 원자 claim. now 이전 due 한 cron 최대 limit 개 */
  claimDueCrons(now: Date, limit: number): Promise<CronJob[]>;

  /** 시트 할당 (pool 전략). 없으면 null */
  allocateSeat(botId: string): Promise<Seat | null>;
  releaseSeat(seatId: string): Promise<void>;

  /** 운영 채널 구독 (PG=LISTEN, SQLite=EventEmitter) */
  listen(channel: string, cb: (payload: unknown) => void): Promise<Unsubscribe>;
}

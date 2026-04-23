/**
 * ExecutionTarget 내에서 OperationalStore 의 seat 영역만 필요할 때 쓰는 좁은 인터페이스.
 *
 * common → ops-store 로의 직접 의존을 피하기 위한 구조적 타입. 실제 호출부는
 * `@team-semicolon/semo-ops-store` 의 `OperationalStore` 구현을 그대로 넘긴다.
 */
export interface SeatLike {
  id: string;
  botId: string;
  /** 어댑터가 해석할 좌석 키(예: CLAUDE_CONFIG_DIR 경로). */
  seatKey: string;
  allocatedAt: string;
}

export interface OperationalStoreLike {
  allocateSeat(botId: string): Promise<SeatLike | null>;
  releaseSeat(seatId: string): Promise<void>;
}

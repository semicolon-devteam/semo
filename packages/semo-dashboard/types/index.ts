/**
 * @file types/index.ts
 * @description SEMO 대시보드 공통 타입 정의.
 *   Bot, Session, CronJob, KBItem 등 API 응답과 컴포넌트가 공유하는 인터페이스.
 * @module types
 */

/** @description 봇 기본 정보 (목록/카드 표시용) */
export interface Bot {
  /** 봇 고유 식별자 (e.g. "workclaw") */
  id: string;
  /** 봇 표시 이름 */
  name: string;
  /** 봇 대표 이모지 */
  emoji: string;
  /** 봇 역할/직책 설명 */
  role: string;
  /** 현재 연결 상태 */
  status: 'online' | 'offline';
  /** 마지막 활동 ISO 타임스탬프 */
  lastActive: string;
  /** 활성 세션 수 */
  sessionCount: number;
  /** GitHub 워크스페이스 경로 (e.g. "semo-system/bot-workspaces/workclaw") */
  workspacePath: string;
}

/** @description 봇 상세 정보 (config·files·memory·activity 포함) */
export interface BotDetail {
  /** GitHub에서 가져온 설정 파일 원문 */
  config: {
    /** SOUL.md 내용 */
    soul: string;
    /** AGENTS.md 내용 */
    agents: string;
    /** USER.md 내용 */
    user: string;
  };
  /** 워크스페이스 최상위 파일 목록 */
  files: BotFile[];
  /** 메모리 파일 (decisions, team, 일일 로그) */
  memory: {
    /** memory/decisions.md 내용 */
    decisions: string;
    /** memory/team.md 내용 */
    team: string;
    /** 최근 3일 일일 로그 */
    dailyLogs: DailyLog[];
  };
  /** OpenClaw 세션·크론 활동 */
  activity: {
    sessions: Session[];
    cronJobs: CronJob[];
  };
}

/** @description 워크스페이스 파일/디렉토리 항목 */
export interface BotFile {
  /** 상대 경로 (워크스페이스 루트 기준) */
  path: string;
  /** 항목 종류 */
  type: 'file' | 'directory';
}

/** @description 일일 로그 항목 */
export interface DailyLog {
  /** YYYY-MM-DD 형식 날짜 */
  date: string;
  /** 로그 파일 원문 */
  content: string;
}

// OpenClaw Types

/** @description OpenClaw 대화 세션 */
export interface Session {
  /** 세션 고유 키 */
  sessionKey: string;
  /** 사용자 표시 라벨 */
  label: string;
  /** 세션 종류: main(기본) | isolated(격리) */
  kind: 'main' | 'isolated';
  /** 채팅 채널 종류 (e.g. 'slack', 'telegram') */
  chatType: string;
  /** 마지막 메시지 ISO 타임스탬프 */
  lastActivity: string;
  /** 누적 메시지 수 */
  messageCount: number;
}

/** @description OpenClaw 예약 작업 */
export interface CronJob {
  /** 크론 잡 고유 ID */
  jobId: string;
  /** 사람이 읽기 쉬운 작업 이름 */
  name: string;
  /** 실행 스케줄 정의 (JSONB) */
  schedule: {
    /** 스케줄 종류 */
    kind: 'cron' | 'every' | 'at';
    [key: string]: unknown;
  };
  /** 활성화 여부 */
  enabled: boolean;
  /** 마지막 실행 ISO 타임스탬프 */
  lastRun?: string;
  /** 다음 예정 실행 ISO 타임스탬프 */
  nextRun?: string;
}

// KB Types

/** @description Knowledge Base 항목 (팀 KB 또는 봇 KB) */
export interface KBItem {
  /** KB 도메인 카테고리 */
  domain: string;
  /** 도메인 내 고유 키 */
  key: string;
  /**
   * KB 항목 값.
   * @remarks DB 스키마가 JSONB이므로 구조가 다양할 수 있음.
   *   string이면 마크다운 텍스트, object이면 구조화 데이터.
   */
  value: Record<string, unknown> | string | number;
  /** 값 요약 (검색 결과 미리보기) */
  valueSummary?: string;
  /** 코사인 유사도 (0-100, 검색 결과에만 존재) */
  similarity?: number;
  /** 항목을 소유한 봇 ID */
  ownerBot: string;
  /** 생성 ISO 타임스탬프 */
  createdAt: string;
  /** 마지막 수정 ISO 타임스탬프 */
  updatedAt: string;
}

/** @description KB 시맨틱 검색 결과 (similarity 필수) */
export interface KBSearchResult extends KBItem {
  /** 코사인 유사도 점수 (0-100) */
  similarity: number;
}

/** @description KB 데이터베이스 스키마 항목 (레거시, semo.knowledge_base 직접 매핑) */
export interface KBEntry {
  id: string;
  title: string;
  content: string;
  bot_id: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

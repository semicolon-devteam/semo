/**
 * SemoBot 대화형 Factory — 자연어 → 구조화된 action.
 *
 * 파서(rule-based 또는 LLM-based) 가 반환하는 공통 타입.
 * 각 변종은 `semo factory apply` 가 바로 실행 가능한 수준의 필드를 모두 포함한다.
 * 필수 필드가 추출 불가능하면 `unknown` 또는 `needs-clarification` 으로 반환.
 */

export interface BotCreateAction {
  kind: 'bot.create';
  /** canonical bot id (영문 lowercase, hyphen 허용). */
  botId: string;
  /** 짧은 역할 설명. 예: "기획/PRD 전문". */
  role: string;
  /** 복사 베이스 템플릿 bot id. default 'semiclaw'. */
  template?: string;
  /** KB 도메인 목록 (쉼표구분 원문). */
  kbDomains?: string[];
  /** 원문 메시지. UX 표시용. */
  sourceText: string;
}

export interface BotListAction {
  kind: 'bot.list';
  sourceText: string;
}

export interface KbUpsertAction {
  kind: 'kb.upsert';
  domain: string;
  key: string;
  subKey?: string;
  content: string;
  sourceText: string;
}

export interface KbSearchAction {
  kind: 'kb.search';
  query: string;
  sourceText: string;
}

export interface OntologyListAction {
  kind: 'ontology.list';
  sourceText: string;
}

export interface NeedsClarificationAction {
  kind: 'needs-clarification';
  reason: string;
  /** 제안 질문 (UX 가 그대로 노출). */
  prompt: string;
  sourceText: string;
}

export interface UnknownAction {
  kind: 'unknown';
  reason: string;
  sourceText: string;
}

export type FactoryAction =
  | BotCreateAction
  | BotListAction
  | KbUpsertAction
  | KbSearchAction
  | OntologyListAction
  | NeedsClarificationAction
  | UnknownAction;

/** 파서 구현체가 지켜야 하는 공통 인터페이스. */
export interface FactoryIntentParser {
  /** 파서 식별자 (로그/디버그용). 예: "rule-v1", "ollama:qwen2.5-coder". */
  readonly id: string;
  parse(text: string): FactoryAction | Promise<FactoryAction>;
}

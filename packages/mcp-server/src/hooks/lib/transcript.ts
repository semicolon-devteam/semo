/**
 * Transcript JSONL 파서
 *
 * Claude Code transcript 파일을 파싱하여
 * 사용자/어시스턴트 메시지를 추출합니다.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import type { TranscriptEntry, TranscriptTextEntry } from './types.js';

/**
 * Transcript JSONL 파일 파싱
 */
export async function parseTranscript(filePath: string): Promise<TranscriptEntry[]> {
  const entries: TranscriptEntry[] = [];

  if (!fs.existsSync(filePath)) {
    return entries;
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as TranscriptEntry;
      entries.push(entry);
    } catch {
      // 파싱 실패한 라인은 무시
      if (process.env.SEMO_HOOKS_DEBUG) {
        console.error('[semo-hooks] Failed to parse transcript line:', line.slice(0, 100));
      }
    }
  }

  return entries;
}

/**
 * 마지막 assistant 응답 추출
 */
export function getLastAssistantResponse(entries: TranscriptEntry[]): string | null {
  // 역순으로 순회하여 마지막 assistant text 찾기
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === 'text' && entry.role === 'assistant') {
      return entry.content;
    }
  }
  return null;
}

/**
 * 마지막 user 프롬프트 추출
 */
export function getLastUserPrompt(entries: TranscriptEntry[]): string | null {
  // 역순으로 순회하여 마지막 user text 찾기
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === 'text' && entry.role === 'user') {
      return entry.content;
    }
  }
  return null;
}

/**
 * 모든 텍스트 엔트리 추출
 */
export function getTextEntries(entries: TranscriptEntry[]): TranscriptTextEntry[] {
  return entries.filter(
    (entry): entry is TranscriptTextEntry => entry.type === 'text'
  );
}

/**
 * 세션 통계 계산
 */
export function calculateSessionStats(entries: TranscriptEntry[]): {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolUses: number;
} {
  let userMessages = 0;
  let assistantMessages = 0;
  let toolUses = 0;

  for (const entry of entries) {
    if (entry.type === 'text') {
      if (entry.role === 'user') {
        userMessages++;
      } else if (entry.role === 'assistant') {
        assistantMessages++;
      }
    } else if (entry.type === 'tool_use') {
      toolUses++;
    }
  }

  return {
    totalMessages: userMessages + assistantMessages,
    userMessages,
    assistantMessages,
    toolUses,
  };
}

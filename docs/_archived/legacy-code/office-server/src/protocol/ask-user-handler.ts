/**
 * Phase 10: Ask User Handler
 * Agent가 사용자에게 질문하는 프로토콜 처리
 *
 * 프로토콜 형식:
 * [ASK_USER]
 * 질문: 로그인 방식은 어떤 것을 지원할까요?
 * 타입: selection
 * 옵션: [이메일/비밀번호, 소셜 로그인, SSO]
 * 타임아웃: 300
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  ParsedAskUserMessage,
  QuestionType,
  ProtocolHandlerContext,
  HandlerResult,
  PROTOCOL_PATTERNS,
} from './types.js';

export class AskUserHandler {
  constructor(private supabase: SupabaseClient) {}

  /**
   * [ASK_USER] 프로토콜 메시지 파싱
   */
  parse(output: string): ParsedAskUserMessage | null {
    const match = output.match(PROTOCOL_PATTERNS.ASK_USER);
    if (!match) return null;

    const content = match[1].trim();
    const lines = content.split('\n').map((line) => line.trim());

    let question = '';
    let questionType: QuestionType = 'text';
    let options: string[] | undefined;
    let timeout: number | undefined;
    const metadata: Record<string, any> = {};

    for (const line of lines) {
      if (line.startsWith('질문:')) {
        question = line.substring(3).trim();
      } else if (line.startsWith('타입:')) {
        const typeStr = line.substring(3).trim();
        if (typeStr === 'text' || typeStr === 'selection' || typeStr === 'confirmation') {
          questionType = typeStr;
        }
      } else if (line.startsWith('옵션:')) {
        const optionsStr = line.substring(3).trim();
        // "[옵션1, 옵션2, 옵션3]" 형식 파싱
        const optionsMatch = optionsStr.match(/\[(.*?)\]/);
        if (optionsMatch) {
          options = optionsMatch[1].split(',').map((opt) => opt.trim());
        }
      } else if (line.startsWith('타임아웃:')) {
        const timeoutStr = line.substring(5).trim();
        timeout = parseInt(timeoutStr, 10);
        if (isNaN(timeout)) timeout = undefined;
      } else if (line.includes(':')) {
        // 기타 메타데이터
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        metadata[key.trim()] = value;
      }
    }

    if (!question) {
      console.error('[AskUserHandler] 질문 내용이 없습니다:', content);
      return null;
    }

    return {
      type: 'ASK_USER',
      question,
      questionType,
      options,
      metadata: {
        ...metadata,
        timeout,
      },
    };
  }

  /**
   * 파싱된 질문을 DB에 저장
   */
  async saveQuestion(
    parsed: ParsedAskUserMessage,
    context: ProtocolHandlerContext
  ): Promise<HandlerResult<string>> {
    try {
      const { officeId, agentId, workflowInstanceId } = context;

      // 타임아웃 계산
      const timeout = parsed.metadata?.timeout as number | undefined;
      const expiresAt = timeout ? new Date(Date.now() + timeout * 1000) : null;

      const { data, error } = await this.supabase
        .from('user_questions')
        .insert({
          office_id: officeId,
          agent_id: agentId,
          workflow_instance_id: workflowInstanceId,
          question_type: parsed.questionType,
          question: parsed.question,
          options: parsed.options || null,
          status: 'pending',
          expires_at: expiresAt,
          metadata: parsed.metadata || {},
        })
        .select('id')
        .single();

      if (error) {
        console.error('[AskUserHandler] DB 저장 실패:', error);
        return { success: false, error: error.message };
      }

      console.log(`[AskUserHandler] 질문 저장 완료: ${data.id}`);
      return { success: true, data: data.id };
    } catch (error: any) {
      console.error('[AskUserHandler] saveQuestion 오류:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 사용자 응답 대기
   * Realtime으로 응답이 오면 resolve
   */
  async waitForResponse(questionId: string, timeoutMs: number = 300000): Promise<HandlerResult<string>> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        channel.unsubscribe();
        resolve({ success: false, error: 'Timeout waiting for user response' });
      }, timeoutMs);

      const channel = this.supabase
        .channel(`question:${questionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_questions',
            filter: `id=eq.${questionId}`,
          },
          (payload: any) => {
            const newRow = payload.new;
            if (newRow.status === 'answered') {
              clearTimeout(timeout);
              channel.unsubscribe();
              console.log(`[AskUserHandler] 응답 수신: ${newRow.response}`);
              resolve({ success: true, data: newRow.response });
            } else if (newRow.status === 'timeout' || newRow.status === 'cancelled') {
              clearTimeout(timeout);
              channel.unsubscribe();
              resolve({ success: false, error: `Question ${newRow.status}` });
            }
          }
        )
        .subscribe();
    });
  }

  /**
   * 전체 플로우: 파싱 → 저장 → 응답 대기
   */
  async handle(
    output: string,
    context: ProtocolHandlerContext
  ): Promise<HandlerResult<{ questionId: string; response: string }>> {
    // 1. 파싱
    const parsed = this.parse(output);
    if (!parsed) {
      return { success: false, error: 'Failed to parse [ASK_USER] message' };
    }

    // 2. DB 저장
    const saveResult = await this.saveQuestion(parsed, context);
    if (!saveResult.success || !saveResult.data) {
      return { success: false, error: saveResult.error };
    }

    const questionId = saveResult.data;

    // 3. 응답 대기
    const timeout = (parsed.metadata?.timeout as number | undefined) || 300;
    const responseResult = await this.waitForResponse(questionId, timeout * 1000);

    if (!responseResult.success || !responseResult.data) {
      return { success: false, error: responseResult.error };
    }

    return {
      success: true,
      data: {
        questionId,
        response: responseResult.data,
      },
    };
  }

  /**
   * 질문 취소
   */
  async cancelQuestion(questionId: string): Promise<HandlerResult<void>> {
    try {
      const { error } = await this.supabase
        .from('user_questions')
        .update({ status: 'cancelled' })
        .eq('id', questionId)
        .eq('status', 'pending');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 질문 목록 조회
   */
  async getQuestions(officeId: string, status?: string) {
    try {
      let query = this.supabase
        .from('user_questions')
        .select('*, agents(name, role)')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

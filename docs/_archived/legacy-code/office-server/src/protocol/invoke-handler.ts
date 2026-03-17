/**
 * Phase 11: Invoke Handler
 * Agent 간 호출 프로토콜 처리
 *
 * 프로토콜 형식:
 * [INVOKE:PO] 요구사항 분석을 요청합니다.
 * 컨텍스트: 로그인 기능 구현
 * 타입: task
 * 우선순위: high
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  ParsedInvokeMessage,
  InvocationType,
  ProtocolHandlerContext,
  HandlerResult,
  PROTOCOL_PATTERNS,
} from './types.js';

export class InvokeHandler {
  constructor(private supabase: SupabaseClient) {}

  /**
   * [INVOKE:AgentName] 프로토콜 메시지 파싱
   */
  parse(output: string): ParsedInvokeMessage | null {
    const match = output.match(PROTOCOL_PATTERNS.INVOKE);
    if (!match) return null;

    const targetAgentName = match[1].trim();
    const content = match[2].trim();
    const lines = content.split('\n').map((line) => line.trim());

    let context = '';
    let invocationType: InvocationType = 'task';
    let targetAgentRole: string | undefined;
    const payload: Record<string, any> = {};

    for (const line of lines) {
      if (line.startsWith('컨텍스트:')) {
        context = line.substring(6).trim();
      } else if (line.startsWith('타입:')) {
        const typeStr = line.substring(3).trim();
        if (typeStr === 'task' || typeStr === 'question' || typeStr === 'collaboration') {
          invocationType = typeStr;
        }
      } else if (line.startsWith('역할:')) {
        targetAgentRole = line.substring(3).trim();
      } else if (line.includes(':')) {
        // 기타 페이로드
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        payload[key.trim()] = value;
      } else if (line && !context) {
        // 첫 줄이 컨텍스트가 아니면 전체를 컨텍스트로 간주
        context = line;
      }
    }

    if (!context) {
      console.error('[InvokeHandler] 컨텍스트가 없습니다:', content);
      return null;
    }

    return {
      type: 'INVOKE',
      targetAgentName,
      targetAgentRole,
      invocationType,
      context,
      payload: Object.keys(payload).length > 0 ? payload : undefined,
    };
  }

  /**
   * Target Agent 찾기 (이름 또는 역할로)
   */
  private async findTargetAgent(
    officeId: string,
    targetName: string,
    targetRole?: string
  ): Promise<HandlerResult<string>> {
    try {
      let query = this.supabase.from('agents').select('id').eq('office_id', officeId);

      // 이름으로 먼저 찾기
      const { data: byName, error: nameError } = await query.eq('name', targetName).maybeSingle();

      if (byName) {
        return { success: true, data: byName.id };
      }

      // 역할로 찾기
      if (targetRole) {
        const { data: byRole, error: roleError } = await this.supabase
          .from('agents')
          .select('id')
          .eq('office_id', officeId)
          .eq('role', targetRole)
          .maybeSingle();

        if (byRole) {
          return { success: true, data: byRole.id };
        }
      }

      // 역할 이름으로 찾기 (이름이 실제로 역할일 수 있음)
      const { data: byRoleAsName, error: roleAsNameError } = await this.supabase
        .from('agents')
        .select('id')
        .eq('office_id', officeId)
        .eq('role', targetName)
        .maybeSingle();

      if (byRoleAsName) {
        return { success: true, data: byRoleAsName.id };
      }

      return { success: false, error: `Target agent not found: ${targetName}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 파싱된 호출을 DB에 저장
   */
  async saveInvocation(
    parsed: ParsedInvokeMessage,
    context: ProtocolHandlerContext
  ): Promise<HandlerResult<string>> {
    try {
      const { officeId, agentId, workflowInstanceId } = context;

      // Target Agent 찾기
      const targetResult = await this.findTargetAgent(
        officeId,
        parsed.targetAgentName,
        parsed.targetAgentRole
      );

      if (!targetResult.success || !targetResult.data) {
        return { success: false, error: targetResult.error };
      }

      const calleeAgentId = targetResult.data;

      const { data, error } = await this.supabase
        .from('agent_invocations')
        .insert({
          office_id: officeId,
          workflow_instance_id: workflowInstanceId,
          caller_agent_id: agentId,
          callee_agent_id: calleeAgentId,
          invocation_type: parsed.invocationType,
          context: parsed.context,
          payload: parsed.payload || {},
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) {
        console.error('[InvokeHandler] DB 저장 실패:', error);
        return { success: false, error: error.message };
      }

      console.log(`[InvokeHandler] 호출 저장 완료: ${data.id} (${parsed.targetAgentName})`);
      return { success: true, data: data.id };
    } catch (error: any) {
      console.error('[InvokeHandler] saveInvocation 오류:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 호출 완료 대기
   * Realtime으로 상태가 completed가 되면 resolve
   */
  async waitForCompletion(invocationId: string, timeoutMs: number = 600000): Promise<HandlerResult<string>> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        channel.unsubscribe();
        resolve({ success: false, error: 'Timeout waiting for invocation completion' });
      }, timeoutMs);

      const channel = this.supabase
        .channel(`invocation:${invocationId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'agent_invocations',
            filter: `id=eq.${invocationId}`,
          },
          (payload: any) => {
            const newRow = payload.new;
            if (newRow.status === 'completed') {
              clearTimeout(timeout);
              channel.unsubscribe();
              console.log(`[InvokeHandler] 호출 완료: ${newRow.result || 'No result'}`);
              resolve({ success: true, data: newRow.result || '' });
            } else if (newRow.status === 'rejected' || newRow.status === 'timeout') {
              clearTimeout(timeout);
              channel.unsubscribe();
              resolve({ success: false, error: `Invocation ${newRow.status}` });
            }
          }
        )
        .subscribe();
    });
  }

  /**
   * 전체 플로우: 파싱 → 저장 → 완료 대기
   */
  async handle(
    output: string,
    context: ProtocolHandlerContext
  ): Promise<HandlerResult<{ invocationId: string; result: string }>> {
    // 1. 파싱
    const parsed = this.parse(output);
    if (!parsed) {
      return { success: false, error: 'Failed to parse [INVOKE] message' };
    }

    // 2. DB 저장
    const saveResult = await this.saveInvocation(parsed, context);
    if (!saveResult.success || !saveResult.data) {
      return { success: false, error: saveResult.error };
    }

    const invocationId = saveResult.data;

    // 3. 완료 대기 (선택적)
    // 호출만 하고 응답을 기다리지 않을 수도 있음
    // 필요하면 waitForCompletion 호출

    return {
      success: true,
      data: {
        invocationId,
        result: '', // 비동기 호출이므로 즉시 결과 없음
      },
    };
  }

  /**
   * 호출 수락
   */
  async acceptInvocation(invocationId: string): Promise<HandlerResult<void>> {
    try {
      const { error } = await this.supabase
        .from('agent_invocations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invocationId)
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
   * 호출 완료
   */
  async completeInvocation(invocationId: string, result: string): Promise<HandlerResult<void>> {
    try {
      const { error } = await this.supabase
        .from('agent_invocations')
        .update({
          status: 'completed',
          result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', invocationId)
        .in('status', ['accepted', 'in_progress']);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 호출 거절
   */
  async rejectInvocation(invocationId: string, reason: string): Promise<HandlerResult<void>> {
    try {
      const { error } = await this.supabase
        .from('agent_invocations')
        .update({
          status: 'rejected',
          result: reason,
        })
        .eq('id', invocationId)
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
   * Agent의 호출 목록 조회
   */
  async getInvocations(agentId: string, status?: string) {
    try {
      let query = this.supabase
        .from('agent_invocations')
        .select('*, caller:caller_agent_id(name, role), callee:callee_agent_id(name, role)')
        .or(`caller_agent_id.eq.${agentId},callee_agent_id.eq.${agentId}`)
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

/**
 * Phase 12: Result Handler
 * Agent 간 결과물 전달 프로토콜 처리
 *
 * 프로토콜 형식:
 * [DELIVER_RESULT:AgentName]
 * 타입: file
 * 제목: 로그인 페이지 구현 완료
 * 내용: 로그인 페이지를 구현했습니다. 이메일/비밀번호 인증을 지원합니다.
 * 파일: [src/pages/login.tsx, src/components/LoginForm.tsx]
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  ParsedDeliverResultMessage,
  ResultType,
  ProtocolHandlerContext,
  HandlerResult,
  PROTOCOL_PATTERNS,
} from './types.js';

export class ResultHandler {
  constructor(private supabase: SupabaseClient) {}

  /**
   * [DELIVER_RESULT:AgentName] 프로토콜 메시지 파싱
   */
  parse(output: string): ParsedDeliverResultMessage | null {
    const match = output.match(PROTOCOL_PATTERNS.DELIVER_RESULT);
    if (!match) return null;

    const targetAgentName = match[1]?.trim();
    const content = match[2].trim();
    const lines = content.split('\n').map((line) => line.trim());

    let resultType: ResultType = 'text';
    let title = '';
    let resultContent = '';
    let targetAgentRole: string | undefined;
    const metadata: Record<string, any> = {};
    let filePaths: string[] | undefined;
    let githubUrl: string | undefined;
    let githubNumber: number | undefined;

    for (const line of lines) {
      if (line.startsWith('타입:')) {
        const typeStr = line.substring(3).trim();
        if (
          typeStr === 'file' ||
          typeStr === 'github_issue' ||
          typeStr === 'github_pr' ||
          typeStr === 'text' ||
          typeStr === 'structured_data'
        ) {
          resultType = typeStr;
        }
      } else if (line.startsWith('제목:')) {
        title = line.substring(3).trim();
      } else if (line.startsWith('내용:')) {
        resultContent = line.substring(3).trim();
      } else if (line.startsWith('역할:')) {
        targetAgentRole = line.substring(3).trim();
      } else if (line.startsWith('파일:')) {
        const filesStr = line.substring(3).trim();
        // "[file1.tsx, file2.tsx]" 형식 파싱
        const filesMatch = filesStr.match(/\[(.*?)\]/);
        if (filesMatch) {
          filePaths = filesMatch[1].split(',').map((f) => f.trim());
        }
      } else if (line.startsWith('GitHub URL:')) {
        githubUrl = line.substring(11).trim();
      } else if (line.startsWith('GitHub 번호:')) {
        const numStr = line.substring(10).trim();
        githubNumber = parseInt(numStr, 10);
        if (isNaN(githubNumber)) githubNumber = undefined;
      } else if (line.includes(':')) {
        // 기타 메타데이터
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        metadata[key.trim()] = value;
      } else if (line && !resultContent) {
        // 첫 줄이 내용이 아니면 전체를 내용으로 간주
        resultContent = line;
      }
    }

    if (!title || !resultContent) {
      console.error('[ResultHandler] 제목 또는 내용이 없습니다:', content);
      return null;
    }

    return {
      type: 'DELIVER_RESULT',
      targetAgentName,
      targetAgentRole,
      resultType,
      title,
      content: resultContent,
      filePaths,
      githubUrl,
      githubNumber,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  /**
   * Target Agent 찾기 (이름 또는 역할로)
   */
  private async findTargetAgent(
    officeId: string,
    targetName?: string,
    targetRole?: string
  ): Promise<HandlerResult<string | null>> {
    if (!targetName && !targetRole) {
      return { success: true, data: null }; // 수신자 없음 (전체 공개)
    }

    try {
      // 이름으로 먼저 찾기
      if (targetName) {
        const { data: byName, error: nameError } = await this.supabase
          .from('agents')
          .select('id')
          .eq('office_id', officeId)
          .eq('name', targetName)
          .maybeSingle();

        if (byName) {
          return { success: true, data: byName.id };
        }
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
      if (targetName) {
        const { data: byRoleAsName, error: roleAsNameError } = await this.supabase
          .from('agents')
          .select('id')
          .eq('office_id', officeId)
          .eq('role', targetName)
          .maybeSingle();

        if (byRoleAsName) {
          return { success: true, data: byRoleAsName.id };
        }
      }

      return { success: true, data: null }; // 찾지 못하면 전체 공개
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 파싱된 결과를 DB에 저장
   */
  async saveResult(
    parsed: ParsedDeliverResultMessage,
    context: ProtocolHandlerContext,
    invocationId?: string
  ): Promise<HandlerResult<string>> {
    try {
      const { officeId, agentId, workflowInstanceId } = context;

      // Target Agent 찾기 (선택적)
      const targetResult = await this.findTargetAgent(
        officeId,
        parsed.targetAgentName,
        parsed.targetAgentRole
      );

      if (!targetResult.success) {
        return { success: false, error: targetResult.error };
      }

      const targetAgentId = targetResult.data || null;

      const { data, error } = await this.supabase
        .from('agent_results')
        .insert({
          office_id: officeId,
          agent_id: agentId,
          workflow_instance_id: workflowInstanceId,
          invocation_id: invocationId || null,
          result_type: parsed.resultType,
          title: parsed.title,
          content: parsed.content,
          target_agent_id: targetAgentId,
          file_paths: parsed.filePaths || null,
          github_url: parsed.githubUrl || null,
          github_number: parsed.githubNumber || null,
          metadata: parsed.metadata || {},
        })
        .select('id')
        .single();

      if (error) {
        console.error('[ResultHandler] DB 저장 실패:', error);
        return { success: false, error: error.message };
      }

      console.log(
        `[ResultHandler] 결과 저장 완료: ${data.id} (${parsed.resultType}: ${parsed.title})`
      );
      return { success: true, data: data.id };
    } catch (error: any) {
      console.error('[ResultHandler] saveResult 오류:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 전체 플로우: 파싱 → 저장
   */
  async handle(
    output: string,
    context: ProtocolHandlerContext,
    invocationId?: string
  ): Promise<HandlerResult<{ resultId: string }>> {
    // 1. 파싱
    const parsed = this.parse(output);
    if (!parsed) {
      return { success: false, error: 'Failed to parse [DELIVER_RESULT] message' };
    }

    // 2. DB 저장
    const saveResult = await this.saveResult(parsed, context, invocationId);
    if (!saveResult.success || !saveResult.data) {
      return { success: false, error: saveResult.error };
    }

    const resultId = saveResult.data;

    return {
      success: true,
      data: {
        resultId,
      },
    };
  }

  /**
   * Agent의 결과물 조회
   */
  async getResults(agentId: string, resultType?: ResultType) {
    try {
      let query = this.supabase
        .from('agent_results')
        .select('*, agent:agent_id(name, role), target:target_agent_id(name, role)')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (resultType) {
        query = query.eq('result_type', resultType);
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

  /**
   * Target Agent가 받은 결과물 조회
   */
  async getReceivedResults(targetAgentId: string, resultType?: ResultType) {
    try {
      let query = this.supabase
        .from('agent_results')
        .select('*, agent:agent_id(name, role)')
        .eq('target_agent_id', targetAgentId)
        .order('created_at', { ascending: false });

      if (resultType) {
        query = query.eq('result_type', resultType);
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

  /**
   * Office의 모든 결과물 조회 (전체 공개 결과물)
   */
  async getPublicResults(officeId: string, resultType?: ResultType) {
    try {
      let query = this.supabase
        .from('agent_results')
        .select('*, agent:agent_id(name, role)')
        .eq('office_id', officeId)
        .is('target_agent_id', null)
        .order('created_at', { ascending: false });

      if (resultType) {
        query = query.eq('result_type', resultType);
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

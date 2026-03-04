/**
 * Phase 15: Agent Availability Manager
 * 역할별 동시성 전략 관리
 *
 * 동시성 전략:
 * - PO (Product Owner): QUEUE (max 3, FIFO)
 * - PM (Project Manager): QUEUE (max 5, FIFO)
 * - Designer, Architect: WAIT (60초 대기, 한 번에 1개)
 * - Frontend, Backend, QA: PARALLEL (동시 max 2개)
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type ConcurrencyStrategy = 'QUEUE' | 'WAIT' | 'PARALLEL';

export interface ConcurrencyConfig {
  strategy: ConcurrencyStrategy;
  maxConcurrency: number;
  waitTimeMs?: number; // WAIT 전략일 때 대기 시간
  queueSize?: number; // QUEUE 전략일 때 큐 크기
}

export interface AgentAvailability {
  agentId: string;
  role: string;
  activeTasks: number;
  queuedTasks: number;
  isAvailable: boolean;
  concurrencyConfig: ConcurrencyConfig;
}

export interface HandlerResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class AgentAvailabilityManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 역할별 동시성 전략 조회
   */
  getConcurrencyStrategy(role: string): ConcurrencyConfig {
    const normalizedRole = role.toLowerCase();

    // PO: QUEUE (max 3)
    if (normalizedRole.includes('po') || normalizedRole.includes('product owner')) {
      return {
        strategy: 'QUEUE',
        maxConcurrency: 1, // 한 번에 1개만 실행
        queueSize: 3,
      };
    }

    // PM: QUEUE (max 5)
    if (normalizedRole.includes('pm') || normalizedRole.includes('project manager')) {
      return {
        strategy: 'QUEUE',
        maxConcurrency: 1,
        queueSize: 5,
      };
    }

    // Designer, Architect: WAIT (60초)
    if (
      normalizedRole.includes('designer') ||
      normalizedRole.includes('architect') ||
      normalizedRole.includes('디자이너') ||
      normalizedRole.includes('아키텍트')
    ) {
      return {
        strategy: 'WAIT',
        maxConcurrency: 1,
        waitTimeMs: 60000, // 60초
      };
    }

    // Frontend, Backend, QA: PARALLEL (max 2)
    if (
      normalizedRole.includes('frontend') ||
      normalizedRole.includes('backend') ||
      normalizedRole.includes('qa') ||
      normalizedRole.includes('프론트') ||
      normalizedRole.includes('백엔드') ||
      normalizedRole.includes('테스트')
    ) {
      return {
        strategy: 'PARALLEL',
        maxConcurrency: 2,
      };
    }

    // 기본: PARALLEL (max 1)
    return {
      strategy: 'PARALLEL',
      maxConcurrency: 1,
    };
  }

  /**
   * Agent의 현재 작업 상태 조회
   */
  async getAgentTaskStatus(agentId: string): Promise<HandlerResult<AgentAvailability>> {
    try {
      // Agent 정보 조회
      const { data: agent, error: agentError } = await this.supabase
        .from('agents')
        .select('id, role')
        .eq('id', agentId)
        .single();

      if (agentError || !agent) {
        return { success: false, error: 'Agent not found' };
      }

      // 활성 작업 수 조회
      const { data: activeTasks, error: activeError } = await this.supabase
        .from('agent_task_queue')
        .select('id')
        .eq('agent_id', agentId)
        .in('status', ['assigned', 'executing']);

      if (activeError) {
        return { success: false, error: activeError.message };
      }

      // 큐 대기 작업 수 조회
      const { data: queuedTasks, error: queueError } = await this.supabase
        .from('agent_task_queue')
        .select('id')
        .eq('agent_id', agentId)
        .eq('status', 'queued');

      if (queueError) {
        return { success: false, error: queueError.message };
      }

      const config = this.getConcurrencyStrategy(agent.role);
      const activeCount = activeTasks?.length || 0;
      const queuedCount = queuedTasks?.length || 0;

      // 가용성 판단
      let isAvailable = false;
      switch (config.strategy) {
        case 'QUEUE':
          // 큐에 여유가 있으면 가능
          isAvailable = queuedCount < (config.queueSize || 0);
          break;
        case 'WAIT':
          // 활성 작업이 없으면 가능
          isAvailable = activeCount === 0;
          break;
        case 'PARALLEL':
          // 동시 실행 수가 max보다 작으면 가능
          isAvailable = activeCount < config.maxConcurrency;
          break;
      }

      return {
        success: true,
        data: {
          agentId,
          role: agent.role,
          activeTasks: activeCount,
          queuedTasks: queuedCount,
          isAvailable,
          concurrencyConfig: config,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Agent가 새로운 작업을 받을 수 있는지 확인
   */
  async isAgentAvailable(agentId: string): Promise<HandlerResult<boolean>> {
    const statusResult = await this.getAgentTaskStatus(agentId);
    if (!statusResult.success || !statusResult.data) {
      return { success: false, error: statusResult.error };
    }

    return {
      success: true,
      data: statusResult.data.isAvailable,
    };
  }

  /**
   * 작업을 Agent에게 할당
   */
  async assignTask(
    agentId: string,
    taskType: string,
    taskReferenceId: string,
    priority: number = 0,
    metadata?: Record<string, any>
  ): Promise<HandlerResult<string>> {
    try {
      // Agent 정보 조회
      const { data: agent, error: agentError } = await this.supabase
        .from('agents')
        .select('id, office_id, role')
        .eq('id', agentId)
        .single();

      if (agentError || !agent) {
        return { success: false, error: 'Agent not found' };
      }

      // 가용성 확인
      const availabilityResult = await this.isAgentAvailable(agentId);
      if (!availabilityResult.success) {
        return { success: false, error: availabilityResult.error };
      }

      const config = this.getConcurrencyStrategy(agent.role);

      // 전략에 따라 초기 상태 결정
      let initialStatus: 'queued' | 'assigned' = 'queued';
      if (config.strategy === 'PARALLEL' && availabilityResult.data) {
        // PARALLEL 전략이고 가용하면 즉시 할당
        initialStatus = 'assigned';
      }

      // 작업 큐에 추가
      const { data: task, error: insertError } = await this.supabase
        .from('agent_task_queue')
        .insert({
          office_id: agent.office_id,
          agent_id: agentId,
          task_type: taskType,
          task_reference_id: taskReferenceId,
          priority,
          status: initialStatus,
          assigned_at: initialStatus === 'assigned' ? new Date().toISOString() : null,
          metadata: metadata || {},
        })
        .select('id')
        .single();

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      console.log(
        `[AvailabilityManager] 작업 할당: ${task.id} → Agent ${agentId} (${config.strategy})`
      );

      return { success: true, data: task.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 큐에서 다음 작업 가져오기 (QUEUE 전략용)
   */
  async dequeueNextTask(agentId: string): Promise<HandlerResult<string | null>> {
    try {
      // 우선순위 높은 순, 생성 시간 빠른 순으로 정렬
      const { data: queuedTasks, error: queueError } = await this.supabase
        .from('agent_task_queue')
        .select('id')
        .eq('agent_id', agentId)
        .eq('status', 'queued')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1);

      if (queueError) {
        return { success: false, error: queueError.message };
      }

      if (!queuedTasks || queuedTasks.length === 0) {
        return { success: true, data: null }; // 큐가 비어있음
      }

      const taskId = queuedTasks[0].id;

      // 상태를 'assigned'로 변경
      const { error: updateError } = await this.supabase
        .from('agent_task_queue')
        .update({
          status: 'assigned',
          assigned_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      console.log(`[AvailabilityManager] 큐에서 작업 할당: ${taskId}`);
      return { success: true, data: taskId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 작업 시작 (assigned → executing)
   */
  async startTask(taskId: string): Promise<HandlerResult<void>> {
    try {
      const { error } = await this.supabase
        .from('agent_task_queue')
        .update({
          status: 'executing',
          started_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('status', 'assigned');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 작업 완료 (executing → completed)
   */
  async completeTask(taskId: string): Promise<HandlerResult<void>> {
    try {
      const { error } = await this.supabase
        .from('agent_task_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('status', 'executing');

      if (error) {
        return { success: false, error: error.message };
      }

      // 완료 후 큐에서 다음 작업 할당 시도
      const { data: task } = await this.supabase
        .from('agent_task_queue')
        .select('agent_id, agents(role)')
        .eq('id', taskId)
        .single();

      if (task && task.agents) {
        const config = this.getConcurrencyStrategy((task.agents as any).role);
        if (config.strategy === 'QUEUE') {
          // QUEUE 전략이면 다음 작업 자동 할당
          await this.dequeueNextTask(task.agent_id);
        }
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 작업 실패 (executing → failed)
   */
  async failTask(taskId: string, errorMessage: string): Promise<HandlerResult<void>> {
    try {
      // 현재 재시도 횟수 조회
      const { data: task, error: selectError } = await this.supabase
        .from('agent_task_queue')
        .select('retry_count, max_retries')
        .eq('id', taskId)
        .single();

      if (selectError || !task) {
        return { success: false, error: 'Task not found' };
      }

      const shouldRetry = task.retry_count < task.max_retries;

      if (shouldRetry) {
        // 재시도
        const { error: retryError } = await this.supabase
          .from('agent_task_queue')
          .update({
            status: 'queued',
            retry_count: task.retry_count + 1,
            last_error: errorMessage,
          })
          .eq('id', taskId);

        if (retryError) {
          return { success: false, error: retryError.message };
        }

        console.log(`[AvailabilityManager] 작업 재시도: ${taskId} (${task.retry_count + 1}/${task.max_retries})`);
      } else {
        // 최종 실패
        const { error: failError } = await this.supabase
          .from('agent_task_queue')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            last_error: errorMessage,
          })
          .eq('id', taskId);

        if (failError) {
          return { success: false, error: failError.message };
        }

        console.log(`[AvailabilityManager] 작업 최종 실패: ${taskId}`);
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 작업 취소
   */
  async cancelTask(taskId: string): Promise<HandlerResult<void>> {
    try {
      const { error } = await this.supabase
        .from('agent_task_queue')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .in('status', ['queued', 'assigned']);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Office의 모든 Agent 가용성 조회
   */
  async getOfficeAvailability(officeId: string): Promise<HandlerResult<AgentAvailability[]>> {
    try {
      const { data: agents, error: agentsError } = await this.supabase
        .from('agents')
        .select('id')
        .eq('office_id', officeId);

      if (agentsError) {
        return { success: false, error: agentsError.message };
      }

      if (!agents || agents.length === 0) {
        return { success: true, data: [] };
      }

      const availabilities: AgentAvailability[] = [];
      for (const agent of agents) {
        const statusResult = await this.getAgentTaskStatus(agent.id);
        if (statusResult.success && statusResult.data) {
          availabilities.push(statusResult.data);
        }
      }

      return { success: true, data: availabilities };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

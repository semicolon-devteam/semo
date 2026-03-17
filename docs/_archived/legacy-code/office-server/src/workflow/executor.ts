/**
 * Phase 16: Workflow Executor
 * 워크플로우 실행 엔진
 *
 * 기능:
 * - Workflow Instance 생성
 * - Step 실행 및 완료 처리
 * - Step 간 의존성 관리
 * - Agent 할당 및 Task Queue 연동
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { AgentAvailabilityManager } from '../concurrency/availability-manager.js';

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'ready' | 'executing' | 'completed' | 'failed' | 'skipped';

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  officeId: string;
  userId: string;
  status: WorkflowStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface WorkflowStepExecution {
  id: string;
  workflowInstanceId: string;
  stepId: string;
  agentId?: string;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  output?: Record<string, any>;
  errorMessage?: string;
}

export interface HandlerResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class WorkflowExecutor {
  private availabilityManager: AgentAvailabilityManager;

  constructor(private supabase: SupabaseClient) {
    this.availabilityManager = new AgentAvailabilityManager(supabase);
  }

  /**
   * Workflow Instance 생성
   */
  async createInstance(
    workflowId: string,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<HandlerResult<string>> {
    try {
      // Workflow 정보 조회
      const { data: workflow, error: workflowError } = await this.supabase
        .from('workflows')
        .select('id, office_id, name')
        .eq('id', workflowId)
        .single();

      if (workflowError || !workflow) {
        return { success: false, error: 'Workflow not found' };
      }

      // Instance 생성
      const { data: instance, error: instanceError } = await this.supabase
        .from('workflow_instances')
        .insert({
          workflow_id: workflowId,
          office_id: workflow.office_id,
          user_id: userId,
          status: 'pending',
          metadata: metadata || {},
        })
        .select('id')
        .single();

      if (instanceError) {
        return { success: false, error: instanceError.message };
      }

      // Workflow의 모든 Step에 대한 Execution 레코드 생성
      const { data: steps, error: stepsError } = await this.supabase
        .from('workflow_steps')
        .select('id, step_order, depends_on')
        .eq('workflow_id', workflowId)
        .order('step_order', { ascending: true });

      if (stepsError) {
        return { success: false, error: stepsError.message };
      }

      if (steps && steps.length > 0) {
        const stepExecutions = steps.map((step) => ({
          workflow_instance_id: instance.id,
          workflow_step_id: step.id,
          status: step.depends_on ? 'pending' : 'ready', // 의존성 없으면 즉시 ready
        }));

        const { error: executionsError } = await this.supabase
          .from('workflow_step_executions')
          .insert(stepExecutions);

        if (executionsError) {
          return { success: false, error: executionsError.message };
        }
      }

      console.log(`[WorkflowExecutor] Instance 생성: ${instance.id} (Workflow: ${workflow.name})`);
      return { success: true, data: instance.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Workflow Instance 시작
   */
  async startInstance(instanceId: string): Promise<HandlerResult<void>> {
    try {
      const { error } = await this.supabase
        .from('workflow_instances')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', instanceId)
        .eq('status', 'pending');

      if (error) {
        return { success: false, error: error.message };
      }

      // Ready 상태인 Step들을 자동 실행
      await this.executeReadySteps(instanceId);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Ready 상태인 Step들을 실행
   */
  private async executeReadySteps(instanceId: string): Promise<void> {
    const { data: readySteps } = await this.supabase
      .from('workflow_step_executions')
      .select('id, workflow_step_id, workflow_steps(agent_id)')
      .eq('workflow_instance_id', instanceId)
      .eq('status', 'ready');

    if (readySteps && readySteps.length > 0) {
      for (const step of readySteps) {
        const stepData = step.workflow_steps as any;
        if (stepData?.agent_id) {
          await this.executeStep(step.id, stepData.agent_id);
        }
      }
    }
  }

  /**
   * Step 실행 (Agent 할당 및 Task Queue에 추가)
   */
  async executeStep(stepExecutionId: string, agentId: string): Promise<HandlerResult<string>> {
    try {
      // Step Execution 정보 조회
      const { data: execution, error: executionError } = await this.supabase
        .from('workflow_step_executions')
        .select('id, workflow_instance_id, workflow_step_id, status')
        .eq('id', stepExecutionId)
        .single();

      if (executionError || !execution) {
        return { success: false, error: 'Step execution not found' };
      }

      if (execution.status !== 'ready') {
        return { success: false, error: `Step is not ready: ${execution.status}` };
      }

      // Agent 가용성 확인
      const availabilityResult = await this.availabilityManager.isAgentAvailable(agentId);
      if (!availabilityResult.success) {
        return { success: false, error: availabilityResult.error };
      }

      // Task Queue에 작업 추가
      const taskResult = await this.availabilityManager.assignTask(
        agentId,
        'workflow_step',
        stepExecutionId,
        0, // priority
        {
          workflow_instance_id: execution.workflow_instance_id,
          workflow_step_id: execution.workflow_step_id,
        }
      );

      if (!taskResult.success || !taskResult.data) {
        return { success: false, error: taskResult.error };
      }

      // Step Execution 상태 업데이트
      const { error: updateError } = await this.supabase
        .from('workflow_step_executions')
        .update({
          agent_id: agentId,
          status: 'executing',
          started_at: new Date().toISOString(),
        })
        .eq('id', stepExecutionId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      console.log(`[WorkflowExecutor] Step 실행: ${stepExecutionId} → Agent ${agentId}`);
      return { success: true, data: taskResult.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Step 완료 처리
   */
  async completeStep(
    stepExecutionId: string,
    output?: Record<string, any>
  ): Promise<HandlerResult<void>> {
    try {
      // Step Execution 완료 처리
      const { data: execution, error: updateError } = await this.supabase
        .from('workflow_step_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          output: output || {},
        })
        .eq('id', stepExecutionId)
        .eq('status', 'executing')
        .select('workflow_instance_id, workflow_step_id')
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      if (!execution) {
        return { success: false, error: 'Step execution not found or not in executing state' };
      }

      console.log(`[WorkflowExecutor] Step 완료: ${stepExecutionId}`);

      // 의존하는 Step들의 의존성 체크 및 상태 업데이트
      await this.checkDependentSteps(execution.workflow_instance_id, execution.workflow_step_id);

      // Instance 전체 완료 체크
      await this.checkInstanceCompletion(execution.workflow_instance_id);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 의존하는 Step들의 의존성 체크
   */
  private async checkDependentSteps(instanceId: string, completedStepId: string): Promise<void> {
    // 완료된 Step에 의존하는 Step들 찾기
    const { data: dependentSteps } = await this.supabase
      .from('workflow_steps')
      .select('id')
      .contains('depends_on', [completedStepId]);

    if (!dependentSteps || dependentSteps.length === 0) {
      return;
    }

    // 각 의존 Step의 의존성이 모두 충족되었는지 확인
    for (const step of dependentSteps) {
      const { data: stepInfo } = await this.supabase
        .from('workflow_steps')
        .select('depends_on')
        .eq('id', step.id)
        .single();

      if (!stepInfo || !stepInfo.depends_on) continue;

      // 모든 의존 Step이 완료되었는지 확인
      const { data: dependencies } = await this.supabase
        .from('workflow_step_executions')
        .select('status')
        .eq('workflow_instance_id', instanceId)
        .in('workflow_step_id', stepInfo.depends_on);

      if (!dependencies) continue;

      const allCompleted = dependencies.every((dep) => dep.status === 'completed');

      if (allCompleted) {
        // 의존성 충족 → ready 상태로 변경
        await this.supabase
          .from('workflow_step_executions')
          .update({ status: 'ready' })
          .eq('workflow_instance_id', instanceId)
          .eq('workflow_step_id', step.id)
          .eq('status', 'pending');

        console.log(`[WorkflowExecutor] Step ready: ${step.id} (의존성 충족)`);
      }
    }

    // Ready 상태가 된 Step들 자동 실행
    await this.executeReadySteps(instanceId);
  }

  /**
   * Instance 전체 완료 체크
   */
  private async checkInstanceCompletion(instanceId: string): Promise<void> {
    const { data: executions } = await this.supabase
      .from('workflow_step_executions')
      .select('status')
      .eq('workflow_instance_id', instanceId);

    if (!executions || executions.length === 0) {
      return;
    }

    const allCompleted = executions.every(
      (exec) => exec.status === 'completed' || exec.status === 'skipped'
    );
    const anyFailed = executions.some((exec) => exec.status === 'failed');

    if (allCompleted) {
      await this.supabase
        .from('workflow_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', instanceId);

      console.log(`[WorkflowExecutor] Workflow 완료: ${instanceId}`);
    } else if (anyFailed) {
      await this.supabase
        .from('workflow_instances')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', instanceId);

      console.log(`[WorkflowExecutor] Workflow 실패: ${instanceId}`);
    }
  }

  /**
   * Step 실패 처리
   */
  async failStep(stepExecutionId: string, errorMessage: string): Promise<HandlerResult<void>> {
    try {
      const { data: execution, error: updateError } = await this.supabase
        .from('workflow_step_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('id', stepExecutionId)
        .eq('status', 'executing')
        .select('workflow_instance_id')
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      if (!execution) {
        return { success: false, error: 'Step execution not found or not in executing state' };
      }

      console.log(`[WorkflowExecutor] Step 실패: ${stepExecutionId} - ${errorMessage}`);

      // Instance 상태 체크
      await this.checkInstanceCompletion(execution.workflow_instance_id);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Step 스킵
   */
  async skipStep(stepExecutionId: string, reason: string): Promise<HandlerResult<void>> {
    try {
      const { data: execution, error: updateError } = await this.supabase
        .from('workflow_step_executions')
        .update({
          status: 'skipped',
          completed_at: new Date().toISOString(),
          error_message: reason,
        })
        .eq('id', stepExecutionId)
        .in('status', ['pending', 'ready'])
        .select('workflow_instance_id, workflow_step_id')
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      if (!execution) {
        return { success: false, error: 'Step execution not found or not in valid state' };
      }

      console.log(`[WorkflowExecutor] Step 스킵: ${stepExecutionId} - ${reason}`);

      // 의존하는 Step들의 의존성 체크
      await this.checkDependentSteps(execution.workflow_instance_id, execution.workflow_step_id);

      // Instance 상태 체크
      await this.checkInstanceCompletion(execution.workflow_instance_id);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Instance 취소
   */
  async cancelInstance(instanceId: string, reason: string): Promise<HandlerResult<void>> {
    try {
      // Instance 상태 업데이트
      const { error: instanceError } = await this.supabase
        .from('workflow_instances')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          metadata: { cancellation_reason: reason },
        })
        .eq('id', instanceId)
        .in('status', ['pending', 'running']);

      if (instanceError) {
        return { success: false, error: instanceError.message };
      }

      // 실행 중인 Step들 취소
      const { data: executingSteps } = await this.supabase
        .from('workflow_step_executions')
        .select('id')
        .eq('workflow_instance_id', instanceId)
        .eq('status', 'executing');

      if (executingSteps && executingSteps.length > 0) {
        for (const step of executingSteps) {
          await this.failStep(step.id, `Workflow cancelled: ${reason}`);
        }
      }

      console.log(`[WorkflowExecutor] Workflow 취소: ${instanceId} - ${reason}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Instance 상태 조회
   */
  async getInstanceStatus(instanceId: string): Promise<HandlerResult<WorkflowInstance>> {
    try {
      const { data: instance, error } = await this.supabase
        .from('workflow_instances')
        .select('*, workflow:workflow_id(name, description)')
        .eq('id', instanceId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: instance as any };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Instance의 모든 Step 실행 상태 조회
   */
  async getStepExecutions(instanceId: string): Promise<HandlerResult<WorkflowStepExecution[]>> {
    try {
      const { data: executions, error } = await this.supabase
        .from('workflow_step_executions')
        .select('*, workflow_step:workflow_step_id(name, description, step_order), agent:agent_id(name, role)')
        .eq('workflow_instance_id', instanceId)
        .order('workflow_step.step_order', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: executions as any };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

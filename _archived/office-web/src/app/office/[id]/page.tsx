'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useOfficeStore, Job } from '@/stores/officeStore';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import * as api from '@/lib/api';

// Dynamic imports (no SSR)
const OfficeCanvas = dynamic(
  () => import('@/components/office/OfficeCanvas'),
  { ssr: false }
);

const XtermTerminal = dynamic(
  () => import('@/components/XtermTerminal').then(mod => ({ default: mod.XtermTerminal })),
  { ssr: false }
);

const AgentSessionMonitor = dynamic(
  () => import('@/components/AgentSessionMonitor'),
  { ssr: false }
);

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500',
  ready: 'bg-yellow-500',
  processing: 'bg-blue-500',
  done: 'bg-green-500',
  merged: 'bg-purple-500',
  failed: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  ready: '준비',
  processing: '진행중',
  done: '완료',
  merged: '머지됨',
  failed: '실패',
};

// Demo Office UUID (DB에 시드된 Demo Office의 실제 UUID)
const DEMO_OFFICE_ID = '00000000-0000-0000-0000-000000000001';

// 잘 알려진 역할에 대한 색상 매핑 (없는 역할은 기본 색상 사용)
const ROLE_COLORS: Record<string, string> = {
  // PO Team (Pink/Purple tones)
  Researcher: 'bg-pink-600',
  Planner: 'bg-pink-500',
  Architect: 'bg-purple-600',
  Designer: 'bg-purple-500',
  // PM Team (Orange/Red tones)
  Publisher: 'bg-orange-600',
  FE: 'bg-red-500',
  DBA: 'bg-orange-500',
  BE: 'bg-blue-700',
  // Ops Team (Cyan/Green tones)
  QA: 'bg-cyan-500',
  Healer: 'bg-green-500',
  Infra: 'bg-gray-600',
  Marketer: 'bg-teal-500',
  // Special
  Orchestrator: 'bg-yellow-500',
  // Legacy
  PO: 'bg-pink-600',
  PM: 'bg-orange-500',
  DevOps: 'bg-gray-600',
};

// Demo 모드 초기 Job 목록 (시뮬레이션용)
const DEMO_JOBS: Job[] = [
  { id: 'j1', description: '로그인 UI 구현', status: 'done', progress: 100, prNumber: 42 },
  { id: 'j2', description: 'API 엔드포인트 추가', status: 'processing', progress: 60 },
  { id: 'j3', description: '테스트 코드 작성', status: 'ready', progress: 10 },
];

// URL의 officeId를 실제 DB UUID로 변환하는 헬퍼 함수
function resolveOfficeId(urlId: string): string {
  return urlId === 'demo' ? DEMO_OFFICE_ID : urlId;
}

export default function OfficePage() {
  const params = useParams();
  const urlOfficeId = params.id as string;
  // 실제 API 호출에 사용할 officeId (demo -> UUID 변환)
  const officeId = resolveOfficeId(urlOfficeId);
  const [command, setCommand] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<api.TaskResult | null>(null);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [personas, setPersonas] = useState<api.Persona[]>([]);
  const [officeAgents, setOfficeAgents] = useState<api.Agent[]>([]);
  const [addingAgent, setAddingAgent] = useState(false);
  const [executingJobs, setExecutingJobs] = useState<Set<string>>(new Set());

  // Session Monitor State
  const [showSessionMonitor, setShowSessionMonitor] = useState(false);

  const { jobs, messages, setJobs, addJobs, updateJob, setOfficeId } = useOfficeStore();

  // Initialize office and realtime
  useEffect(() => {
    setOfficeId(officeId);
  }, [officeId, setOfficeId]);

  useSupabaseRealtime(officeId);

  // Load personas
  const loadPersonas = useCallback(async () => {
    try {
      const result = await api.getPersonas();
      setPersonas(result.personas);
    } catch (err) {
      console.error('Failed to load personas:', err);
    }
  }, []);

  // Load agents for this office
  const loadAgents = useCallback(async () => {
    try {
      const result = await api.getAgents(officeId);
      setOfficeAgents(result.agents);
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  }, [officeId]);

  useEffect(() => {
    if (officeId) {
      loadPersonas();
      loadAgents();
      // Demo 모드에서는 초기 Job 목록 설정 (시뮬레이션용)
      if (urlOfficeId === 'demo') {
        setJobs(DEMO_JOBS);
      }
    }
  }, [officeId, urlOfficeId, loadPersonas, loadAgents, setJobs]);

  // Add agent to office (Demo 모드에서도 실제 API 호출)
  const handleAddAgent = async (personaId: string) => {
    setAddingAgent(true);
    try {
      await api.createAgent(officeId, { persona_id: personaId });
      await loadAgents();
      setShowAddAgent(false);
    } catch (err) {
      console.error('Failed to add agent:', err);
      setError(err instanceof Error ? err.message : 'Agent 추가 실패');
    } finally {
      setAddingAgent(false);
    }
  };

  // Execute a job
  const handleExecuteJob = async (jobId: string) => {
    if (urlOfficeId === 'demo') {
      // Demo mode: simulate job execution with agent assignment
      const job = jobs.find(j => j.id === jobId);
      if (!job) return;

      // Find an idle agent to assign
      const idleAgent = officeAgents.find(a => a.status === 'idle');
      if (!idleAgent) {
        setError('모든 Agent가 작업 중입니다. 잠시 후 다시 시도하세요.');
        return;
      }

      // Assign agent to job
      setOfficeAgents(prev => prev.map(a =>
        a.id === idleAgent.id
          ? { ...a, status: 'working' as const, current_task: job.description, current_job_id: jobId }
          : a
      ));

      // Update job to processing
      updateJob(jobId, { status: 'processing', progress: 30 });

      // Simulate progress updates
      setTimeout(() => updateJob(jobId, { progress: 60 }), 1500);
      setTimeout(() => updateJob(jobId, { progress: 90 }), 3000);

      // Complete job and release agent
      setTimeout(() => {
        updateJob(jobId, {
          status: 'done',
          progress: 100,
          prNumber: Math.floor(Math.random() * 100) + 1
        });
        // Release agent back to idle
        setOfficeAgents(prev => prev.map(a =>
          a.id === idleAgent.id
            ? { ...a, status: 'idle' as const, current_task: undefined, current_job_id: undefined }
            : a
        ));
      }, 4500);
      return;
    }
    setExecutingJobs(prev => new Set(prev).add(jobId));
    setError(null);

    try {
      // Find an idle agent to execute
      const idleAgent = officeAgents.find(a => a.status === 'idle');

      await api.executeJob(officeId, jobId, {
        agent_id: idleAgent?.id,
        create_worktree: true,
      });

      // Update job status locally
      setJobs(jobs.map(j =>
        j.id === jobId ? { ...j, status: 'processing' as const, progress: 10 } : j
      ));

      // Refresh jobs after a delay
      setTimeout(loadJobs, 2000);
    } catch (err) {
      console.error('Failed to execute job:', err);
      setError(err instanceof Error ? err.message : 'Job 실행 실패');
    } finally {
      setExecutingJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  // Execute all ready jobs
  const handleExecuteAllReady = async () => {
    const readyJobs = jobs.filter(j => j.status === 'ready');
    for (const job of readyJobs) {
      await handleExecuteJob(job.id);
    }
  };

  // Load initial jobs
  const loadJobs = useCallback(async () => {
    try {
      const result = await api.getJobs(officeId);
      setJobs(result.jobs.map(job => ({
        id: job.id,
        description: job.description,
        status: job.status,
        prNumber: job.pr_number,
        progress: job.status === 'done' || job.status === 'merged' ? 100 :
                  job.status === 'processing' ? 50 :
                  job.status === 'ready' ? 10 : 0,
      })));
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  }, [officeId, setJobs]);

  useEffect(() => {
    // Demo 모드는 DEMO_JOBS 시뮬레이션 사용, 그 외에는 API 호출
    if (officeId && urlOfficeId !== 'demo') {
      loadJobs();
    }
  }, [officeId, urlOfficeId, loadJobs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isSubmitting) return;

    if (urlOfficeId === 'demo') {
      // Demo mode: simulate full workflow - decomposition → agent assignment → execution
      setIsSubmitting(true);
      const timestamp = Date.now();
      const mockJobs: Job[] = [
        { id: `j-${timestamp}-1`, description: `${command} - UI 구현`, status: 'ready', progress: 10 },
        { id: `j-${timestamp}-2`, description: `${command} - API 연동`, status: 'ready', progress: 10 },
        { id: `j-${timestamp}-3`, description: `${command} - 테스트 작성`, status: 'pending', progress: 0 },
      ];

      // Step 1: Show decomposition result
      addJobs(mockJobs);
      setLastResult({
        message: 'Task 분해 완료 (Demo)',
        summary: `"${command}" 작업이 3개의 서브태스크로 분해되었습니다.`,
        estimated_agents: 2,
        jobs: mockJobs.map(j => ({ id: j.id, description: j.description, status: j.status, pr_number: undefined, office_id: 'demo', depends_on: [], priority: 1, created_at: new Date().toISOString() })),
        execution_order: [[mockJobs[0].id, mockJobs[1].id], [mockJobs[2].id]],
      });
      setCommand('');
      setIsSubmitting(false);

      // Step 2: Auto-execute ready jobs after delay (simulate orchestration)
      setTimeout(() => {
        // Execute first two jobs in parallel (if agents available)
        handleExecuteJob(mockJobs[0].id);
        setTimeout(() => handleExecuteJob(mockJobs[1].id), 500);
      }, 1500);

      // Step 3: Execute dependent job after first jobs complete
      setTimeout(() => {
        // Update pending job to ready
        updateJob(mockJobs[2].id, { status: 'ready', progress: 10 });
        // Execute after a short delay
        setTimeout(() => handleExecuteJob(mockJobs[2].id), 1000);
      }, 7000);

      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Use new Chat API (PM 조율 워크플로우)
      const chatResult = await api.sendChatMessage(officeId, {
        type: 'task_submit',
        content: command,
        sender_type: 'user',
      });

      if (!chatResult.success) {
        throw new Error(chatResult.error || 'Task 제출 실패');
      }

      // Convert chat result to TaskResult format for UI
      const result: api.TaskResult = {
        message: 'Task 분해 완료',
        summary: `"${command}" 작업이 ${chatResult.jobs?.length || 0}개의 서브태스크로 분해되었습니다.`,
        estimated_agents: chatResult.jobs?.length || 0,
        jobs: (chatResult.jobs || []).map(j => ({
          id: j.id,
          office_id: officeId,
          description: j.description,
          status: 'ready' as const,
          depends_on: j.depends_on,
          priority: j.priority,
          created_at: new Date().toISOString(),
        })),
        execution_order: [[...(chatResult.jobs || []).map(j => j.id)]],
      };

      setLastResult(result);
      setCommand('');

      // Update jobs with new ones
      setJobs(result.jobs.map(job => ({
        id: job.id,
        description: job.description,
        status: job.status,
        prNumber: job.pr_number,
        progress: 0,
      })));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Task 제출 실패';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-office-wall border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Semo Office</h1>
          <span className="text-sm text-gray-400">ID: {urlOfficeId}</span>
          {urlOfficeId === 'demo' && (
            <span className="px-2 py-1 text-xs bg-yellow-600 rounded font-medium">DEMO</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddAgent(true)}
            className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-700"
          >
            + Agent
          </button>
          <button
            onClick={() => setShowSessionMonitor(true)}
            className="px-3 py-1 text-sm bg-green-600 rounded hover:bg-green-700"
          >
            Sessions
          </button>
          <button
            onClick={() => { loadJobs(); loadAgents(); }}
            className="px-3 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600"
          >
            Refresh
          </button>
          <button className="px-3 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600">
            Settings
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Office View */}
        <div className="flex-1 relative">
          <OfficeCanvas officeId={officeId} />
        </div>

        {/* Sidebar */}
        <aside className="w-80 bg-office-wall border-l border-gray-700 flex flex-col">
          {/* Agents Panel */}
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-semibold mb-3">Agents ({officeAgents.length})</h2>
            {officeAgents.length === 0 ? (
              <p className="text-sm text-gray-500">에이전트가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {officeAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${
                      agent.status === 'working' ? 'bg-green-500 animate-pulse' :
                      agent.status === 'idle' ? 'bg-gray-400' : 'bg-yellow-500'
                    }`} />
                    <span className={`px-2 py-0.5 rounded text-xs text-white ${ROLE_COLORS[agent.persona?.role || 'FE'] || 'bg-gray-600'}`}>
                      {agent.persona?.role || 'Agent'}
                    </span>
                    <span className="text-gray-300 truncate">{agent.persona?.name || agent.id.slice(0, 8)}</span>
                    {agent.current_job_id && (
                      <span className="text-xs text-blue-400">작업중</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Jobs Panel */}
          <div className="p-4 border-b border-gray-700 max-h-[40%] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Jobs ({jobs.length})</h2>
              <div className="flex items-center gap-2">
                {jobs.some(j => j.status === 'ready') && (
                  <button
                    onClick={handleExecuteAllReady}
                    className="px-2 py-1 text-xs bg-green-600 rounded hover:bg-green-700"
                  >
                    Run All Ready
                  </button>
                )}
                {lastResult && (
                  <span className="text-xs text-gray-400">
                    {lastResult.estimated_agents} agents
                  </span>
                )}
              </div>
            </div>
            {jobs.length === 0 ? (
              <p className="text-sm text-gray-500">아직 작업이 없습니다</p>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="text-sm bg-gray-800/50 p-2 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="truncate flex-1" title={job.description}>
                        {job.description.slice(0, 25)}
                        {job.description.length > 25 ? '...' : ''}
                      </span>
                      <div className="flex items-center gap-1">
                        {job.status === 'ready' && (
                          <button
                            onClick={() => handleExecuteJob(job.id)}
                            disabled={executingJobs.has(job.id)}
                            className="px-2 py-0.5 text-xs bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {executingJobs.has(job.id) ? '...' : 'Run'}
                          </button>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[job.status]}`}>
                          {STATUS_LABELS[job.status]}
                        </span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-bar-fill ${
                          job.status === 'done' || job.status === 'merged' ? 'bg-green-500' :
                          job.status === 'processing' ? 'bg-blue-500 animate-pulse' : ''
                        }`}
                        style={{ width: `${job.progress || 0}%` }}
                      />
                    </div>
                    {job.prNumber && (
                      <a
                        href={`https://github.com/semicolon-devteam/semo/pull/${job.prNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline mt-1 inline-block"
                      >
                        PR #{job.prNumber}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Decomposition Result */}
          {lastResult && (
            <div className="p-4 border-b border-gray-700 bg-gray-800/50">
              <h3 className="text-sm font-semibold mb-2 text-green-400">Task 분해 완료</h3>
              <p className="text-xs text-gray-300 mb-2">{lastResult.summary}</p>
              <div className="text-xs text-gray-400">
                실행 순서: {lastResult.execution_order.map((group, i) => (
                  <span key={i}>
                    {i > 0 && ' → '}
                    [{group.length}개]
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Completed PRs */}
          {jobs.some(j => j.prNumber) && (
            <div className="p-4 border-b border-gray-700 bg-green-900/20">
              <h3 className="text-sm font-semibold mb-2 text-green-400">
                Pull Requests ({jobs.filter(j => j.prNumber).length})
              </h3>
              <div className="space-y-2">
                {jobs.filter(j => j.prNumber).map((job) => (
                  <div key={job.id} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${
                      job.status === 'merged' ? 'bg-purple-500' :
                      job.status === 'done' ? 'bg-green-500' : 'bg-gray-500'
                    }`} />
                    <a
                      href={`https://github.com/semicolon-devteam/semo/pull/${job.prNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      PR #{job.prNumber}
                    </a>
                    <span className="text-gray-400 text-xs truncate flex-1">
                      {job.description.slice(0, 20)}...
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[job.status]}`}>
                      {STATUS_LABELS[job.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Log */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h2 className="font-semibold mb-3">Messages ({messages.length})</h2>
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500">메시지가 없습니다</p>
            ) : (
              <div className="space-y-3 text-sm">
                {messages.slice(-20).map((msg) => (
                  <div key={msg.id} className="p-2 bg-gray-800 rounded">
                    {msg.fromAgentId && (
                      <span className="font-medium text-blue-400">{msg.fromAgentId}: </span>
                    )}
                    <span className="text-gray-300">{msg.content}</span>
                    <div className="text-xs text-gray-500 mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Command Input */}
      <footer className="px-6 py-4 bg-office-wall border-t border-gray-700">
        {error && (
          <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="작업을 입력하세요 (예: '로그인 기능 구현해줘')"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSubmitting || !command.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          >
            {isSubmitting ? '분석중...' : 'Submit'}
          </button>
        </form>
      </footer>

      {/* Add Agent Modal */}
      {showAddAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Agent 추가</h3>
              <button
                onClick={() => setShowAddAgent(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Office에 추가할 Agent의 역할을 선택하세요
            </p>
            {personas.length === 0 ? (
              <p className="text-sm text-gray-500">사용 가능한 Persona가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {personas.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => handleAddAgent(persona.id)}
                    disabled={addingAgent}
                    className="w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs text-white ${ROLE_COLORS[persona.role] || 'bg-gray-600'}`}>
                        {persona.role}
                      </span>
                      <span className="font-medium">{persona.name || persona.role}</span>
                    </div>
                    {persona.core_skills && persona.core_skills.length > 0 && (
                      <div className="mt-2 text-xs text-gray-400">
                        Skills: {persona.core_skills.slice(0, 3).join(', ')}
                        {persona.core_skills.length > 3 && '...'}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowAddAgent(false)}
                className="px-4 py-2 text-sm bg-gray-700 rounded hover:bg-gray-600"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Session Monitor */}
      <AgentSessionMonitor
        isOpen={showSessionMonitor}
        onClose={() => setShowSessionMonitor(false)}
      />
    </div>
  );
}

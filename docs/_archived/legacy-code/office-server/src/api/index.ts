/**
 * Semo Office API
 *
 * REST API for managing offices, agents, and jobs.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { TaskDecomposer } from '../decomposer/index.js';
import { JobScheduler } from '../scheduler/index.js';
import { WorktreeManager } from '../worktree/manager.js';
import { RealtimeHandler } from '../realtime/broadcast.js';
import { LocalSessionExecutor } from '../session/local-executor.js';
import { CommandHandler, AgentCommand } from '../session/command-handler.js';
import { ChatRouter } from '../chat/router.js';
import * as db from '../db/supabase.js';
import type { DecompositionRequest, AgentRole, AgentPersona, ChatMessage, ChatType } from '../types.js';
import type { AutoResponseConfig } from '../session/auto-responder.js';

// UUID validation regex (relaxed to accept any 8-4-4-4-12 hex pattern)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Global executor reference for WebSocket handler
let globalLocalExecutor: LocalSessionExecutor | null = null;

export function getLocalExecutor(): LocalSessionExecutor | null {
  return globalLocalExecutor;
}

// Middleware to validate UUID parameters
function validateUUID(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const paramName of paramNames) {
      const value = req.params[paramName];
      if (value && !isValidUUID(value)) {
        res.status(400).json({ error: `Invalid ${paramName}: must be a valid UUID` });
        return;
      }
    }
    next();
  };
}

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cors());

  const decomposer = new TaskDecomposer();
  const scheduler = new JobScheduler();
  const worktreeManager = new WorktreeManager();
  // Create LocalSessionExecutor with auto-response enabled by default
  const localExecutor = new LocalSessionExecutor(
    { verbose: true },
    {
      enabled: true,
      defaultBehavior: 'allow',
      preferSessionAllow: true,  // Prefer "Yes, allow for session" to reduce prompts
    }
  );
  const commandHandler = new CommandHandler(localExecutor);

  // Store reference for WebSocket handler
  globalLocalExecutor = localExecutor;

  // Chat routers by office (lazy initialized)
  const chatRouters = new Map<string, ChatRouter>();

  function getChatRouter(officeId: string): ChatRouter {
    let router = chatRouters.get(officeId);
    if (!router) {
      router = new ChatRouter(decomposer, scheduler, commandHandler, {
        officeId,
        autoSchedule: true,
        verbose: true,
      });
      chatRouters.set(officeId, router);
    }
    return router;
  }

  // Initialize executor
  localExecutor.initialize().catch((err) => {
    console.error('Failed to initialize LocalSessionExecutor:', err);
  });

  // Error handler
  const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'semo-office-server', version: '0.1.0' });
  });

  // === Office Management ===

  // List offices
  app.get('/api/offices', asyncHandler(async (_req: Request, res: Response) => {
    const offices = await db.listOffices();
    res.json({ offices });
  }));

  // Create office
  app.post('/api/offices', asyncHandler(async (req: Request, res: Response) => {
    const { name, github_org, github_repo, repo_path, layout } = req.body;

    if (!name || !github_org || !github_repo) {
      res.status(400).json({ error: 'name, github_org, and github_repo are required' });
      return;
    }

    const office = await db.createOffice({
      name,
      github_org,
      github_repo,
      repo_path,
      layout: layout || {},
    });

    res.status(201).json(office);
  }));

  // Get office
  app.get('/api/offices/:id', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const office = await db.getOffice(id);

    if (!office) {
      res.status(404).json({ error: 'Office not found' });
      return;
    }

    res.json(office);
  }));

  // Delete office
  app.delete('/api/offices/:id', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await db.deleteOffice(id);
    res.status(204).send();
  }));

  // === Task Management ===

  // Submit task (natural language)
  app.post('/api/offices/:id/tasks', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const { task, context } = req.body;

    if (!task) {
      res.status(400).json({ error: 'task is required' });
      return;
    }

    // Verify office exists
    const office = await db.getOffice(office_id);
    if (!office) {
      res.status(404).json({ error: 'Office not found' });
      return;
    }

    const request: DecompositionRequest = {
      office_id,
      request: task,
      context,
    };

    // Decompose task into jobs
    const result = await decomposer.decompose(request);

    // Create jobs in database with proper UUID mapping
    const createdJobs = [];
    const idMapping = new Map<string, string>(); // decomposer ID -> DB UUID

    // First pass: create all jobs without dependencies
    for (const job of result.jobs) {
      const createdJob = await db.createJob({
        office_id,
        description: job.description,
        status: 'pending', // Will update after dependency mapping
        depends_on: [],
        priority: job.priority,
        branch_name: `feature/${job.role.toLowerCase()}-${Date.now()}`,
      });

      idMapping.set(job.id, createdJob.id);
      createdJobs.push(createdJob);
    }

    // Second pass: update dependencies with actual UUIDs
    for (let i = 0; i < result.jobs.length; i++) {
      const job = result.jobs[i];
      const createdJob = createdJobs[i];

      // Map decomposer IDs to database UUIDs
      const mappedDeps = job.depends_on
        .map((depId) => idMapping.get(depId))
        .filter((id): id is string => id !== undefined);

      // Update job with mapped dependencies and correct status
      const updatedJob = await db.updateJob(createdJob.id, {
        depends_on: mappedDeps,
        status: mappedDeps.length === 0 ? 'ready' : 'pending',
      });

      createdJobs[i] = updatedJob;

      // Also enqueue in memory scheduler
      scheduler.enqueue([job], office_id);
    }

    res.status(201).json({
      message: 'Task decomposed and enqueued',
      summary: result.request_summary,
      jobs: createdJobs,
      execution_order: result.execution_order,
      estimated_agents: result.estimated_agents,
    });
  }));

  // Get jobs for office
  app.get('/api/offices/:id/jobs', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const { status } = req.query;

    const jobs = await db.getJobs(office_id, status as any);
    res.json({ office_id, jobs, total: jobs.length });
  }));

  // Get job details
  app.get('/api/offices/:id/jobs/:jobId', validateUUID('id', 'jobId'), asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const job = await db.getJob(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json(job);
  }));

  // Update job status
  app.patch('/api/offices/:id/jobs/:jobId', validateUUID('id', 'jobId'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id, jobId } = req.params;
    const { status, pr_number } = req.body;

    const job = await db.updateJob(jobId, { status, pr_number });

    // If job completed, update dependent jobs
    if (status === 'done' || status === 'merged') {
      await db.updateDependentJobs(office_id, jobId);
    }

    res.json(job);
  }));

  // === Agent Management ===

  // Get agents in office
  app.get('/api/offices/:id/agents', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const agents = await db.getAgents(office_id);
    res.json({ office_id, agents, total: agents.length });
  }));

  // Create agent in office
  app.post('/api/offices/:id/agents', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const { persona_id, position_x, position_y } = req.body;

    if (!persona_id) {
      res.status(400).json({ error: 'persona_id is required' });
      return;
    }

    const agent = await db.createAgent({
      office_id,
      persona_id,
      status: 'idle',
      position_x: position_x || 0,
      position_y: position_y || 0,
    });

    res.status(201).json(agent);
  }));

  // Update agent
  app.patch('/api/offices/:id/agents/:agentId', validateUUID('id', 'agentId'), asyncHandler(async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const updates = req.body;

    const agent = await db.updateAgent(agentId, updates);
    res.json(agent);
  }));

  // Send message to agent
  app.post('/api/offices/:id/agents/:agentId/message', validateUUID('id', 'agentId'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id, agentId } = req.params;
    const { content, message_type } = req.body;

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const message = await db.createMessage({
      office_id,
      to_agent_id: agentId,
      message_type: message_type || 'notification',
      content,
      context: {},
    });

    res.status(201).json(message);
  }));

  // === Worktree Management ===

  // Create worktree for agent
  app.post('/api/offices/:id/worktrees', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const { agent_role, branch_name } = req.body;

    if (!agent_role) {
      res.status(400).json({ error: 'agent_role is required' });
      return;
    }

    const office = await db.getOffice(office_id);
    if (!office || !office.repo_path) {
      res.status(400).json({ error: 'Office repo_path not configured' });
      return;
    }

    // Create physical worktree
    const worktree = await worktreeManager.createWorktree({
      officeId: office_id,
      repoPath: office.repo_path,
      agentRole: agent_role as AgentRole,
      branchName: branch_name,
    });

    // Save to database
    const record = await db.createWorktreeRecord({
      office_id,
      agent_role: agent_role as AgentRole,
      path: worktree.path,
      branch: worktree.branch,
      status: 'idle',
    });

    res.status(201).json(record);
  }));

  // Get worktrees
  app.get('/api/offices/:id/worktrees', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;

    const office = await db.getOffice(office_id);
    if (!office || !office.repo_path) {
      res.json({ office_id, worktrees: [] });
      return;
    }

    const worktrees = await worktreeManager.listWorktrees(office.repo_path);
    res.json({ office_id, worktrees });
  }));

  // Delete worktree
  app.delete('/api/offices/:id/worktrees/:worktreeId', validateUUID('id', 'worktreeId'), asyncHandler(async (req: Request, res: Response) => {
    const { worktreeId } = req.params;
    const { force } = req.query;

    // Get worktree record
    const office_id = req.params.id;
    // For MVP, we'll just delete the record
    // In production, we'd also clean up the physical worktree

    await db.deleteWorktreeRecord(worktreeId);
    res.status(204).send();
  }));

  // === Persona Management ===

  // Get personas
  app.get('/api/personas', asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.query;
    const personas = await db.getPersonas(role as AgentRole);
    res.json({ personas, total: personas.length });
  }));

  // Create custom persona
  app.post('/api/personas', asyncHandler(async (req: Request, res: Response) => {
    const { role, name, persona_prompt, scope_patterns, core_skills } = req.body;

    if (!role || !persona_prompt) {
      res.status(400).json({ error: 'role and persona_prompt are required' });
      return;
    }

    const persona = await db.createPersona({
      role,
      name,
      avatar_config: {},
      persona_prompt,
      scope_patterns: scope_patterns || [],
      skill_ids: [],
      core_skills: core_skills || [],
      knowledge_refs: [],
      is_default: false,
    });

    res.status(201).json(persona);
  }));

  // === Message Management ===

  // Get messages
  app.get('/api/offices/:id/messages', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const { limit } = req.query;

    const messages = await db.getMessages(office_id, Number(limit) || 50);
    res.json({ office_id, messages, total: messages.length });
  }));

  // Create message
  app.post('/api/offices/:id/messages', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const { from_agent_id, to_agent_id, message_type, content, context } = req.body;

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const message = await db.createMessage({
      office_id,
      from_agent_id,
      to_agent_id,
      message_type: message_type || 'notification',
      content,
      context: context || {},
    });

    res.status(201).json(message);
  }));

  // === Chat (PM 조율 워크플로우) ===

  // Send chat message (task_submit or proximity_chat)
  app.post('/api/offices/:id/chat', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const { type, content, target_agent_id, sender_type } = req.body;

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    if (!type || !['task_submit', 'proximity_chat'].includes(type)) {
      res.status(400).json({ error: 'type must be "task_submit" or "proximity_chat"' });
      return;
    }

    if (type === 'proximity_chat' && !target_agent_id) {
      res.status(400).json({ error: 'target_agent_id is required for proximity_chat' });
      return;
    }

    // Construct chat message
    const chatMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      office_id,
      type: type as ChatType,
      content,
      sender_type: sender_type || 'user',
      target_agent_id,
      created_at: new Date().toISOString(),
    };

    // Route through ChatRouter
    const router = getChatRouter(office_id);
    const result = await router.route(chatMessage);

    // Also save as agent message for history
    await db.createMessage({
      office_id,
      to_agent_id: target_agent_id || undefined,
      message_type: type === 'task_submit' ? 'request' : 'notification',
      content,
      context: {
        chat_type: type,
        chat_message_id: chatMessage.id,
        ...(result.jobs ? { jobs: result.jobs.map(j => j.id) } : {}),
      },
    });

    res.status(result.success ? 200 : 400).json(result);
  }));

  // Get chat router stats
  app.get('/api/offices/:id/chat/stats', validateUUID('id'), (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const router = getChatRouter(office_id);
    res.json(router.getStats());
  });

  // Register agent session for proximity chat
  app.post('/api/offices/:id/chat/sessions', validateUUID('id'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const { agent_id, session_id, role, worktree_path } = req.body;

    if (!agent_id || !session_id || !role) {
      res.status(400).json({ error: 'agent_id, session_id, and role are required' });
      return;
    }

    const router = getChatRouter(office_id);
    router.registerAgentSession({
      agentId: agent_id,
      sessionId: session_id,
      role: role as AgentRole,
      worktreePath: worktree_path,
    });

    res.json({ success: true, message: 'Agent session registered' });
  }));

  // Unregister agent session
  app.delete('/api/offices/:id/chat/sessions/:agentId', validateUUID('id', 'agentId'), (req: Request, res: Response) => {
    const { id: office_id, agentId } = req.params;

    const router = getChatRouter(office_id);
    router.unregisterAgentSession(agentId);

    res.json({ success: true, message: 'Agent session unregistered' });
  });

  // Get registered sessions
  app.get('/api/offices/:id/chat/sessions', validateUUID('id'), (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const router = getChatRouter(office_id);
    const sessions = router.getAgentSessions();
    res.json({ sessions, total: sessions.length });
  });

  // === Session Execution ===

  // Execute job with local session
  app.post('/api/offices/:id/jobs/:jobId/execute', validateUUID('id', 'jobId'), asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id, jobId } = req.params;
    const { agent_id, create_worktree } = req.body;

    // Get job
    const job = await db.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Get agent if specified
    let persona: AgentPersona | null = null;
    let agentRole: AgentRole = 'FE';
    if (agent_id) {
      const agents = await db.getAgents(office_id);
      const agent = agents.find(a => a.id === agent_id);
      if (agent && agent.persona) {
        persona = agent.persona;
        agentRole = persona.role as AgentRole;
      }
    }

    // Get default persona if not specified
    if (!persona) {
      const personas = await db.getPersonas();
      const defaultPersona = personas.find(p => p.is_default) || personas[0];
      if (defaultPersona) {
        persona = defaultPersona;
        agentRole = persona.role as AgentRole;
      }
    }

    if (!persona) {
      res.status(400).json({ error: 'No persona available' });
      return;
    }

    // Get office for repo path
    const office = await db.getOffice(office_id);
    if (!office || !office.repo_path) {
      res.status(400).json({ error: 'Office repo_path not configured' });
      return;
    }

    // Determine worktree path
    let worktreePath = office.repo_path;
    let worktreeRecord = null;

    if (create_worktree !== false) {
      try {
        // Create worktree for isolated execution
        const worktree = await worktreeManager.createWorktree({
          officeId: office_id,
          repoPath: office.repo_path,
          agentRole,
          branchName: job.branch_name,
        });
        worktreePath = worktree.path;

        // Save worktree record
        worktreeRecord = await db.createWorktreeRecord({
          office_id,
          agent_role: agentRole,
          path: worktree.path,
          branch: worktree.branch,
          status: 'active',
        });

        console.log(`[API] Created worktree for ${agentRole}: ${worktreePath}`);
      } catch (worktreeError) {
        // Fall back to using main repo if worktree creation fails
        console.warn('Failed to create worktree, using main repo:', worktreeError);
      }
    }

    // Update job status
    await db.updateJob(jobId, { status: 'processing' });

    // Execute asynchronously
    localExecutor.execute({
      job,
      persona,
      worktreePath,
      officeId: office_id,
      agentId: agent_id,
    }).then(async (result) => {
      // Update job status based on result
      if (result.success) {
        await db.updateJob(jobId, {
          status: 'done',
          pr_number: result.prNumber,
        });
        // Update dependent jobs
        await db.updateDependentJobs(office_id, jobId);
      } else {
        await db.updateJob(jobId, { status: 'failed' });
      }

      // Update worktree status
      if (worktreeRecord) {
        try {
          const wtStatus = await worktreeManager.getWorktreeStatus(worktreePath);
          await db.updateWorktree(worktreeRecord.id, {
            status: wtStatus.isClean ? 'idle' : 'dirty',
          });
        } catch (wtError) {
          console.warn('Failed to update worktree status:', wtError);
        }
      }
    }).catch(async (err) => {
      console.error(`Job ${jobId} execution failed:`, err);
      await db.updateJob(jobId, { status: 'failed' });

      // Mark worktree as failed
      if (worktreeRecord) {
        await db.updateWorktree(worktreeRecord.id, { status: 'failed' });
      }
    });

    res.json({
      message: 'Job execution started',
      job_id: jobId,
      status: 'processing',
    });
  }));

  // Get session stats
  app.get('/api/sessions/stats', (_req: Request, res: Response) => {
    const stats = commandHandler.getStats();
    res.json(stats);
  });

  // Execute command (semo-remote compatible)
  app.post('/api/sessions/command', asyncHandler(async (req: Request, res: Response) => {
    const command = req.body as AgentCommand;

    if (!command.command_type) {
      res.status(400).json({ error: 'command_type is required' });
      return;
    }

    if (!command.office_id) {
      res.status(400).json({ error: 'office_id is required' });
      return;
    }

    // Generate command ID if not provided
    if (!command.id) {
      command.id = `cmd-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    const result = await commandHandler.handleCommand(command);
    res.json(result);
  }));

  // List sessions
  app.get('/api/sessions', (_req: Request, res: Response) => {
    const sessions = localExecutor.getSessions().map(s => ({
      id: s.id,
      agentId: s.agentId,
      jobId: s.jobId,
      worktreePath: s.worktreePath,
      status: s.status,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
    }));
    res.json({ sessions, total: sessions.length });
  });

  // Cancel session
  app.post('/api/sessions/:sessionId/cancel', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const success = localExecutor.cancel(sessionId);
    res.json({ success });
  });

  // Terminate session
  app.delete('/api/sessions/:sessionId', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    await localExecutor.terminateSession(sessionId);
    res.status(204).send();
  }));

  // === Test Endpoints (Development Only) ===

  // Get test config
  app.get('/api/test/config', (_req: Request, res: Response) => {
    const playgroundPath = process.env.TEST_PLAYGROUND_PATH || '/tmp/semo-playground';
    res.json({
      playgroundPath,
      configured: !!process.env.TEST_PLAYGROUND_PATH,
    });
  });

  // Quick test: Create session and send simple prompt
  app.post('/api/test/session', asyncHandler(async (req: Request, res: Response) => {
    const playgroundPath = process.env.TEST_PLAYGROUND_PATH || '/tmp/semo-playground';
    const { prompt = 'echo "Hello from Semo Office!"', autoResponse } = req.body;

    // Create session with optional auto-response config
    const createResult = await commandHandler.handleCommand({
      id: `test-create-${Date.now()}`,
      office_id: 'test-office',
      command_type: 'create_session',
      payload: {
        worktree_path: playgroundPath,
        persona_name: 'Test Agent',
        initial_prompt: prompt,
        auto_response_config: autoResponse as Partial<AutoResponseConfig> | undefined,
      },
    });

    res.json({
      success: createResult.success,
      sessionId: createResult.sessionId,
      playgroundPath,
      autoResponseEnabled: autoResponse?.enabled !== false,
      message: createResult.success
        ? 'Session created! Claude Code is starting...'
        : createResult.error,
    });
  }));

  // Quick test: Send prompt to existing session
  app.post('/api/test/prompt', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, prompt } = req.body;

    if (!sessionId || !prompt) {
      res.status(400).json({ error: 'sessionId and prompt are required' });
      return;
    }

    const result = await commandHandler.handleCommand({
      id: `test-prompt-${Date.now()}`,
      office_id: 'test-office',
      session_id: sessionId,
      command_type: 'send_prompt',
      payload: { prompt },
    });

    res.json(result);
  }));

  // Quick test: Get session output
  app.get('/api/test/output/:sessionId', asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const lines = parseInt(req.query.lines as string) || 50;

    const result = await commandHandler.handleCommand({
      id: `test-output-${Date.now()}`,
      office_id: 'test-office',
      session_id: sessionId,
      command_type: 'get_output',
      payload: { lines },
    });

    res.json(result);
  }));

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('API Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  const port = process.env.PORT ?? 3001;
  app.listen(port, () => {
    console.log(`Semo Office Server running on port ${port}`);
  });
}

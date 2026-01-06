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
import * as db from '../db/supabase.js';
import type { DecompositionRequest, AgentRole } from '../types.js';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cors());

  const decomposer = new TaskDecomposer();
  const scheduler = new JobScheduler();
  const worktreeManager = new WorktreeManager();

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
  app.get('/api/offices/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const office = await db.getOffice(id);

    if (!office) {
      res.status(404).json({ error: 'Office not found' });
      return;
    }

    res.json(office);
  }));

  // Delete office
  app.delete('/api/offices/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await db.deleteOffice(id);
    res.status(204).send();
  }));

  // === Task Management ===

  // Submit task (natural language)
  app.post('/api/offices/:id/tasks', asyncHandler(async (req: Request, res: Response) => {
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

    // Create jobs in database
    const createdJobs = [];
    for (const job of result.jobs) {
      // Get default persona for role
      const persona = await db.getDefaultPersona(job.role);

      const createdJob = await db.createJob({
        office_id,
        description: job.description,
        status: job.depends_on.length === 0 ? 'ready' : 'pending',
        depends_on: job.depends_on,
        priority: job.priority,
        branch_name: `feature/${job.role.toLowerCase()}-${Date.now()}`,
      });

      createdJobs.push(createdJob);

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
  app.get('/api/offices/:id/jobs', asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const { status } = req.query;

    const jobs = await db.getJobs(office_id, status as any);
    res.json({ office_id, jobs, total: jobs.length });
  }));

  // Get job details
  app.get('/api/offices/:id/jobs/:jobId', asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const job = await db.getJob(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json(job);
  }));

  // Update job status
  app.patch('/api/offices/:id/jobs/:jobId', asyncHandler(async (req: Request, res: Response) => {
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
  app.get('/api/offices/:id/agents', asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const agents = await db.getAgents(office_id);
    res.json({ office_id, agents, total: agents.length });
  }));

  // Create agent in office
  app.post('/api/offices/:id/agents', asyncHandler(async (req: Request, res: Response) => {
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
  app.patch('/api/offices/:id/agents/:agentId', asyncHandler(async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const updates = req.body;

    const agent = await db.updateAgent(agentId, updates);
    res.json(agent);
  }));

  // Send message to agent
  app.post('/api/offices/:id/agents/:agentId/message', asyncHandler(async (req: Request, res: Response) => {
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
  app.post('/api/offices/:id/worktrees', asyncHandler(async (req: Request, res: Response) => {
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
  app.get('/api/offices/:id/worktrees', asyncHandler(async (req: Request, res: Response) => {
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
  app.delete('/api/offices/:id/worktrees/:worktreeId', asyncHandler(async (req: Request, res: Response) => {
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
  app.get('/api/offices/:id/messages', asyncHandler(async (req: Request, res: Response) => {
    const { id: office_id } = req.params;
    const { limit } = req.query;

    const messages = await db.getMessages(office_id, Number(limit) || 50);
    res.json({ office_id, messages, total: messages.length });
  }));

  // Create message
  app.post('/api/offices/:id/messages', asyncHandler(async (req: Request, res: Response) => {
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

/**
 * Semo Office Server
 *
 * Multi-agent orchestration backend for Semo Office.
 * Handles task decomposition, agent scheduling, and worktree management.
 */

import 'dotenv/config';
import { createServer } from 'http';
import { createApp, getLocalExecutor } from './api/index.js';
import { TerminalWebSocketHandler } from './session/terminal-ws.js';

// Start server when run directly
const isMainModule = process.argv[1]?.includes('index');

if (isMainModule) {
  const app = createApp();
  const port = process.env.PORT ?? 3001;

  // Create HTTP server
  const server = createServer(app);

  // Attach WebSocket handler for terminal streaming
  const executor = getLocalExecutor();
  if (executor) {
    const terminalWs = new TerminalWebSocketHandler(executor);
    terminalWs.attach(server);
  }

  server.listen(port, () => {
    console.log(`🚀 Semo Office Server v0.2.0`);
    console.log(`   Running on http://localhost:${port}`);
    console.log(`   Health: http://localhost:${port}/health`);
    console.log(`   API: http://localhost:${port}/api/offices`);
    console.log(`   WebSocket: ws://localhost:${port}/ws/terminal`);
  });
}

export { createApp, getLocalExecutor } from './api/index.js';
export { TaskDecomposer } from './decomposer/index.js';
export { SessionPool } from './session/pool.js';
export { SessionExecutor } from './session/executor.js';
export { LocalSessionExecutor } from './session/local-executor.js';
export { CommandHandler } from './session/command-handler.js';
export { TerminalWebSocketHandler } from './session/terminal-ws.js';
export { ChatRouter } from './chat/router.js';
export { WorktreeManager } from './worktree/manager.js';
export { JobScheduler } from './scheduler/index.js';
export { RealtimeHandler } from './realtime/broadcast.js';

// Database
export * as db from './db/supabase.js';

// Types
export type {
  Office,
  Job,
  AgentPersona,
  Worktree,
  OfficeAgent,
  AgentMessage,
  AgentRole,
  JobStatus,
  WorktreeStatus,
  AgentStatus,
  MessageType,
  DecompositionRequest,
  DecompositionResult,
  DecomposedJob,
  DependencyEdge,
  ProjectContext,
  // Chat types
  ChatType,
  ChatMessage,
  ChatRouteResult,
} from './types.js';

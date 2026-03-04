/**
 * Terminal WebSocket Handler
 *
 * Streams rendered screen content to connected clients via WebSocket.
 * Uses UPSERT style: sends full screen state on each change.
 * Client replaces entire terminal content instead of appending.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { LocalSessionExecutor } from './local-executor.js';

interface TerminalClient {
  ws: WebSocket;
  sessionId: string;
}

export class TerminalWebSocketHandler {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<TerminalClient>> = new Map();
  private executor: LocalSessionExecutor;

  constructor(executor: LocalSessionExecutor) {
    this.executor = executor;
    this.setupExecutorListeners();
  }

  /**
   * Attach WebSocket server to HTTP server
   */
  attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws/terminal' });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        ws.close(4000, 'sessionId is required');
        return;
      }

      console.log(`[TerminalWS] Client connected for session: ${sessionId}`);

      // Register client
      const client: TerminalClient = { ws, sessionId };
      if (!this.clients.has(sessionId)) {
        this.clients.set(sessionId, new Set());
      }
      this.clients.get(sessionId)!.add(client);

      // Check if session exists and send initial screen content
      const session = this.executor.getSession(sessionId);
      if (!session) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Session not found',
        }));
      } else {
        // Send initial screen content (UPSERT style)
        const screenContent = this.executor.getScreen(sessionId);
        if (screenContent) {
          ws.send(JSON.stringify({
            type: 'screen',
            content: screenContent,
          }));
        }
      }

      // Handle incoming messages (input from client)
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(sessionId, message);
        } catch {
          console.error('[TerminalWS] Invalid message format');
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        console.log(`[TerminalWS] Client disconnected from session: ${sessionId}`);
        const clients = this.clients.get(sessionId);
        if (clients) {
          clients.delete(client);
          if (clients.size === 0) {
            this.clients.delete(sessionId);
          }
        }
      });

      // Send ready message
      ws.send(JSON.stringify({
        type: 'connected',
        sessionId,
      }));
    });

    console.log('[TerminalWS] WebSocket server attached at /ws/terminal');
  }

  /**
   * Setup listeners on LocalSessionExecutor
   */
  private setupExecutorListeners(): void {
    // Listen for screen events (UPSERT style - full screen content)
    this.executor.on('screen', ({ sessionId, content }) => {
      this.broadcast(sessionId, {
        type: 'screen',
        content,
      });
    });

    // Listen for raw output events (legacy compatibility)
    this.executor.on('output', ({ sessionId, data }) => {
      this.broadcast(sessionId, {
        type: 'output',
        data,
      });
    });

    // Listen for session end events
    this.executor.on('sessionEnded', ({ sessionId, exitCode }) => {
      this.broadcast(sessionId, {
        type: 'sessionEnded',
        exitCode,
      });
      // Clean up clients for this session
      this.clients.delete(sessionId);
    });

    // Listen for completion events
    this.executor.on('complete', (result) => {
      this.broadcast(result.sessionId, {
        type: 'complete',
        success: result.success,
        prNumber: result.prNumber,
        duration: result.duration,
      });
    });
  }

  /**
   * Handle messages from client
   */
  private handleClientMessage(sessionId: string, message: { type: string; data?: string }): void {
    switch (message.type) {
      case 'input':
        // Send input to PTY
        if (message.data) {
          this.executor.sendText(sessionId, message.data);
        }
        break;

      case 'resize':
        // Handle terminal resize (could extend LocalSessionExecutor to support this)
        console.log(`[TerminalWS] Resize requested for ${sessionId}`);
        break;

      case 'cancel':
        // Send Ctrl+C
        this.executor.cancel(sessionId);
        break;

      default:
        console.log(`[TerminalWS] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Broadcast message to all clients watching a session
   */
  private broadcast(sessionId: string, message: object): void {
    const clients = this.clients.get(sessionId);
    if (!clients) return;

    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  /**
   * Get connected client count for a session
   */
  getClientCount(sessionId: string): number {
    return this.clients.get(sessionId)?.size || 0;
  }

  /**
   * Get all active session IDs with connected clients
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Close all connections
   */
  close(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
  }
}

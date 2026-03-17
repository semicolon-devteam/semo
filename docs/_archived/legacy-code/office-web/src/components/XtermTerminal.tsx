'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface XtermTerminalProps {
  sessionId: string;
  wsUrl?: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string | null) => void;
  className?: string;
}

export function XtermTerminal({
  sessionId,
  wsUrl = 'ws://localhost:3030/ws/terminal',
  onConnected,
  onDisconnected,
  onError,
  className = '',
}: XtermTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const url = `${wsUrl}?sessionId=${sessionId}`;
    console.log('[XtermTerminal] Connecting to:', url);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[XtermTerminal] Connected');
      setIsConnected(true);
      onError?.(null); // Clear any previous errors
      onConnected?.();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'screen':
            // UPSERT style: replace entire screen content
            if (terminalInstance.current && message.content) {
              terminalInstance.current.reset();
              // Write rendered screen content line by line
              const lines = message.content.split('\n');
              lines.forEach((line: string, index: number) => {
                if (index > 0) {
                  terminalInstance.current?.write('\r\n');
                }
                terminalInstance.current?.write(line);
              });
            }
            break;
          case 'output':
            // Legacy: append raw PTY output
            terminalInstance.current?.write(message.data);
            break;
          case 'connected':
            console.log('[XtermTerminal] Session connected:', message.sessionId);
            break;
          case 'sessionEnded':
            console.log('[XtermTerminal] Session ended:', message.exitCode);
            terminalInstance.current?.writeln(`\r\n\x1b[33m[Session ended with code ${message.exitCode}]\x1b[0m`);
            break;
          case 'complete':
            terminalInstance.current?.writeln(`\r\n\x1b[32m[Task completed - success: ${message.success}]\x1b[0m`);
            break;
          case 'error':
            console.error('[XtermTerminal] Error:', message.message);
            onError?.(message.message);
            break;
        }
      } catch {
        // Raw data - write directly
        terminalInstance.current?.write(event.data);
      }
    };

    ws.onclose = (event) => {
      console.log('[XtermTerminal] Disconnected, code:', event.code);
      setIsConnected(false);
      onDisconnected?.();

      // Auto-reconnect after 2 seconds if not a normal close
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[XtermTerminal] Attempting to reconnect...');
          connect();
        }, 2000);
      }
    };

    ws.onerror = () => {
      // Error details are not available in browser WebSocket API
      // The onclose event will fire after this with more details
      console.log('[XtermTerminal] WebSocket error occurred');
    };
  }, [sessionId, wsUrl, onConnected, onDisconnected, onError]);

  // Send input to server
  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data }));
    }
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
    });

    // Add addons
    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();

    terminal.loadAddon(fit);
    terminal.loadAddon(webLinks);

    // Open terminal
    terminal.open(terminalRef.current);
    fit.fit();

    // Store references
    terminalInstance.current = terminal;
    fitAddon.current = fit;

    // Handle input
    terminal.onData((data) => {
      sendInput(data);
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
    });
    resizeObserver.observe(terminalRef.current);

    // Connect to WebSocket
    connect();

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close(1000); // Normal close
      terminal.dispose();
    };
  }, [connect, sendInput]);

  // Reconnect when sessionId changes
  useEffect(() => {
    if (terminalInstance.current) {
      terminalInstance.current.clear();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close(1000);
      connect();
    }
  }, [sessionId, connect]);

  return (
    <div className={`relative ${className}`}>
      {/* Connection status indicator */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 text-xs">
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-gray-400">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Terminal container */}
      <div
        ref={terminalRef}
        className="w-full h-full min-h-[300px] bg-[#1e1e1e] rounded overflow-hidden"
      />
    </div>
  );
}

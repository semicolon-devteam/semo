/**
 * Runtime Portable HostAdapter 구현체 모음.
 *
 * P5-1: ClaudeCodeAdapter (현 동작 1:1 wrap)
 * P5-4: CodexAdapter (예정)
 * P5-5: OllamaAdapter, HermesAdapter (stub, 예정)
 */

export { ClaudeCodeAdapter, type ClaudeCodeAdapterOptions } from './claude-code-adapter.js';
export { CodexCliAdapter, type CodexCliAdapterOptions } from './codex-cli-adapter.js';
export { OllamaCliAdapter, type OllamaCliAdapterOptions } from './ollama-cli-adapter.js';
export { HermesDesktopAdapter } from './hermes-desktop-adapter.js';
export { OpenClawAdapter, type OpenClawAdapterOptions } from './openclaw-adapter.js';

/**
 * Runtime Portable bridges — host 간 도구/세션/결과 변환 helper.
 *
 * P5-4b: Codex MCP bridge (ToolGateway → Codex MCP 도구).
 * P5-x  : Claude tool_use bridge, Hermes notification bridge 등.
 */

export {
  buildCodexMcpTools,
  buildCodexMcpServerStanza,
  type CodexMcpTool,
} from './codex-mcp-bridge.js';

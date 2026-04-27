/**
 * Codex MCP Bridge — ToolGateway 의 도구 정의를 Codex CLI 가 인식하는 MCP 도구 형태로 변환.
 *
 * P5-4b 시범 단계: 변환 helper + Codex config.toml 패치 helper 만 제공.
 * 실 MCP 서버 (stdio transport) spawn 은 별도 entry point (P5-4b.ii) 에서 다룬다.
 *
 * Codex CLI MCP 통합:
 *   ~/.codex/config.toml
 *   ----
 *   [mcp.servers.semo]
 *   command = "node"
 *   args = ["/path/to/semo-mcp-bridge.js"]
 *
 * Codex 가 시작 시 [mcp.servers.*] 를 stdio JSON-RPC 로 spawn → tools/list 로 도구 목록 가져옴.
 */

import type { ToolDefinition, ToolGateway } from '../tool-gateway.js';

/**
 * MCP `tools/list` 응답 형태. @modelcontextprotocol/sdk 의 ListToolsResult 와 호환.
 */
export interface CodexMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * ToolGateway 의 도구 정의를 Codex MCP 도구 배열로 변환.
 * definition 형태로 등록된 도구만 노출 (P5-3a 호환의 name-only 등록은 제외).
 */
export function buildCodexMcpTools(gateway: ToolGateway): CodexMcpTool[] {
  return gateway.listDefinitions().map((def: ToolDefinition) => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
  }));
}

/**
 * Codex `~/.codex/config.toml` 에 추가할 MCP 서버 stanza 생성.
 * 호출처가 fs.appendFileSync(configPath, stanza) 로 직접 적용.
 */
export function buildCodexMcpServerStanza(input: {
  serverName: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}): string {
  const { serverName, command, args = [], env = {} } = input;
  const lines: string[] = [`[mcp.servers.${serverName}]`, `command = "${command}"`];
  if (args.length > 0) {
    lines.push(`args = [${args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(', ')}]`);
  }
  if (Object.keys(env).length > 0) {
    lines.push('[mcp.servers.' + serverName + '.env]');
    for (const [k, v] of Object.entries(env)) {
      lines.push(`${k} = "${v.replace(/"/g, '\\"')}"`);
    }
  }
  return lines.join('\n') + '\n';
}

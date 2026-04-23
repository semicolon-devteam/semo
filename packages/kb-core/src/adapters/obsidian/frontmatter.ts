/**
 * 최소 YAML frontmatter 파서 — Obsidian 노트의 `--- ... ---` 블록.
 *
 * 지원: `key: value`, `key: "quoted value"`, 숫자, 불리언, 단순 리스트(`- item`).
 * 비지원: 중첩 객체, 블록 스칼라. 고급 YAML 가 필요하면 js-yaml 로 교체.
 */
export interface FrontmatterResult {
  data: Record<string, unknown>;
  body: string;
}

const FM_START = /^---\s*\n/;
const FM_END = /\n---\s*(?:\n|$)/;

export function parseFrontmatter(source: string): FrontmatterResult {
  if (!FM_START.test(source)) return { data: {}, body: source };
  const startMatch = source.match(FM_START);
  if (!startMatch) return { data: {}, body: source };
  const afterStart = source.slice(startMatch[0].length);
  const endMatch = afterStart.match(FM_END);
  if (!endMatch) return { data: {}, body: source };
  const yaml = afterStart.slice(0, endMatch.index!);
  const body = afterStart.slice(endMatch.index! + endMatch[0].length);
  return { data: parseSimpleYaml(yaml), body };
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = yaml.split(/\r?\n/);
  let currentListKey: string | null = null;
  let currentList: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;
    if (currentListKey && /^\s+-\s/.test(line)) {
      currentList.push(parseScalar(line.replace(/^\s+-\s+/, '')) as string);
      continue;
    }
    if (currentListKey) {
      out[currentListKey] = currentList;
      currentListKey = null;
      currentList = [];
    }
    const m = line.match(/^([^:\s][^:]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2];
    if (!value) {
      currentListKey = key;
      currentList = [];
      continue;
    }
    out[key] = parseScalar(value);
  }
  if (currentListKey) out[currentListKey] = currentList;
  return out;
}

function parseScalar(raw: string): unknown {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

export function renderFrontmatter(data: Record<string, unknown>, body: string): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${stringifyScalar(item)}`);
    } else {
      lines.push(`${key}: ${stringifyScalar(value)}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n') + body;
}

function stringifyScalar(v: unknown): string {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (/[:#\n"']/.test(s)) return `"${s.replace(/"/g, '\\"')}"`;
  return s;
}

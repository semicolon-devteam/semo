/**
 * operator-persona — operator(슬랙 관리채널)가 base 에이전트 행동(SOUL) SoT 를 편집하는 로직.
 *
 * 안전 패턴: operator hermes 는 도구 없이 대화만 한다(슬랙-트리거 셸 금지).
 * 라우터가 (1) 현재 persona 들을 프롬프트에 주입 → operator 가 diff 제안,
 * (2) 사용자가 컨펌하면 operator 가 APPLY_PERSONA 블록을 출력,
 * (3) 라우터가 그 블록을 파싱해 DB(${DB_SCHEMA}.agent_personas) 갱신 + 프로토타입 hermes SOUL.md 동기화.
 *
 * 설계: docs/superpowers/specs/2026-06-02-agent-behavior-sot-and-propagation-design.md
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Pool } from 'pg';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export interface PersonaRow {
  slug: string;
  display_name: string | null;
  soul_md: string;
  version: number;
}

export async function listActivePersonas(pool: Pool): Promise<PersonaRow[]> {
  const { rows } = await pool.query<PersonaRow>(
    `SELECT slug, display_name, soul_md, version
       FROM ${DB_SCHEMA}.agent_personas WHERE status = 'active' ORDER BY slug`,
  );
  return rows;
}

/** operator 프롬프트에 주입할 "현재 행동 정의" 블록. operator 는 도구가 없으므로 이걸 보고 제안한다. */
export function buildPersonaContextBlock(personas: PersonaRow[]): string {
  if (personas.length === 0) return '';
  const lines = ['# 현재 등록된 base 에이전트 행동(SOUL) — 네가 편집할 수 있는 대상'];
  for (const p of personas) {
    lines.push(
      `\n## persona slug: ${p.slug} (v${p.version}${p.display_name ? `, ${p.display_name}` : ''})`,
    );
    lines.push('````md');
    lines.push(p.soul_md);
    lines.push('````');
  }
  return lines.join('\n');
}

export interface OperatorMentionTarget {
  botId: string;
  displayName: string;
  mention: string;
}

export function buildOperatorMentionGuide(targets: OperatorMentionTarget[]): string {
  const targetByBotId = new Map<string, OperatorMentionTarget>();
  for (const target of targets) {
    if (!targetByBotId.has(target.botId)) targetByBotId.set(target.botId, target);
  }
  const uniqueTargets = Array.from(targetByBotId.values());
  if (uniqueTargets.length === 0) return '';
  const lines = [
    '# Slack bot 호출 권한',
    '사용자가 Semi/Colony에게 질문해달라, 테스트해달라, 호출해달라, 답하게 해달라고 요청하면 다른 base 에이전트를 직접 호출할 수 있습니다.',
    '',
    '정확한 Slack 멘션 토큰:',
  ];
  for (const target of uniqueTargets) {
    lines.push(`- ${target.displayName} (\`${target.botId}\`): ${target.mention}`);
  }
  lines.push(
    '',
    '규칙:',
    '- 이 호출은 행동 수정이 아니므로 APPLY_PERSONA 블록이 필요 없습니다.',
    '- 실제로 호출할 때는 위 토큰을 그대로 쓰고, 그 뒤에 질문/요청을 한 문장으로 붙입니다.',
    '- 호출한 에이전트의 답을 대신 지어내지 말고, 답변은 해당 에이전트가 이어서 하게 둡니다.',
  );
  return lines.join('\n');
}

export function shouldTriggerOperatorAdminRoute(text: string, operatorMentionToken = ''): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (operatorMentionToken && trimmed.includes(operatorMentionToken)) return true;
  return /^(?:@?(?:operator|오퍼레이터))(?:\s|$|<)/i.test(trimmed);
}

export interface ParsedApply {
  slug: string;
  note?: string;
  soul: string;
}

/**
 * operator 출력에서 적용 지시 블록을 파싱.
 * 형식:
 *   APPLY_PERSONA: <slug>
 *   NOTE: <한 줄>
 *   ---SOUL---
 *   <새 soul_md 전체>
 *   ---END---
 */
export function parseApplyPersona(text: string): ParsedApply | null {
  const m = text.match(
    /APPLY_PERSONA:\s*([a-z0-9_-]+)[^\n]*\n([\s\S]*?)---SOUL---\s*\n([\s\S]*?)\n\s*---END---/i,
  );
  if (!m) return null;
  const slug = m[1].trim();
  const noteM = m[2].match(/NOTE:\s*(.+)/i);
  const soul = m[3].trim();
  if (!soul) return null;
  return { slug, note: noteM ? noteM[1].trim() : undefined, soul };
}

/**
 * 파싱된 적용 지시를 DB 에 반영(version++ + revision) 하고 프로토타입 hermes SOUL.md 동기화.
 * 존재하지 않는 slug 는 거부(operator 는 기존 persona 만 편집).
 * @returns 새 version
 */
export async function applyPersona(
  pool: Pool,
  apply: ParsedApply,
  by: string,
  hermesHome: string,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ version: number }>(
      `SELECT version FROM ${DB_SCHEMA}.agent_personas WHERE slug = $1 FOR UPDATE`,
      [apply.slug],
    );
    if (existing.rows.length === 0) {
      throw new Error(`unknown persona slug: ${apply.slug}`);
    }
    const version = existing.rows[0].version + 1;
    await client.query(
      `UPDATE ${DB_SCHEMA}.agent_personas
          SET soul_md = $2, version = $3, updated_by = $4, updated_at = now()
        WHERE slug = $1`,
      [apply.slug, apply.soul, version, by],
    );
    await client.query(
      `INSERT INTO ${DB_SCHEMA}.agent_persona_revisions (slug, version, soul_md, updated_by, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [apply.slug, version, apply.soul, by, apply.note ?? null],
    );
    await client.query('COMMIT');
    // 프로토타입 런타임 즉시 반영 (hermes 는 SOUL.md 를 매 메시지 fresh-load)
    const destDir = path.join(hermesHome, 'profiles', `semo-${apply.slug}`);
    if (fs.existsSync(destDir)) {
      fs.writeFileSync(path.join(destDir, 'SOUL.md'), apply.soul);
    }
    return version;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

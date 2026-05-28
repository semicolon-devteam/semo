/**
 * Persona Pack 스키마 + validator (기획 §3.2, P0.2).
 * 정본 packs 는 packages/semo-dashboard/personas/*.json. 이 모듈은 타입·검증·기본값만.
 */
export const PERSONA_IDS = ['shop', 'personal', 'worker'] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];
export const DEFAULT_PERSONA_ID: PersonaId = 'shop';

export function isPersonaId(v: unknown): v is PersonaId {
  return typeof v === 'string' && (PERSONA_IDS as readonly string[]).includes(v);
}

export interface PersonaAgent {
  id: string;
  name: string;
  role: string;
  dept?: string;
  color?: string;
  accent?: string;
  accessoryKind?: string;
}

/**
 * 콘텐츠 깊은 구조(home/team/...)는 화면(screen-persona)이 자체 소비하므로 느슨하게 둔다.
 * 검증은 최상위 필수 키 + id/agents 형태만 (P0: 골조 안전).
 */
export interface PersonaPack {
  id: PersonaId;
  label: string;
  longLabel?: string;
  icon?: string;
  accent?: string;
  ownerLabel?: string;
  workspace: { name: string; subtitle?: string };
  agents: PersonaAgent[];
  home: Record<string, unknown>;
  team: Record<string, unknown>;
  knowledge: Record<string, unknown>;
  library: Record<string, unknown>;
  plan: Record<string, unknown>;
}

const REQUIRED_KEYS: (keyof PersonaPack)[] = [
  'id',
  'label',
  'workspace',
  'agents',
  'home',
  'team',
  'knowledge',
  'library',
  'plan',
];

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validatePersonaPack(pack: unknown): ValidationResult {
  const errors: string[] = [];
  if (!pack || typeof pack !== 'object') {
    return { ok: false, errors: ['pack is not an object'] };
  }
  const p = pack as Record<string, unknown>;
  for (const k of REQUIRED_KEYS) {
    if (!(k in p)) errors.push(`missing key: ${k}`);
  }
  if ('id' in p && !isPersonaId(p.id)) errors.push(`invalid id: ${String(p.id)}`);
  if ('agents' in p && !Array.isArray(p.agents)) errors.push('agents must be an array');
  if ('workspace' in p && (typeof p.workspace !== 'object' || p.workspace === null)) {
    errors.push('workspace must be an object');
  }
  return { ok: errors.length === 0, errors };
}

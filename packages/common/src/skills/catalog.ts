/**
 * KernelSkillCatalog — builtin kernel skill 조회.
 *
 * 추후 tenant overlay 가 필요하면 constructor 에 주입한 tenant 목록을 우선 적용.
 */
import { BUILTIN_KERNEL_SKILLS } from './builtin.js';
import type { KernelSkill } from './types.js';

export class KernelSkillCatalog {
  private readonly byId: Map<string, KernelSkill>;

  constructor(private readonly skills: readonly KernelSkill[] = BUILTIN_KERNEL_SKILLS) {
    this.byId = new Map(skills.map((s) => [s.id.toLowerCase(), s]));
  }

  list(): readonly KernelSkill[] {
    return this.skills;
  }

  get(id: string): KernelSkill | null {
    return this.byId.get(id.toLowerCase()) ?? null;
  }

  has(id: string): boolean {
    return this.byId.has(id.toLowerCase());
  }
}

export const defaultKernelSkillCatalog = new KernelSkillCatalog();

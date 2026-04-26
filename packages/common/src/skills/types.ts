/**
 * KernelSkill — L0 카탈로그 스킬 (OSS 배포 산출물).
 *
 * tenant 가 같은 이름의 스킬을 `~/.semo/tenant/skills/{name}/SKILL.md` 로 두면
 * `semo update` 가 그 파일을 우선 적용한다 (3-way overlay).
 *
 * 본 인터페이스는 SKILL.md "원본" 문자열을 코드에 inline 한 형태이며,
 * `semo update` 는 이를 `~/.semo/kernel/skills/{id}/SKILL.md` 로 풀어 쓴다.
 */
export interface KernelSkill {
  /** 디렉터리/스킬명 (kebab-case). */
  readonly id: string;
  /** 한 줄 요약 — 카탈로그에 노출. */
  readonly summary: string;
  /** SKILL.md 본문 (frontmatter 포함 전체 텍스트). */
  readonly skillMd: string;
}

/**
 * SEMO → semicolony 리브랜딩 호환 레이어 (Phase 0).
 *
 * 전면 리브랜딩을 무중단·롤백 가능하게 하기 위한 dual-read 기반 유틸.
 * 원칙: **SEMICOLONY_* 우선, SEMO_* fallback** (무기한 양방향 호환).
 * Phase 0 단계에서는 default 값이 모두 구(`semo`) 기준이라 **동작 불변**.
 * DB/KB 마이그레이션(Phase 1·2) 완료 후 Phase 3 에서 default 를 `semicolony` 로 flip.
 *
 * 설계: ~/.claude/plans/squishy-chasing-planet.md
 */
import * as path from 'path';
import * as os from 'os';

/** `SEMICOLONY_<suffix>` 우선, 없으면 `SEMO_<suffix>`, 둘 다 없으면 undefined. */
export function envDual(suffix: string): string | undefined {
  return process.env[`SEMICOLONY_${suffix}`] ?? process.env[`SEMO_${suffix}`];
}

/**
 * 플랫폼 홈 디렉토리.
 * Phase 0: default `~/.semo` (동작 불변). Phase 5(디렉토리 이전)에서 default 를 `~/.semicolony` 로 flip.
 * `SEMICOLONY_HOME` > `SEMO_HOME` > `~/.semo`.
 */
export function resolveSemoHome(): string {
  return envDual('HOME') ?? path.join(os.homedir(), '.semo');
}

/**
 * DB 스키마 한정자. Phase 0~2: `'semo'`(동작 불변). Phase 3 에서 default 를 `'semicolony'` 로 flip.
 * `SEMICOLONY_DB_SCHEMA` / `SEMO_DB_SCHEMA` 로 운영 override 가능.
 */
export const DB_SCHEMA: string = envDual('DB_SCHEMA') ?? 'semo';

/** KB 플랫폼 도메인. Phase 0~2: `'semo'`. Phase 3 에서 `'semicolony'`. override: `*_PLATFORM_KB_DOMAIN`. */
export const PLATFORM_KB_DOMAIN: string = envDual('PLATFORM_KB_DOMAIN') ?? 'semo';

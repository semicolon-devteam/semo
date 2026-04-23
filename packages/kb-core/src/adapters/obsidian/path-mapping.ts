/**
 * Vault 경로 ↔ (domain, key, subKey) 매핑.
 *
 * 규칙:
 *   SEMO/{domain}/{key}.md              → subKey 없음 (singleton)
 *   SEMO/{domain}/{key}/{subKey}.md     → subKey 존재 (collection)
 *   SEMO/{domain}/{key}/{a}/{b}.md      → subKey = "a/b" (중첩 collection)
 *
 * 파일 이름/디렉토리에 경로 구분자가 없고 "/" 로만 합성되므로, subKey 는 평문 슬래시를 보존한다.
 */
import path from 'node:path';

export const SEMO_ROOT = 'SEMO';

export interface VaultKey {
  domain: string;
  key: string;
  subKey?: string;
}

export function fileToVaultKey(vaultRoot: string, filePath: string): VaultKey | null {
  const rel = path.relative(vaultRoot, filePath);
  if (rel.startsWith('..')) return null;
  const parts = rel.split(path.sep);
  if (parts[0] !== SEMO_ROOT) return null;
  if (parts.length < 3) return null; // SEMO/{domain}/{key}.md
  const [, domain, ...rest] = parts;
  const last = rest[rest.length - 1];
  if (!last.endsWith('.md')) return null;
  const lastNoExt = last.slice(0, -3);
  if (rest.length === 1) {
    return { domain, key: lastNoExt };
  }
  const [key, ...subParts] = rest;
  subParts[subParts.length - 1] = lastNoExt;
  return { domain, key, subKey: subParts.join('/') };
}

export function vaultKeyToFile(vaultRoot: string, k: VaultKey): string {
  const base = path.join(vaultRoot, SEMO_ROOT, k.domain);
  if (!k.subKey) return path.join(base, `${k.key}.md`);
  const subParts = k.subKey.split('/');
  return path.join(base, k.key, ...subParts.slice(0, -1), `${subParts[subParts.length - 1]}.md`);
}

/**
 * Shared domain validation for KB write paths.
 * Caches ontology domains for 60 seconds.
 */

import { Pool } from "pg";

interface DomainCache {
  domains: Set<string>;
  fetchedAt: number;
}

let cache: DomainCache | null = null;
const CACHE_TTL_MS = 60_000;

async function fetchDomains(pool: Pool): Promise<Set<string>> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT domain FROM semo.ontology ORDER BY domain"
    );
    return new Set(result.rows.map((r: { domain: string }) => r.domain));
  } finally {
    client.release();
  }
}

/**
 * Validate that a domain exists in semo.ontology.
 * Returns { valid, known (list of registered domains), error? }.
 * Results are cached for 60 seconds.
 */
export async function validateDomain(
  pool: Pool,
  domain: string
): Promise<{ valid: boolean; known: string[]; error?: string }> {
  const now = Date.now();

  if (!cache || now - cache.fetchedAt > CACHE_TTL_MS) {
    const domains = await fetchDomains(pool);
    cache = { domains, fetchedAt: now };
  }

  const known = Array.from(cache.domains).sort();

  if (cache.domains.has(domain)) {
    return { valid: true, known };
  }

  return {
    valid: false,
    known,
    error: `도메인 '${domain}'은(는) 온톨로지에 등록되지 않았습니다. 등록된 도메인: [${known.join(", ")}]`,
  };
}

/**
 * Invalidate the domain cache (e.g. after adding a new ontology entry).
 */
export function invalidateDomainCache(): void {
  cache = null;
}

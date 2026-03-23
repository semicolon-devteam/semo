/**
 * Shared domain validation for KB write paths.
 * Caches ontology domains for 60 seconds.
 */

import { Pool } from "pg";

interface DomainCache {
  domains: Set<string>;
  serviceMap: Map<string, string[]>;
  fetchedAt: number;
}

let cache: DomainCache | null = null;
const CACHE_TTL_MS = 60_000;

async function fetchDomainsAndServices(pool: Pool): Promise<{ domains: Set<string>; serviceMap: Map<string, string[]> }> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT domain, service FROM semo.ontology ORDER BY domain"
    );
    const domains = new Set<string>();
    const serviceMap = new Map<string, string[]>();

    for (const row of result.rows) {
      domains.add(row.domain);
      if (row.service) {
        const existing = serviceMap.get(row.service) || [];
        existing.push(row.domain);
        serviceMap.set(row.service, existing);
      }
    }

    // Also include dot-notation based service domains (e.g. "jungchipan.kpi" → service "jungchipan")
    for (const domain of domains) {
      if (domain.includes('.')) {
        const svc = domain.split('.')[0];
        const existing = serviceMap.get(svc) || [];
        if (!existing.includes(domain)) {
          existing.push(domain);
          serviceMap.set(svc, existing);
        }
      }
    }

    return { domains, serviceMap };
  } finally {
    client.release();
  }
}

async function ensureCache(pool: Pool): Promise<DomainCache> {
  const now = Date.now();
  if (!cache || now - cache.fetchedAt > CACHE_TTL_MS) {
    const { domains, serviceMap } = await fetchDomainsAndServices(pool);
    cache = { domains, serviceMap, fetchedAt: now };
  }
  return cache;
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
  const c = await ensureCache(pool);
  const known = Array.from(c.domains).sort();

  if (c.domains.has(domain)) {
    return { valid: true, known };
  }

  return {
    valid: false,
    known,
    error: `도메인 '${domain}'은(는) 온톨로지에 등록되지 않았습니다. 등록된 도메인: [${known.join(", ")}]`,
  };
}

/**
 * Resolve a service name to all its associated domains.
 * Includes both ontology.service column matches and dot-notation domains.
 * For example, service "jungchipan" resolves to ["jungchipan", "jungchipan.kpi", "jungchipan.spec"].
 */
export async function resolveServiceDomains(
  pool: Pool,
  service: string
): Promise<string[]> {
  const c = await ensureCache(pool);
  const domains = c.serviceMap.get(service) || [];
  // Also include the service name itself if it's a registered domain
  if (c.domains.has(service) && !domains.includes(service)) {
    return [service, ...domains];
  }
  return domains;
}

/**
 * Invalidate the domain cache (e.g. after adding a new ontology entry).
 */
export function invalidateDomainCache(): void {
  cache = null;
}

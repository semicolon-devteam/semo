/**
 * Test script: 017 ontology instance model migration + Phase A verification
 *
 * Tests:
 *   Phase A — openclaw.json cliBackends config validation
 *   Phase B — Migration 017 + MCP function correctness
 *
 * Usage: npx tsx packages/mcp-kb/test-017-migration.ts
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

// ── Env ──────────────────────────────────────────────────────
const envPath = path.join(process.env.HOME || "", ".semo.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
const JSON_MODE = process.argv.includes('--json');

// ── Test framework ───────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string) {
  if (JSON_MODE) {
    console.log(JSON.stringify({
      type: 'case',
      id: label.substring(0, 60).replace(/\s+/g, '-'),
      status: condition ? 'pass' : 'fail',
      label,
    }));
  } else {
    console.log(`  ${condition ? '✅' : '❌'} ${label}`);
  }
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(label);
  }
}

function assertGt(actual: number, min: number, label: string) {
  assert(actual > min, `${label} (actual: ${actual}, expected: > ${min})`);
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  assert(
    actual === expected,
    `${label} (actual: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`
  );
}

// ── Phase A: openclaw.json validation ─────────────────────────
async function testPhaseA() {
  console.log("\n═══ Phase A: openclaw.json cliBackends ═══\n");

  const bots = [
    "semiclaw",
    "workclaw",
    "reviewclaw",
    "planclaw",
    "designclaw",
    "infraclaw",
    "growthclaw",
  ];

  for (const bot of bots) {
    const configPath = path.join(
      process.env.HOME || "",
      `.openclaw-${bot}`,
      "openclaw.json"
    );
    const settingsPath = path.join(
      process.env.HOME || "",
      `.openclaw-${bot}`,
      "workspace",
      ".claude",
      "settings.json"
    );

    // Config exists
    assert(fs.existsSync(configPath), `${bot}: openclaw.json exists`);
    if (!fs.existsSync(configPath)) continue;

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const backends = config?.agents?.defaults?.cliBackends;

    // cliBackends key exists
    assert(!!backends, `${bot}: cliBackends key exists`);
    if (!backends) continue;

    const defaultBackend = backends["anthropic:default"];
    assert(!!defaultBackend, `${bot}: anthropic:default backend exists`);
    if (!defaultBackend) continue;

    // args contains --mcp-config
    const args: string[] = defaultBackend.args || [];
    const mcpIdx = args.indexOf("--mcp-config");
    assert(mcpIdx >= 0, `${bot}: args contains --mcp-config`);
    assert(
      mcpIdx >= 0 && args[mcpIdx + 1] === settingsPath,
      `${bot}: --mcp-config points to correct settings.json`
    );

    // args has -p, --output-format json, --dangerously-skip-permissions
    assert(args.includes("-p"), `${bot}: args includes -p`);
    assert(args.includes("--output-format"), `${bot}: args includes --output-format`);
    assert(
      args.includes("--dangerously-skip-permissions"),
      `${bot}: args includes --dangerously-skip-permissions`
    );

    // resumeArgs exists and has --resume
    const resumeArgs: string[] = defaultBackend.resumeArgs || [];
    assert(resumeArgs.includes("--resume"), `${bot}: resumeArgs includes --resume`);
    assert(
      resumeArgs.includes("--mcp-config"),
      `${bot}: resumeArgs includes --mcp-config`
    );

    // settings.json exists and has semo-kb MCP
    assert(fs.existsSync(settingsPath), `${bot}: workspace settings.json exists`);
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      assert(!!settings?.mcpServers?.["semo-kb"], `${bot}: semo-kb MCP configured`);
    }
  }
}

// ── Phase B: Pre-migration state snapshot ────────────────────
async function snapshotPreMigration() {
  console.log("\n═══ Phase B: Pre-Migration Snapshot ═══\n");

  const client = await pool.connect();
  try {
    // KB entry count
    const kbCount = await client.query(
      "SELECT COUNT(*)::int as cnt FROM semo.knowledge_base"
    );
    console.log(`  KB entries: ${kbCount.rows[0].cnt}`);

    // Ontology count
    const ontoCount = await client.query(
      "SELECT COUNT(*)::int as cnt FROM semo.ontology"
    );
    console.log(`  Ontology domains: ${ontoCount.rows[0].cnt}`);

    // Ontology types count
    const typeCount = await client.query(
      "SELECT COUNT(*)::int as cnt FROM semo.ontology_types"
    );
    console.log(`  Ontology types: ${typeCount.rows[0].cnt}`);

    // Current domains
    const domains = await client.query(
      "SELECT domain, entity_type, service FROM semo.ontology ORDER BY domain"
    );
    console.log(`  Domains: ${domains.rows.map((r: any) => r.domain).join(", ")}`);

    // Check FK existence
    const fkCheck = await client.query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_ontology_entity_type'
        AND table_schema = 'semo'
    `);
    console.log(
      `  FK fk_ontology_entity_type: ${fkCheck.rows.length > 0 ? "exists" : "not yet"}`
    );

    // Check entity_type NULL count
    const nullEt = await client.query(
      "SELECT COUNT(*)::int as cnt FROM semo.ontology WHERE entity_type IS NULL"
    );
    console.log(`  NULL entity_type: ${nullEt.rows[0].cnt}`);

    // Flat domains in KB (will be migrated)
    const flatDomains = await client.query(`
      SELECT domain, COUNT(*)::int as cnt
      FROM semo.knowledge_base
      WHERE domain NOT LIKE '%.%'
      GROUP BY domain ORDER BY domain
    `);
    console.log(`  Flat-domain KB entries:`);
    for (const r of flatDomains.rows) {
      console.log(`    ${r.domain}: ${r.cnt} entries`);
    }

    return {
      kbCount: kbCount.rows[0].cnt as number,
      ontoCount: ontoCount.rows[0].cnt as number,
      typeCount: typeCount.rows[0].cnt as number,
      hasFk: fkCheck.rows.length > 0,
    };
  } finally {
    client.release();
  }
}

// ── Phase B: Run migration ───────────────────────────────────
async function runMigration() {
  console.log("\n═══ Phase B: Running Migration 017 ═══\n");

  const migrationPath = path.resolve(
    __dirname,
    "../../packages/cli/migrations/017_ontology_instance_model.sql"
  );

  // Also try relative from script location
  const altPath = path.resolve(
    process.cwd(),
    "packages/cli/migrations/017_ontology_instance_model.sql"
  );

  const sqlPath = fs.existsSync(migrationPath) ? migrationPath : altPath;

  if (!fs.existsSync(sqlPath)) {
    console.error(`  ERROR: Migration file not found: ${sqlPath}`);
    return false;
  }

  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log(`  Migration file: ${sqlPath} (${sql.length} chars)`);

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("  ✅ Migration 017 applied successfully");
    return true;
  } catch (err: any) {
    // If FK/constraint already exists, that's OK (idempotency)
    if (
      err.message.includes("already exists") ||
      err.message.includes("already set")
    ) {
      console.log(
        `  ⚠️ Migration partially applied (${err.message.split("\n")[0]}) — already migrated, continuing`
      );
      return true;
    }
    console.error(`  ❌ Migration failed: ${err.message}`);
    return false;
  } finally {
    client.release();
  }
}

// ── Phase B: Post-migration validation ──────────────────────
async function testPostMigration(preMigration: {
  kbCount: number;
  ontoCount: number;
}) {
  console.log("\n═══ Phase B: Post-Migration Validation ═══\n");

  const client = await pool.connect();
  try {
    // 1. FK constraint exists
    const fkCheck = await client.query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_ontology_entity_type'
        AND table_schema = 'semo'
    `);
    assert(fkCheck.rows.length > 0, "FK fk_ontology_entity_type exists");

    // 2. No NULL entity_type
    const nullEt = await client.query(
      "SELECT COUNT(*)::int as cnt FROM semo.ontology WHERE entity_type IS NULL"
    );
    assertEqual(nullEt.rows[0].cnt, 0, "No NULL entity_type in ontology");

    // 3. entity_type is NOT NULL constraint
    const colCheck = await client.query(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'semo' AND table_name = 'ontology' AND column_name = 'entity_type'
    `);
    assertEqual(
      colCheck.rows[0]?.is_nullable,
      "NO",
      "entity_type column is NOT NULL"
    );

    // 4. All entity_type values reference valid ontology_types
    const invalidRef = await client.query(`
      SELECT o.domain, o.entity_type
      FROM semo.ontology o
      WHERE NOT EXISTS (
        SELECT 1 FROM semo.ontology_types t WHERE t.type_key = o.entity_type
      )
    `);
    assertEqual(
      invalidRef.rows.length,
      0,
      "All entity_type values have valid ontology_types reference"
    );

    // 5. Service instances exist
    const instances = await client.query(`
      SELECT domain FROM semo.ontology WHERE entity_type = 'service' ORDER BY domain
    `);
    assertGt(
      instances.rows.length,
      0,
      "At least one service instance registered"
    );
    const instanceDomains = instances.rows.map((r: any) => r.domain);
    console.log(
      `    Service instances: ${instanceDomains.join(", ")}`
    );

    // Check specific service instances (semicolon is organization, not service)
    for (const svc of ["jungchipan", "playland"]) {
      assert(
        instanceDomains.includes(svc),
        `Service instance '${svc}' registered`
      );
    }

    // semicolon should be organization, not service
    const semicolonOnto = await client.query(
      "SELECT entity_type FROM semo.ontology WHERE domain = 'semicolon'"
    );
    assertEqual(
      semicolonOnto.rows[0]?.entity_type,
      "organization",
      "semicolon has entity_type=organization (not service)"
    );

    // 6. _global service tagging
    const globalDomains = await client.query(`
      SELECT domain, entity_type FROM semo.ontology
      WHERE service = '_global' ORDER BY domain
    `);
    assertGt(
      globalDomains.rows.length,
      0,
      "Global domains tagged with service='_global'"
    );
    console.log(
      `    _global domains: ${globalDomains.rows.map((r: any) => r.domain).join(", ")}`
    );

    // 7. KB entries migrated to dot-notation
    const flatKb = await client.query(`
      SELECT COUNT(*)::int as cnt FROM semo.knowledge_base
      WHERE domain NOT LIKE '%.%'
        AND domain NOT IN (SELECT domain FROM semo.ontology WHERE entity_type = 'service')
    `);
    // Should be 0 or very few (only service instance domains like 'semicolon' which stay flat)
    console.log(
      `    Non-dot-notation KB entries (excluding service instances): ${flatKb.rows[0].cnt}`
    );

    // 8. KB count preserved (no data loss)
    const kbCount = await client.query(
      "SELECT COUNT(*)::int as cnt FROM semo.knowledge_base"
    );
    assertEqual(
      kbCount.rows[0].cnt,
      preMigration.kbCount,
      `KB entry count preserved (${preMigration.kbCount})`
    );

    // 9. Dot-notation domains in ontology
    const dotDomains = await client.query(`
      SELECT domain, entity_type, service FROM semo.ontology
      WHERE domain LIKE '_global.%' ORDER BY domain
    `);
    assertGt(
      dotDomains.rows.length,
      0,
      "_global.* dot-notation domains created in ontology"
    );
    console.log(
      `    _global.* domains: ${dotDomains.rows.map((r: any) => r.domain).join(", ")}`
    );

    // 10. KB service generated column works with dot-notation
    const svcCol = await client.query(`
      SELECT DISTINCT service FROM semo.knowledge_base
      WHERE service IS NOT NULL ORDER BY service LIMIT 10
    `);
    console.log(
      `    KB service column values: ${svcCol.rows.map((r: any) => r.service).join(", ")}`
    );
    assert(
      svcCol.rows.some((r: any) => r.service === "_global"),
      "KB service column includes '_global'"
    );

    // 11. ontology_types type_key index
    const idxCheck = await client.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'semo' AND indexname = 'idx_ontology_entity_type_fk'
    `);
    assert(idxCheck.rows.length > 0, "Index idx_ontology_entity_type_fk exists");

  } finally {
    client.release();
  }
}

// ── Phase B: MCP function tests ──────────────────────────────
async function testMcpFunctions() {
  console.log("\n═══ Phase B: MCP Function Tests ═══\n");

  // Import MCP functions
  const {
    kbSearch,
    kbGet,
    kbList,
    ontoList,
    ontoShow,
    ontoListTypes,
    ontoListServices,
    ontoListInstances,
  } = await import("./src/lib/kb.js");
  const { validateDomain, resolveServiceDomains } = await import(
    "./src/lib/validate.js"
  );

  // 1. ontoList — returns domains grouped with service
  const allDomains = await ontoList(pool);
  assertGt(allDomains.length, 0, "ontoList returns domains");

  const globalDomains = allDomains.filter(
    (d) => !d.service || d.service === "_global"
  );
  const serviceDomains = allDomains.filter(
    (d) => d.service && d.service !== "_global"
  );
  assertGt(globalDomains.length, 0, "ontoList has global/_global domains");
  assertGt(serviceDomains.length, 0, "ontoList has service-scoped domains");

  // 2. ontoListTypes — returns types from ontology_types
  const types = await ontoListTypes(pool);
  assertGt(types.length, 5, "ontoListTypes returns types");
  assert(
    types.some((t) => t.type_key === "service"),
    "type 'service' exists"
  );
  assert(
    types.some((t) => t.type_key === "person"),
    "type 'person' exists"
  );

  // 3. ontoListInstances — returns service instances (semicolon is organization, not here)
  const instances = await ontoListInstances(pool);
  assertGt(instances.length, 0, "ontoListInstances returns instances");
  assert(
    instances.some((i) => i.domain === "jungchipan"),
    "instance 'jungchipan' found"
  );
  assert(
    !instances.some((i) => i.domain === "semicolon"),
    "semicolon NOT in service instances (it's an organization)"
  );

  // 4. ontoListServices — returns service aggregation
  const services = await ontoListServices(pool);
  assertGt(services.length, 0, "ontoListServices returns services");

  // 5. ontoShow — show a _global domain
  const teamOnto = await ontoShow(pool, "_global.team");
  assert(!!teamOnto, "ontoShow returns _global.team domain");
  if (teamOnto) {
    assertEqual(
      teamOnto.entity_type,
      "person",
      "_global.team has entity_type=person"
    );
  }

  // 6. ontoShow — show semicolon (organization, not service)
  const scOnto = await ontoShow(pool, "semicolon");
  assert(!!scOnto, "ontoShow returns semicolon domain");
  if (scOnto) {
    assertEqual(
      scOnto.entity_type,
      "organization",
      "semicolon has entity_type=organization"
    );
  }

  // 7. validateDomain — accepts new dot-notation domains
  const validResult = await validateDomain(pool, "_global.team");
  assert(validResult.valid, "validateDomain accepts _global.team");

  // 8. validateDomain — rejects unknown domain
  const invalidResult = await validateDomain(pool, "nonexistent-domain-xyz");
  assert(!invalidResult.valid, "validateDomain rejects unknown domain");

  // 9. resolveServiceDomains — resolves _global
  const globalResolved = await resolveServiceDomains(pool, "_global");
  assertGt(
    globalResolved.length,
    0,
    "resolveServiceDomains resolves _global"
  );
  assert(
    globalResolved.some((d) => d.includes("_global")),
    "resolved domains include _global prefix"
  );

  // 10. kbSearch — search works with new domain structure
  const searchResults = await kbSearch(pool, "팀", {
    domain: "_global.team",
    limit: 5,
    mode: "text",
  });
  // May return 0 if no 팀 entries in _global.team, but should not throw
  assert(
    Array.isArray(searchResults),
    "kbSearch with _global.team does not throw"
  );

  // 11. kbList — list works with new domain
  const listResults = await kbList(pool, {
    domain: "_global.team",
    limit: 5,
  });
  assert(
    Array.isArray(listResults),
    "kbList with _global.team does not throw"
  );

  // 12. kbSearch with service filter
  const svcSearch = await kbSearch(pool, "test", {
    service: "_global",
    limit: 5,
    mode: "text",
  });
  assert(
    Array.isArray(svcSearch),
    "kbSearch with service=_global does not throw"
  );

  // 13. kbList with service filter
  const svcList = await kbList(pool, { service: "_global", limit: 5 });
  assert(
    Array.isArray(svcList),
    "kbList with service=_global does not throw"
  );
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  SEMO 017 Migration + Phase A Test Suite    ║");
  console.log("╚══════════════════════════════════════════════╝");

  try {
    // Phase A
    await testPhaseA();

    // Phase B: snapshot
    const snapshot = await snapshotPreMigration();

    // Phase B: run migration
    const migrationOk = await runMigration();
    if (!migrationOk) {
      console.error("\n⛔ Migration failed — skipping post-migration tests");
      process.exit(1);
    }

    // Phase B: validate
    await testPostMigration(snapshot);

    // Phase B: MCP functions
    await testMcpFunctions();
  } finally {
    await pool.end();
  }

  // Summary
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log(
    `║  Results: ${passed} passed, ${failed} failed${" ".repeat(Math.max(0, 20 - String(passed).length - String(failed).length))}║`
  );
  console.log("╚══════════════════════════════════════════════╝");

  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  ❌ ${f}`));
  }

  if (JSON_MODE) {
    console.log(JSON.stringify({ type: 'summary', pass: passed, fail: failed, warn: 0 }));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

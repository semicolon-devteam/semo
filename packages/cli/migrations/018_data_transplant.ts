#!/usr/bin/env npx tsx
/**
 * 018_data_transplant.ts — 서비스 인스턴스 모델 완전 전환
 *
 * _global.* 임시 구조 → 서비스 인스턴스 중심 모델로 데이터 이식
 *
 * Steps:
 *   1. _global.project → 개별 서비스 도메인 (ontology + structured KB entries)
 *   2. _global.kpi / _global.milestone → 서비스 하위 키
 *   3. _global.{team,decision,...} → semicolon 하위 키
 *   4. 온톨로지 정리 (_global.* 삭제)
 *
 * Usage:
 *   npx tsx packages/cli/migrations/018_data_transplant.ts [--dry-run]
 *
 * 선행 조건:
 *   - 017_ontology_instance_model.sql 적용 완료
 *   - 018_type_schema.sql 적용 완료
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ============================================================
// Env setup
// ============================================================

const envPath = path.join(os.homedir(), ".semo.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const DRY_RUN = process.argv.includes("--dry-run");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10000,
});

// ============================================================
// Service definitions
// ============================================================

interface ServiceDef {
  name: string;
  status: string;
  originalKey: string;
  botKeys: string[];
}

const SERVICES: ServiceDef[] = [
  { name: "axoracle",           status: "active",      originalKey: "axoracle",           botKeys: [] },
  { name: "bebecare",           status: "active",      originalKey: "bebecare",           botKeys: ["bebecare/semiclaw"] },
  { name: "byebuyer",           status: "active",      originalKey: "byebuyer",           botKeys: ["by-buyer/semiclaw"] },
  { name: "gameland",           status: "active",      originalKey: "gameland",           botKeys: ["game-land/semiclaw"] },
  { name: "jungchipan",         status: "active",      originalKey: "jungchipan",         botKeys: ["jungchipan/semiclaw"] },
  { name: "playland",           status: "active",      originalKey: "playland",           botKeys: [] },
  { name: "ps",                 status: "active",      originalKey: "ps",                 botKeys: ["ps/semiclaw"] },
  { name: "star-spot",          status: "active",      originalKey: "star-spot",          botKeys: ["star-spot/semiclaw", "star-spot/planclaw", "star-spot/workclaw", "star-spot/growthclaw"] },
  { name: "labor-union",        status: "active",      originalKey: "labor-union",        botKeys: ["labor-union/semiclaw"] },
  { name: "viral",              status: "active",      originalKey: "viral",              botKeys: [] },
  { name: "office-community",   status: "active",      originalKey: "office-community",   botKeys: ["office-land/semiclaw"] },
  { name: "core-backend",       status: "active",      originalKey: "core-backend",       botKeys: ["core-backend-context/semiclaw"] },
  { name: "linkta",             status: "active",      originalKey: "linkta",             botKeys: [] },
  { name: "sales-keeper",       status: "active",      originalKey: "sales-keeper",       botKeys: ["sales-keeper/semiclaw"] },
  { name: "acaiv",              status: "active",      originalKey: "acaiv",              botKeys: ["acaiv/semiclaw"] },
  { name: "cointalk",           status: "hold",        originalKey: "cointalk",           botKeys: [] },
  { name: "chagok",             status: "hold",        originalKey: "chagok",             botKeys: [] },
  { name: "healing-hands",      status: "hold",        originalKey: "healing-hands",      botKeys: [] },
  { name: "introduction",       status: "maintenance", originalKey: "introduction",       botKeys: [] },
  { name: "semo",               status: "active",      originalKey: "semo",               botKeys: ["semo/semiclaw", "semo/planclaw"] },
  { name: "servicemaker",       status: "hold",        originalKey: "servicemaker",       botKeys: [] },
  { name: "samho",              status: "completed",   originalKey: "samho",              botKeys: [] },
  { name: "seoul-tour",         status: "hold",        originalKey: "seoul-tour",         botKeys: [] },
  { name: "shipyard",           status: "hold",        originalKey: "shipyard",           botKeys: [] },
  { name: "point-exchanger",    status: "active",      originalKey: "point-exchanger",    botKeys: [] },
  { name: "semo-remote-client", status: "active",      originalKey: "semo-remote-client", botKeys: [] },
  { name: "celeb-map",          status: "deprecated",  originalKey: "celeb-map",          botKeys: [] },
];

/** Meta/context entries in _global.project — not real services, delete only */
const META_KEYS = [
  "project-context/semiclaw",
  "repo-analysis/semiclaw",
  "others/semiclaw",
  "land-platform/semiclaw",
  "wishket-context/semiclaw",
  "leeds-on/semiclaw",
  "risk-zero-kr/semiclaw",
  "tether-mining/semiclaw",
];

/** KPI key → service name overrides (when key prefix doesn't match service name) */
const KPI_SERVICE_OVERRIDES: Record<string, string> = {
  officeland: "office-community",
};

// ============================================================
// Content parsing (rule-based)
// ============================================================

interface ParsedService {
  baseInformation: string;
  currentSituation?: string;
  po?: string;
  serviceUrl?: string;
  bm?: string;
  techStack?: string;
  repo?: string;
  slackChannel?: string;
}

function parseServiceContent(
  originalContent: string | null,
  botContents: string[],
  metadata?: Record<string, unknown>,
): ParsedService {
  const result: ParsedService = {
    baseInformation: originalContent || "",
  };

  // 1. Extract from metadata (highest priority)
  if (metadata) {
    if (metadata.repo) result.repo = String(metadata.repo);
    if (metadata.owner) result.po = String(metadata.owner);
    if (metadata.slackChannel || metadata.slackChannelName) {
      result.slackChannel = String(metadata.slackChannelName || metadata.slackChannel);
    }
    if (metadata.url || metadata.serviceUrl) {
      result.serviceUrl = String(metadata.url || metadata.serviceUrl);
    }
    if (metadata.techStack) result.techStack = String(metadata.techStack);
  }

  // 2. Extract from content using patterns
  const fullContent = [originalContent || "", ...botContents].join("\n");

  const patterns: Record<string, RegExp> = {
    currentSituation: /현황[:\s]+([^\n]+)/,
    po:              /담당(?:자)?[:\s]+([^\n]+)/,
    serviceUrl:      /(?:URL|서비스\s*(?:주소|URL))[:\s]+(https?:\/\/[^\s\n]+)/i,
    techStack:       /기술\s*스택[:\s]+([^\n]+)/i,
    bm:              /(?:비즈니스\s*모델|BM)[:\s]+([^\n]+)/i,
    repo:            /(?:레포|리포|repo)[:\s]+([^\s\n]+)/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    if (!(result as Record<string, unknown>)[key]) {
      const match = fullContent.match(pattern);
      if (match) (result as Record<string, string>)[key] = match[1].trim();
    }
  }

  // 3. Merge bot contributions into base_information
  const meaningfulBot = botContents.filter((c) => c.length > 50);
  if (meaningfulBot.length > 0) {
    const merged = meaningfulBot.map((c) => c.substring(0, 1000)).join("\n\n---\n\n");
    if (result.baseInformation) {
      result.baseInformation += `\n\n---\n봇 기여 병합:\n${merged}`;
    } else {
      result.baseInformation = merged;
    }
  }

  return result;
}

// ============================================================
// Helpers
// ============================================================

function log(msg: string) {
  console.log(msg);
}

function header(step: string, title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${step}: ${title}`);
  console.log(`${"─".repeat(60)}`);
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  SEMO 018: 서비스 인스턴스 모델 완전 전환`);
  console.log(`  ${DRY_RUN ? "🔍 DRY RUN" : "🚀 LIVE"}`);
  console.log(`${"═".repeat(60)}`);

  const client = await pool.connect();

  try {
    if (!DRY_RUN) await client.query("BEGIN");

    // ── Step 1: Service Instances ──────────────────────────────

    header("Step 1", "서비스 인스턴스 생성 (_global.project → 개별 서비스 도메인)");

    const projectEntries = await client.query(
      "SELECT key, content, metadata FROM semo.knowledge_base WHERE domain = '_global.project'",
    );

    const entryMap = new Map<string, { content: string; metadata: Record<string, unknown> }>();
    for (const row of projectEntries.rows) {
      entryMap.set(row.key, {
        content: row.content,
        metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {},
      });
    }

    log(`  _global.project 엔트리: ${projectEntries.rows.length}건`);

    let servicesCreated = 0;
    let entriesCreated = 0;

    for (const svc of SERVICES) {
      const existing = await client.query(
        "SELECT domain, entity_type FROM semo.ontology WHERE domain = $1",
        [svc.name],
      );

      const originalEntry = entryMap.get(svc.originalKey);
      const botContents: string[] = [];
      for (const bk of svc.botKeys) {
        const be = entryMap.get(bk);
        if (be) botContents.push(be.content);
      }

      const parsed = parseServiceContent(
        originalEntry?.content ?? null,
        botContents,
        originalEntry?.metadata,
      );

      // 1a. Register/update ontology
      if (existing.rows.length === 0) {
        log(`  ✨ ${svc.name} (${svc.status})`);
        if (!DRY_RUN) {
          await client.query(
            `INSERT INTO semo.ontology (domain, entity_type, service, schema, description)
             VALUES ($1, 'service', $1, '{}'::jsonb, $2)`,
            [svc.name, (parsed.baseInformation || svc.name).substring(0, 200)],
          );
        }
        servicesCreated++;
      } else {
        const et = existing.rows[0].entity_type;
        if (et !== "service" && et !== "organization") {
          log(`  🔄 ${svc.name} (${et} → service)`);
          if (!DRY_RUN) {
            await client.query(
              "UPDATE semo.ontology SET entity_type = 'service', service = $1 WHERE domain = $1",
              [svc.name],
            );
          }
        } else {
          log(`  ✅ ${svc.name} (기존 ${et})`);
        }
      }

      // 1b. Create structured KB entries
      const kbEntries: [string, string][] = [
        ["base_information", parsed.baseInformation || `${svc.name} 서비스`],
        ["status", svc.status],
      ];
      if (parsed.po) kbEntries.push(["po", parsed.po]);
      if (parsed.serviceUrl) kbEntries.push(["service_url", parsed.serviceUrl]);
      if (parsed.bm) kbEntries.push(["bm", parsed.bm]);
      if (parsed.techStack) kbEntries.push(["tech_stack", parsed.techStack]);
      if (parsed.currentSituation) kbEntries.push(["current_situation", parsed.currentSituation]);
      if (parsed.repo) kbEntries.push(["repo", parsed.repo]);
      if (parsed.slackChannel) kbEntries.push(["slack_channel", parsed.slackChannel]);

      for (const [key, content] of kbEntries) {
        if (!DRY_RUN) {
          await client.query(
            `INSERT INTO semo.knowledge_base (domain, key, content, created_by)
             VALUES ($1, $2, $3, 'migration-018')
             ON CONFLICT (domain, key) DO UPDATE SET
               content = EXCLUDED.content,
               created_by = EXCLUDED.created_by`,
            [svc.name, key, content],
          );
        }
        entriesCreated++;
      }
    }

    // Delete processed _global.project entries
    const keysToDelete = [
      ...META_KEYS,
      ...SERVICES.flatMap((s) => [s.originalKey, ...s.botKeys]),
    ];

    let deletedProject = 0;
    for (const key of keysToDelete) {
      if (!DRY_RUN) {
        const res = await client.query(
          "DELETE FROM semo.knowledge_base WHERE domain = '_global.project' AND key = $1",
          [key],
        );
        deletedProject += res.rowCount || 0;
      } else {
        const exists = entryMap.has(key);
        if (exists) deletedProject++;
      }
    }

    log(`\n  결과: 서비스 ${servicesCreated}개 신규, KB ${entriesCreated}개 생성, ${deletedProject}개 삭제`);

    // ── Step 2: KPI/Milestone ──────────────────────────────────

    header("Step 2", "KPI/Milestone 이식");

    // KPI: service name override 처리 후 이동
    const kpiEntries = await client.query(
      "SELECT kb_id, key FROM semo.knowledge_base WHERE domain = '_global.kpi'",
    );
    let kpiMoved = 0;
    for (const row of kpiEntries.rows) {
      const slashIdx = (row.key as string).indexOf("/");
      if (slashIdx < 0) continue;
      let svcName = (row.key as string).substring(0, slashIdx);
      const remainder = (row.key as string).substring(slashIdx + 1);
      svcName = KPI_SERVICE_OVERRIDES[svcName] || svcName;

      if (!DRY_RUN) {
        await client.query(
          "UPDATE semo.knowledge_base SET domain = $1, key = $2 WHERE kb_id = $3",
          [svcName, `kpi/${remainder}`, row.kb_id],
        );
      }
      kpiMoved++;
    }
    log(`  KPI: ${kpiMoved}건 이동`);

    // Milestone: 동일 패턴
    const msEntries = await client.query(
      "SELECT kb_id, key FROM semo.knowledge_base WHERE domain = '_global.milestone'",
    );
    let msMoved = 0;
    for (const row of msEntries.rows) {
      const slashIdx = (row.key as string).indexOf("/");
      if (slashIdx < 0) continue;
      const svcName = (row.key as string).substring(0, slashIdx);
      const remainder = (row.key as string).substring(slashIdx + 1);

      if (!DRY_RUN) {
        await client.query(
          "UPDATE semo.knowledge_base SET domain = $1, key = $2 WHERE kb_id = $3",
          [svcName, `milestone/${remainder}`, row.kb_id],
        );
      }
      msMoved++;
    }
    log(`  Milestone: ${msMoved}건 이동`);

    // ── Step 3: Global → semicolon ─────────────────────────────

    header("Step 3", "글로벌 데이터 → semicolon 이동");

    const globalDomains = [
      { old: "_global.team",        prefix: "team" },
      { old: "_global.decision",    prefix: "decision" },
      { old: "_global.process",     prefix: "process" },
      { old: "_global.infra",       prefix: "infra" },
      { old: "_global.bot-config",  prefix: "bot-config" },
      { old: "_global.memory",      prefix: "memory" },
      { old: "_global.skill",       prefix: "skill" },
      { old: "_global.spec",        prefix: "spec" },
      { old: "_global.session-log", prefix: "session-log" },
    ];

    let totalMoved = 0;
    for (const gd of globalDomains) {
      if (!DRY_RUN) {
        const res = await client.query(
          `UPDATE semo.knowledge_base
           SET domain = 'semicolon', key = $2 || '/' || key
           WHERE domain = $1
           RETURNING kb_id`,
          [gd.old, gd.prefix],
        );
        const cnt = res.rowCount || 0;
        totalMoved += cnt;
        if (cnt > 0) log(`  ${gd.old} → semicolon/${gd.prefix}/*: ${cnt}건`);
      } else {
        const res = await client.query(
          "SELECT COUNT(*)::int as cnt FROM semo.knowledge_base WHERE domain = $1",
          [gd.old],
        );
        const cnt = res.rows[0].cnt;
        totalMoved += cnt;
        if (cnt > 0) log(`  ${gd.old} → semicolon/${gd.prefix}/*: ${cnt}건 (dry-run)`);
      }
    }

    // Remaining _global.project entries → semicolon/project/*
    if (!DRY_RUN) {
      const res = await client.query(`
        UPDATE semo.knowledge_base
        SET domain = 'semicolon', key = 'project/' || key
        WHERE domain = '_global.project'
        RETURNING kb_id
      `);
      const cnt = res.rowCount || 0;
      if (cnt > 0) {
        totalMoved += cnt;
        log(`  _global.project (잔여) → semicolon/project/*: ${cnt}건`);
      }
    } else {
      const res = await client.query(
        "SELECT COUNT(*)::int as cnt FROM semo.knowledge_base WHERE domain = '_global.project'",
      );
      const cnt = res.rows[0].cnt;
      if (cnt > 0) {
        totalMoved += cnt;
        log(`  _global.project (잔여) → semicolon/project/*: ${cnt}건 (dry-run)`);
      }
    }

    // Remaining _global.kpi / _global.milestone (edge case: entries without / in key)
    for (const leftover of ["_global.kpi", "_global.milestone"]) {
      if (!DRY_RUN) {
        const res = await client.query(
          `UPDATE semo.knowledge_base
           SET domain = 'semicolon', key = $2 || '/' || key
           WHERE domain = $1
           RETURNING kb_id`,
          [leftover, leftover.replace("_global.", "")],
        );
        const cnt = res.rowCount || 0;
        if (cnt > 0) {
          totalMoved += cnt;
          log(`  ${leftover} (잔여) → semicolon: ${cnt}건`);
        }
      }
    }

    log(`\n  총 이동: ${totalMoved}건`);

    // ── Step 4: Ontology cleanup ───────────────────────────────

    header("Step 4", "온톨로지 정리");

    if (!DRY_RUN) {
      // Delete all _global.* ontology entries
      const delResult = await client.query(
        "DELETE FROM semo.ontology WHERE domain LIKE '_global.%' RETURNING domain",
      );
      log(`  _global.* 온톨로지 삭제: ${delResult.rowCount}개`);

      // Update semicolon description
      await client.query(
        `UPDATE semo.ontology
         SET description = 'Semicolon 조직 — 글로벌 스코프 (team/decision/process/infra/bot-config/memory/skill/spec/session-log)'
         WHERE domain = 'semicolon'`,
      );
      log(`  semicolon 설명 업데이트`);
    } else {
      const cnt = await client.query(
        "SELECT COUNT(*)::int as cnt FROM semo.ontology WHERE domain LIKE '_global.%'",
      );
      log(`  _global.* 온톨로지 삭제 예정: ${cnt.rows[0].cnt}개 (dry-run)`);
    }

    // ── Commit ──────────────────────────────────────────────────

    if (!DRY_RUN) {
      await client.query("COMMIT");
      log("\n✅ 마이그레이션 커밋 완료");
    } else {
      log("\n🔍 DRY RUN 완료 — 실제 변경 없음");
    }

    // ── Verification ────────────────────────────────────────────

    header("검증", "데이터 무결성 확인");

    const totalEntries = await client.query(
      "SELECT COUNT(*)::int as cnt FROM semo.knowledge_base",
    );
    log(`  전체 KB 엔트리: ${totalEntries.rows[0].cnt}`);

    const serviceInstances = await client.query(
      "SELECT COUNT(*)::int as cnt FROM semo.ontology WHERE entity_type = 'service'",
    );
    log(`  서비스 인스턴스: ${serviceInstances.rows[0].cnt}개`);

    const globalRemaining = await client.query(
      "SELECT COUNT(*)::int as cnt FROM semo.knowledge_base WHERE domain LIKE '_global.%'",
    );
    log(`  _global.* 잔여 KB: ${globalRemaining.rows[0].cnt}`);

    const orphans = await client.query(`
      SELECT domain, COUNT(*)::int as cnt
      FROM semo.knowledge_base
      WHERE domain NOT IN (SELECT domain FROM semo.ontology)
      GROUP BY domain ORDER BY cnt DESC
    `);
    if (orphans.rows.length > 0) {
      log(`  ⚠ 고아 도메인 (온톨로지 미등록):`);
      for (const row of orphans.rows) {
        log(`    ${row.domain}: ${row.cnt}건`);
      }
    } else {
      log(`  ✅ 고아 도메인 없음`);
    }

    const perService = await client.query(`
      SELECT domain, COUNT(*)::int as cnt
      FROM semo.knowledge_base
      WHERE domain IN (SELECT domain FROM semo.ontology WHERE entity_type = 'service')
      GROUP BY domain ORDER BY domain
    `);
    if (perService.rows.length > 0) {
      log(`\n  서비스별 엔트리:`);
      for (const row of perService.rows) {
        log(`    ${row.domain}: ${row.cnt}건`);
      }
    }

    log("");
  } catch (err) {
    if (!DRY_RUN) await client.query("ROLLBACK").catch(() => {});
    console.error("\n❌ 마이그레이션 실패:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

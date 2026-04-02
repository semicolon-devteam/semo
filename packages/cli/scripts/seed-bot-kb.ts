/**
 * seed-bot-kb.ts — SOUL.md + bot_status에서 봇 KB 메타데이터 시드
 *
 * Usage: npx tsx packages/cli/scripts/seed-bot-kb.ts
 *
 * bot_status에서 봇 목록을 동적 조회하고,
 * 각 봇의 SOUL.md를 파싱하여 KB에 identity/role/status/delegation을 기록.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getPool, closeConnection } from "../src/database";
import { kbUpsert as kbUpsertFn } from "../src/kb";

const pool = getPool();

// ── SOUL.md Parser ──

interface SoulData {
  identity: string;
  role: string;
  delegation: string;
}

function parseSoulMd(content: string): SoulData {
  const sections: Record<string, string> = {};
  let currentSection = "";
  let buffer: string[] = [];

  for (const line of content.split("\n")) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) {
      if (currentSection) {
        sections[currentSection] = buffer.join("\n").trim();
      }
      currentSection = heading[1].trim().toLowerCase();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  if (currentSection) {
    sections[currentSection] = buffer.join("\n").trim();
  }

  // Find identity section (## Identity)
  const identity =
    sections["identity"] || sections["identity & persona"] || "";

  // Find R&R section
  const role = sections["r&r"] || sections["r&r (role & responsibilities)"] || "";

  // Find delegation (역할 밖 업무 → 인계 대상)
  const delegation = sections["역할 밖 업무"] || "";

  return { identity, role, delegation };
}

// ── KB Upsert (정식 경로: 임베딩 + 검증 포함) ──

async function upsert(
  domain: string,
  key: string,
  content: string,
): Promise<boolean> {
  const result = await kbUpsertFn(pool, {
    domain,
    key,
    content,
    created_by: "seed-bot-kb",
  });
  if (!result.success) {
    console.log(`    ⚠️ ${domain}/${key}: ${result.error}`);
    return false;
  }
  return true;
}

// ── Main ──

async function main() {
  console.log("=== Bot KB Seed ===\n");

  // 1. 봇 목록 (DB에서 동적 조회)
  const { rows: bots } = await pool.query<{
    bot_id: string;
    name: string;
    emoji: string;
    role: string;
    status: string;
  }>(
    `SELECT bot_id, name, emoji, role, status
     FROM semo.bot_status
     WHERE bot_id != 'shared'
     ORDER BY bot_id`
  );

  console.log(`봇 ${bots.length}개 발견\n`);

  for (const bot of bots) {
    const wsPath = path.join(
      os.homedir(),
      `.openclaw-${bot.bot_id}`,
      "workspace"
    );
    const soulPath = path.join(wsPath, "SOUL.md");

    console.log(`── ${bot.bot_id} ──`);

    // identity (bot_status 메타데이터 기반)
    const identityContent = [
      `name: ${bot.name || bot.bot_id}`,
      `emoji: ${bot.emoji || "🤖"}`,
      `tagline: ${bot.role || "Bot"}`,
    ].join("\n");

    if (await upsert(bot.bot_id, "identity", identityContent)) {
      console.log(`  ✅ identity`);
    }

    // status
    if (await upsert(bot.bot_id, "status", bot.status || "offline")) {
      console.log(`  ✅ status: ${bot.status || "offline"}`);
    }

    // SOUL.md 파싱
    if (fs.existsSync(soulPath)) {
      const content = fs.readFileSync(soulPath, "utf-8");
      const soul = parseSoulMd(content);

      // KB is SoT for roles — skip upsert if SOUL.md R&R is a pointer (no role table)
      const isRolePointer = soul.role && !soul.role.includes("| 카테고리");
      if (soul.role && !isRolePointer) {
        if (await upsert(bot.bot_id, "role", soul.role)) {
          console.log(`  ✅ role (${soul.role.split("\n").length} lines)`);
        }
      } else if (isRolePointer) {
        console.log(`  ⏭️ role (KB is SoT — pointer detected, skip)`);
      }

      if (soul.delegation) {
        if (await upsert(bot.bot_id, "delegation", soul.delegation)) {
          console.log(`  ✅ delegation (${soul.delegation.split("\n").length} lines)`);
        }
      }

      // gateway_config from openclaw.json
      const configPath = path.join(
        os.homedir(),
        `.openclaw-${bot.bot_id}`,
        "openclaw.json"
      );
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          const port = config?.gateway?.port;
          const model =
            config?.agents?.defaults?.model?.primary || "unknown";
          const gwContent = [
            `port: ${port || "N/A"}`,
            `model: ${model}`,
          ].join("\n");
          if (await upsert(bot.bot_id, "gateway_config", gwContent)) {
            console.log(`  ✅ gateway_config (port: ${port})`);
          }
        } catch {
          console.log(`  ⚠️ gateway_config: openclaw.json 파싱 실패`);
        }
      }
    } else {
      console.log(`  ⚠️ SOUL.md 없음 — role/delegation 스킵`);
    }

    console.log();
  }

  console.log("=== 완료 ===");
  await closeConnection();
}

main().catch((err) => {
  console.error("Fatal:", err);
  closeConnection();
  process.exit(1);
});

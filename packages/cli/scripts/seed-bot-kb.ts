/**
 * seed-bot-kb.ts — SOUL.md + bot_status에서 봇 KB 메타데이터 시드
 *
 * Usage: npx tsx packages/cli/scripts/seed-bot-kb.ts
 *
 * bot_status에서 봇 목록을 동적 조회하고,
 * 각 봇의 SOUL.md를 파싱하여 KB에 identity/role/status/delegation을 기록.
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── Env ──
const envPath = path.join(os.homedir(), ".semo.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

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

// ── KB Upsert ──

async function kbUpsert(
  domain: string,
  key: string,
  content: string,
  createdBy: string
): Promise<void> {
  await pool.query(
    `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by)
     VALUES ($1, $2, '', $3, $4)
     ON CONFLICT (domain, key, sub_key) DO UPDATE SET
       content = EXCLUDED.content,
       created_by = EXCLUDED.created_by,
       updated_at = NOW(),
       version = semo.knowledge_base.version + 1`,
    [domain, key, content, createdBy]
  );
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

    await kbUpsert(bot.bot_id, "identity", identityContent, "seed-bot-kb");
    console.log(`  ✅ identity`);

    // status
    await kbUpsert(
      bot.bot_id,
      "status",
      bot.status || "offline",
      "seed-bot-kb"
    );
    console.log(`  ✅ status: ${bot.status || "offline"}`);

    // SOUL.md 파싱
    if (fs.existsSync(soulPath)) {
      const content = fs.readFileSync(soulPath, "utf-8");
      const soul = parseSoulMd(content);

      if (soul.role) {
        await kbUpsert(bot.bot_id, "role", soul.role, "seed-bot-kb");
        console.log(`  ✅ role (${soul.role.split("\n").length} lines)`);
      }

      if (soul.delegation) {
        await kbUpsert(
          bot.bot_id,
          "delegation",
          soul.delegation,
          "seed-bot-kb"
        );
        console.log(
          `  ✅ delegation (${soul.delegation.split("\n").length} lines)`
        );
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
          await kbUpsert(
            bot.bot_id,
            "gateway_config",
            gwContent,
            "seed-bot-kb"
          );
          console.log(`  ✅ gateway_config (port: ${port})`);
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
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  pool.end();
  process.exit(1);
});

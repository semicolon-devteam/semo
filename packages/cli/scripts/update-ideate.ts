import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

const pool = new Pool({
  host: "3.38.162.21",
  port: 5432,
  user: "app",
  password: "ProductionPassword2024!@#",
  database: "appdb",
  ssl: false,
});

async function main() {
  const client = await pool.connect();
  try {
    // semo-system의 ideate SKILL.md 읽기
    const skillPath = path.join(__dirname, "../../../../semo-system/semo-skills/ideate/SKILL.md");
    const skillContent = fs.readFileSync(skillPath, "utf-8");

    console.log("📄 SKILL.md 읽기 완료 (", skillContent.length, "bytes)");
    console.log("🔍 플랫폼 전략 포함:", skillContent.includes("플랫폼 전략") ? "✅" : "❌");

    const result = await client.query(
      `UPDATE semo.skills
       SET content = $1, version = '2.1.0', updated_at = now()
       WHERE name = 'ideate'
       RETURNING name, version`,
      [skillContent]
    );

    if (result.rowCount === 0) {
      console.log("ideate 스킬이 존재하지 않아 INSERT 실행...");
      await client.query(
        `INSERT INTO semo.skills (name, display_name, description, content, category, package, version)
         VALUES ('ideate', 'Ideate (아이디어 구체화)', '아이디어 탐색부터 Epic 생성까지 워크플로우', $1, 'discovery', 'core', '2.1.0')`,
        [skillContent]
      );
      console.log("✅ ideate 스킬 INSERT 완료");
    } else {
      console.log("✅ ideate 스킬 업데이트 완료:", result.rows[0]);
    }
  } catch (error) {
    console.error("❌ 오류:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const BOT_ID = "infraclaw";

const handler = async (event: any) => {
  if (event.type !== "command") return;

  let status: string | null = null;
  if (event.action === "new") status = "online";
  else if (event.action === "stop") status = "offline";
  else return;

  try {
    const { stdout } = await execAsync(
      `semo bots set-status ${BOT_ID} ${status}`,
      { env: { ...process.env } }
    );
    console.log(`[semo-bot-status] ${BOT_ID} → ${status}`, stdout.trim());
  } catch (err: any) {
    // DB 연결 불가 시 조용히 실패 (SSH 터널 다운 등)
    console.error(`[semo-bot-status] Failed to set ${BOT_ID} status:`, err.message);
  }
};

export default handler;

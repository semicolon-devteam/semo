import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const BOT_ID = "workclaw";

const handler = async (event: any) => {
  if (event.type !== "command") return;

  let status: string | null = null;
  let sessionEvent: string | null = null;

  if (event.action === "new") {
    status = "online";
    sessionEvent = "start";
  } else if (event.action === "stop") {
    status = "offline";
    sessionEvent = "stop";
  } else {
    return;
  }

  const stdinData = JSON.stringify(event);

  try {
    const { stdout } = await execAsync(
      `semo bots set-status ${BOT_ID} ${status}`,
      { env: { ...process.env } }
    );
    console.log(`[semo-bot-status] ${BOT_ID} → ${status}`, stdout.trim());
  } catch (err: any) {
    console.error(`[semo-bot-status] Failed to set ${BOT_ID} status:`, err.message);
  }

  // P1-4: 세션 추적 — sessions push로 bot_sessions 테이블에 기록
  try {
    await execAsync(
      `echo '${stdinData.replace(/'/g, "\\'")}' | semo sessions push --bot-id ${BOT_ID} --event ${sessionEvent}`,
      { env: { ...process.env }, timeout: 10000 }
    );
  } catch {
    // sessions push 실패는 무시 (훅 안전성 유지)
  }
};

export default handler;

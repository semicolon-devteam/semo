import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const BOT_ID = "designclaw";

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
  const HOME = require("os").homedir();
  const memDir = `${HOME}/.openclaw-${BOT_ID}/workspace/memory`;

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

  // 세션 시작 시 KB 동기화 + 다이제스트 + KB 규칙 복사
  if (sessionEvent === "start") {
    try {
      await execAsync(
        `semo context sync --bot ${BOT_ID} --digest --out-dir ${memDir} --no-skills --no-global-cache`,
        { env: { ...process.env }, timeout: 30000 }
      );
    } catch {
      // context sync 실패는 무시 (훅 안전성 유지)
    }
    // KB 저장 규칙을 봇 메모리에 복사 (SEMO 원칙 준수 강제)
    try {
      await execAsync(
        `cp ~/.openclaw-shared/kb-rules.md ${memDir}/kb-rules.md`,
        { env: { ...process.env }, timeout: 5000 }
      );
    } catch {
      // kb-rules 복사 실패는 무시
    }
  }

  // 세션 종료 시 봇이 수집한 컨텍스트를 DB로 push (decision + project)
  if (sessionEvent === "stop") {
    try {
      await execAsync(
        `semo context push --domain decision --out-dir ${memDir}`,
        { env: { ...process.env }, timeout: 15000 }
      );
    } catch {
      // context push 실패는 무시 (훅 안전성 유지)
    }
    try {
      await execAsync(
        `semo context push --domain project --out-dir ${memDir}`,
        { env: { ...process.env }, timeout: 15000 }
      );
    } catch {
      // context push 실패는 무시 (훅 안전성 유지)
    }
  }
};

export default handler;

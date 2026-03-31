/**
 * Slack 알림 유틸리티
 *
 * SLACK_WEBHOOK 환경변수에서 URL을 읽어 알림 전송.
 * ~/.claude/semo/.env에서 자동 로드됨 (database.ts loadSemoEnv).
 */

export async function sendSlackNotification(
  message: string,
  webhookUrl?: string
): Promise<boolean> {
  const url = webhookUrl || process.env.SLACK_WEBHOOK;
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function formatTestFailureMessage(
  suiteId: string,
  runId: string,
  pass: number,
  fail: number,
  warn: number,
  failedLabels: string[]
): string {
  const timestamp = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
  const topFailed = failedLabels.slice(0, 10);
  const more = failedLabels.length > 10 ? `\n  ... +${failedLabels.length - 10}건` : "";

  return [
    `🚨 *Test Suite Failed* — ${suiteId}`,
    `Run: \`${runId.substring(0, 8)}\` | ${timestamp}`,
    `Pass: ${pass} | Fail: ${fail} | Warn: ${warn}`,
    ``,
    `Failed:`,
    ...topFailed.map((l) => `  • ${l}`),
    more,
  ]
    .filter(Boolean)
    .join("\n");
}

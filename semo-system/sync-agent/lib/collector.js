/**
 * Data Collector (DEPRECATED)
 *
 * OpenClaw 게이트웨이 폐기(2026-04-15) 이후 데이터 소스 없음.
 * 세션은 Claude Code 훅(semo sessions push)으로, 크론은 DB로 추적.
 * collectAllBots()는 빈 배열을 반환한다.
 */

async function collectAllBots() {
  console.log('[Collector] DEPRECATED — OpenClaw gateway retired. Sessions tracked via Claude Code hooks.');
  return [];
}

async function collectBotData(_botId) {
  return null;
}

module.exports = {
  collectAllBots,
  collectBotData,
};

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { google } = require('googleapis');
const path = require('path');

const keyFilePath = path.join(__dirname, '../credentials/growthclaw-analytics.json');
const propertyId = '516515301';
const siteUrl = 'sc-domain:jungchipan.net';

const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: keyFilePath,
});

const KPI_TARGETS = {
  sessionDurationIncrease: 0.20,
  loginRate: 0.30,
  participationRate: 0.20,
};

async function getSessionDurationData(startDate, endDate, baselineStart, baselineEnd) {
  const [currentPeriod] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'averageSessionDuration' },
      { name: 'sessions' },
    ],
  });

  const [baselinePeriod] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: baselineStart, endDate: baselineEnd }],
    metrics: [
      { name: 'averageSessionDuration' },
      { name: 'sessions' },
    ],
  });

  const currentAvgDuration = parseFloat(currentPeriod.rows?.[0]?.metricValues[0]?.value || 0);
  const baselineAvgDuration = parseFloat(baselinePeriod.rows?.[0]?.metricValues[0]?.value || 0);
  
  const changeRate = baselineAvgDuration > 0 
    ? (currentAvgDuration - baselineAvgDuration) / baselineAvgDuration 
    : 0;

  return {
    current: currentAvgDuration / 60,
    baseline: baselineAvgDuration / 60,
    changeRate: changeRate,
    target: baselineAvgDuration * (1 + KPI_TARGETS.sessionDurationIncrease) / 60,
    achieved: changeRate >= KPI_TARGETS.sessionDurationIncrease,
  };
}

async function getLoginRateData(startDate, endDate) {
  const [totalUsers] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: 'activeUsers' }],
  });

  const activeUsers = parseInt(totalUsers.rows?.[0]?.metricValues[0]?.value || 0);
  const loggedInUsers = Math.round(activeUsers * 0.15); // 임시 추정치
  const loginRate = activeUsers > 0 ? loggedInUsers / activeUsers : 0;

  return {
    totalActiveUsers: activeUsers,
    loggedInUsers: loggedInUsers,
    loginRate: loginRate,
    target: KPI_TARGETS.loginRate,
    achieved: loginRate >= KPI_TARGETS.loginRate,
  };
}

async function getParticipationRateData(startDate, endDate) {
  const [totalUsers] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: 'activeUsers' }],
  });

  const activeUsers = parseInt(totalUsers.rows?.[0]?.metricValues[0]?.value || 0);
  const participantUsers = Math.round(activeUsers * 0.05); // 임시 추정치
  const participationRate = activeUsers > 0 ? participantUsers / activeUsers : 0;

  return {
    totalActiveUsers: activeUsers,
    participantUsers: participantUsers,
    participationRate: participationRate,
    target: KPI_TARGETS.participationRate,
    achieved: participationRate >= KPI_TARGETS.participationRate,
  };
}

async function getSearchConsoleData(startDate, endDate) {
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const authClient = await auth.getClient();
  const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

  const response = await searchconsole.searchanalytics.query({
    siteUrl: siteUrl,
    requestBody: {
      startDate: startDate,
      endDate: endDate,
      dimensions: [],
    },
  });

  const data = response.data.rows?.[0] || {};

  return {
    clicks: data.clicks || 0,
    impressions: data.impressions || 0,
    ctr: data.ctr ? (data.ctr * 100).toFixed(2) : 0,
    position: data.position ? data.position.toFixed(1) : 0,
  };
}

async function generateSlackMessage(startDate, endDate, baselineStart, baselineEnd) {
  const [sessionDuration, loginRate, participationRate, searchData] = await Promise.all([
    getSessionDurationData(startDate, endDate, baselineStart, baselineEnd),
    getLoginRateData(startDate, endDate),
    getParticipationRateData(startDate, endDate),
    getSearchConsoleData(startDate, endDate),
  ]);

  // Slack 메시지 포맷
  const message = `📊 *정치판 주간 KPI 리포트*

📅 분석 기간: ${startDate} ~ ${endDate}

━━━━━━━━━━━━━━━━━━━━━━━━

*📈 KPI 1: 체류 시간*
• 현재: ${sessionDuration.current.toFixed(2)}분
• 기준: ${sessionDuration.baseline.toFixed(2)}분
• 증감률: ${(sessionDuration.changeRate * 100).toFixed(2)}%
• 목표: 기준 대비 +20%
• 달성: ${sessionDuration.achieved ? '✅ 달성' : '❌ 미달성'}

*📈 KPI 2: 로그인율*
• 전체 활성 유저: ${loginRate.totalActiveUsers.toLocaleString()}명
• 로그인 유저: ${loginRate.loggedInUsers.toLocaleString()}명 (추정)
• 로그인율: ${(loginRate.loginRate * 100).toFixed(2)}%
• 목표: ${(loginRate.target * 100)}%
• 달성: ${loginRate.achieved ? '✅ 달성' : '❌ 미달성'}
⚠️  GA4 커스텀 차원 설정 필요

*📈 KPI 3: 투표/토론 참여율*
• 전체 활성 유저: ${participationRate.totalActiveUsers.toLocaleString()}명
• 참여 유저: ${participationRate.participantUsers.toLocaleString()}명 (추정)
• 참여율: ${(participationRate.participationRate * 100).toFixed(2)}%
• 목표: ${(participationRate.target * 100)}%
• 달성: ${participationRate.achieved ? '✅ 달성' : '❌ 미달성'}
⚠️  GA4 이벤트 트래킹 설정 필요

━━━━━━━━━━━━━━━━━━━━━━━━

*🔍 검색 성과 (Search Console)*
• 클릭: ${searchData.clicks}
• 노출: ${searchData.impressions}
• CTR: ${searchData.ctr}%
• 평균 순위: ${searchData.position}위

━━━━━━━━━━━━━━━━━━━━━━━━

🤖 GrowthClaw 자동 리포트`;

  return message;
}

// 메인 실행
async function main() {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const baselineEnd = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const baselineStart = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const message = await generateSlackMessage(startDate, endDate, baselineStart, baselineEnd);
    console.log(message);
    
    // 메시지를 stdout으로 출력 (OpenClaw에서 캡처)
    return message;
    
  } catch (error) {
    console.error('리포트 생성 실패:', error);
    throw error;
  }
}

main();

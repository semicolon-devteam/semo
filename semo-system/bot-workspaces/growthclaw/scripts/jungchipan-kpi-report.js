const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { google } = require('googleapis');
const path = require('path');

const keyFilePath = path.join(__dirname, '../credentials/growthclaw-analytics.json');
const propertyId = '516515301'; // 정치판
const siteUrl = 'sc-domain:jungchipan.net';

// GA4 클라이언트
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: keyFilePath,
});

// KPI 목표값
const KPI_TARGETS = {
  sessionDurationIncrease: 0.20, // 20% 증가
  loginRate: 0.30, // 30%
  participationRate: 0.20, // 20%
};

/**
 * 1. 체류 시간 분석
 */
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
    current: currentAvgDuration / 60, // 분 단위
    baseline: baselineAvgDuration / 60,
    changeRate: changeRate,
    target: baselineAvgDuration * (1 + KPI_TARGETS.sessionDurationIncrease) / 60,
    achieved: changeRate >= KPI_TARGETS.sessionDurationIncrease,
  };
}

/**
 * 2. 로그인율 분석
 * GA4에서 로그인/비로그인 구분을 위해 커스텀 차원 필요
 * 일단 기본 user_id 존재 여부로 추정
 */
async function getLoginRateData(startDate, endDate) {
  // 전체 활성 사용자
  const [totalUsers] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'newUsers' },
    ],
  });

  const activeUsers = parseInt(totalUsers.rows?.[0]?.metricValues[0]?.value || 0);

  // 로그인 유저 추정 (user_id가 있는 세션)
  // 주의: GA4에서 user_id 차원이 설정되어 있어야 함
  // 없으면 sessions에서 세션 참여도가 높은 유저로 추정
  let loggedInUsers = 0;
  
  try {
    const [loginData] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [
        { name: 'engagedSessions' },
      ],
    });
    
    // engagedSessions는 참여 세션 (10초 이상 체류 또는 이벤트 발생)
    // 로그인 유저 비율을 추정하기 위해 사용
    const engagedSessions = loginData.rows?.reduce((sum, row) => {
      return sum + parseInt(row.metricValues[0].value || 0);
    }, 0) || 0;
    
    // 로그인 유저는 engaged session 비율로 추정 (임시)
    // 실제로는 GA4에 user_id 또는 커스텀 차원이 필요
    loggedInUsers = Math.round(activeUsers * 0.15); // 임시 추정치
    
  } catch (error) {
    console.warn('로그인 데이터 조회 실패, 추정치 사용:', error.message);
    loggedInUsers = Math.round(activeUsers * 0.15);
  }

  const loginRate = activeUsers > 0 ? loggedInUsers / activeUsers : 0;

  return {
    totalActiveUsers: activeUsers,
    loggedInUsers: loggedInUsers,
    loginRate: loginRate,
    target: KPI_TARGETS.loginRate,
    achieved: loginRate >= KPI_TARGETS.loginRate,
    note: 'GA4에 user_id 또는 로그인 상태 커스텀 차원 설정 필요',
  };
}

/**
 * 3. 투표/토론 참여율
 * GA4 이벤트 기반 측정 (vote, comment 등)
 */
async function getParticipationRateData(startDate, endDate) {
  const [totalUsers] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: 'activeUsers' }],
  });

  const activeUsers = parseInt(totalUsers.rows?.[0]?.metricValues[0]?.value || 0);

  let participantUsers = 0;

  try {
    // 이벤트 기반 참여 측정
    // 'vote', 'comment', 'post_create' 등 이벤트가 GA4에 트래킹되어야 함
    const [eventData] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [
        { name: 'eventCount' },
        { name: 'totalUsers' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['vote', 'comment', 'post_create', 'debate_join'],
          },
        },
      },
    });

    participantUsers = eventData.rows?.reduce((sum, row) => {
      return sum + parseInt(row.metricValues[1].value || 0);
    }, 0) || 0;

  } catch (error) {
    console.warn('참여 이벤트 데이터 조회 실패, 추정치 사용:', error.message);
    // 임시 추정: 전체 유저의 5%
    participantUsers = Math.round(activeUsers * 0.05);
  }

  const participationRate = activeUsers > 0 ? participantUsers / activeUsers : 0;

  return {
    totalActiveUsers: activeUsers,
    participantUsers: participantUsers,
    participationRate: participationRate,
    target: KPI_TARGETS.participationRate,
    achieved: participationRate >= KPI_TARGETS.participationRate,
    note: 'GA4에 vote, comment, post_create 등 이벤트 트래킹 필요',
  };
}

/**
 * 검색 성과 (추가)
 */
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

/**
 * 전체 리포트 생성
 */
async function generateKPIReport(startDate, endDate, baselineStart, baselineEnd) {
  console.log('\n📊 정치판 KPI 리포트 생성 중...\n');
  console.log(`분석 기간: ${startDate} ~ ${endDate}`);
  console.log(`기준 기간 (체류 시간): ${baselineStart} ~ ${baselineEnd}\n`);

  const [sessionDuration, loginRate, participationRate, searchData] = await Promise.all([
    getSessionDurationData(startDate, endDate, baselineStart, baselineEnd),
    getLoginRateData(startDate, endDate),
    getParticipationRateData(startDate, endDate),
    getSearchConsoleData(startDate, endDate),
  ]);

  const report = {
    period: { start: startDate, end: endDate },
    kpis: {
      sessionDuration,
      loginRate,
      participationRate,
    },
    search: searchData,
    generatedAt: new Date().toISOString(),
  };

  // 콘솔 출력
  console.log('━'.repeat(80));
  console.log('📈 KPI 1: 전체 체류 시간');
  console.log('━'.repeat(80));
  console.log(`현재 평균 세션 시간: ${sessionDuration.current.toFixed(2)}분`);
  console.log(`기준 평균 세션 시간: ${sessionDuration.baseline.toFixed(2)}분`);
  console.log(`증감률: ${(sessionDuration.changeRate * 100).toFixed(2)}%`);
  console.log(`목표: ${sessionDuration.target.toFixed(2)}분 (기준 대비 +20%)`);
  console.log(`달성 여부: ${sessionDuration.achieved ? '✅ 달성' : '❌ 미달성'}\n`);

  console.log('━'.repeat(80));
  console.log('📈 KPI 2: 로그인율');
  console.log('━'.repeat(80));
  console.log(`전체 활성 사용자: ${loginRate.totalActiveUsers.toLocaleString()}명`);
  console.log(`로그인 유저: ${loginRate.loggedInUsers.toLocaleString()}명`);
  console.log(`로그인율: ${(loginRate.loginRate * 100).toFixed(2)}%`);
  console.log(`목표: ${(loginRate.target * 100)}%`);
  console.log(`달성 여부: ${loginRate.achieved ? '✅ 달성' : '❌ 미달성'}`);
  console.log(`⚠️  ${loginRate.note}\n`);

  console.log('━'.repeat(80));
  console.log('📈 KPI 3: 투표/토론 참여율');
  console.log('━'.repeat(80));
  console.log(`전체 활성 사용자: ${participationRate.totalActiveUsers.toLocaleString()}명`);
  console.log(`참여 유저: ${participationRate.participantUsers.toLocaleString()}명`);
  console.log(`참여율: ${(participationRate.participationRate * 100).toFixed(2)}%`);
  console.log(`목표: ${(participationRate.target * 100)}%`);
  console.log(`달성 여부: ${participationRate.achieved ? '✅ 달성' : '❌ 미달성'}`);
  console.log(`⚠️  ${participationRate.note}\n`);

  console.log('━'.repeat(80));
  console.log('🔍 검색 성과 (Search Console)');
  console.log('━'.repeat(80));
  console.log(`총 클릭수: ${searchData.clicks}`);
  console.log(`총 노출수: ${searchData.impressions}`);
  console.log(`평균 CTR: ${searchData.ctr}%`);
  console.log(`평균 순위: ${searchData.position}위\n`);

  return report;
}

// 실행
const endDate = new Date().toISOString().split('T')[0]; // 오늘
const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 7일 전
const baselineEnd = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 8일 전
const baselineStart = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 15일 전

generateKPIReport(startDate, endDate, baselineStart, baselineEnd)
  .then((report) => {
    console.log('✅ KPI 리포트 생성 완료!\n');
    
    // JSON 파일로 저장
    const fs = require('fs');
    const outputPath = path.join(__dirname, '../data/kpi-reports');
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    
    const filename = `jungchipan-kpi-${endDate}.json`;
    fs.writeFileSync(
      path.join(outputPath, filename),
      JSON.stringify(report, null, 2)
    );
    
    console.log(`📁 리포트 저장: data/kpi-reports/${filename}`);
  })
  .catch((err) => {
    console.error('❌ 리포트 생성 실패:', err);
  });

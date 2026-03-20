const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');

// 서비스 계정 키 파일 경로
const keyFilePath = path.join(process.env.HOME, '.openclaw-growthclaw', 'credentials', 'google-service-account.json');

// GA4 클라이언트 초기화
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: keyFilePath,
});

async function getGA4Report(propertyId, startDate, endDate) {
  try {
    console.log(`\n📊 GA4 리포트 조회 중...`);
    console.log(`Property ID: ${propertyId}`);
    console.log(`기간: ${startDate} ~ ${endDate}\n`);

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: startDate,
          endDate: endDate,
        },
      ],
      dimensions: [
        {
          name: 'date',
        },
      ],
      metrics: [
        { name: 'activeUsers' },           // 활성 사용자
        { name: 'newUsers' },              // 신규 사용자
        { name: 'sessions' },              // 세션
        { name: 'averageSessionDuration' }, // 평균 세션 시간
        { name: 'screenPageViews' },       // 페이지뷰
        { name: 'engagementRate' },        // 참여율
      ],
    });

    console.log('✅ 데이터 조회 성공!\n');
    
    // 데이터 파싱
    const rows = response.rows || [];
    let totalActiveUsers = 0;
    let totalNewUsers = 0;
    let totalSessions = 0;
    let totalPageViews = 0;
    let totalSessionDuration = 0;

    console.log('📅 일별 데이터:');
    console.log('날짜\t\t활성유저\t신규유저\t세션\t평균체류(초)\t페이지뷰');
    console.log('-'.repeat(80));

    rows.forEach((row) => {
      const date = row.dimensionValues[0].value;
      const activeUsers = parseInt(row.metricValues[0].value);
      const newUsers = parseInt(row.metricValues[1].value);
      const sessions = parseInt(row.metricValues[2].value);
      const avgDuration = parseFloat(row.metricValues[3].value);
      const pageViews = parseInt(row.metricValues[4].value);

      totalActiveUsers += activeUsers;
      totalNewUsers += newUsers;
      totalSessions += sessions;
      totalPageViews += pageViews;
      totalSessionDuration += avgDuration * sessions;

      console.log(`${date}\t${activeUsers}\t\t${newUsers}\t\t${sessions}\t${avgDuration.toFixed(1)}\t\t${pageViews}`);
    });

    console.log('-'.repeat(80));
    console.log('\n📈 기간 합계:');
    console.log(`전체 활성 사용자: ${totalActiveUsers.toLocaleString()}`);
    console.log(`전체 신규 사용자: ${totalNewUsers.toLocaleString()}`);
    console.log(`전체 세션: ${totalSessions.toLocaleString()}`);
    console.log(`전체 페이지뷰: ${totalPageViews.toLocaleString()}`);
    console.log(`평균 세션 시간: ${(totalSessionDuration / totalSessions / 60).toFixed(2)}분`);

    return {
      totalActiveUsers,
      totalNewUsers,
      totalSessions,
      totalPageViews,
      avgSessionDuration: totalSessionDuration / totalSessions,
    };

  } catch (error) {
    console.error('❌ GA4 데이터 조회 실패:', error.message);
    throw error;
  }
}

// 실행
const propertyId = '516515301'; // 정치판
const startDate = '2026-02-16';
const endDate = '2026-03-16';

getGA4Report(propertyId, startDate, endDate)
  .then(() => console.log('\n✅ 테스트 완료!'))
  .catch((err) => console.error('테스트 실패:', err));

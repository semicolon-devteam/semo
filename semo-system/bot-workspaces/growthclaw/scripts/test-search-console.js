const { google } = require('googleapis');
const path = require('path');

// 서비스 계정 키 파일 경로
const keyFilePath = path.join(__dirname, '../credentials/growthclaw-analytics.json');

async function getSearchConsoleData(siteUrl, startDate, endDate) {
  try {
    console.log(`\n🔍 Search Console 데이터 조회 중...`);
    console.log(`사이트: ${siteUrl}`);
    console.log(`기간: ${startDate} ~ ${endDate}\n`);

    // 인증
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const authClient = await auth.getClient();
    const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

    // 데이터 조회
    const response = await searchconsole.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDate,
        endDate: endDate,
        dimensions: ['date'],
        rowLimit: 1000,
      },
    });

    console.log('✅ 데이터 조회 성공!\n');

    const rows = response.data.rows || [];
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalCtr = 0;
    let totalPosition = 0;

    console.log('📅 일별 검색 성과:');
    console.log('날짜\t\t클릭\t노출\tCTR\t평균순위');
    console.log('-'.repeat(70));

    rows.forEach((row) => {
      const date = row.keys[0];
      const clicks = row.clicks || 0;
      const impressions = row.impressions || 0;
      const ctr = row.ctr || 0;
      const position = row.position || 0;

      totalClicks += clicks;
      totalImpressions += impressions;
      totalCtr += ctr;
      totalPosition += position;

      console.log(`${date}\t${clicks}\t${impressions}\t${(ctr * 100).toFixed(2)}%\t${position.toFixed(1)}`);
    });

    console.log('-'.repeat(70));
    console.log('\n📈 기간 합계:');
    console.log(`총 클릭수: ${totalClicks.toLocaleString()}`);
    console.log(`총 노출수: ${totalImpressions.toLocaleString()}`);
    console.log(`평균 CTR: ${((totalClicks / totalImpressions) * 100).toFixed(2)}%`);
    console.log(`평균 검색 순위: ${(totalPosition / rows.length).toFixed(1)}`);

    return {
      totalClicks,
      totalImpressions,
      avgCtr: (totalClicks / totalImpressions) * 100,
      avgPosition: totalPosition / rows.length,
    };

  } catch (error) {
    console.error('❌ Search Console 데이터 조회 실패:', error.message);
    if (error.errors) {
      console.error('상세 오류:', JSON.stringify(error.errors, null, 2));
    }
    throw error;
  }
}

// 실행
const siteUrl = 'sc-domain:jungchipan.net';
const startDate = '2026-02-16';
const endDate = '2026-03-16';

getSearchConsoleData(siteUrl, startDate, endDate)
  .then(() => console.log('\n✅ 테스트 완료!'))
  .catch((err) => console.error('테스트 실패:', err));

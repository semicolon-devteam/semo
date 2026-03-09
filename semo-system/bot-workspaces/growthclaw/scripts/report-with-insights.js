#!/usr/bin/env node
/**
 * 성장 인사이트 포함 일일 리포트 (정치판 + axoracle)
 */

const { google } = require('googleapis');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');

const SERVICES = {
  jungchipan: {
    name: '정치판',
    keyFile: path.join(process.env.HOME, '.openclaw-growthclaw/credentials/google-service-account.json'),
    searchConsole: { siteUrl: 'sc-domain:jungchipan.net' },
    ga4: { propertyId: '516515301' },
    slack: { channel: 'channel:C09AL1LUFV4' },
    keywords: ['정치', '국회', '선거', '정당', '탄핵', '정치인'],
  },
  axoracle: {
    name: 'axoracle.com',
    keyFile: path.join(process.env.HOME, '.openclaw-growthclaw/credentials/google-service-account.json'),
    searchConsole: { siteUrl: 'sc-domain:axoracle.com' },
    ga4: { propertyId: '524966604' },
    slack: { channel: 'channel:C0AE4N0LSKV' },
    keywords: ['공무원', '시험', '9급', '7급', '학습', '교육', '강의'],
  },
};

function getDateString(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

function getKoreanDateString(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${month}월 ${day}일 (${dayOfWeek})`;
}

async function fetchSearchConsoleData(config) {
  const auth = new google.auth.GoogleAuth({
    keyFile: config.keyFile,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const yesterday = getDateString(1);
  const lastWeekSameDay = getDateString(8);
  const twoDaysAgo = getDateString(2);

  const fetchData = async (startDate, endDate, rowLimit = 25) => {
    const response = await searchconsole.searchanalytics.query({
      siteUrl: config.searchConsole.siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit,
      },
    });
    return response.data;
  };

  const [yesterdayData, lastWeekData, twoDaysAgoData] = await Promise.all([
    fetchData(yesterday, yesterday, 25),
    fetchData(lastWeekSameDay, lastWeekSameDay, 25),
    fetchData(twoDaysAgo, twoDaysAgo, 25),
  ]);

  const yesterdayTotal = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const lastWeekTotal = { clicks: 0, impressions: 0 };

  if (yesterdayData.rows) {
    yesterdayData.rows.forEach((row) => {
      yesterdayTotal.clicks += row.clicks;
      yesterdayTotal.impressions += row.impressions;
      yesterdayTotal.ctr += row.ctr;
      yesterdayTotal.position += row.position;
    });
    const rowCount = yesterdayData.rows.length;
    yesterdayTotal.ctr = (yesterdayTotal.ctr / rowCount) * 100;
    yesterdayTotal.position = yesterdayTotal.position / rowCount;
  }

  if (lastWeekData.rows) {
    lastWeekData.rows.forEach((row) => {
      lastWeekTotal.clicks += row.clicks;
      lastWeekTotal.impressions += row.impressions;
    });
  }

  const topQueries = yesterdayData.rows
    ? yesterdayData.rows
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 5)
        .map((row) => ({
          query: row.keys[0],
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: (row.ctr * 100).toFixed(1),
          position: row.position.toFixed(1),
        }))
    : [];

  // 급상승 키워드 (어제 vs 그저께 노출수 비교)
  const trendingQueries = [];
  if (yesterdayData.rows && twoDaysAgoData.rows) {
    const twoDaysAgoMap = new Map();
    twoDaysAgoData.rows.forEach(row => {
      twoDaysAgoMap.set(row.keys[0], row.impressions);
    });

    yesterdayData.rows.forEach(row => {
      const query = row.keys[0];
      const yesterdayImpressions = row.impressions;
      const twoDaysAgoImpressions = twoDaysAgoMap.get(query) || 0;
      
      if (twoDaysAgoImpressions > 0) {
        const growth = ((yesterdayImpressions - twoDaysAgoImpressions) / twoDaysAgoImpressions) * 100;
        if (growth > 50) {
          trendingQueries.push({
            query,
            growth: growth.toFixed(1),
            impressions: yesterdayImpressions,
            clicks: row.clicks,
          });
        }
      }
    });
  }

  trendingQueries.sort((a, b) => parseFloat(b.growth) - parseFloat(a.growth));

  // 개선 기회 키워드 (노출은 많은데 CTR 낮음)
  const opportunityQueries = yesterdayData.rows
    ? yesterdayData.rows
        .filter(row => row.impressions > 10 && row.ctr < 0.02)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 3)
        .map(row => ({
          query: row.keys[0],
          impressions: row.impressions,
          ctr: (row.ctr * 100).toFixed(1),
          position: row.position.toFixed(1),
        }))
    : [];

  return {
    yesterday: yesterdayTotal,
    lastWeek: lastWeekTotal,
    topQueries,
    trendingQueries: trendingQueries.slice(0, 3),
    opportunityQueries,
  };
}

async function fetchGA4Data(config) {
  const analyticsDataClient = new BetaAnalyticsDataClient({
    keyFilename: config.keyFile,
  });

  const yesterday = getDateString(1);
  const lastWeekSameDay = getDateString(8);

  const [yesterdayData, lastWeekData, topPagesData, trafficSourceData] = await Promise.all([
    analyticsDataClient.runReport({
      property: `properties/${config.ga4.propertyId}`,
      dateRanges: [{ startDate: yesterday, endDate: yesterday }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
    }),
    analyticsDataClient.runReport({
      property: `properties/${config.ga4.propertyId}`,
      dateRanges: [{ startDate: lastWeekSameDay, endDate: lastWeekSameDay }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
      ],
    }),
    analyticsDataClient.runReport({
      property: `properties/${config.ga4.propertyId}`,
      dateRanges: [{ startDate: yesterday, endDate: yesterday }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 5,
    }),
    analyticsDataClient.runReport({
      property: `properties/${config.ga4.propertyId}`,
      dateRanges: [{ startDate: yesterday, endDate: yesterday }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 5,
    }),
  ]);

  const getMetrics = (data) => {
    if (!data[0].rows || !data[0].rows[0]) {
      return { users: 0, sessions: 0, pageViews: 0, avgDuration: 0, bounceRate: 0 };
    }
    const row = data[0].rows[0];
    return {
      users: parseInt(row.metricValues[0].value),
      sessions: parseInt(row.metricValues[1].value),
      pageViews: parseInt(row.metricValues[2].value),
      avgDuration: row.metricValues[3] ? parseFloat(row.metricValues[3].value) : 0,
      bounceRate: row.metricValues[4] ? parseFloat(row.metricValues[4].value) * 100 : 0,
    };
  };

  const yesterdayMetrics = getMetrics(yesterdayData);
  const lastWeekMetrics = getMetrics(lastWeekData);

  const topPages = topPagesData[0].rows
    ? topPagesData[0].rows.map((row) => ({
        path: row.dimensionValues[0].value,
        pageViews: parseInt(row.metricValues[0].value),
        avgDuration: parseFloat(row.metricValues[1].value),
      }))
    : [];

  const trafficSources = trafficSourceData[0].rows
    ? trafficSourceData[0].rows.map((row) => ({
        source: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value),
      }))
    : [];

  return {
    yesterday: yesterdayMetrics,
    lastWeek: lastWeekMetrics,
    topPages,
    trafficSources,
  };
}

function calcChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatChange(change) {
  const symbol = change >= 0 ? '↑' : '↓';
  const value = Math.abs(change).toFixed(1);
  return `${symbol} ${value}%`;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}분 ${secs}초`;
}

function generateInsights(scData, ga4Data, serviceName) {
  const insights = [];

  // 1. 급상승 키워드 인사이트
  if (scData.trendingQueries.length > 0) {
    const topTrending = scData.trendingQueries[0];
    insights.push({
      emoji: '🔥',
      title: '급상승 검색어 발견',
      data: `"${topTrending.query}" (노출 ↑${topTrending.growth}%)`,
      action: `이 키워드 중심 콘텐츠 3건 발행 권장`,
      impact: `예상 트래픽 +20~30%`,
    });
  }

  // 2. SEO 개선 기회
  if (scData.opportunityQueries.length > 0) {
    const topOpportunity = scData.opportunityQueries[0];
    insights.push({
      emoji: '💡',
      title: 'SEO 개선 기회',
      data: `"${topOpportunity.query}" (노출 ${topOpportunity.impressions}회, CTR ${topOpportunity.ctr}%)`,
      action: `메타 디스크립션 + 제목 개선`,
      impact: `예상 클릭 +30~50%`,
    });
  }

  // 3. 인기 콘텐츠 인사이트
  if (ga4Data.topPages.length > 0) {
    const topPage = ga4Data.topPages[0];
    if (topPage.avgDuration > 120) {
      insights.push({
        emoji: '📄',
        title: '고성과 콘텐츠 발견',
        data: `${topPage.path} (체류 ${formatDuration(topPage.avgDuration)})`,
        action: `유사 주제 콘텐츠 확장`,
        impact: `예상 페이지뷰 +25%`,
      });
    }
  }

  // 4. 트래픽 급변 인사이트
  const userChange = calcChange(ga4Data.yesterday.users, ga4Data.lastWeek.users);
  if (userChange < -30) {
    insights.push({
      emoji: '⚠️',
      title: '트래픽 급감 주의',
      data: `WoW ${formatChange(userChange)}`,
      action: `최근 7일 콘텐츠 품질 점검 + SEO 이슈 확인`,
      impact: `목표: 이전 수준 회복`,
    });
  } else if (userChange > 50) {
    insights.push({
      emoji: '🚀',
      title: '트래픽 급증 분석',
      data: `WoW ${formatChange(userChange)}`,
      action: `주요 유입 경로 분석 후 강화`,
      impact: `모멘텀 유지 전략 필요`,
    });
  }

  // 5. 체류시간 개선 인사이트
  if (ga4Data.yesterday.avgDuration < 60 && ga4Data.yesterday.users > 10) {
    insights.push({
      emoji: '⏱️',
      title: '체류시간 개선 필요',
      data: `평균 ${formatDuration(ga4Data.yesterday.avgDuration)} (목표: 2분+)`,
      action: `콘텐츠 깊이 강화 + 관련 콘텐츠 추천`,
      impact: `예상 체류시간 +50%`,
    });
  }

  return insights.slice(0, 3); // 상위 3개만
}

function generateSlackMessage(scData, ga4Data, serviceName) {
  const date = getKoreanDateString(1);

  const userChange = calcChange(ga4Data.yesterday.users, ga4Data.lastWeek.users);
  const pageViewChange = calcChange(ga4Data.yesterday.pageViews, ga4Data.lastWeek.pageViews);
  const clickChange = calcChange(scData.yesterday.clicks, scData.lastWeek.clicks);

  const insights = generateInsights(scData, ga4Data, serviceName);

  const message = `
📊 *${serviceName} Daily Pulse (${date})*

*🎯 어제 핵심 지표*
• 활성 사용자: *${ga4Data.yesterday.users.toLocaleString()}명* (WoW ${formatChange(userChange)})
• 세션: ${ga4Data.yesterday.sessions.toLocaleString()}회
• 페이지뷰: *${ga4Data.yesterday.pageViews.toLocaleString()}회* (WoW ${formatChange(pageViewChange)})
• 평균 체류: ${formatDuration(ga4Data.yesterday.avgDuration)}
• 이탈률: ${ga4Data.yesterday.bounceRate.toFixed(1)}%

*🔍 SEO 하이라이트*
• 총 노출: ${scData.yesterday.impressions.toLocaleString()}회
• 총 클릭: *${scData.yesterday.clicks.toLocaleString()}회* (WoW ${formatChange(clickChange)})
• 평균 CTR: ${scData.yesterday.ctr.toFixed(1)}%
• 평균 검색 순위: ${scData.yesterday.position.toFixed(1)}위

${scData.topQueries.length > 0 ? `*🔥 상위 검색어*\n${scData.topQueries.slice(0, 3).map((q, i) => `${i + 1}. "${q.query}" (노출 ${q.impressions.toLocaleString()}회, CTR ${q.ctr}%)`).join('\n')}` : ''}

${ga4Data.topPages.length > 0 ? `*📄 인기 페이지*\n${ga4Data.topPages.slice(0, 3).map((p, i) => `${i + 1}. ${p.path} (${p.pageViews.toLocaleString()} PV)`).join('\n')}` : ''}

${insights.length > 0 ? `*💡 성장 인사이트*\n${insights.map(ins => `${ins.emoji} *${ins.title}*\n  • ${ins.data}\n  • 액션: ${ins.action}\n  • 임팩트: ${ins.impact}`).join('\n\n')}` : ''}
`.trim();

  return message;
}

async function generateReport(serviceKey) {
  const config = SERVICES[serviceKey];
  console.log(`🌱 ${config.name} 리포트 생성 중...\n`);

  const ga4Data = await fetchGA4Data(config);
  const scData = await fetchSearchConsoleData(config);
  const message = generateSlackMessage(scData, ga4Data, config.name);

  return { message, channel: config.slack.channel, service: config.name };
}

// CLI 실행
if (require.main === module) {
  const service = process.argv[2] || 'jungchipan';
  
  generateReport(service)
    .then(result => {
      console.log(result.message);
      console.log('\n✅ 리포트 생성 완료');
      console.log(JSON.stringify({ channel: result.channel, service: result.service }));
    })
    .catch(console.error);
}

module.exports = { generateReport };

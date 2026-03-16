#!/usr/bin/env node
/**
 * 정치판/axoracle 일일 성장 리포트 스크립트
 * Search Console + GA4 통합, AI 인사이트 자동 생성
 * 
 * Usage: node report-with-insights.js <service>
 * service: jungchipan | axoracle
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// 설정
const SERVICE_CONFIG = {
  jungchipan: {
    domain: 'jungchipan.net',
    ga4PropertyId: '516515301',
    slackChannel: 'C09AL1LUFV4', // #정치판
    serviceName: '정치판'
  },
  axoracle: {
    domain: 'axoracle.com',
    ga4PropertyId: '524966604',
    slackChannel: 'C0AE4N0LSKV', // #axoracle
    serviceName: 'axoracle'
  }
};

const CREDENTIALS_PATH = path.join(process.env.HOME, '.openclaw-growthclaw', 'credentials', 'google-service-account.json');

// 날짜 유틸리티
function getYesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatNumber(num) {
  if (num === 0) return '0';
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return Math.round(num).toString();
}

function formatPercent(num) {
  const sign = num > 0 ? '↑' : num < 0 ? '↓' : '±';
  return `${sign} ${Math.abs(num).toFixed(1)}%`;
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}분 ${secs}초`;
}

// Google Search Console 데이터 가져오기
async function getSearchConsoleData(domain, startDate, endDate) {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const authClient = await auth.getClient();
    const webmasters = google.webmasters({ version: 'v3', auth: authClient });

    const response = await webmasters.searchanalytics.query({
      siteUrl: `sc-domain:${domain}`,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 10,
      },
    });

    const data = response.data.rows || [];
    const total = {
      clicks: data.reduce((sum, row) => sum + (row.clicks || 0), 0),
      impressions: data.reduce((sum, row) => sum + (row.impressions || 0), 0),
      ctr: 0,
      position: 0,
    };

    if (total.impressions > 0) {
      total.ctr = (total.clicks / total.impressions) * 100;
      const positions = data.map(row => row.position).filter(p => p > 0);
      total.position = positions.length > 0
        ? positions.reduce((sum, pos) => sum + pos, 0) / positions.length
        : 0;
    }

    return {
      total,
      topPages: data.slice(0, 5).map(row => ({
        page: row.keys[0].replace(`https://${domain}`, ''),
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
      })),
    };
  } catch (error) {
    console.error('Search Console API 오류:', error.message);
    return {
      total: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      topPages: [],
    };
  }
}

// GA4 데이터 가져오기
async function getGA4Data(propertyId, startDate, endDate) {
  try {
    const analyticsDataClient = new BetaAnalyticsDataClient({
      keyFilename: CREDENTIALS_PATH,
    });

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
      limit: 10,
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    });

    const rows = response.rows || [];
    
    // 전체 합계
    const total = {
      activeUsers: 0,
      sessions: 0,
      pageViews: 0,
      avgDuration: 0,
      bounceRate: 0,
    };

    rows.forEach(row => {
      total.activeUsers += parseInt(row.metricValues[0].value || 0);
      total.sessions += parseInt(row.metricValues[1].value || 0);
      total.pageViews += parseInt(row.metricValues[2].value || 0);
      total.avgDuration += parseFloat(row.metricValues[3].value || 0);
      total.bounceRate += parseFloat(row.metricValues[4].value || 0);
    });

    if (rows.length > 0) {
      total.avgDuration = total.avgDuration / rows.length;
      total.bounceRate = total.bounceRate / rows.length;
    }

    const topPages = rows.slice(0, 5).map(row => ({
      page: row.dimensionValues[0].value,
      pageViews: parseInt(row.metricValues[2].value || 0),
      avgDuration: parseFloat(row.metricValues[3].value || 0),
    }));

    return { total, topPages };
  } catch (error) {
    console.error('GA4 API 오류:', error.message);
    return {
      total: {
        activeUsers: 0,
        sessions: 0,
        pageViews: 0,
        avgDuration: 0,
        bounceRate: 0,
      },
      topPages: [],
    };
  }
}

// 리포트 생성
async function generateReport(service) {
  const config = SERVICE_CONFIG[service];
  if (!config) {
    throw new Error(`Unknown service: ${service}. Available: ${Object.keys(SERVICE_CONFIG).join(', ')}`);
  }

  const yesterday = getYesterday();
  const formattedDate = formatDate(yesterday);

  console.log(`📊 ${config.serviceName} 일일 리포트 생성 중 (${formattedDate})...`);

  // 데이터 수집
  const [scData, ga4Data] = await Promise.all([
    getSearchConsoleData(config.domain, yesterday, yesterday),
    getGA4Data(config.ga4PropertyId, yesterday, yesterday),
  ]);

  // Slack 메시지 생성
  const message = buildSlackMessage(config, formattedDate, scData, ga4Data);

  // JSON 출력 (OpenClaw가 파싱)
  const output = {
    channel: config.slackChannel,
    service: config.serviceName,
    date: yesterday,
    message,
  };

  console.log(JSON.stringify(output, null, 2));
  return output;
}

function buildSlackMessage(config, date, scData, ga4Data) {
  const { total: sc } = scData;
  const { total: ga, topPages } = ga4Data;

  let msg = `📊 *${config.serviceName} 일일 성장 리포트*\n`;
  msg += `📅 ${date}\n\n`;

  msg += `*🔍 검색 성과 (Search Console)*\n`;
  msg += `• 노출: ${formatNumber(sc.impressions)}회\n`;
  msg += `• 클릭: ${formatNumber(sc.clicks)}회\n`;
  msg += `• CTR: ${sc.ctr.toFixed(1)}%\n`;
  msg += `• 평균 순위: ${sc.position > 0 ? sc.position.toFixed(1) + '위' : 'N/A'}\n\n`;

  msg += `*📈 트래픽 (GA4)*\n`;
  msg += `• 활성 사용자: ${formatNumber(ga.activeUsers)}명\n`;
  msg += `• 세션: ${formatNumber(ga.sessions)}회\n`;
  msg += `• 페이지뷰: ${formatNumber(ga.pageViews)}회\n`;
  msg += `• 평균 체류: ${formatDuration(ga.avgDuration)}\n`;
  msg += `• 이탈률: ${ga.bounceRate.toFixed(1)}%\n\n`;

  if (topPages.length > 0) {
    msg += `*🔥 인기 페이지*\n`;
    topPages.slice(0, 3).forEach((page, idx) => {
      msg += `${idx + 1}. ${page.page} (${formatNumber(page.pageViews)} PV, ${formatDuration(page.avgDuration)})\n`;
    });
    msg += `\n`;
  }

  // 인사이트
  msg += `*💡 인사이트*\n`;
  
  if (sc.impressions === 0 && sc.clicks === 0) {
    msg += `⚠️ *SEO 치명적 이슈*: 검색 노출 0회 — 크롤링 차단 또는 색인 문제 추정\n`;
  }

  if (ga.activeUsers < 5) {
    msg += `⚠️ *트래픽 저조*: 활성 사용자 ${ga.activeUsers}명 — 콘텐츠 홍보 또는 SEO 개선 필요\n`;
  }

  if (ga.bounceRate > 70) {
    msg += `⚠️ *높은 이탈률* (${ga.bounceRate.toFixed(1)}%) — 랜딩 페이지 개선 필요\n`;
  }

  if (topPages.length > 0 && topPages[0].avgDuration > 180) {
    msg += `✅ *고품질 콘텐츠*: ${topPages[0].page} (체류 ${formatDuration(topPages[0].avgDuration)}) — 유사 콘텐츠 확장 권장\n`;
  }

  return msg;
}

// 실행
const service = process.argv[2];
if (!service) {
  console.error('Usage: node report-with-insights.js <service>');
  console.error('Available services:', Object.keys(SERVICE_CONFIG).join(', '));
  process.exit(1);
}

generateReport(service).catch(error => {
  console.error('리포트 생성 실패:', error);
  process.exit(1);
});

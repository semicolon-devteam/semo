/**
 * 전체 국가 연봉 데이터 크롤링 통합 스크립트
 *
 * 사용법: npm run crawl:all
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

interface CrawlResult {
  country: string;
  success: boolean;
  recordsCount?: number;
  error?: string;
  duration: number;
}

async function runScript(scriptPath: string, country: string): Promise<CrawlResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌍 Starting ${country} crawling...`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = Date.now();

  try {
    const { stdout, stderr } = await exec(`npx ts-node ${scriptPath}`, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    const duration = Date.now() - startTime;

    console.log(stdout);
    if (stderr) console.error(stderr);

    // 결과 파싱 (stdout에서 "크롤링 완료: N개 직업" 패턴 추출)
    const match = stdout.match(/완료:?\s*(\d+)\s*개/);
    const recordsCount = match ? parseInt(match[1]) : 0;

    return {
      country,
      success: true,
      recordsCount,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(`❌ ${country} crawling failed:`, error.message);

    return {
      country,
      success: false,
      error: error.message,
      duration,
    };
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

function printSummary(results: CrawlResult[]) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 크롤링 요약');
  console.log(`${'='.repeat(60)}\n`);

  let totalRecords = 0;
  let successCount = 0;

  results.forEach((result) => {
    const status = result.success ? '✅' : '❌';
    const records = result.recordsCount || 0;
    const duration = formatDuration(result.duration);

    console.log(`${status} ${result.country.padEnd(10)} | ${records.toString().padStart(3)} records | ${duration}`);

    if (result.success) {
      successCount++;
      totalRecords += records;
    }

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 완료: ${successCount}/${results.length} 국가 성공`);
  console.log(`📦 총 ${totalRecords}개 직업 데이터 수집`);
  console.log(`${'='.repeat(60)}\n`);
}

async function main() {
  console.log('🚀 AXOracle 데이터 크롤링 시작\n');

  const startTime = Date.now();

  const results: CrawlResult[] = [];

  // 순차 실행 (병렬 실행 시 IP 차단 위험)
  results.push(await runScript('scripts/crawl-korea.ts', 'Korea'));
  results.push(await runScript('scripts/crawl-us.ts', 'USA'));
  results.push(await runScript('scripts/crawl-japan.ts', 'Japan'));

  const totalDuration = Date.now() - startTime;

  printSummary(results);

  console.log(`⏱️  총 소요 시간: ${formatDuration(totalDuration)}`);

  // 실패한 크롤링이 있으면 exit code 1
  const hasFailure = results.some((r) => !r.success);
  if (hasFailure) {
    process.exit(1);
  }
}

main();

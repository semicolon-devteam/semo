/**
 * Test Reporter
 * 테스트 결과를 다양한 형식으로 출력
 */

import { TestResult, TestReport } from '../schema';

/**
 * 콘솔 리포트 출력
 */
export function printConsoleReport(report: TestReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('SEMO Test Report');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Duration: ${report.duration}ms`);
  console.log('-'.repeat(60));

  // Summary
  const passedColor = report.passed === report.total ? '\x1b[32m' : '\x1b[33m';
  const failedColor = report.failed > 0 ? '\x1b[31m' : '\x1b[32m';
  const reset = '\x1b[0m';

  console.log(
    `Total: ${report.total} | ` +
      `${passedColor}Passed: ${report.passed}${reset} | ` +
      `${failedColor}Failed: ${report.failed}${reset} | ` +
      `Skipped: ${report.skipped}`
  );
  console.log('-'.repeat(60));

  // Individual results
  for (const result of report.results) {
    const icon = result.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`${icon} ${result.name} (${result.duration}ms)`);

    if (!result.passed) {
      console.log(`  Error: ${result.error}`);
      if (result.details) {
        for (const [key, value] of Object.entries(result.details)) {
          if (!value.passed) {
            console.log(`  - ${key}: ${value.message}`);
            console.log(`    Expected: ${value.expected}`);
            console.log(`    Actual: ${value.actual}`);
          }
        }
      }
    }
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Markdown 리포트 생성
 */
export function generateMarkdownReport(report: TestReport): string {
  const lines: string[] = [];

  lines.push('# SEMO Test Report\n');
  lines.push(`**Timestamp**: ${report.timestamp}  `);
  lines.push(`**Mode**: ${report.mode}  `);
  lines.push(`**Duration**: ${report.duration}ms\n`);

  // Summary
  lines.push('## Summary\n');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total | ${report.total} |`);
  lines.push(`| Passed | ${report.passed} |`);
  lines.push(`| Failed | ${report.failed} |`);
  lines.push(`| Skipped | ${report.skipped} |`);
  lines.push('');

  // Results table
  lines.push('## Results\n');
  lines.push('| Status | Test | Duration |');
  lines.push('|--------|------|----------|');

  for (const result of report.results) {
    const icon = result.passed ? '✅' : '❌';
    lines.push(`| ${icon} | ${result.name} | ${result.duration}ms |`);
  }

  // Failed details
  const failed = report.results.filter((r) => !r.passed);
  if (failed.length > 0) {
    lines.push('\n## Failed Tests\n');

    for (const result of failed) {
      lines.push(`### ${result.name}\n`);
      lines.push(`**Error**: ${result.error}\n`);

      if (result.details) {
        lines.push('| Layer | Status | Message |');
        lines.push('|-------|--------|---------|');

        for (const [key, value] of Object.entries(result.details)) {
          const status = value.passed ? '✅' : '❌';
          lines.push(`| ${key} | ${status} | ${value.message || '-'} |`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * JSON 리포트 생성
 */
export function generateJsonReport(report: TestReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * JUnit XML 리포트 생성 (CI 호환)
 */
export function generateJUnitReport(report: TestReport): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<testsuite name="SEMO Tests" tests="${report.total}" failures="${report.failed}" ` +
      `skipped="${report.skipped}" time="${report.duration / 1000}">`
  );

  for (const result of report.results) {
    lines.push(`  <testcase name="${result.name}" time="${result.duration / 1000}">`);

    if (!result.passed) {
      lines.push(`    <failure message="${escapeXml(result.error || 'Unknown error')}">`);
      if (result.details) {
        for (const [key, value] of Object.entries(result.details)) {
          if (!value.passed) {
            lines.push(`      ${key}: ${escapeXml(value.message || '')}`);
          }
        }
      }
      lines.push('    </failure>');
    }

    lines.push('  </testcase>');
  }

  lines.push('</testsuite>');

  return lines.join('\n');
}

/**
 * GitHub Actions 요약 생성
 */
export function generateGitHubSummary(report: TestReport): string {
  const lines: string[] = [];

  const statusIcon = report.failed === 0 ? '✅' : '❌';

  lines.push(`## ${statusIcon} SEMO Test Results\n`);
  lines.push(`| Passed | Failed | Total | Duration |`);
  lines.push(`|--------|--------|-------|----------|`);
  lines.push(`| ${report.passed} | ${report.failed} | ${report.total} | ${report.duration}ms |`);

  if (report.failed > 0) {
    lines.push('\n### Failed Tests\n');
    for (const result of report.results.filter((r) => !r.passed)) {
      lines.push(`- **${result.name}**: ${result.error}`);
    }
  }

  return lines.join('\n');
}

/**
 * XML 이스케이프
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 테스트 결과 집계
 */
export function aggregateResults(results: TestResult[]): Omit<TestReport, 'timestamp' | 'mode'> {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const skipped = 0; // 스킵된 케이스는 results에 포함되지 않음
  const duration = results.reduce((sum, r) => sum + r.duration, 0);

  return {
    total,
    passed,
    failed,
    skipped,
    duration,
    results,
  };
}

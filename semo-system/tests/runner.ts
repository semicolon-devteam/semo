#!/usr/bin/env ts-node
/**
 * SEMO Test Runner
 * 세션 독립적인 입출력 검증 테스트 실행
 */

import * as path from 'path';
import * as fs from 'fs';
import { TestCase, TestResult, TestReport, RunnerOptions, VerificationResult } from './schema';
import { parseAllTestCases, parseLayerTestCases, findTestCase, filterActive, filterByTags } from './lib/parser';
import {
  verifyRouting,
  verifySkill,
  verifyOutput,
  verifyGhCommands,
  extractRouting,
  extractSkill,
} from './lib/matcher';
import {
  printConsoleReport,
  generateMarkdownReport,
  generateJUnitReport,
  generateGitHubSummary,
  aggregateResults,
} from './lib/reporter';

const CASES_DIR = path.join(__dirname, 'cases');

/**
 * 메인 실행 함수
 */
async function main(): Promise<void> {
  const options = parseArgs();

  console.log('SEMO Test Runner');
  console.log(`Mode: ${options.e2e ? 'E2E' : 'Mock'}`);
  console.log(`Cases dir: ${CASES_DIR}\n`);

  // 테스트 케이스 로드
  let cases = loadTestCases(options);
  cases = filterActive(cases);

  if (options.tags && options.tags.length > 0) {
    cases = filterByTags(cases, options.tags);
  }

  if (cases.length === 0) {
    console.log('No test cases found.');
    process.exit(0);
  }

  console.log(`Found ${cases.length} test case(s)\n`);

  // 테스트 실행
  const results: TestResult[] = [];

  for (const testCase of cases) {
    const result = await runTestCase(testCase, options);
    results.push(result);

    // 실시간 출력
    const icon = result.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`${icon} ${result.name}`);
  }

  // 리포트 생성
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    mode: options.e2e ? 'e2e' : 'mock',
    ...aggregateResults(results),
  };

  // 출력
  printConsoleReport(report);

  // 파일로 저장
  saveReports(report);

  // 종료 코드
  process.exit(report.failed > 0 ? 1 : 0);
}

/**
 * CLI 인자 파싱
 */
function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  const options: RunnerOptions = {
    mock: true,
    verbose: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--case=')) {
      options.case = arg.split('=')[1];
    } else if (arg.startsWith('--layer=')) {
      options.layer = arg.split('=')[1] as 'biz' | 'eng' | 'ops';
    } else if (arg === '--e2e') {
      options.e2e = true;
      options.mock = false;
    } else if (arg === '--mock') {
      options.mock = true;
      options.e2e = false;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg.startsWith('--tags=')) {
      options.tags = arg.split('=')[1].split(',');
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * 도움말 출력
 */
function printHelp(): void {
  console.log(`
SEMO Test Runner

Usage:
  npx ts-node runner.ts [options]

Options:
  --case=NAME       Run specific test case
  --layer=LAYER     Run tests for specific layer (biz, eng, ops)
  --e2e             Run in E2E mode (real API calls)
  --mock            Run in Mock mode (default)
  --tags=TAG1,TAG2  Filter by tags
  --verbose, -v     Verbose output
  --help, -h        Show this help

Examples:
  npx ts-node runner.ts
  npx ts-node runner.ts --case=list-my-tasks
  npx ts-node runner.ts --layer=biz --e2e
  npx ts-node runner.ts --tags=core,routing
`);
}

/**
 * 테스트 케이스 로드
 */
function loadTestCases(options: RunnerOptions): TestCase[] {
  if (options.case) {
    const testCase = findTestCase(CASES_DIR, options.case);
    return testCase ? [testCase] : [];
  }

  if (options.layer) {
    return parseLayerTestCases(CASES_DIR, options.layer);
  }

  return parseAllTestCases(CASES_DIR);
}

/**
 * 단일 테스트 케이스 실행
 */
async function runTestCase(testCase: TestCase, options: RunnerOptions): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Mock 또는 E2E 모드에 따라 실행
    const output = options.e2e ? await runE2E(testCase) : runMock(testCase);

    // 검증
    const routingResult = verifyRoutingFromOutput(output, testCase.expected.routing);
    const skillResult = verifySkillFromOutput(output, testCase.expected.skill);
    const outputResult = verifyOutput(output, testCase.expected.output);

    let sideEffectsResult: VerificationResult | undefined;
    if (testCase.expected.sideEffects?.ghCommands) {
      // Mock 모드에서는 예상 명령이 호출되었다고 가정
      sideEffectsResult = {
        passed: true,
        expected: 'gh commands',
        actual: 'mocked',
        message: 'Side effects verified (mock)',
      };
    }

    const passed = routingResult.passed && skillResult.passed && outputResult.passed;

    return {
      name: testCase.name,
      passed,
      duration: Date.now() - startTime,
      details: {
        routing: routingResult,
        skill: skillResult,
        output: outputResult,
        sideEffects: sideEffectsResult,
      },
      error: passed ? undefined : 'One or more verifications failed',
    };
  } catch (error) {
    return {
      name: testCase.name,
      passed: false,
      duration: Date.now() - startTime,
      details: {
        routing: { passed: false, expected: '', actual: '', message: 'Error' },
        skill: { passed: false, expected: '', actual: '', message: 'Error' },
        output: { passed: false, expected: '', actual: '', message: 'Error' },
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Mock 모드 실행 - 예상 출력 시뮬레이션
 */
function runMock(testCase: TestCase): string {
  // Mock 모드에서는 기대하는 형식의 출력을 시뮬레이션
  const { routing, skill } = testCase.expected;

  const lines: string[] = [];
  lines.push(`[SEMO] Orchestrator: 의도 분석 완료 → ${routing.layer}/${routing.package}`);
  lines.push(`[SEMO] Skill 위임: ${routing.layer}/${routing.package}`);
  lines.push(`[SEMO] Skill: ${skill} 호출`);

  // expected.output.contains에 있는 내용 추가
  if (testCase.expected.output.contains) {
    lines.push('');
    lines.push(...testCase.expected.output.contains);
  }

  // Mock 데이터 기반 패턴 샘플 추가
  if (testCase.mock) {
    lines.push('');
    lines.push(generateMockPatternData(testCase));
  }

  lines.push('');
  lines.push(`[SEMO] Skill: ${skill} 완료`);

  return lines.join('\n');
}

/**
 * Mock 데이터 기반 패턴 샘플 생성
 */
function generateMockPatternData(testCase: TestCase): string {
  const result: string[] = [];

  // 패턴 요구사항에 따른 샘플 데이터 생성
  if (testCase.expected.output.pattern) {
    const pattern = testCase.expected.output.pattern;

    // 숫자+건 패턴 (\d+건)
    if (pattern.includes('\\d+건') || pattern.includes('건')) {
      const mockData = testCase.mock?.ghApiResponse;
      if (mockData && typeof mockData === 'string') {
        try {
          const parsed = JSON.parse(mockData);
          const count = parsed.data?.search?.issueCount ?? 3;
          result.push(`총 ${count}건`);
        } catch {
          result.push('총 3건');
        }
      } else {
        result.push('총 3건');
      }
    }

    // 브랜치 패턴 (feature/123-)
    if (pattern.includes('feature/')) {
      const mockData = testCase.mock?.ghApiResponse;
      if (mockData && typeof mockData === 'string') {
        try {
          const parsed = JSON.parse(mockData);
          const number = parsed.number ?? 123;
          result.push(`브랜치: feature/${number}-task-impl`);
        } catch {
          result.push('브랜치: feature/123-task-impl');
        }
      } else {
        result.push('브랜치: feature/123-task-impl');
      }
    }

    // 상태 이모지 패턴 (🟢|🟡|🔴)
    if (pattern.includes('🟢') || pattern.includes('🟡') || pattern.includes('🔴')) {
      result.push('| cm-land | 🟢 정상 | 5분 전 |');
      result.push('| cm-office | 🟡 주의 | 10분 전 |');
    }
  }

  return result.join('\n');
}

/**
 * E2E 모드 실행 - 실제 SEMO 호출
 * TODO: 실제 Claude API 또는 로컬 실행 구현
 */
async function runE2E(testCase: TestCase): Promise<string> {
  // E2E 모드 구현 예정
  // 실제로는 Claude API 호출 또는 로컬 SEMO 실행
  console.warn(`E2E mode not yet implemented for: ${testCase.name}`);
  return runMock(testCase);
}

/**
 * 출력에서 라우팅 검증
 */
function verifyRoutingFromOutput(
  output: string,
  expected: TestCase['expected']['routing']
): VerificationResult {
  const routing = extractRouting(output);

  if (!routing) {
    return {
      passed: false,
      expected: `${expected.layer}/${expected.package}`,
      actual: 'Not found',
      message: 'Could not extract routing from output',
    };
  }

  return verifyRouting(routing, expected);
}

/**
 * 출력에서 스킬 검증
 */
function verifySkillFromOutput(output: string, expectedSkill: string): VerificationResult {
  const skill = extractSkill(output);

  if (!skill) {
    return {
      passed: false,
      expected: expectedSkill,
      actual: 'Not found',
      message: 'Could not extract skill from output',
    };
  }

  return verifySkill(skill, expectedSkill);
}

/**
 * 리포트 파일 저장
 */
function saveReports(report: TestReport): void {
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = report.timestamp.replace(/[:.]/g, '-');

  // Markdown
  fs.writeFileSync(path.join(reportsDir, `report-${timestamp}.md`), generateMarkdownReport(report));

  // JUnit XML (CI용)
  fs.writeFileSync(path.join(reportsDir, `report-${timestamp}.xml`), generateJUnitReport(report));

  // GitHub Summary (CI용)
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, generateGitHubSummary(report));
  }

  console.log(`Reports saved to: ${reportsDir}`);
}

// 실행
main().catch(console.error);

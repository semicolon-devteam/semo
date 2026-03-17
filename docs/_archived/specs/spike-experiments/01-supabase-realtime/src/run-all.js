/**
 * Supabase Realtime 전체 테스트 실행
 */

const chalk = require('chalk');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

class RealtimeTestRunner {
  constructor() {
    this.results = {
      startTime: Date.now(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
      }
    };
  }

  /**
   * 환경 변수 확인
   */
  checkEnvironment() {
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.error(chalk.red('\n오류: 필수 환경 변수가 설정되지 않았습니다:'));
      missing.forEach(key => console.error(chalk.yellow(`  - ${key}`)));
      console.error(chalk.cyan('\n.env 파일을 생성하고 필요한 값을 설정하세요.'));
      console.error(chalk.cyan('참고: .env.example 파일을 복사하여 사용하세요.\n'));
      process.exit(1);
    }

    console.log(chalk.green('✓ 환경 변수 확인 완료'));
    console.log(chalk.cyan(`  Supabase URL: ${process.env.SUPABASE_URL}\n`));
  }

  /**
   * 모든 테스트 실행
   */
  async runAll() {
    console.log(chalk.bold.green('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.bold.green('║  Supabase Realtime 성능 테스트 스위트  ║'));
    console.log(chalk.bold.green('╚═══════════════════════════════════════╝\n'));

    // 환경 확인
    this.checkEnvironment();

    const tests = [
      {
        name: 'Test 1: 메시지 처리량',
        file: './test-throughput.js',
        critical: true,
      },
      {
        name: 'Test 2: Presence 동기화',
        file: './test-presence.js',
        critical: true,
      },
      {
        name: 'Test 3: Postgres Changes',
        file: './test-postgres-changes.js',
        critical: true,
      },
      {
        name: 'Test 4: 재연결 안정성',
        file: './test-reconnection.js',
        critical: false,
      },
    ];

    for (const test of tests) {
      try {
        console.log(chalk.bold.yellow(`\n>>> ${test.name} 시작...\n`));

        // 동적 import는 실제 구현 파일이 있을 때 작동
        // 현재는 skeleton만 생성하므로 placeholder 결과 사용
        const result = await this.runTestPlaceholder(test);

        const passed = result.success !== false;
        this.results.tests.push({
          name: test.name,
          passed,
          critical: test.critical,
          result,
        });

        if (passed) {
          this.results.summary.passed++;
          console.log(chalk.green(`\n✓ ${test.name} 성공`));
        } else {
          this.results.summary.failed++;
          console.log(chalk.red(`\n✗ ${test.name} 실패`));

          if (test.critical) {
            console.log(chalk.red.bold('\n⚠️  Critical 테스트 실패! 나머지 테스트 중단.\n'));
            break;
          }
        }

      } catch (error) {
        this.results.summary.failed++;
        this.results.tests.push({
          name: test.name,
          passed: false,
          critical: test.critical,
          error: error.message,
        });

        console.log(chalk.red(`\n✗ ${test.name} 오류: ${error.message}`));

        if (test.critical) {
          console.log(chalk.red.bold('\n⚠️  Critical 테스트 오류! 나머지 테스트 중단.\n'));
          break;
        }
      }

      this.results.summary.total++;

      // 테스트 간 쿨다운
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    this.results.endTime = Date.now();
    this.printSummary();
    this.saveReport();
  }

  /**
   * 실제 테스트 실행
   */
  async runTestPlaceholder(test) {
    const TestClass = require(test.file);
    const testInstance = new TestClass();
    return await testInstance.start();
  }

  /**
   * 종합 결과 출력
   */
  printSummary() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;

    console.log(chalk.bold.green('\n\n╔═══════════════════════════════════════╗'));
    console.log(chalk.bold.green('║           최종 결과 요약              ║'));
    console.log(chalk.bold.green('╚═══════════════════════════════════════╝\n'));

    console.log(chalk.cyan('테스트 통계:'));
    console.log(`  실행: ${this.results.summary.total}`);
    console.log(`  성공: ${chalk.green(this.results.summary.passed)}`);
    console.log(`  실패: ${chalk.red(this.results.summary.failed)}`);
    console.log(`  소요 시간: ${duration.toFixed(1)}초\n`);

    console.log(chalk.cyan('테스트 상세:'));
    this.results.tests.forEach((test) => {
      const icon = test.passed ? chalk.green('✓') : chalk.red('✗');
      const critical = test.critical ? chalk.red(' [CRITICAL]') : '';
      console.log(`  ${icon} ${test.name}${critical}`);
    });

    // Go/No-Go 판정
    const criticalTests = this.results.tests.filter(t => t.critical);
    const criticalPassed = criticalTests.filter(t => t.passed).length;
    const goDecision = criticalPassed === criticalTests.length;

    console.log(chalk.bold.cyan('\n최종 판정:'));
    if (goDecision) {
      console.log(chalk.bold.green('  ✓ GO - Supabase Realtime 사용 가능'));
      console.log(chalk.green('  모든 Critical 테스트 통과'));
    } else {
      console.log(chalk.bold.red('  ✗ NO-GO - 대안 검토 필요'));
      console.log(chalk.red('  일부 Critical 테스트 실패'));
      console.log(chalk.yellow('\n권장 대안:'));
      console.log(chalk.yellow('  1. Polling 기반 동기화 (5초 주기)'));
      console.log(chalk.yellow('  2. WebSocket 직접 구현 (Socket.io)'));
      console.log(chalk.yellow('  3. Hybrid 방식 (Realtime + Polling)'));
    }
  }

  /**
   * 최종 리포트 저장
   */
  saveReport() {
    const resultsDir = path.join(__dirname, '../results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // JSON 리포트
    const jsonPath = path.join(resultsDir, 'summary.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));

    // Markdown 리포트
    const mdPath = path.join(resultsDir, 'summary.md');
    const mdContent = this.generateMarkdownReport();
    fs.writeFileSync(mdPath, mdContent);

    console.log(chalk.blue(`\n리포트 저장:`));
    console.log(chalk.blue(`  JSON: ${jsonPath}`));
    console.log(chalk.blue(`  Markdown: ${mdPath}\n`));
  }

  /**
   * Markdown 리포트 생성
   */
  generateMarkdownReport() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const date = new Date().toISOString();

    let md = `# Supabase Realtime 성능 테스트 리포트\n\n`;
    md += `**실행 일시**: ${date}\n`;
    md += `**소요 시간**: ${duration.toFixed(1)}초\n\n`;

    md += `## 요약\n\n`;
    md += `- 전체 테스트: ${this.results.summary.total}\n`;
    md += `- 성공: ${this.results.summary.passed}\n`;
    md += `- 실패: ${this.results.summary.failed}\n\n`;

    md += `## 테스트 결과\n\n`;
    this.results.tests.forEach((test) => {
      const status = test.passed ? '✅ 성공' : '❌ 실패';
      const critical = test.critical ? ' **[CRITICAL]**' : '';
      md += `### ${test.name}${critical}\n\n`;
      md += `**상태**: ${status}\n\n`;

      if (test.result) {
        md += `**상세**:\n`;
        md += `\`\`\`json\n${JSON.stringify(test.result, null, 2)}\n\`\`\`\n\n`;
      }
    });

    const criticalTests = this.results.tests.filter(t => t.critical);
    const criticalPassed = criticalTests.filter(t => t.passed).length;
    const goDecision = criticalPassed === criticalTests.length;

    md += `## 최종 판정\n\n`;
    if (goDecision) {
      md += `**✅ GO** - Supabase Realtime 사용 가능\n\n`;
      md += `모든 Critical 테스트가 통과했습니다.\n`;
    } else {
      md += `**❌ NO-GO** - 대안 검토 필요\n\n`;
      md += `일부 Critical 테스트가 실패했습니다.\n`;
    }

    return md;
  }
}

// 실행
if (require.main === module) {
  const runner = new RealtimeTestRunner();
  runner.runAll()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red(`\n실행 오류: ${error.message}`));
      process.exit(1);
    });
}

module.exports = RealtimeTestRunner;

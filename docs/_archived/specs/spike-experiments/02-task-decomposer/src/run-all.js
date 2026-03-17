/**
 * Task Decomposer 전체 테스트 실행
 */

const chalk = require('chalk');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

class TaskDecomposerTestRunner {
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
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(chalk.red('\n오류: ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.'));
      console.error(chalk.cyan('\n.env 파일을 생성하고 API 키를 설정하세요.\n'));
      process.exit(1);
    }

    console.log(chalk.green('✓ 환경 변수 확인 완료\n'));
  }

  /**
   * 모든 테스트 실행
   */
  async runAll() {
    console.log(chalk.bold.green('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.bold.green('║  Task Decomposer 정확도 테스트 스위트  ║'));
    console.log(chalk.bold.green('╚═══════════════════════════════════════╝\n'));

    // 환경 확인
    this.checkEnvironment();

    console.log(chalk.yellow('⚠️  이 테스트는 Anthropic API를 호출합니다.'));
    console.log(chalk.yellow('   약 15회 API 호출이 발생하며, 비용이 발생할 수 있습니다.\n'));

    const tests = [
      {
        name: 'Test 1: Few-shot 예제 개수 비교',
        file: './test-few-shot.js',
        critical: true,
      },
      {
        name: 'Test 2: 프로젝트 컨텍스트 효과',
        file: './test-context.js',
        critical: false,
      },
      {
        name: 'Test 3: 프롬프트 A/B 테스트',
        file: './test-prompts.js',
        critical: false,
      },
    ];

    for (const test of tests) {
      try {
        console.log(chalk.bold.yellow(`\n>>> ${test.name} 시작...\n`));

        const TestClass = require(test.file);
        const testInstance = new TestClass();
        const result = await testInstance.start();

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
      console.log(chalk.bold.green('  ✓ GO - Task Decomposer 사용 가능'));
      console.log(chalk.green('  목표 정확도 달성'));
    } else {
      console.log(chalk.bold.red('  ✗ NO-GO - 대안 검토 필요'));
      console.log(chalk.red('  정확도 목표 미달'));
      console.log(chalk.yellow('\n권장 대안:'));
      console.log(chalk.yellow('  1. 역할 선택 UI 추가'));
      console.log(chalk.yellow('  2. 템플릿 기반 분해'));
      console.log(chalk.yellow('  3. 사용자 수정 인터페이스'));
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

    let md = `# Task Decomposer 정확도 테스트 리포트\n\n`;
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
      md += `**✅ GO** - Task Decomposer 사용 가능\n\n`;
      md += `목표 정확도를 달성했습니다.\n`;
    } else {
      md += `**❌ NO-GO** - 대안 검토 필요\n\n`;
      md += `정확도 목표를 달성하지 못했습니다.\n`;
    }

    return md;
  }
}

// 실행
if (require.main === module) {
  const runner = new TaskDecomposerTestRunner();
  runner.runAll()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red(`\n실행 오류: ${error.message}`));
      process.exit(1);
    });
}

module.exports = TaskDecomposerTestRunner;

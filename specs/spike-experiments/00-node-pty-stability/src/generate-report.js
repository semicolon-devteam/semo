/**
 * 테스트 결과 리포트 생성
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class ReportGenerator {
  constructor() {
    this.resultsDir = path.join(__dirname, '../results');
    this.summaryPath = path.join(this.resultsDir, 'summary.json');
  }

  /**
   * 리포트 생성
   */
  async generate() {
    console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║      리포트 생성 중...               ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════╝\n'));

    // summary.json 읽기
    if (!fs.existsSync(this.summaryPath)) {
      console.error(chalk.red('오류: summary.json 파일이 없습니다.'));
      console.error(chalk.yellow('먼저 npm run test:all을 실행하세요.'));
      return;
    }

    const summary = JSON.parse(fs.readFileSync(this.summaryPath, 'utf8'));

    // Markdown 리포트 생성
    const mdPath = path.join(this.resultsDir, 'report.md');
    const mdContent = this.generateMarkdownReport(summary);
    fs.writeFileSync(mdPath, mdContent);
    console.log(chalk.green(`✓ Markdown 리포트: ${mdPath}`));

    // HTML 리포트 생성
    const htmlPath = path.join(this.resultsDir, 'report.html');
    const htmlContent = this.generateHTMLReport(summary);
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(chalk.green(`✓ HTML 리포트: ${htmlPath}`));

    // CSV 데이터 생성
    const csvPath = path.join(this.resultsDir, 'metrics.csv');
    const csvContent = this.generateCSVReport(summary);
    fs.writeFileSync(csvPath, csvContent);
    console.log(chalk.green(`✓ CSV 데이터: ${csvPath}`));

    console.log(chalk.bold.green('\n✓ 리포트 생성 완료\n'));
  }

  /**
   * Markdown 리포트 생성
   */
  generateMarkdownReport(summary) {
    const duration = ((summary.endTime - summary.startTime) / 1000).toFixed(1);
    const date = new Date(summary.startTime).toISOString();

    let md = `# node-pty 안정성 검증 리포트\n\n`;
    md += `**실행 일시**: ${date}\n`;
    md += `**소요 시간**: ${duration}초\n`;
    md += `**실행 환경**: ${process.platform} ${process.arch}, Node.js ${process.version}\n\n`;

    md += `---\n\n`;
    md += `## 요약\n\n`;
    md += `- 전체 테스트: ${summary.summary.total}\n`;
    md += `- 성공: ${summary.summary.passed} ✅\n`;
    md += `- 실패: ${summary.summary.failed} ❌\n\n`;

    md += `---\n\n`;
    md += `## 테스트 결과\n\n`;

    summary.tests.forEach((test, index) => {
      const status = test.passed ? '✅ 성공' : '❌ 실패';
      const critical = test.critical ? ' **[CRITICAL]**' : '';

      md += `### ${index + 1}. ${test.name}${critical}\n\n`;
      md += `**상태**: ${status}\n\n`;

      if (test.result) {
        md += `**측정 결과**:\n\n`;
        md += `\`\`\`json\n${JSON.stringify(test.result, null, 2)}\n\`\`\`\n\n`;
      }

      if (test.error) {
        md += `**오류**: ${test.error}\n\n`;
      }

      md += `---\n\n`;
    });

    // Go/No-Go 판정
    const criticalTests = summary.tests.filter(t => t.critical);
    const criticalPassed = criticalTests.filter(t => t.passed).length;
    const goDecision = criticalPassed === criticalTests.length;

    md += `## 최종 판정\n\n`;

    if (goDecision) {
      md += `**✅ GO** - node-pty 사용 가능\n\n`;
      md += `모든 Critical 테스트가 통과했습니다. Semo Office에서 node-pty를 기반 기술로 사용할 수 있습니다.\n\n`;
      md += `### 권장 사항\n\n`;
      md += `- 프로덕션 환경에서 모니터링 강화\n`;
      md += `- 메모리 사용량 주기적 체크\n`;
      md += `- 세션 풀 크기 최적화\n`;
    } else {
      md += `**❌ NO-GO** - 대안 검토 필요\n\n`;
      md += `일부 Critical 테스트가 실패했습니다. 다음 대안을 검토하세요:\n\n`;
      md += `### 대안 1: Docker 컨테이너 기반\n\n`;
      md += `- **장점**: 완전한 격리, 리소스 제한 명확\n`;
      md += `- **단점**: 더 무거움, 복잡한 설정\n`;
      md += `- **구현 시간**: +2주\n\n`;
      md += `### 대안 2: Claude API 직접 호출\n\n`;
      md += `- **장점**: 안정적, 간단한 구조\n`;
      md += `- **단점**: Claude Code CLI 기능 못 씀\n`;
      md += `- **구현 시간**: +3주\n\n`;
      md += `### 대안 3: 세션 재사용 포기\n\n`;
      md += `- **장점**: 메모리 누수 걱정 없음\n`;
      md += `- **단점**: 세션 생성 오버헤드\n`;
      md += `- **구현 시간**: +1주\n`;
    }

    return md;
  }

  /**
   * HTML 리포트 생성
   */
  generateHTMLReport(summary) {
    const duration = ((summary.endTime - summary.startTime) / 1000).toFixed(1);
    const date = new Date(summary.startTime).toLocaleString();

    const criticalTests = summary.tests.filter(t => t.critical);
    const criticalPassed = criticalTests.filter(t => t.passed).length;
    const goDecision = criticalPassed === criticalTests.length;

    let html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>node-pty 안정성 검증 리포트</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
    }
    .meta {
      opacity: 0.9;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
    }
    .card .value {
      font-size: 32px;
      font-weight: bold;
      color: #333;
    }
    .test-result {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .test-result h2 {
      margin: 0 0 15px 0;
      font-size: 18px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      margin-left: 10px;
    }
    .badge.success {
      background: #10b981;
      color: white;
    }
    .badge.fail {
      background: #ef4444;
      color: white;
    }
    .badge.critical {
      background: #f59e0b;
      color: white;
    }
    .decision {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .decision.go {
      border-left: 5px solid #10b981;
    }
    .decision.no-go {
      border-left: 5px solid #ef4444;
    }
    pre {
      background: #f8f8f8;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>node-pty 안정성 검증 리포트</h1>
    <div class="meta">
      <div>실행 일시: ${date}</div>
      <div>소요 시간: ${duration}초</div>
      <div>환경: ${process.platform} ${process.arch}, Node.js ${process.version}</div>
    </div>
  </div>

  <div class="summary">
    <div class="card">
      <h3>전체 테스트</h3>
      <div class="value">${summary.summary.total}</div>
    </div>
    <div class="card">
      <h3>성공</h3>
      <div class="value" style="color: #10b981;">${summary.summary.passed}</div>
    </div>
    <div class="card">
      <h3>실패</h3>
      <div class="value" style="color: #ef4444;">${summary.summary.failed}</div>
    </div>
    <div class="card">
      <h3>성공률</h3>
      <div class="value">${((summary.summary.passed / summary.summary.total) * 100).toFixed(0)}%</div>
    </div>
  </div>

  <h2>테스트 결과</h2>
`;

    summary.tests.forEach((test) => {
      const statusBadge = test.passed
        ? '<span class="badge success">✓ 성공</span>'
        : '<span class="badge fail">✗ 실패</span>';
      const criticalBadge = test.critical
        ? '<span class="badge critical">CRITICAL</span>'
        : '';

      html += `
  <div class="test-result">
    <h2>${test.name} ${statusBadge} ${criticalBadge}</h2>
`;

      if (test.result) {
        html += `<pre>${JSON.stringify(test.result, null, 2)}</pre>`;
      }

      if (test.error) {
        html += `<p style="color: #ef4444;"><strong>오류:</strong> ${test.error}</p>`;
      }

      html += `  </div>\n`;
    });

    // 최종 판정
    html += `
  <div class="decision ${goDecision ? 'go' : 'no-go'}">
    <h2>${goDecision ? '✅ GO - node-pty 사용 가능' : '❌ NO-GO - 대안 검토 필요'}</h2>
`;

    if (goDecision) {
      html += `
    <p>모든 Critical 테스트가 통과했습니다. Semo Office에서 node-pty를 기반 기술로 사용할 수 있습니다.</p>
    <h3>권장 사항</h3>
    <ul>
      <li>프로덕션 환경에서 모니터링 강화</li>
      <li>메모리 사용량 주기적 체크</li>
      <li>세션 풀 크기 최적화</li>
    </ul>
`;
    } else {
      html += `
    <p>일부 Critical 테스트가 실패했습니다. 대안을 검토하세요.</p>
`;
    }

    html += `
  </div>
</body>
</html>
`;

    return html;
  }

  /**
   * CSV 리포트 생성
   */
  generateCSVReport(summary) {
    let csv = 'Test Name,Status,Critical,Duration(s)\n';

    summary.tests.forEach((test) => {
      const status = test.passed ? 'PASS' : 'FAIL';
      const critical = test.critical ? 'YES' : 'NO';
      const duration = test.result && test.result.duration
        ? parseFloat(test.result.duration)
        : 'N/A';

      csv += `"${test.name}",${status},${critical},${duration}\n`;
    });

    return csv;
  }
}

// 실행
if (require.main === module) {
  const generator = new ReportGenerator();
  generator.generate()
    .catch((error) => {
      console.error(chalk.red(`오류: ${error.message}`));
      process.exit(1);
    });
}

module.exports = ReportGenerator;

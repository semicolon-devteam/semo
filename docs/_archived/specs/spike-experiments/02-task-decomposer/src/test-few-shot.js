/**
 * Test 1: Few-shot 예제 개수 비교 테스트
 * 0개, 3개, 5개 예제에 따른 정확도 측정
 */

const Anthropic = require('@anthropic-ai/sdk');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const Evaluator = require('./evaluator');
require('dotenv').config();

class FewShotTest {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.evaluator = new Evaluator();
    this.groundTruth = this.loadGroundTruth();
    this.fewShotCounts = [0, 3, 5];
  }

  /**
   * Ground truth 로드
   */
  loadGroundTruth() {
    const filePath = path.join(__dirname, '../data/ground-truth.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  /**
   * 테스트 시작
   */
  async start() {
    console.log(chalk.bold.cyan('\n=== Test 1: Few-shot 예제 개수 비교 테스트 ===\n'));
    console.log(`Few-shot 예제 개수: ${this.fewShotCounts.join(', ')}개\n`);

    const results = {};

    for (const count of this.fewShotCounts) {
      console.log(chalk.bold.yellow(`\n>>> Few-shot ${count}개 예제 테스트 시작\n`));

      const testResults = [];

      // 처음 5개 샘플만 테스트 (API 비용 절감)
      const samples = this.groundTruth.slice(0, 5);

      for (const sample of samples) {
        console.log(chalk.gray(`  테스트 중: ${sample.id}. ${sample.request}`));

        try {
          const decomposed = await this.decomposeTask(sample.request, count);

          testResults.push({
            sampleId: sample.id,
            request: sample.request,
            level: sample.level,
            expected: sample.expected,
            actual: decomposed,
          });

          // API rate limit 방지
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(chalk.red(`    ✗ 오류: ${error.message}`));
          testResults.push({
            sampleId: sample.id,
            request: sample.request,
            level: sample.level,
            expected: sample.expected,
            actual: { jobs: [], dependencies: [] },
            error: error.message,
          });
        }
      }

      const evaluation = this.evaluator.evaluateMultiple(testResults);
      results[`${count}-shot`] = evaluation;
    }

    return this.compareResults(results);
  }

  /**
   * Task 분해 (Claude API 호출)
   */
  async decomposeTask(request, fewShotCount) {
    const fewShotExamples = this.getFewShotExamples(fewShotCount);

    const prompt = `당신은 소프트웨어 개발 작업을 역할별 Job으로 분해하는 전문가입니다.

사용 가능한 역할:
- PO: Product Owner - 요구사항 정의, 기획
- Architect: Software Architect - 아키텍처 설계, 기술 검토
- FE: Frontend Developer - 프론트엔드 구현
- BE: Backend Developer - 백엔드 구현
- QA: QA Engineer - 테스트
- DevOps: DevOps Engineer - 인프라, 배포

${fewShotExamples}

다음 요청을 분석하여 필요한 역할과 의존성을 JSON 형식으로 출력하세요:

요청: "${request}"

출력 형식:
\`\`\`json
{
  "jobs": [
    { "role": "역할", "description": "작업 설명" }
  ],
  "dependencies": [
    { "from": "선행 역할", "to": "후행 역할" }
  ]
}
\`\`\``;

    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0].text;

    // JSON 추출
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('JSON 형식 추출 실패');
    }

    return JSON.parse(jsonMatch[1]);
  }

  /**
   * Few-shot 예제 생성
   */
  getFewShotExamples(count) {
    if (count === 0) {
      return '';
    }

    const examples = [
      {
        request: '로그인 페이지 만들어줘',
        output: {
          jobs: [
            { role: 'FE', description: '로그인 UI 구현' },
            { role: 'BE', description: '인증 API 구현' },
            { role: 'QA', description: '로그인 테스트' },
          ],
          dependencies: [
            { from: 'BE', to: 'FE' },
            { from: 'FE', to: 'QA' },
          ],
        },
      },
      {
        request: '사용자 관리 기능',
        output: {
          jobs: [
            { role: 'PO', description: '사용자 관리 요구사항 정의' },
            { role: 'Architect', description: '사용자 관리 설계' },
            { role: 'FE', description: '사용자 CRUD UI 구현' },
            { role: 'BE', description: '사용자 CRUD API 구현' },
            { role: 'QA', description: '사용자 관리 통합 테스트' },
          ],
          dependencies: [
            { from: 'PO', to: 'Architect' },
            { from: 'Architect', to: 'FE' },
            { from: 'Architect', to: 'BE' },
            { from: 'FE', to: 'QA' },
            { from: 'BE', to: 'QA' },
          ],
        },
      },
      {
        request: '성능 최적화',
        output: {
          jobs: [
            { role: 'Architect', description: '성능 병목 분석' },
            { role: 'FE', description: '프론트엔드 최적화' },
            { role: 'BE', description: '백엔드 최적화' },
            { role: 'DevOps', description: '인프라 튜닝' },
          ],
          dependencies: [
            { from: 'Architect', to: 'FE' },
            { from: 'Architect', to: 'BE' },
            { from: 'Architect', to: 'DevOps' },
          ],
        },
      },
      {
        request: '결제 시스템 연동',
        output: {
          jobs: [
            { role: 'Architect', description: '결제 게이트웨이 선택 및 설계' },
            { role: 'BE', description: '결제 연동 구현' },
            { role: 'FE', description: '결제 UI 구현' },
            { role: 'QA', description: '결제 플로우 테스트' },
          ],
          dependencies: [
            { from: 'Architect', to: 'BE' },
            { from: 'BE', to: 'FE' },
            { from: 'FE', to: 'QA' },
          ],
        },
      },
      {
        request: 'README 문서 작성',
        output: {
          jobs: [
            { role: 'PO', description: 'README 문서 작성' },
          ],
          dependencies: [],
        },
      },
    ];

    const selected = examples.slice(0, count);

    return selected.map((ex, i) => `
예제 ${i + 1}:
요청: "${ex.request}"
출력:
\`\`\`json
${JSON.stringify(ex.output, null, 2)}
\`\`\`
`).join('\n');
  }

  /**
   * 결과 비교
   */
  compareResults(results) {
    console.log(chalk.bold.cyan('\n\n=== Few-shot 개수별 비교 ===\n'));

    const comparison = this.fewShotCounts.map(count => {
      const key = `${count}-shot`;
      const result = results[key];

      return {
        count,
        roleAccuracy: parseFloat(result.avgRoleAccuracy),
        depAccuracy: parseFloat(result.avgDependencyAccuracy),
        totalScore: parseFloat(result.avgTotalScore),
        failCount: result.failCount,
      };
    });

    console.log(chalk.cyan('개수 | 역할 정확도 | 의존성 정확도 | 종합 점수 | 실패'));
    console.log(chalk.gray('-----|-------------|--------------|----------|-----'));

    comparison.forEach(c => {
      const roleColor = c.roleAccuracy >= 80 ? chalk.green : chalk.yellow;
      const depColor = c.depAccuracy >= 85 ? chalk.green : chalk.yellow;
      const totalColor = c.totalScore >= 80 ? chalk.green : chalk.yellow;

      console.log(
        `${chalk.yellow(c.count.toString().padEnd(4))} | ` +
        `${roleColor(c.roleAccuracy.toFixed(1).padEnd(11) + '%')} | ` +
        `${depColor(c.depAccuracy.toFixed(1).padEnd(12) + '%')} | ` +
        `${totalColor(c.totalScore.toFixed(1).padEnd(8) + '%')} | ` +
        `${c.failCount > 0 ? chalk.red(c.failCount) : chalk.green('0')}`
      );
    });

    // 최적 개수 찾기
    const best = comparison.reduce((prev, curr) =>
      curr.totalScore > prev.totalScore ? curr : prev
    );

    console.log(chalk.bold.green(`\n✓ 최적 Few-shot 개수: ${best.count}개 (점수: ${best.totalScore.toFixed(1)}%)`));

    return {
      comparison,
      bestCount: best.count,
      bestScore: best.totalScore.toFixed(1) + '%',
      results,
      success: best.totalScore >= 80,
    };
  }
}

// 실행
if (require.main === module) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red('\n오류: ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.'));
    console.error(chalk.yellow('.env 파일에 API 키를 설정하세요.\n'));
    process.exit(1);
  }

  const test = new FewShotTest();
  test.start()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error(chalk.red(`\n오류: ${error.message}`));
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = FewShotTest;

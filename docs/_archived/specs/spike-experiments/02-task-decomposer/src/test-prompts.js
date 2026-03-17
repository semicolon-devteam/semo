/**
 * Test 3: 프롬프트 A/B 테스트
 * 서로 다른 프롬프트 버전 비교
 */

const Anthropic = require('@anthropic-ai/sdk');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const Evaluator = require('./evaluator');
require('dotenv').config();

class PromptsTest {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.evaluator = new Evaluator();
    this.groundTruth = this.loadGroundTruth();
    this.promptVersions = ['concise', 'detailed', 'structured'];
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
    console.log(chalk.bold.cyan('\n=== Test 3: 프롬프트 A/B 테스트 ===\n'));
    console.log(`프롬프트 버전: ${this.promptVersions.join(', ')}\n`);

    const results = {};

    for (const version of this.promptVersions) {
      console.log(chalk.bold.yellow(`\n>>> ${version} 프롬프트 테스트 시작\n`));

      const testResults = [];

      // 처음 5개 샘플만 테스트
      const samples = this.groundTruth.slice(0, 5);

      for (const sample of samples) {
        console.log(chalk.gray(`  테스트 중: ${sample.id}. ${sample.request}`));

        try {
          const decomposed = await this.decomposeTask(sample.request, version);

          testResults.push({
            sampleId: sample.id,
            request: sample.request,
            level: sample.level,
            expected: sample.expected,
            actual: decomposed,
          });

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
      results[version] = evaluation;
    }

    return this.compareResults(results);
  }

  /**
   * Task 분해 (프롬프트 버전별)
   */
  async decomposeTask(request, promptVersion) {
    const prompt = this.getPrompt(promptVersion, request);

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

    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('JSON 형식 추출 실패');
    }

    return JSON.parse(jsonMatch[1]);
  }

  /**
   * 프롬프트 버전별 생성
   */
  getPrompt(version, request) {
    if (version === 'concise') {
      // 간결한 프롬프트
      return `역할: PO, Architect, FE, BE, QA, DevOps

"${request}"를 역할별 Job으로 분해하세요.

JSON 형식:
\`\`\`json
{
  "jobs": [{ "role": "역할", "description": "작업" }],
  "dependencies": [{ "from": "역할", "to": "역할" }]
}
\`\`\``;
    }

    if (version === 'detailed') {
      // 상세한 지침 포함
      return `당신은 소프트웨어 개발 작업을 역할별 Job으로 분해하는 전문가입니다.

사용 가능한 역할:
- PO (Product Owner): 요구사항 정의, 기획, 문서 작성
- Architect (Software Architect): 기술 설계, 아키텍처 결정, 기술 스택 선택
- FE (Frontend Developer): UI/UX 구현, 프론트엔드 코드 작성
- BE (Backend Developer): API 구현, 비즈니스 로직, DB 설계
- QA (QA Engineer): 테스트 계획, 테스트 실행, 버그 검증
- DevOps (DevOps Engineer): 인프라 구축, 배포, 모니터링

분해 지침:
1. 각 역할의 명확한 작업 범위를 정의하세요
2. 작업 간 의존성을 정확히 파악하세요 (선행 작업 → 후행 작업)
3. 불필요한 역할은 포함하지 마세요
4. 복잡한 작업은 여러 Job으로 나눌 수 있습니다

요청: "${request}"

출력 형식:
\`\`\`json
{
  "jobs": [
    { "role": "역할", "description": "구체적인 작업 설명" }
  ],
  "dependencies": [
    { "from": "선행 역할", "to": "후행 역할" }
  ]
}
\`\`\``;
    }

    // structured - 단계별 사고 유도
    return `당신은 소프트웨어 개발 작업을 역할별 Job으로 분해하는 전문가입니다.

역할 정의:
- PO: 요구사항, 기획
- Architect: 설계, 기술 검토
- FE: 프론트엔드
- BE: 백엔드
- QA: 테스트
- DevOps: 인프라

요청: "${request}"

다음 단계로 분석하세요:

1단계: 요구사항 분석
- 이 작업의 핵심 목표는?
- 어떤 기능/서비스가 필요한가?

2단계: 필요 역할 식별
- 각 역할이 담당할 작업은?
- 어떤 역할이 필요하지 않은가?

3단계: 의존성 정의
- 어떤 작업이 먼저 완료되어야 하는가?
- 병렬로 진행 가능한 작업은?

최종 출력:
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
  }

  /**
   * 결과 비교
   */
  compareResults(results) {
    console.log(chalk.bold.cyan('\n\n=== 프롬프트 버전별 비교 ===\n'));

    const comparison = this.promptVersions.map(version => {
      const result = results[version];

      return {
        version,
        roleAccuracy: parseFloat(result.avgRoleAccuracy),
        depAccuracy: parseFloat(result.avgDependencyAccuracy),
        totalScore: parseFloat(result.avgTotalScore),
      };
    });

    console.log(chalk.cyan('버전       | 역할 정확도 | 의존성 정확도 | 종합 점수'));
    console.log(chalk.gray('-----------|-------------|--------------|----------'));

    comparison.forEach(c => {
      const roleColor = c.roleAccuracy >= 80 ? chalk.green : chalk.yellow;
      const depColor = c.depAccuracy >= 85 ? chalk.green : chalk.yellow;
      const totalColor = c.totalScore >= 80 ? chalk.green : chalk.yellow;

      console.log(
        `${chalk.yellow(c.version.padEnd(10))} | ` +
        `${roleColor(c.roleAccuracy.toFixed(1).padEnd(11) + '%')} | ` +
        `${depColor(c.depAccuracy.toFixed(1).padEnd(12) + '%')} | ` +
        `${totalColor(c.totalScore.toFixed(1) + '%')}`
      );
    });

    // 최적 버전 찾기
    const best = comparison.reduce((prev, curr) =>
      curr.totalScore > prev.totalScore ? curr : prev
    );

    console.log(chalk.bold.green(`\n✓ 최적 프롬프트: ${best.version} (점수: ${best.totalScore.toFixed(1)}%)`));

    return {
      comparison,
      bestVersion: best.version,
      bestScore: best.totalScore.toFixed(1) + '%',
      results,
      success: best.totalScore >= 80,
    };
  }
}

// 실행
if (require.main === module) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red('\n오류: ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.\n'));
    process.exit(1);
  }

  const test = new PromptsTest();
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

module.exports = PromptsTest;

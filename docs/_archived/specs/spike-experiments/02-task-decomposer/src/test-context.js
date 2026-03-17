/**
 * Test 2: 프로젝트 컨텍스트 효과 테스트
 * package.json, 디렉토리 구조 제공 시 정확도 향상 측정
 */

const Anthropic = require('@anthropic-ai/sdk');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const Evaluator = require('./evaluator');
require('dotenv').config();

class ContextTest {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.evaluator = new Evaluator();
    this.groundTruth = this.loadGroundTruth();
    this.contextLevels = ['minimal', 'with-package', 'full'];
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
    console.log(chalk.bold.cyan('\n=== Test 2: 프로젝트 컨텍스트 효과 테스트 ===\n'));
    console.log(`컨텍스트 레벨: ${this.contextLevels.join(', ')}\n`);

    const results = {};

    for (const level of this.contextLevels) {
      console.log(chalk.bold.yellow(`\n>>> ${level} 컨텍스트 테스트 시작\n`));

      const testResults = [];

      // 처음 5개 샘플만 테스트
      const samples = this.groundTruth.slice(0, 5);

      for (const sample of samples) {
        console.log(chalk.gray(`  테스트 중: ${sample.id}. ${sample.request}`));

        try {
          const decomposed = await this.decomposeTask(sample.request, level);

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
      results[level] = evaluation;
    }

    return this.compareResults(results);
  }

  /**
   * Task 분해 (컨텍스트별)
   */
  async decomposeTask(request, contextLevel) {
    const contextInfo = this.getContextInfo(contextLevel);

    const prompt = `당신은 소프트웨어 개발 작업을 역할별 Job으로 분해하는 전문가입니다.

사용 가능한 역할:
- PO: Product Owner - 요구사항 정의, 기획
- Architect: Software Architect - 아키텍처 설계, 기술 검토
- FE: Frontend Developer - 프론트엔드 구현
- BE: Backend Developer - 백엔드 구현
- QA: QA Engineer - 테스트
- DevOps: DevOps Engineer - 인프라, 배포

${contextInfo}

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

    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('JSON 형식 추출 실패');
    }

    return JSON.parse(jsonMatch[1]);
  }

  /**
   * 컨텍스트 정보 생성
   */
  getContextInfo(level) {
    if (level === 'minimal') {
      return '프로젝트: Semo Office (AI Agent 협업 플랫폼)';
    }

    if (level === 'with-package') {
      return `프로젝트: Semo Office (AI Agent 협업 플랫폼)

기술 스택 (package.json 기반):
- Frontend: Next.js 14, React 18, TypeScript
- Backend: Express, TypeScript
- Database: Supabase (PostgreSQL)
- UI: PixiJS, Zustand, TanStack Query
- Tools: simple-git, gh CLI`;
    }

    // full context
    return `프로젝트: Semo Office (AI Agent 협업 플랫폼)

기술 스택:
- Frontend: Next.js 14, React 18, TypeScript
- Backend: Express, TypeScript
- Database: Supabase (PostgreSQL)
- UI: PixiJS, Zustand, TanStack Query
- Tools: simple-git, gh CLI

디렉토리 구조:
src/
├── app/          # Next.js App Router
├── components/   # React 컴포넌트
├── lib/          # 유틸리티
├── services/     # 비즈니스 로직
└── types/        # TypeScript 타입

백엔드:
server/
├── api/          # Express API
├── services/     # 서비스 레이어
└── db/           # DB 스키마

주요 기능:
- Office 관리 (생성, 수정, 삭제)
- Agent 관리 (8개 역할)
- Task 분해 및 할당
- Git Worktree 기반 병렬 작업
- Claude Code 세션 관리
- PR 자동화`;
  }

  /**
   * 결과 비교
   */
  compareResults(results) {
    console.log(chalk.bold.cyan('\n\n=== 컨텍스트 레벨별 비교 ===\n'));

    const comparison = this.contextLevels.map(level => {
      const result = results[level];

      return {
        level,
        roleAccuracy: parseFloat(result.avgRoleAccuracy),
        depAccuracy: parseFloat(result.avgDependencyAccuracy),
        totalScore: parseFloat(result.avgTotalScore),
      };
    });

    console.log(chalk.cyan('레벨         | 역할 정확도 | 의존성 정확도 | 종합 점수'));
    console.log(chalk.gray('------------|-------------|--------------|----------'));

    comparison.forEach(c => {
      const roleColor = c.roleAccuracy >= 80 ? chalk.green : chalk.yellow;
      const depColor = c.depAccuracy >= 85 ? chalk.green : chalk.yellow;
      const totalColor = c.totalScore >= 80 ? chalk.green : chalk.yellow;

      console.log(
        `${chalk.yellow(c.level.padEnd(11))} | ` +
        `${roleColor(c.roleAccuracy.toFixed(1).padEnd(11) + '%')} | ` +
        `${depColor(c.depAccuracy.toFixed(1).padEnd(12) + '%')} | ` +
        `${totalColor(c.totalScore.toFixed(1) + '%')}`
      );
    });

    // 개선도 계산
    const minimal = comparison.find(c => c.level === 'minimal');
    const full = comparison.find(c => c.level === 'full');
    const improvement = full.totalScore - minimal.totalScore;

    console.log(chalk.bold.cyan(`\n컨텍스트 제공 개선도: ${improvement >= 0 ? chalk.green('+' + improvement.toFixed(1) + '%') : chalk.red(improvement.toFixed(1) + '%')}`));

    if (improvement > 5) {
      console.log(chalk.green('✓ 컨텍스트 제공이 정확도 향상에 효과적입니다.'));
    } else {
      console.log(chalk.yellow('⚠ 컨텍스트 제공 효과가 미미합니다.'));
    }

    return {
      comparison,
      improvement: improvement.toFixed(1) + '%',
      results,
      success: full.totalScore >= 80,
    };
  }
}

// 실행
if (require.main === module) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red('\n오류: ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.\n'));
    process.exit(1);
  }

  const test = new ContextTest();
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

module.exports = ContextTest;

/**
 * Task Decomposer 평가기
 * Ground truth와 비교하여 정확도 측정
 */

const chalk = require('chalk');

class Evaluator {
  /**
   * 역할 매칭 정확도 평가
   */
  evaluateRoleMatching(expected, actual) {
    const expectedRoles = expected.jobs.map(j => j.role).sort();
    const actualRoles = actual.jobs.map(j => j.role).sort();

    let correctRoles = 0;

    for (const role of expectedRoles) {
      if (actualRoles.includes(role)) {
        correctRoles++;
        // 매칭된 역할 제거 (중복 방지)
        const index = actualRoles.indexOf(role);
        actualRoles.splice(index, 1);
      }
    }

    const accuracy = expectedRoles.length > 0
      ? (correctRoles / expectedRoles.length) * 100
      : 0;

    return {
      expectedCount: expectedRoles.length,
      actualCount: actual.jobs.length,
      correctCount: correctRoles,
      accuracy: accuracy.toFixed(1) + '%',
      accuracyValue: accuracy,
    };
  }

  /**
   * 의존성 추론 정확도 평가
   */
  evaluateDependencies(expected, actual) {
    const expectedDeps = expected.dependencies.map(d => `${d.from}->${d.to}`);
    const actualDeps = actual.dependencies
      ? actual.dependencies.map(d => `${d.from}->${d.to}`)
      : [];

    let correctDeps = 0;

    for (const dep of expectedDeps) {
      if (actualDeps.includes(dep)) {
        correctDeps++;
      }
    }

    const accuracy = expectedDeps.length > 0
      ? (correctDeps / expectedDeps.length) * 100
      : 100; // 의존성 없으면 100%

    return {
      expectedCount: expectedDeps.length,
      actualCount: actualDeps.length,
      correctCount: correctDeps,
      accuracy: accuracy.toFixed(1) + '%',
      accuracyValue: accuracy,
    };
  }

  /**
   * 전체 평가
   */
  evaluate(expected, actual, sampleId) {
    const roleResult = this.evaluateRoleMatching(expected, actual);
    const depResult = this.evaluateDependencies(expected, actual);

    // 전체 점수 (역할 60%, 의존성 40%)
    const totalScore = (roleResult.accuracyValue * 0.6) + (depResult.accuracyValue * 0.4);

    return {
      sampleId,
      roleAccuracy: roleResult.accuracy,
      roleAccuracyValue: roleResult.accuracyValue,
      dependencyAccuracy: depResult.accuracy,
      dependencyAccuracyValue: depResult.accuracyValue,
      totalScore: totalScore.toFixed(1) + '%',
      totalScoreValue: totalScore,
      roleDetails: roleResult,
      dependencyDetails: depResult,
    };
  }

  /**
   * 여러 샘플 평가
   */
  evaluateMultiple(results) {
    console.log(chalk.bold.cyan('\n평가 결과:\n'));

    const evaluations = results.map(r => {
      const evaluation = this.evaluate(r.expected, r.actual, r.sampleId);

      const scoreColor = evaluation.totalScoreValue >= 80
        ? chalk.green
        : evaluation.totalScoreValue >= 60
          ? chalk.yellow
          : chalk.red;

      console.log(`  ${r.sampleId}. ${r.request}`);
      console.log(`     역할: ${scoreColor(evaluation.roleAccuracy)} (${evaluation.roleDetails.correctCount}/${evaluation.roleDetails.expectedCount})`);
      console.log(`     의존성: ${scoreColor(evaluation.dependencyAccuracy)} (${evaluation.dependencyDetails.correctCount}/${evaluation.dependencyDetails.expectedCount})`);
      console.log(`     종합: ${scoreColor(evaluation.totalScore)}\n`);

      return evaluation;
    });

    // 전체 통계
    const avgRoleAccuracy = evaluations.reduce((sum, e) => sum + e.roleAccuracyValue, 0) / evaluations.length;
    const avgDepAccuracy = evaluations.reduce((sum, e) => sum + e.dependencyAccuracyValue, 0) / evaluations.length;
    const avgTotalScore = evaluations.reduce((sum, e) => sum + e.totalScoreValue, 0) / evaluations.length;

    const failCount = evaluations.filter(e => e.totalScoreValue < 70).length;

    console.log(chalk.bold.cyan('전체 통계:\n'));
    console.log(`  역할 매칭 정확도: ${avgRoleAccuracy >= 80 ? chalk.green(avgRoleAccuracy.toFixed(1) + '%') : chalk.yellow(avgRoleAccuracy.toFixed(1) + '%')}`);
    console.log(`  의존성 정확도: ${avgDepAccuracy >= 85 ? chalk.green(avgDepAccuracy.toFixed(1) + '%') : chalk.yellow(avgDepAccuracy.toFixed(1) + '%')}`);
    console.log(`  평균 종합 점수: ${avgTotalScore >= 80 ? chalk.green(avgTotalScore.toFixed(1) + '%') : chalk.yellow(avgTotalScore.toFixed(1) + '%')}`);
    console.log(`  실패 (< 70%): ${failCount > 0 ? chalk.red(failCount) : chalk.green('0')}/${evaluations.length}\n`);

    const success = avgRoleAccuracy >= 80 && avgDepAccuracy >= 85;

    if (success) {
      console.log(chalk.bold.green('✓ 성공: 목표 달성'));
    } else {
      console.log(chalk.bold.yellow('⚠ 부분 성공: 개선 필요'));
      if (avgRoleAccuracy < 80) {
        console.log(chalk.yellow('  - 역할 매칭 정확도 개선 필요'));
      }
      if (avgDepAccuracy < 85) {
        console.log(chalk.yellow('  - 의존성 추론 정확도 개선 필요'));
      }
    }

    return {
      evaluations,
      avgRoleAccuracy: avgRoleAccuracy.toFixed(1) + '%',
      avgDependencyAccuracy: avgDepAccuracy.toFixed(1) + '%',
      avgTotalScore: avgTotalScore.toFixed(1) + '%',
      failCount,
      success,
    };
  }

  /**
   * 레벨별 통계
   */
  analyzeByLevel(evaluations, results) {
    const levels = ['simple', 'medium', 'complex'];

    console.log(chalk.bold.cyan('\n레벨별 분석:\n'));

    levels.forEach(level => {
      const levelResults = results
        .map((r, i) => ({ ...r, evaluation: evaluations[i] }))
        .filter(r => r.level === level);

      if (levelResults.length === 0) return;

      const avgScore = levelResults.reduce((sum, r) => sum + r.evaluation.totalScoreValue, 0) / levelResults.length;

      const scoreColor = avgScore >= 80 ? chalk.green : avgScore >= 60 ? chalk.yellow : chalk.red;

      console.log(`  ${level.toUpperCase()}: ${scoreColor(avgScore.toFixed(1) + '%')} (${levelResults.length}개 샘플)`);
    });

    console.log();
  }
}

module.exports = Evaluator;

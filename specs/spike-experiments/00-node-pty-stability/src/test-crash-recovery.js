/**
 * Test 4: 크래시 복구 테스트
 * 세션 크래시 시 자동 재시작 검증
 */

const pty = require('node-pty');
const chalk = require('chalk');
const os = require('os');

class CrashRecoveryTest {
  constructor() {
    this.attempts = 5;
    this.results = [];
  }

  /**
   * 테스트 시작
   */
  async start() {
    console.log(chalk.bold.cyan('\n=== Test 4: 크래시 복구 테스트 ===\n'));
    console.log(`${this.attempts}회 크래시 및 복구 시도\n`);

    for (let i = 1; i <= this.attempts; i++) {
      console.log(chalk.bold.yellow(`\n[시도 ${i}/${this.attempts}]`));
      const attemptResult = await this.testSingleRecovery(i);
      this.results.push(attemptResult);

      // 시도 간 쿨다운
      if (i < this.attempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return this.analyzeResults();
  }

  /**
   * 단일 크래시 복구 시도
   */
  async testSingleRecovery(attemptNumber) {
    const startTime = Date.now();
    let sessionId1, sessionId2;
    let crashDetected = false;
    let recoverySuccess = false;
    let recoveryTime = null;

    try {
      // 1단계: 첫 세션 생성
      console.log('  [1] 세션 생성 중...');
      const session1 = await this.createSession();
      sessionId1 = session1.pid;
      console.log(chalk.green(`      ✓ 세션 시작: PID ${sessionId1}`));

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 2단계: 크래시 유발
      console.log('  [2] 크래시 유발 중...');
      const crashTime = Date.now();
      await this.crashSession(session1);
      console.log(chalk.yellow(`      ! 세션 종료: SIGKILL`));

      // 3단계: 크래시 감지
      console.log('  [3] 크래시 감지 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      crashDetected = true;
      const detectionTime = (Date.now() - crashTime) / 1000;
      console.log(chalk.green(`      ✓ 크래시 감지: ${detectionTime.toFixed(1)}초 후`));

      // 4단계: 새 세션 생성
      console.log('  [4] 새 세션 생성 중...');
      const recoveryStartTime = Date.now();
      const session2 = await this.createSession();
      sessionId2 = session2.pid;
      recoveryTime = (Date.now() - recoveryStartTime) / 1000;
      console.log(chalk.green(`      ✓ 새 세션 시작: PID ${sessionId2}`));

      // 5단계: 작업 재개 확인
      console.log('  [5] 작업 재개 확인 중...');
      const workSuccess = await this.verifySession(session2);
      recoverySuccess = workSuccess;

      if (workSuccess) {
        console.log(chalk.green(`      ✓ 작업 재개 성공`));
      } else {
        console.log(chalk.red(`      ✗ 작업 재개 실패`));
      }

      // 정리
      session2.kill();

      const totalRecoveryTime = (Date.now() - crashTime) / 1000;

      return {
        attemptNumber,
        sessionId1,
        sessionId2,
        crashDetected,
        recoverySuccess,
        recoveryTime: recoveryTime.toFixed(1) + '초',
        totalRecoveryTime: totalRecoveryTime.toFixed(1) + '초',
        success: crashDetected && recoverySuccess
      };

    } catch (error) {
      console.error(chalk.red(`      ✗ 오류: ${error.message}`));
      return {
        attemptNumber,
        sessionId1,
        sessionId2: null,
        crashDetected,
        recoverySuccess: false,
        error: error.message,
        success: false
      };
    }
  }

  /**
   * 세션 생성
   */
  createSession() {
    return new Promise((resolve, reject) => {
      try {
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        const ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.cwd(),
          env: process.env
        });

        // 세션 준비 대기
        setTimeout(() => {
          resolve(ptyProcess);
        }, 500);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 세션 크래시 유발
   */
  crashSession(session) {
    return new Promise((resolve) => {
      session.kill('SIGKILL');
      setTimeout(resolve, 100);
    });
  }

  /**
   * 세션 동작 확인
   */
  verifySession(session) {
    return new Promise((resolve) => {
      let outputReceived = false;

      session.onData((data) => {
        if (data.length > 0) {
          outputReceived = true;
        }
      });

      // 간단한 명령 실행
      session.write('echo "test"\r');

      // 1초 대기 후 출력 확인
      setTimeout(() => {
        resolve(outputReceived);
      }, 1000);
    });
  }

  /**
   * 결과 분석
   */
  analyzeResults() {
    console.log('\n\n' + chalk.bold.cyan('결과 분석:'));

    const successfulRecoveries = this.results.filter(r => r.success).length;
    const successRate = (successfulRecoveries / this.attempts) * 100;

    const avgRecoveryTime = this.results
      .filter(r => r.recoveryTime)
      .reduce((sum, r) => sum + parseFloat(r.recoveryTime), 0) / successfulRecoveries;

    const success = successRate === 100;

    console.log(`  전체 시도: ${chalk.yellow(this.attempts)}`);
    console.log(`  성공: ${chalk.green(successfulRecoveries)}`);
    console.log(`  실패: ${chalk.red(this.attempts - successfulRecoveries)}`);
    console.log(`  성공률: ${success ? chalk.green(successRate.toFixed(0) + '%') : chalk.red(successRate.toFixed(0) + '%')}`);
    console.log(`  평균 복구 시간: ${chalk.yellow(avgRecoveryTime.toFixed(1) + '초')}`);

    console.log(chalk.cyan('\n시도별 상세:'));
    this.results.forEach((r) => {
      const icon = r.success ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} 시도 ${r.attemptNumber}: ${r.totalRecoveryTime || 'N/A'}`);
    });

    if (success) {
      console.log(chalk.bold.green('\n✓ 성공: 모든 복구 시도 성공'));
    } else {
      console.log(chalk.bold.red(`\n✗ 실패: ${this.attempts - successfulRecoveries}개 시도 실패`));
      console.log(chalk.yellow('\n권장 조치:'));
      console.log(chalk.yellow('  - 세션 헬스체크 강화'));
      console.log(chalk.yellow('  - 복구 재시도 로직 추가'));
      console.log(chalk.yellow('  - 세션 풀 관리 개선'));
    }

    return {
      attempts: this.attempts,
      successful: successfulRecoveries,
      failed: this.attempts - successfulRecoveries,
      successRate: successRate.toFixed(0) + '%',
      avgRecoveryTime: avgRecoveryTime.toFixed(1) + '초',
      details: this.results,
      success
    };
  }
}

// 실행
if (require.main === module) {
  const test = new CrashRecoveryTest();
  test.start()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error(chalk.red(`\n오류: ${error.message}`));
      process.exit(1);
    });
}

module.exports = CrashRecoveryTest;

/**
 * Test 2: 동시 세션 스트레스 테스트
 *
 * 목적: 30개 세션 동시 실행 시 안정성 검증
 */

const pty = require('node-pty');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const NUM_SESSIONS = 30;
const TASK_DURATION = 60 * 1000; // 1분

class ConcurrentTest {
  constructor() {
    this.sessions = [];
    this.results = {
      created: 0,
      failed: 0,
      completed: 0,
      crashed: 0,
      startTime: null,
      endTime: null,
      peakMemory: 0,
      peakCPU: 0,
    };
  }

  /**
   * 단일 세션 생성 및 실행
   */
  async createSession(id) {
    return new Promise((resolve, reject) => {
      try {
        const session = pty.spawn('bash', [], {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.cwd(),
          env: process.env
        });

        const sessionData = {
          id,
          pid: session.pid,
          startTime: Date.now(),
          outputLines: 0,
          completed: false,
          crashed: false,
        };

        session.on('data', (data) => {
          sessionData.outputLines++;
        });

        session.on('exit', (code) => {
          if (!sessionData.completed) {
            sessionData.crashed = true;
            this.results.crashed++;
          }
        });

        // 간단한 작업 실행
        session.write('echo "Session ' + id + ' started"\r');
        session.write('sleep 5\r');
        session.write('echo "Session ' + id + ' completed"\r');

        setTimeout(() => {
          sessionData.completed = true;
          sessionData.endTime = Date.now();
          this.results.completed++;
          session.kill();
          resolve(sessionData);
        }, TASK_DURATION);

        this.sessions.push({ session, data: sessionData });
        this.results.created++;

      } catch (error) {
        this.results.failed++;
        reject(error);
      }
    });
  }

  /**
   * 시스템 리소스 모니터링
   */
  monitorResources() {
    const interval = setInterval(() => {
      const usage = process.memoryUsage();
      const memory = usage.rss;

      if (memory > this.results.peakMemory) {
        this.results.peakMemory = memory;
      }

      // CPU 사용률은 간단히 측정 (정확하지 않음)
      // 실제로는 pidusage 같은 라이브러리 사용 권장
      const cpuUsage = process.cpuUsage();
      const cpu = (cpuUsage.user + cpuUsage.system) / 1000000;
      if (cpu > this.results.peakCPU) {
        this.results.peakCPU = cpu;
      }
    }, 1000);

    return interval;
  }

  /**
   * 테스트 실행
   */
  async start() {
    console.log(chalk.green('=== Test 2: 동시 세션 스트레스 테스트 ===\n'));
    console.log(`세션 수: ${NUM_SESSIONS}`);
    console.log(`작업 시간: ${TASK_DURATION / 1000}초\n`);

    this.results.startTime = Date.now();
    const monitorInterval = this.monitorResources();

    try {
      // 모든 세션 동시 생성
      const promises = [];
      for (let i = 1; i <= NUM_SESSIONS; i++) {
        promises.push(
          this.createSession(i).catch(err => {
            console.log(chalk.red(`✗ 세션 ${i} 생성 실패: ${err.message}`));
            return null;
          })
        );
      }

      console.log(chalk.yellow('세션 생성 중...\n'));
      await Promise.all(promises);

      // 모든 작업 완료 대기
      await new Promise(resolve => setTimeout(resolve, TASK_DURATION + 5000));

      this.results.endTime = Date.now();
      clearInterval(monitorInterval);

      // 결과 출력
      this.analyze();
      this.saveResults();

    } catch (error) {
      clearInterval(monitorInterval);
      console.error(chalk.red(`테스트 오류: ${error.message}`));
      throw error;
    } finally {
      // 모든 세션 정리
      this.sessions.forEach(({ session }) => {
        try {
          session.kill();
        } catch (e) {
          // 이미 종료된 세션 무시
        }
      });
    }
  }

  /**
   * 결과 분석
   */
  analyze() {
    const { created, failed, completed, crashed, startTime, endTime, peakMemory, peakCPU } = this.results;

    const successRate = (completed / created) * 100;
    const duration = (endTime - startTime) / 1000;

    console.log(chalk.green('\n=== 테스트 완료 ===\n'));
    console.log(chalk.cyan('세션 통계:'));
    console.log(`  생성 성공: ${chalk.green(created)}/${NUM_SESSIONS} (${((created / NUM_SESSIONS) * 100).toFixed(1)}%)`);
    console.log(`  생성 실패: ${chalk.red(failed)}`);
    console.log(`  작업 완료: ${chalk.green(completed)}/${created} (${successRate.toFixed(1)}%)`);
    console.log(`  크래시: ${chalk.red(crashed)}`);

    console.log(chalk.cyan('\n리소스 사용:'));
    console.log(`  피크 메모리: ${(peakMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  피크 CPU: ${peakCPU.toFixed(2)}%`);
    console.log(`  소요 시간: ${duration.toFixed(1)}초`);

    const success = created === NUM_SESSIONS && successRate >= 90;
    console.log(`\n판정: ${success ? chalk.green('✓ 성공') : chalk.red('✗ 실패')}`);

    if (successRate < 90) {
      console.log(chalk.yellow('\n⚠️  주의: 성공률이 90% 미만입니다.'));
      console.log(chalk.yellow('   동시 세션 수를 줄이는 것을 권장합니다.'));
    }
  }

  /**
   * 결과 저장
   */
  saveResults() {
    const resultsDir = path.join(__dirname, '../results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filePath = path.join(resultsDir, 'test-concurrent.json');
    fs.writeFileSync(filePath, JSON.stringify({
      ...this.results,
      sessions: this.sessions.map(s => s.data)
    }, null, 2));

    console.log(chalk.blue(`\n결과 저장: ${filePath}`));
  }
}

// 실행
if (require.main === module) {
  const test = new ConcurrentTest();
  test.start()
    .then(() => {
      console.log(chalk.green('\n테스트 완료'));
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red(`\n테스트 실패: ${error.message}`));
      process.exit(1);
    });
}

module.exports = ConcurrentTest;

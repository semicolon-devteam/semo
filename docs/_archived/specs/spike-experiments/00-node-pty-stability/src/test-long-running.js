/**
 * Test 1: 장시간 세션 안정성 테스트
 *
 * 목적: 30분 작업 중 메모리 누수 및 크래시 감지
 */

const pty = require('node-pty');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// 설정
const TEST_DURATION = 30 * 60 * 1000; // 30분
const MEMORY_CHECK_INTERVAL = 10 * 60 * 1000; // 10분
const COMMAND = 'claude'; // Claude Code CLI

class LongRunningTest {
  constructor() {
    this.session = null;
    this.startTime = null;
    this.memorySnapshots = [];
    this.outputBuffer = [];
    this.crashed = false;
  }

  /**
   * 메모리 사용량 측정
   */
  captureMemory() {
    const usage = process.memoryUsage();
    const snapshot = {
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
    };
    this.memorySnapshots.push(snapshot);

    console.log(chalk.blue(`[${this.formatElapsed(snapshot.elapsed)}] 메모리 스냅샷`));
    console.log(`  Heap Used: ${this.formatBytes(snapshot.heapUsed)}`);
    console.log(`  Heap Total: ${this.formatBytes(snapshot.heapTotal)}`);
    console.log(`  RSS: ${this.formatBytes(snapshot.rss)}`);
  }

  /**
   * 세션 시작
   */
  async start() {
    console.log(chalk.green('=== Test 1: 장시간 세션 안정성 ===\n'));

    this.startTime = Date.now();
    this.captureMemory(); // 초기 메모리

    return new Promise((resolve, reject) => {
      try {
        // PTY 세션 생성
        this.session = pty.spawn('bash', [], {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.cwd(),
          env: process.env
        });

        console.log(chalk.green(`✓ 세션 생성 성공: PID ${this.session.pid}\n`));

        // 출력 수신
        this.session.on('data', (data) => {
          this.outputBuffer.push(data);
          // 버퍼 크기 제한 (메모리 관리)
          if (this.outputBuffer.length > 10000) {
            this.outputBuffer.shift();
          }
        });

        // 종료 감지
        this.session.on('exit', (code, signal) => {
          this.crashed = true;
          console.log(chalk.red(`\n✗ 세션 종료: code=${code}, signal=${signal}`));
          reject(new Error(`Session crashed: ${signal || code}`));
        });

        // 긴 작업 시뮬레이션 (파일 읽기, 검색 등)
        this.simulateLongTask();

        // 주기적 메모리 체크
        const memoryInterval = setInterval(() => {
          if (Date.now() - this.startTime >= TEST_DURATION) {
            clearInterval(memoryInterval);
            this.finish(resolve);
          } else {
            this.captureMemory();
          }
        }, MEMORY_CHECK_INTERVAL);

      } catch (error) {
        console.log(chalk.red(`✗ 세션 생성 실패: ${error.message}`));
        reject(error);
      }
    });
  }

  /**
   * 긴 작업 시뮬레이션
   */
  simulateLongTask() {
    const commands = [
      'echo "Starting long task simulation..."',
      'for i in {1..100}; do echo "Iteration $i"; sleep 1; done',
      'find . -name "*.js" | head -20',
      'cat package.json',
      'echo "Task completed"'
    ];

    let index = 0;
    const sendNextCommand = () => {
      if (index < commands.length && !this.crashed) {
        this.session.write(commands[index] + '\r');
        index++;
        setTimeout(sendNextCommand, 5000); // 5초마다 다음 명령
      }
    };

    sendNextCommand();
  }

  /**
   * 테스트 종료
   */
  finish(resolve) {
    this.captureMemory(); // 최종 메모리

    console.log(chalk.green('\n=== 테스트 완료 ===\n'));

    // 결과 분석
    const result = this.analyze();

    // 세션 종료
    if (this.session && !this.crashed) {
      this.session.kill();
    }

    // 결과 저장
    this.saveResults(result);

    resolve(result);
  }

  /**
   * 결과 분석
   */
  analyze() {
    const initial = this.memorySnapshots[0];
    const final = this.memorySnapshots[this.memorySnapshots.length - 1];

    const heapGrowth = final.heapUsed - initial.heapUsed;
    const heapGrowthRate = (heapGrowth / (final.elapsed / 3600000)); // MB/hour

    const result = {
      duration: final.elapsed,
      crashed: this.crashed,
      memorySnapshots: this.memorySnapshots,
      heapGrowth: heapGrowth,
      heapGrowthRate: heapGrowthRate,
      success: !this.crashed && heapGrowthRate < 100 * 1024 * 1024, // < 100MB/hour
      outputLinesReceived: this.outputBuffer.length,
    };

    console.log(chalk.cyan('분석 결과:'));
    console.log(`  지속 시간: ${this.formatElapsed(result.duration)}`);
    console.log(`  크래시 여부: ${result.crashed ? chalk.red('예') : chalk.green('아니오')}`);
    console.log(`  힙 증가량: ${this.formatBytes(result.heapGrowth)}`);
    console.log(`  힙 증가율: ${this.formatBytes(result.heapGrowthRate)}/hour`);
    console.log(`  수신 라인 수: ${result.outputLinesReceived}`);
    console.log(`\n판정: ${result.success ? chalk.green('✓ 성공') : chalk.red('✗ 실패')}`);

    return result;
  }

  /**
   * 결과 저장
   */
  saveResults(result) {
    const resultsDir = path.join(__dirname, '../results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filePath = path.join(resultsDir, 'test-long-running.json');
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    console.log(chalk.blue(`\n결과 저장: ${filePath}`));
  }

  /**
   * 유틸리티 함수
   */
  formatBytes(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  formatElapsed(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

// 실행
if (require.main === module) {
  const test = new LongRunningTest();
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

module.exports = LongRunningTest;

/**
 * Test 3: 출력 버퍼링 테스트
 * 대량 출력 처리 시 손실률 측정
 */

const pty = require('node-pty');
const chalk = require('chalk');
const os = require('os');

class OutputBufferingTest {
  constructor() {
    this.totalLines = 50000;
    this.receivedLines = 0;
    this.output = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * 테스트 시작
   */
  async start() {
    console.log(chalk.bold.cyan('\n=== Test 3: 출력 버퍼링 테스트 ===\n'));
    console.log(`목표: ${this.totalLines.toLocaleString()}줄 출력 손실 < 1%\n`);

    this.startTime = Date.now();

    // pty 세션 생성
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env
    });

    // 출력 수신
    ptyProcess.onData((data) => {
      const lines = data.split('\n').filter(line => line.includes('LINE:'));
      this.receivedLines += lines.length;

      // 진행 상황 표시 (1000줄마다)
      if (this.receivedLines % 1000 === 0) {
        process.stdout.write(`\r수신: ${this.receivedLines.toLocaleString()}줄`);
      }
    });

    // 대량 출력 생성 명령
    const command = this.generateOutputCommand(this.totalLines);
    ptyProcess.write(command + '\r');

    // 출력 완료 대기
    await this.waitForCompletion(ptyProcess);

    this.endTime = Date.now();

    // 정리
    ptyProcess.kill();

    return this.analyzeResults();
  }

  /**
   * 플랫폼별 대량 출력 명령 생성
   */
  generateOutputCommand(lines) {
    if (os.platform() === 'win32') {
      return `for ($i=1; $i -le ${lines}; $i++) { Write-Output "LINE: $i" }`;
    } else {
      return `for i in {1..${lines}}; do echo "LINE: $i"; done`;
    }
  }

  /**
   * 출력 완료 대기
   */
  waitForCompletion(ptyProcess) {
    return new Promise((resolve) => {
      let noDataTimeout;
      let lastReceived = this.receivedLines;

      const checkCompletion = () => {
        if (this.receivedLines === lastReceived) {
          // 3초간 데이터 없으면 완료로 간주
          clearTimeout(noDataTimeout);
          noDataTimeout = setTimeout(() => {
            resolve();
          }, 3000);
        } else {
          lastReceived = this.receivedLines;
          setTimeout(checkCompletion, 500);
        }
      };

      checkCompletion();

      // 최대 5분 타임아웃
      setTimeout(() => {
        resolve();
      }, 5 * 60 * 1000);
    });
  }

  /**
   * 결과 분석
   */
  analyzeResults() {
    console.log('\n\n' + chalk.bold.cyan('결과 분석:'));

    const duration = (this.endTime - this.startTime) / 1000;
    const lossRate = ((this.totalLines - this.receivedLines) / this.totalLines) * 100;
    const throughput = Math.round(this.receivedLines / duration);

    const success = lossRate < 1.0;

    const result = {
      totalLines: this.totalLines,
      receivedLines: this.receivedLines,
      lostLines: this.totalLines - this.receivedLines,
      lossRate: lossRate.toFixed(2) + '%',
      duration: duration.toFixed(1) + '초',
      throughput: throughput.toLocaleString() + ' 줄/초',
      success
    };

    console.log(`  전송: ${chalk.yellow(this.totalLines.toLocaleString())} 줄`);
    console.log(`  수신: ${chalk.yellow(this.receivedLines.toLocaleString())} 줄`);
    console.log(`  손실: ${chalk.red((this.totalLines - this.receivedLines).toLocaleString())} 줄`);
    console.log(`  손실률: ${success ? chalk.green(result.lossRate) : chalk.red(result.lossRate)}`);
    console.log(`  소요 시간: ${chalk.yellow(result.duration)}`);
    console.log(`  처리량: ${chalk.yellow(result.throughput)}`);

    if (success) {
      console.log(chalk.bold.green('\n✓ 성공: 손실률 < 1%'));
    } else {
      console.log(chalk.bold.red('\n✗ 실패: 손실률 > 1%'));
      console.log(chalk.yellow('\n권장 조치:'));
      console.log(chalk.yellow('  - 출력 버퍼 크기 증가'));
      console.log(chalk.yellow('  - 백프레셔(backpressure) 메커니즘 적용'));
      console.log(chalk.yellow('  - 출력 스트림 최적화'));
    }

    return result;
  }
}

// 실행
if (require.main === module) {
  const test = new OutputBufferingTest();
  test.start()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error(chalk.red(`\n오류: ${error.message}`));
      process.exit(1);
    });
}

module.exports = OutputBufferingTest;

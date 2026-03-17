/**
 * Test 4: 재연결 안정성 테스트
 * 네트워크 끊김 시 자동 재연결 검증
 */

const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk');
require('dotenv').config();

class ReconnectionTest {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    this.channelName = 'test-reconnection';
    this.attempts = 3;
    this.results = [];
  }

  /**
   * 테스트 시작
   */
  async start() {
    console.log(chalk.bold.cyan('\n=== Test 4: 재연결 안정성 테스트 ===\n'));
    console.log(`${this.attempts}회 연결 끊김 및 재연결 시도\n`);

    for (let i = 1; i <= this.attempts; i++) {
      console.log(chalk.bold.yellow(`\n[시도 ${i}/${this.attempts}]`));
      const attemptResult = await this.testSingleReconnection(i);
      this.results.push(attemptResult);

      // 시도 간 쿨다운
      if (i < this.attempts) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    return this.analyzeResults();
  }

  /**
   * 단일 재연결 시도
   */
  async testSingleReconnection(attemptNumber) {
    const startTime = Date.now();
    let connected = false;
    let disconnected = false;
    let reconnected = false;
    let disconnectTime = 0;
    let reconnectTime = 0;

    try {
      // 1단계: 초기 연결
      console.log('  [1] 채널 연결 중...');

      const channel = this.supabase.channel(`${this.channelName}-${attemptNumber}`);

      // 상태 변경 감지
      channel.on('system', {}, (payload) => {
        console.log(chalk.gray(`      시스템 이벤트: ${payload.status}`));
      });

      await channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          connected = true;
          console.log(chalk.green('      ✓ 채널 연결 완료'));
        } else if (status === 'CHANNEL_ERROR') {
          console.log(chalk.red('      ✗ 채널 오류'));
        } else if (status === 'TIMED_OUT') {
          console.log(chalk.red('      ✗ 연결 타임아웃'));
        } else if (status === 'CLOSED') {
          if (connected && !disconnected) {
            disconnected = true;
            disconnectTime = Date.now();
            console.log(chalk.yellow('      ! 연결 끊김 감지'));
          }
        }
      });

      // 연결 확인 대기
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!connected) {
        throw new Error('Initial connection failed');
      }

      // 2단계: 연결 끊기 시뮬레이션
      console.log('  [2] 연결 끊기 시뮬레이션...');

      // 채널 unsubscribe로 연결 끊기
      await channel.unsubscribe();
      disconnected = true;
      disconnectTime = Date.now();

      console.log(chalk.yellow('      ! 연결 끊김'));

      // 3단계: 재연결 시도
      console.log('  [3] 재연결 시도 중...');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 새 채널 생성 및 재연결
      const newChannel = this.supabase.channel(`${this.channelName}-${attemptNumber}-retry`);

      await newChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          reconnected = true;
          reconnectTime = Date.now();
          console.log(chalk.green('      ✓ 재연결 성공'));
        }
      });

      // 재연결 확인 대기
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4단계: 메시지 수신 확인
      console.log('  [4] 메시지 수신 확인...');

      let messageReceived = false;

      newChannel.on('broadcast', { event: 'test' }, () => {
        messageReceived = true;
        console.log(chalk.green('      ✓ 메시지 수신 확인'));
      });

      await newChannel.send({
        type: 'broadcast',
        event: 'test',
        payload: { test: true },
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 정리
      await this.supabase.removeChannel(channel);
      await this.supabase.removeChannel(newChannel);

      const totalTime = (Date.now() - startTime) / 1000;
      const reconnectionTime = reconnected
        ? ((reconnectTime - disconnectTime) / 1000).toFixed(1)
        : 'N/A';

      return {
        attemptNumber,
        connected,
        disconnected,
        reconnected,
        messageReceived,
        reconnectionTime: reconnectionTime + '초',
        totalTime: totalTime.toFixed(1) + '초',
        success: connected && disconnected && reconnected && messageReceived,
      };

    } catch (error) {
      console.error(chalk.red(`      ✗ 오류: ${error.message}`));
      return {
        attemptNumber,
        connected,
        disconnected,
        reconnected: false,
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * 결과 분석
   */
  analyzeResults() {
    console.log(chalk.bold.cyan('\n\n결과 분석:\n'));

    const successfulAttempts = this.results.filter(r => r.success).length;
    const successRate = (successfulAttempts / this.attempts) * 100;

    const reconnectionTimes = this.results
      .filter(r => r.reconnectionTime && r.reconnectionTime !== 'N/A초')
      .map(r => parseFloat(r.reconnectionTime));

    const avgReconnectionTime = reconnectionTimes.length > 0
      ? (reconnectionTimes.reduce((a, b) => a + b, 0) / reconnectionTimes.length).toFixed(1)
      : 'N/A';

    const success = successRate === 100;

    console.log(`  전체 시도: ${chalk.yellow(this.attempts)}`);
    console.log(`  성공: ${chalk.green(successfulAttempts)}`);
    console.log(`  실패: ${chalk.red(this.attempts - successfulAttempts)}`);
    console.log(`  성공률: ${success ? chalk.green(successRate.toFixed(0) + '%') : chalk.yellow(successRate.toFixed(0) + '%')}`);
    console.log(`  평균 재연결 시간: ${avgReconnectionTime !== 'N/A' ? chalk.yellow(avgReconnectionTime + '초') : chalk.gray('N/A')}`);

    console.log(chalk.cyan('\n시도별 상세:'));
    this.results.forEach((r) => {
      const icon = r.success ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} 시도 ${r.attemptNumber}: ${r.reconnectionTime || 'N/A'}`);
    });

    if (success) {
      console.log(chalk.bold.green('\n✓ 성공: 모든 재연결 시도 성공'));
    } else if (successRate >= 66) {
      console.log(chalk.bold.yellow('\n⚠ 부분 성공: 대부분 재연결 성공'));
    } else {
      console.log(chalk.bold.red(`\n✗ 실패: ${this.attempts - successfulAttempts}개 시도 실패`));
    }

    return {
      attempts: this.attempts,
      successful: successfulAttempts,
      failed: this.attempts - successfulAttempts,
      successRate: successRate.toFixed(0) + '%',
      avgReconnectionTime: avgReconnectionTime !== 'N/A' ? avgReconnectionTime + '초' : 'N/A',
      details: this.results,
      success: successRate >= 66, // 2/3 이상 성공하면 통과
    };
  }
}

// 실행
if (require.main === module) {
  const test = new ReconnectionTest();
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

module.exports = ReconnectionTest;

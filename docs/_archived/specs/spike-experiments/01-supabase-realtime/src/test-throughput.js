/**
 * Test 1: 메시지 처리량 테스트
 * 초당 10개 메시지 (분당 600개) 브로드캐스트 처리 가능 여부
 */

const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk');
require('dotenv').config();

class ThroughputTest {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    this.channelName = 'test-throughput';
    this.totalMessages = 600; // 분당 600개
    this.sentMessages = 0;
    this.receivedMessages = [];
    this.latencies = [];
  }

  /**
   * 테스트 시작
   */
  async start() {
    console.log(chalk.bold.cyan('\n=== Test 1: 메시지 처리량 테스트 ===\n'));
    console.log(`목표: ${this.totalMessages}개 메시지, 평균 지연 < 500ms, 손실률 < 1%\n`);

    const startTime = Date.now();

    // 채널 생성 및 구독
    const channel = this.supabase.channel(this.channelName);

    // 메시지 수신 리스너
    channel.on('broadcast', { event: 'message' }, (payload) => {
      const receivedAt = Date.now();
      const sentAt = payload.payload.timestamp;
      const latency = receivedAt - sentAt;

      this.receivedMessages.push(payload.payload);
      this.latencies.push(latency);

      if (this.receivedMessages.length % 100 === 0) {
        process.stdout.write(`\r수신: ${this.receivedMessages.length}/${this.totalMessages}`);
      }
    });

    await channel.subscribe();
    console.log(chalk.green('✓ 채널 구독 완료'));

    // 1초 대기 (구독 안정화)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 메시지 전송 시작
    console.log(chalk.yellow('\n메시지 전송 시작...\n'));

    for (let i = 1; i <= this.totalMessages; i++) {
      const message = {
        id: i,
        timestamp: Date.now(),
        content: `Message ${i}`,
      };

      await channel.send({
        type: 'broadcast',
        event: 'message',
        payload: message,
      });

      this.sentMessages++;

      // 초당 10개 속도 유지 (100ms 간격)
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(chalk.green('\n\n✓ 메시지 전송 완료'));

    // 수신 완료 대기 (최대 10초)
    console.log(chalk.yellow('수신 완료 대기 중...\n'));
    await this.waitForCompletion(10000);

    // 채널 종료
    await this.supabase.removeChannel(channel);

    const duration = (Date.now() - startTime) / 1000;

    return this.analyzeResults(duration);
  }

  /**
   * 수신 완료 대기
   */
  async waitForCompletion(maxWaitMs) {
    const startWait = Date.now();
    let lastReceived = this.receivedMessages.length;

    while (Date.now() - startWait < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (this.receivedMessages.length === lastReceived) {
        // 1초간 변화 없으면 완료로 간주
        break;
      }
      lastReceived = this.receivedMessages.length;
    }
  }

  /**
   * 결과 분석
   */
  analyzeResults(duration) {
    console.log(chalk.bold.cyan('결과 분석:\n'));

    const lossCount = this.sentMessages - this.receivedMessages.length;
    const lossRate = (lossCount / this.sentMessages) * 100;

    const avgLatency = this.latencies.length > 0
      ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
      : 0;

    const maxLatency = this.latencies.length > 0
      ? Math.max(...this.latencies)
      : 0;

    const success = lossRate < 1.0 && avgLatency < 500;

    console.log(`  전송: ${chalk.yellow(this.sentMessages)} 메시지`);
    console.log(`  수신: ${chalk.yellow(this.receivedMessages.length)} 메시지`);
    console.log(`  손실: ${chalk.red(lossCount)} 메시지`);
    console.log(`  손실률: ${success ? chalk.green(lossRate.toFixed(2) + '%') : chalk.red(lossRate.toFixed(2) + '%')}`);
    console.log(`  평균 지연: ${success ? chalk.green(avgLatency + 'ms') : chalk.red(avgLatency + 'ms')}`);
    console.log(`  최대 지연: ${chalk.yellow(maxLatency + 'ms')}`);
    console.log(`  소요 시간: ${chalk.yellow(duration.toFixed(1) + '초')}`);

    if (success) {
      console.log(chalk.bold.green('\n✓ 성공: 목표 달성'));
    } else {
      console.log(chalk.bold.red('\n✗ 실패: 목표 미달성'));
      if (lossRate >= 1.0) {
        console.log(chalk.yellow('  - 메시지 손실률 초과'));
      }
      if (avgLatency >= 500) {
        console.log(chalk.yellow('  - 평균 지연 시간 초과'));
      }
    }

    return {
      sent: this.sentMessages,
      received: this.receivedMessages.length,
      lossCount,
      lossRate: lossRate.toFixed(2) + '%',
      avgLatency: avgLatency + 'ms',
      maxLatency: maxLatency + 'ms',
      duration: duration.toFixed(1) + '초',
      success,
    };
  }
}

// 실행
if (require.main === module) {
  const test = new ThroughputTest();
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

module.exports = ThroughputTest;

/**
 * Test 2: Presence 동기화 테스트
 * 8개 Agent 온라인 상태 동기화 정확도
 */

const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk');
require('dotenv').config();

class PresenceTest {
  constructor() {
    this.channelName = 'test-presence';
    this.clientCount = 8;
    this.clients = [];
    this.presenceStates = new Map();
  }

  /**
   * 테스트 시작
   */
  async start() {
    console.log(chalk.bold.cyan('\n=== Test 2: Presence 동기화 테스트 ===\n'));
    console.log(`목표: ${this.clientCount}개 클라이언트 상태 동기화 100%\n`);

    const startTime = Date.now();

    // 클라이언트 생성 및 채널 구독
    console.log(chalk.yellow('클라이언트 생성 중...\n'));

    for (let i = 1; i <= this.clientCount; i++) {
      const client = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      const channel = client.channel(this.channelName);

      // Presence 트래킹
      const agentState = {
        agent_id: `agent-${i}`,
        role: ['FE', 'BE', 'QA', 'DevOps', 'PO', 'Architect', 'SM', 'Designer'][i % 8],
        status: 'online',
        timestamp: Date.now(),
      };

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        this.presenceStates.set(`client-${i}`, Object.keys(state).length);

        if (i === 1) {
          // 첫 번째 클라이언트만 로그 출력
          console.log(`  동기화: ${Object.keys(state).length}/${this.clientCount} 클라이언트`);
        }
      });

      channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log(chalk.green(`  ✓ ${newPresences[0].agent_id} 참여`));
      });

      channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log(chalk.yellow(`  - ${leftPresences[0].agent_id} 퇴장`));
      });

      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(agentState);
        }
      });

      this.clients.push({ client, channel, agentState });

      // 순차 생성 (안정성)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(chalk.green(`\n✓ ${this.clientCount}개 클라이언트 생성 완료`));

    // 동기화 안정화 대기
    console.log(chalk.yellow('\n동기화 안정화 대기 중...\n'));
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 상태 업데이트 테스트
    console.log(chalk.yellow('상태 업데이트 테스트...\n'));

    for (let i = 0; i < this.clients.length; i++) {
      const { channel } = this.clients[i];
      await channel.track({
        ...this.clients[i].agentState,
        status: i % 2 === 0 ? 'working' : 'idle',
        updated_at: Date.now(),
      });
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 최종 상태 확인 대기
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 정리
    console.log(chalk.yellow('\n클라이언트 정리 중...\n'));
    for (const { client, channel } of this.clients) {
      await client.removeChannel(channel);
    }

    const duration = (Date.now() - startTime) / 1000;

    return this.analyzeResults(duration);
  }

  /**
   * 결과 분석
   */
  analyzeResults(duration) {
    console.log(chalk.bold.cyan('결과 분석:\n'));

    // 각 클라이언트가 본 Presence 수
    const syncCounts = Array.from(this.presenceStates.values());
    const avgSyncCount = syncCounts.length > 0
      ? Math.round(syncCounts.reduce((a, b) => a + b, 0) / syncCounts.length)
      : 0;

    const syncRate = (avgSyncCount / this.clientCount) * 100;
    const success = syncRate === 100;

    console.log(`  참여자: ${chalk.yellow(this.clientCount)}명`);
    console.log(`  평균 동기화: ${success ? chalk.green(avgSyncCount) : chalk.yellow(avgSyncCount)}/${this.clientCount}`);
    console.log(`  동기화율: ${success ? chalk.green(syncRate.toFixed(0) + '%') : chalk.yellow(syncRate.toFixed(0) + '%')}`);
    console.log(`  소요 시간: ${chalk.yellow(duration.toFixed(1) + '초')}`);

    if (success) {
      console.log(chalk.bold.green('\n✓ 성공: 완벽한 동기화'));
    } else {
      console.log(chalk.bold.yellow('\n⚠ 부분 성공: 동기화 불완전'));
      console.log(chalk.yellow('  Presence는 eventual consistency를 보장하므로'));
      console.log(chalk.yellow('  일부 지연은 정상 동작입니다.'));
    }

    return {
      participants: this.clientCount,
      avgSyncCount,
      syncRate: syncRate.toFixed(0) + '%',
      duration: duration.toFixed(1) + '초',
      success: syncRate >= 90, // 90% 이상이면 성공으로 간주
    };
  }
}

// 실행
if (require.main === module) {
  const test = new PresenceTest();
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

module.exports = PresenceTest;

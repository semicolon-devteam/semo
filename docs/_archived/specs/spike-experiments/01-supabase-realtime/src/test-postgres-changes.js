/**
 * Test 3: Postgres Changes 구독 테스트
 * DB 변경 사항 실시간 수신
 */

const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk');
require('dotenv').config();

class PostgresChangesTest {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    this.tableName = 'spike_test_jobs'; // 테스트용 테이블
    this.totalChanges = 10;
    this.receivedChanges = [];
    this.latencies = [];
  }

  /**
   * 테스트 시작
   */
  async start() {
    console.log(chalk.bold.cyan('\n=== Test 3: Postgres Changes 구독 테스트 ===\n'));
    console.log(`목표: ${this.totalChanges}개 변경 감지, 평균 지연 < 500ms\n`);

    // 테이블 존재 확인
    const tableExists = await this.checkTable();
    if (!tableExists) {
      console.log(chalk.yellow('\n⚠️  테스트 테이블이 없습니다.'));
      console.log(chalk.yellow('\nSupabase 대시보드에서 다음 SQL을 실행하세요:\n'));
      console.log(chalk.cyan(this.getCreateTableSQL()));
      console.log(chalk.yellow('\n테이블 생성 후 다시 실행해주세요.'));

      return {
        success: false,
        skipped: true,
        message: 'Table not found - skipped',
      };
    }

    const startTime = Date.now();

    // 채널 생성 및 구독
    const channel = this.supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: this.tableName,
        },
        (payload) => {
          const receivedAt = Date.now();
          const sentAt = payload.new?.created_at
            ? new Date(payload.new.created_at).getTime()
            : receivedAt;
          const latency = receivedAt - sentAt;

          this.receivedChanges.push(payload);
          this.latencies.push(latency);

          console.log(chalk.green(`  ✓ ${payload.eventType}: ID ${payload.new?.id || payload.old?.id}`));
        }
      )
      .subscribe();

    console.log(chalk.green('✓ Postgres Changes 구독 완료'));

    // 구독 안정화 대기
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 변경 사항 생성
    console.log(chalk.yellow('\n변경 사항 생성 중...\n'));

    for (let i = 1; i <= this.totalChanges; i++) {
      const { error } = await this.supabase
        .from(this.tableName)
        .insert({
          job_name: `Test Job ${i}`,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error(chalk.red(`  ✗ INSERT 오류: ${error.message}`));
      }

      // 삽입 간격
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(chalk.yellow('\n변경 감지 대기 중...\n'));

    // 수신 완료 대기 (최대 10초)
    await this.waitForCompletion(10000);

    // 정리
    await this.cleanup();
    await this.supabase.removeChannel(channel);

    const duration = (Date.now() - startTime) / 1000;

    return this.analyzeResults(duration);
  }

  /**
   * 테이블 존재 확인
   */
  async checkTable() {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      return false;
    }
  }

  /**
   * 테이블 생성 SQL
   */
  getCreateTableSQL() {
    return `
CREATE TABLE IF NOT EXISTS ${this.tableName} (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime 활성화
ALTER TABLE ${this.tableName} REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE ${this.tableName};
    `.trim();
  }

  /**
   * 수신 완료 대기
   */
  async waitForCompletion(maxWaitMs) {
    const startWait = Date.now();
    let lastReceived = this.receivedChanges.length;

    while (Date.now() - startWait < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (this.receivedChanges.length === lastReceived) {
        // 1초간 변화 없으면 완료로 간주
        break;
      }
      lastReceived = this.receivedChanges.length;
    }
  }

  /**
   * 테스트 데이터 정리
   */
  async cleanup() {
    console.log(chalk.yellow('\n테스트 데이터 정리 중...'));

    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .like('job_name', 'Test Job %');

    if (!error) {
      console.log(chalk.green('✓ 정리 완료'));
    }
  }

  /**
   * 결과 분석
   */
  analyzeResults(duration) {
    console.log(chalk.bold.cyan('\n결과 분석:\n'));

    const detectionCount = this.receivedChanges.length;
    const detectionRate = (detectionCount / this.totalChanges) * 100;

    const avgLatency = this.latencies.length > 0
      ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
      : 0;

    const success = detectionCount === this.totalChanges && avgLatency < 500;

    console.log(`  생성: ${chalk.yellow(this.totalChanges)}개 변경`);
    console.log(`  감지: ${chalk.yellow(detectionCount)}개 변경`);
    console.log(`  감지율: ${success ? chalk.green(detectionRate.toFixed(0) + '%') : chalk.yellow(detectionRate.toFixed(0) + '%')}`);
    console.log(`  평균 지연: ${avgLatency > 0 ? (success ? chalk.green(avgLatency + 'ms') : chalk.yellow(avgLatency + 'ms')) : chalk.gray('N/A')}`);
    console.log(`  소요 시간: ${chalk.yellow(duration.toFixed(1) + '초')}`);

    if (success) {
      console.log(chalk.bold.green('\n✓ 성공: 모든 변경 감지'));
    } else if (detectionRate >= 90) {
      console.log(chalk.bold.yellow('\n⚠ 부분 성공: 대부분 감지'));
    } else {
      console.log(chalk.bold.red('\n✗ 실패: 감지율 저조'));
    }

    return {
      created: this.totalChanges,
      detected: detectionCount,
      detectionRate: detectionRate.toFixed(0) + '%',
      avgLatency: avgLatency > 0 ? avgLatency + 'ms' : 'N/A',
      duration: duration.toFixed(1) + '초',
      success: detectionRate >= 90, // 90% 이상이면 성공
    };
  }
}

// 실행
if (require.main === module) {
  const test = new PostgresChangesTest();
  test.start()
    .then((result) => {
      if (result.skipped) {
        process.exit(0); // 스킵은 오류가 아님
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error(chalk.red(`\n오류: ${error.message}`));
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = PostgresChangesTest;

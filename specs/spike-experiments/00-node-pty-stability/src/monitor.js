/**
 * 실시간 모니터링 대시보드
 * 테스트 실행 중 메트릭 실시간 표시
 */

const chalk = require('chalk');
const blessed = require('blessed');
const contrib = require('blessed-contrib');

class Monitor {
  constructor() {
    this.screen = blessed.screen();
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    this.setupWidgets();
    this.setupKeyBindings();
  }

  /**
   * 위젯 설정
   */
  setupWidgets() {
    // 제목
    this.title = this.grid.set(0, 0, 1, 12, blessed.box, {
      content: ' node-pty 안정성 모니터 ',
      tags: true,
      style: {
        fg: 'white',
        bg: 'blue',
        bold: true
      }
    });

    // 메모리 사용량 그래프
    this.memoryLine = this.grid.set(1, 0, 4, 6, contrib.line, {
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'black'
      },
      xLabelPadding: 3,
      xPadding: 5,
      label: 'Memory Usage (MB)',
      showLegend: true,
      legend: { width: 12 }
    });

    // CPU 사용률 게이지
    this.cpuGauge = this.grid.set(1, 6, 2, 3, contrib.gauge, {
      label: 'CPU Usage',
      stroke: 'green',
      fill: 'white'
    });

    // 세션 상태
    this.sessionDonut = this.grid.set(3, 6, 2, 3, contrib.donut, {
      label: 'Session Status',
      radius: 8,
      arcWidth: 3,
      remainColor: 'black',
      yPadding: 2
    });

    // FPS/처리량
    this.fpsGauge = this.grid.set(1, 9, 2, 3, contrib.gauge, {
      label: 'Output Rate (lines/s)',
      stroke: 'cyan',
      fill: 'white'
    });

    // 오류 카운터
    this.errorGauge = this.grid.set(3, 9, 2, 3, contrib.gauge, {
      label: 'Error Rate',
      stroke: 'red',
      fill: 'white'
    });

    // 로그 출력
    this.log = this.grid.set(5, 0, 7, 12, contrib.log, {
      fg: 'green',
      selectedFg: 'green',
      label: 'Activity Log'
    });
  }

  /**
   * 키 바인딩
   */
  setupKeyBindings() {
    this.screen.key(['escape', 'q', 'C-c'], () => {
      return process.exit(0);
    });
  }

  /**
   * 메모리 데이터 업데이트
   */
  updateMemory(data) {
    this.memoryLine.setData([
      {
        title: 'Heap Used',
        x: data.map((_, i) => i.toString()),
        y: data.map(d => Math.round(d.heapUsed / 1024 / 1024))
      },
      {
        title: 'RSS',
        x: data.map((_, i) => i.toString()),
        y: data.map(d => Math.round(d.rss / 1024 / 1024))
      }
    ]);
    this.screen.render();
  }

  /**
   * CPU 사용률 업데이트
   */
  updateCPU(percent) {
    this.cpuGauge.setPercent(Math.round(percent));
    this.screen.render();
  }

  /**
   * 세션 상태 업데이트
   */
  updateSessionStatus(active, idle, crashed) {
    this.sessionDonut.setData([
      { percent: active, label: 'Active', color: 'green' },
      { percent: idle, label: 'Idle', color: 'cyan' },
      { percent: crashed, label: 'Crashed', color: 'red' }
    ]);
    this.screen.render();
  }

  /**
   * 처리량 업데이트
   */
  updateThroughput(linesPerSecond) {
    const percent = Math.min(100, (linesPerSecond / 1000) * 100);
    this.fpsGauge.setPercent(Math.round(percent));
    this.screen.render();
  }

  /**
   * 오류율 업데이트
   */
  updateErrorRate(percent) {
    this.errorGauge.setPercent(Math.round(percent));
    this.screen.render();
  }

  /**
   * 로그 추가
   */
  addLog(message) {
    this.log.log(message);
    this.screen.render();
  }

  /**
   * 렌더링
   */
  render() {
    this.screen.render();
  }
}

/**
 * 시뮬레이션 데이터 생성 (실제 사용 시 삭제)
 */
function runDemo() {
  const monitor = new Monitor();

  // 초기 로그
  monitor.addLog('모니터 시작...');
  monitor.addLog('테스트 세션 생성 중...');

  // 메모리 데이터 시뮬레이션
  let memoryData = [];
  let time = 0;

  setInterval(() => {
    time++;

    // 메모리 증가 시뮬레이션
    const heapUsed = 120 * 1024 * 1024 + Math.sin(time * 0.1) * 20 * 1024 * 1024 + time * 1024 * 1024;
    const rss = 200 * 1024 * 1024 + Math.sin(time * 0.15) * 30 * 1024 * 1024 + time * 1.5 * 1024 * 1024;

    memoryData.push({
      heapUsed,
      rss,
      timestamp: Date.now()
    });

    // 최근 30개만 유지
    if (memoryData.length > 30) {
      memoryData = memoryData.slice(-30);
    }

    monitor.updateMemory(memoryData);

    // CPU 사용률
    const cpu = 40 + Math.sin(time * 0.2) * 20;
    monitor.updateCPU(cpu);

    // 세션 상태
    const active = 70 + Math.sin(time * 0.1) * 10;
    const idle = 25 + Math.cos(time * 0.1) * 5;
    const crashed = 5 + Math.sin(time * 0.3) * 2;
    monitor.updateSessionStatus(active, idle, crashed);

    // 처리량
    const throughput = 500 + Math.sin(time * 0.15) * 200;
    monitor.updateThroughput(throughput);

    // 오류율
    const errorRate = Math.max(0, 5 + Math.sin(time * 0.25) * 3);
    monitor.updateErrorRate(errorRate);

    // 랜덤 로그
    if (time % 3 === 0) {
      const events = [
        '세션 #12 작업 완료',
        '세션 #5 명령 실행 중',
        '메모리 체크포인트 생성',
        '세션 #8 idle 상태',
        '출력 버퍼 플러시'
      ];
      monitor.addLog(events[Math.floor(Math.random() * events.length)]);
    }

  }, 1000);
}

// 실행
if (require.main === module) {
  console.log(chalk.cyan('모니터링 대시보드 시작...'));
  console.log(chalk.yellow('종료: q 또는 Ctrl+C\n'));

  runDemo();
}

module.exports = Monitor;

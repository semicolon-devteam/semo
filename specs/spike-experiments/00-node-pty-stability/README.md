# SPIKE-00-02 & 04-01: node-pty 안정성 검증

> node-pty 기반 Claude Code 세션의 장시간 안정성 및 성능 검증

---

## 실험 목적

node-pty는 Semo Office의 핵심 의존성으로, Agent 세션 관리의 기반 기술입니다.
이 Spike는 다음을 검증합니다:

1. **장시간 안정성**: 30분 이상 작업 시 크래시율, 메모리 누수
2. **동시 세션 관리**: 30개 세션 동시 실행 안정성
3. **출력 버퍼링**: 대량 출력 처리 시 손실률
4. **에러 복구**: 세션 크래시 시 재시작 가능성

---

## 성공 기준

| 지표 | 목표 | Critical |
|------|------|----------|
| 30분 작업 성공률 | > 95% | ✅ 필수 |
| 메모리 증가율 | < 100MB/시간 | ✅ 필수 |
| 동시 세션 30개 안정성 | > 90% | ✅ 필수 |
| 출력 손실률 | < 1% | ⚠️ 중요 |
| 크래시 후 재시작 | 100% 성공 | ✅ 필수 |

---

## 실험 환경

### 요구 사항

- Node.js 18+
- macOS / Linux (Windows는 선택적)
- 최소 8GB RAM
- Claude Code CLI 설치

### 설치

```bash
cd specs/spike-experiments/00-node-pty-stability
npm install
```

---

## 실험 시나리오

### Test 1: 장시간 세션 안정성

**목적**: 30분 작업 중 메모리 누수 및 크래시 감지

**절차**:
```bash
npm run test:long-running
```

**측정 항목**:
- 초기 메모리 사용량
- 10분마다 메모리 사용량 (힙 크기)
- 크래시 발생 여부
- 출력 버퍼 오버플로우

**예상 결과**:
```
[00:00] 세션 시작 - 메모리: 120MB
[10:00] 작업 중 - 메모리: 150MB (+30MB)
[20:00] 작업 중 - 메모리: 180MB (+60MB)
[30:00] 작업 완료 - 메모리: 200MB (+80MB)
✅ 성공: 메모리 증가 < 100MB/시간
```

### Test 2: 동시 세션 스트레스 테스트

**목적**: 30개 세션 동시 실행 시 안정성

**절차**:
```bash
npm run test:concurrent
```

**측정 항목**:
- 30개 세션 생성 성공률
- 각 세션의 명령 실행 성공률
- CPU 사용률
- 시스템 전체 메모리 사용량

**예상 결과**:
```
세션 생성: 30/30 성공 (100%)
명령 실행: 28/30 성공 (93%)
평균 CPU: 45%
총 메모리: 3.2GB
⚠️ 주의: 2개 세션 타임아웃 (수용 가능)
```

### Test 3: 출력 버퍼링 테스트

**목적**: 대량 출력 처리 시 손실 방지

**절차**:
```bash
npm run test:output-buffering
```

**시나리오**:
- 세션에서 10MB 출력 생성
- 버퍼링 없이 순차 읽기
- 손실된 라인 수 계산

**예상 결과**:
```
전송: 50,000 라인
수신: 49,985 라인
손실률: 0.03%
✅ 성공: 손실률 < 1%
```

### Test 4: 크래시 복구 테스트

**목적**: 세션 크래시 시 자동 재시작 검증

**절차**:
```bash
npm run test:crash-recovery
```

**시나리오**:
1. 세션 시작
2. 의도적으로 크래시 유발 (kill -9)
3. 크래시 감지
4. 새 세션 생성 및 작업 재개

**예상 결과**:
```
[1] 세션 시작: session-abc123
[2] 크래시 유발: SIGKILL
[3] 크래시 감지: 2초 후
[4] 새 세션 생성: session-def456
[5] 작업 재개: 성공
✅ 복구 시간: 5초
```

---

## 실행 방법

### 전체 실험 일괄 실행

```bash
npm run test:all
```

### 개별 실험 실행

```bash
# Test 1: 장시간 안정성
npm run test:long-running

# Test 2: 동시 세션
npm run test:concurrent

# Test 3: 출력 버퍼링
npm run test:output-buffering

# Test 4: 크래시 복구
npm run test:crash-recovery
```

### 모니터링 대시보드

```bash
npm run monitor
```

실시간 메트릭 표시:
- 메모리 사용량 그래프
- CPU 사용률
- 세션 상태 (idle, running, crashed)
- 출력 속도

---

## 결과 분석

### 자동 리포트 생성

```bash
npm run report
```

생성 파일:
- `results/summary.md` - 종합 결과
- `results/metrics.json` - 측정 데이터
- `results/charts/` - 시각화 차트

### 수동 분석

```bash
# 메모리 프로파일 분석
npm run analyze:memory

# 로그 분석
npm run analyze:logs
```

---

## 예상 이슈 및 해결 방안

### Issue 1: 메모리 누수 발견

**증상**: 메모리가 계속 증가, GC 효과 없음

**원인 추정**:
- 출력 버퍼 정리 안 됨
- 이벤트 리스너 해제 안 됨
- pty 객체 참조 유지

**해결**:
```typescript
// 세션 종료 시 명시적 정리
session.on('exit', () => {
  pty.removeAllListeners();
  outputBuffer = null;
  pty.kill();
});
```

### Issue 2: 동시 세션 수 제한

**증상**: 20개 이상 세션 시 시스템 불안정

**원인 추정**:
- 파일 디스크립터 제한
- 시스템 리소스 부족

**해결**:
```bash
# ulimit 증가
ulimit -n 4096

# 세션 풀 크기 조정
MAX_CONCURRENT_SESSIONS = 15  # 기존 30 → 15
```

### Issue 3: 출력 손실

**증상**: 대량 출력 시 일부 라인 누락

**원인 추정**:
- 버퍼 오버플로우
- 읽기 속도 < 쓰기 속도

**해결**:
```typescript
// 백프레셔 적용
const outputStream = new Transform({
  highWaterMark: 1024 * 1024,  // 1MB 버퍼
  transform(chunk, encoding, callback) {
    // 버퍼 가득 차면 일시 중지
    if (this.writableLength > this.writableHighWaterMark) {
      pty.pause();
    }
    this.push(chunk);
    callback();
  }
});
```

---

## 결정 사항 (실험 후 업데이트)

### ✅ Go / ❌ No-Go 판단

실험 완료 후 아래 표를 채우세요:

| 지표 | 목표 | 실제 결과 | 판정 |
|------|------|----------|------|
| 30분 작업 성공률 | > 95% | __%  | ⬜ |
| 메모리 증가율 | < 100MB/h | __MB/h | ⬜ |
| 동시 세션 안정성 | > 90% | __%  | ⬜ |
| 출력 손실률 | < 1% | __%  | ⬜ |
| 크래시 복구 | 100% | __%  | ⬜ |

**Go**: 4개 이상 ✅
**No-Go**: 3개 이상 ❌ → 대안 검토 필요

---

## 대안 (No-Go 시)

### 대안 1: Docker 컨테이너 기반

**장점**:
- 완전한 격리
- 리소스 제한 명확
- 크래시 복구 용이

**단점**:
- 더 무거움 (컨테이너 오버헤드)
- 복잡한 설정

**구현 예상 시간**: +2주

### 대안 2: Claude API 직접 호출

**장점**:
- 터미널 세션 없음
- Anthropic 인프라 안정성
- 간단한 구조

**단점**:
- Claude Code CLI 기능 못 씀
- 다른 워크플로우 필요

**구현 예상 시간**: +3주

### 대안 3: 세션 재사용 포기

**장점**:
- 간단한 구조
- 메모리 누수 걱정 없음

**단점**:
- 세션 생성 오버헤드
- 느린 첫 실행

**구현 예상 시간**: +1주

---

## Next Steps

1. ✅ 실험 환경 구축
2. ⏳ Test 1~4 순차 실행
3. ⏳ 결과 분석 및 리포트 작성
4. ⏳ Go/No-Go 결정
5. ⏳ 결과를 plan.md에 반영

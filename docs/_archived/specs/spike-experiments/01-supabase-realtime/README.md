# SPIKE-00-01: Supabase Realtime 성능 테스트

> Office당 8개 Agent, 100개 메시지/분 환경에서 Realtime 지연 시간 측정

---

## 실험 목적

Supabase Realtime은 Agent 상태, 메시지, Job 업데이트를 실시간으로 동기화하는 핵심 인프라입니다.
이 Spike는 다음을 검증합니다:

1. **메시지 처리량**: 분당 100개 메시지 처리 가능 여부
2. **지연 시간**: INSERT → Realtime 수신 평균 지연
3. **메시지 손실**: 고부하 시 메시지 누락 여부
4. **재연결 안정성**: 연결 끊김 시 자동 재연결

---

## 성공 기준

| 지표 | 목표 | Critical |
|------|------|----------|
| 평균 지연 시간 | < 500ms | ✅ 필수 |
| 메시지 손실률 | < 1% | ✅ 필수 |
| 재연결 시간 | < 3초 | ⚠️ 중요 |
| 동시 구독 채널 | 3개 이상 | ✅ 필수 |

---

## 실험 환경

### 요구 사항

- Node.js 18+
- Supabase 프로젝트 (무료 티어 가능)
- `.env` 파일:
  ```
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_KEY=your-service-key
  ```

### 설치

```bash
cd specs/spike-experiments/01-supabase-realtime
npm install
```

---

## 실험 시나리오

### Test 1: 메시지 처리량 테스트

**목적**: 초당 10개 메시지(분당 600개) 브로드캐스트 시 처리 가능 여부

**절차**:
```bash
npm run test:throughput
```

**측정 항목**:
- 전송된 메시지 수
- 수신된 메시지 수
- 손실 메시지 수
- 평균/최대 지연 시간

### Test 2: Presence 동기화

**목적**: Agent 온라인 상태 동기화 정확도

**절차**:
```bash
npm run test:presence
```

**시나리오**:
- 8개 클라이언트가 Presence 채널 참여
- 각 클라이언트의 상태 업데이트
- 다른 클라이언트들의 수신 확인

### Test 3: Postgres Changes 구독

**목적**: DB 변경 사항 실시간 수신

**절차**:
```bash
npm run test:postgres-changes
```

**시나리오**:
- `job_queue` 테이블 INSERT/UPDATE 감지
- 지연 시간 측정
- 누락 여부 확인

### Test 4: 재연결 안정성

**목적**: 네트워크 끊김 시 자동 재연결 검증

**절차**:
```bash
npm run test:reconnection
```

**시나리오**:
1. Realtime 연결
2. 의도적으로 연결 끊기
3. 재연결 시간 측정
4. 재연결 후 메시지 수신 확인

---

## 예상 결과

### ✅ 성공 시나리오

```
=== Supabase Realtime 성능 테스트 ===

Test 1: 메시지 처리량
  전송: 6000 메시지
  수신: 5998 메시지
  손실률: 0.03%
  평균 지연: 234ms
  최대 지연: 892ms
  ✓ 성공

Test 2: Presence 동기화
  참여자: 8/8
  상태 동기화: 100%
  평균 지연: 156ms
  ✓ 성공

Test 3: Postgres Changes
  변경 감지: 100/100
  평균 지연: 312ms
  ✓ 성공

Test 4: 재연결
  재연결 시간: 2.3초
  재연결 후 메시지 수신: 정상
  ✓ 성공

최종 판정: ✅ GO
```

### ❌ 실패 시나리오

```
Test 1: 메시지 처리량
  전송: 6000 메시지
  수신: 5721 메시지
  손실률: 4.65%
  평균 지연: 1,234ms
  ✗ 실패 (손실률 > 1%, 지연 > 500ms)

최종 판정: ❌ NO-GO
→ 대안: Polling 기반 동기화 (5초 주기)
```

---

## 실행 방법

```bash
# 전체 테스트 실행
npm run test:all

# 개별 테스트
npm run test:throughput
npm run test:presence
npm run test:postgres-changes
npm run test:reconnection

# 리포트 생성
npm run report
```

---

## 대안 (NO-GO 시)

### 대안 1: Polling 기반 동기화

**구현**:
```typescript
// 5초마다 상태 조회
setInterval(async () => {
  const jobs = await fetchJobs(officeId);
  const agents = await fetchAgents(officeId);
  updateUI(jobs, agents);
}, 5000);
```

**장점**: 안정성 보장
**단점**: 실시간성 포기 (최대 5초 지연)

### 대안 2: WebSocket 직접 구현

**구현**: Socket.io 사용
**장점**: 세밀한 제어
**단점**: 인프라 관리 부담

### 대안 3: Hybrid 방식

**구현**: Realtime (urgent) + Polling (normal)
**장점**: 균형적 접근
**단점**: 복잡도 증가

---

## Next Steps

1. ✅ 실험 환경 구축
2. ⏳ Supabase 프로젝트 생성
3. ⏳ 테스트 실행
4. ⏳ 결과 분석
5. ⏳ Go/No-Go 결정

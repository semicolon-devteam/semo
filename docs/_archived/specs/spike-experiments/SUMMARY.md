# Spike 실험 종합 요약

> Semo Office 구현 전 기술 검증 Spike 실험 계획 및 실행 가이드

---

## 🚀 Implementation Status

### ✅ MVP Complete - 즉시 실행 가능!

| Spike | Status | Test Files | API Required |
|-------|--------|-----------|--------------|
| **node-pty 안정성** | 🟢 완료 | 7개 파일 | ❌ No API |
| **PixiJS 성능** | 🟢 완료 | 2개 파일 | ❌ No API |
| **Supabase Realtime** | 🟢 완료 | 5개 파일 | ✅ Supabase 프로젝트 |
| **Task Decomposer** | 🟢 완료 | 5개 파일 | ✅ Anthropic API |

**모든 4개 Critical Spike가 MVP 수준으로 구현 완료되었습니다!**

#### node-pty 안정성 (7개 파일)
- ✅ `test-long-running.js` - 30분 장시간 안정성 + 메모리 추적
- ✅ `test-concurrent.js` - 30개 동시 세션 스트레스 테스트
- ✅ `test-output-buffering.js` - 50,000줄 출력 손실률 측정
- ✅ `test-crash-recovery.js` - 5회 크래시/복구 시뮬레이션
- ✅ `monitor.js` - 실시간 모니터링 대시보드 (blessed-contrib)
- ✅ `generate-report.js` - HTML/Markdown/CSV 리포트 생성
- ✅ `run-all.js` - 통합 테스트 러너 (Go/No-Go 자동 판정)

#### PixiJS 성능 (2개 파일)
- ✅ `index.html` - 인터랙티브 테스트 UI (FPS 카운터, 메트릭)
- ✅ `src/main.js` - 3가지 테스트 시나리오 (기본/애니메이션/줌팬)

#### Supabase Realtime (5개 파일)
- ✅ `test-throughput.js` - 600개 메시지/분 처리량 측정
- ✅ `test-presence.js` - 8개 Agent Presence 동기화
- ✅ `test-postgres-changes.js` - DB 변경 감지 (테이블 자동 생성)
- ✅ `test-reconnection.js` - 재연결 안정성 (3회 시도)
- ✅ `run-all.js` - 통합 테스트 러너

#### Task Decomposer (5개 파일)
- ✅ `evaluator.js` - Ground truth 기반 정확도 평가 (역할 60% + 의존성 40%)
- ✅ `test-few-shot.js` - Few-shot 0/3/5개 비교 (5개 샘플)
- ✅ `test-context.js` - minimal/with-package/full 컨텍스트 효과
- ✅ `test-prompts.js` - concise/detailed/structured 프롬프트 A/B
- ✅ `run-all.js` - 통합 테스트 러너 (API 비용 경고 포함)

---

## 🎯 Quick Start (즉시 실행 가능)

### 1. node-pty 안정성 테스트 (가장 중요!)

```bash
cd spike-experiments/00-node-pty-stability
npm install
npm run test:all    # 전체 테스트 (약 35분 소요)

# 또는 개별 테스트
npm run test:long-running    # 30분 안정성 테스트
npm run test:concurrent      # 동시 세션 테스트
npm run test:output-buffering    # 출력 버퍼링 테스트
npm run test:crash-recovery  # 크래시 복구 테스트

# 실시간 모니터링
npm run monitor    # 대시보드 (종료: q)

# 리포트 생성
npm run report    # HTML + Markdown 리포트
```

### 2. PixiJS 성능 테스트

```bash
cd spike-experiments/03-pixi-performance
npm install
npm run dev    # http://localhost:5173 접속

# 브라우저에서 테스트 버튼 클릭:
# - Test 1: Basic Rendering (30 agents)
# - Test 2: Animation (30 animated)
# - Test 3: Zoom/Pan Test
```

### 3. Supabase Realtime 테스트 (구현 필요)

```bash
cd spike-experiments/01-supabase-realtime

# 1. .env 파일 생성
cp .env.example .env
# SUPABASE_URL, SUPABASE_ANON_KEY 설정

# 2. 테스트 구현 (TODO)
npm install
# npm run test:all    # 구현 후 실행
```

### 4. Task Decomposer 테스트 (구현 필요)

```bash
cd spike-experiments/02-task-decomposer

# 1. .env 파일 생성
cp .env.example .env
# ANTHROPIC_API_KEY 설정

# 2. Ground truth 확인
cat data/ground-truth.json    # 10개 샘플 준비 완료

# 3. 테스트 구현 (TODO)
npm install
# npm run test:all    # 구현 후 실행
```

---

## 개요

총 **4개의 Critical Spike** 실험을 통해 Semo Office의 핵심 기술 스택을 검증합니다.
각 Spike는 독립적으로 실행 가능하며, 결과는 plan.md 업데이트에 반영됩니다.

---

## Critical Spike 목록

| ID | 이름 | 우선순위 | 예상 시간 | 상태 |
|----|------|---------|----------|------|
| SPIKE-00-02/04-01 | node-pty 안정성 | 🔴 Critical | 3일 | ✅ 준비 완료 |
| SPIKE-00-01 | Supabase Realtime 성능 | 🟠 High | 2일 | ✅ 준비 완료 |
| SPIKE-02-01 | Task Decomposer 정확도 | 🟠 High | 2일 | ✅ 준비 완료 |
| SPIKE-06-01 | PixiJS 렌더링 성능 | 🟡 Medium | 2일 | ✅ 준비 완료 |

---

## 실행 순서

### Phase 1: 기반 기술 검증 (병렬 가능)

```bash
# Terminal 1: node-pty 안정성 (가장 중요)
cd specs/spike-experiments/00-node-pty-stability
npm install
npm run test:all

# Terminal 2: Supabase Realtime (병렬 실행 가능)
cd specs/spike-experiments/01-supabase-realtime
npm install
npm run test:all
```

**소요 시간**: 3일 (병렬 실행 시 최대 3일)

### Phase 2: 애플리케이션 레이어 검증

```bash
# Task Decomposer 정확도
cd specs/spike-experiments/02-task-decomposer
npm install
npm run test:all
```

**소요 시간**: 2일

### Phase 3: UI 검증

```bash
# PixiJS 성능
cd specs/spike-experiments/03-pixi-performance
npm install
npm run dev
# 브라우저에서 수동 테스트
```

**소요 시간**: 2일

**총 예상 시간**: 7일 (순차) 또는 5일 (일부 병렬)

---

## 성공 기준 매트릭스

| Spike | 핵심 지표 | 목표 | Critical |
|-------|---------|------|----------|
| node-pty | 30분 작업 성공률 | > 95% | ✅ |
| node-pty | 메모리 증가율 | < 100MB/h | ✅ |
| node-pty | 동시 세션 안정성 | > 90% | ✅ |
| Realtime | 평균 지연 | < 500ms | ✅ |
| Realtime | 메시지 손실률 | < 1% | ✅ |
| Decomposer | 역할 매칭 정확도 | > 80% | ✅ |
| Decomposer | 의존성 정확도 | > 85% | ✅ |
| PixiJS | 데스크톱 FPS | > 60fps | ✅ |
| PixiJS | 메모리 사용량 | < 500MB | ✅ |

---

## Go/No-Go 결정 프로세스

### 1. 각 Spike 실행 후 평가

각 Spike는 독립적으로 Go/No-Go 판정:
- **Go**: 모든 Critical 지표 달성
- **No-Go**: 하나 이상 Critical 지표 미달

### 2. 전체 시스템 Go/No-Go

```
IF (node-pty == GO) THEN
  ✅ Semo Office 구현 진행
ELSE IF (node-pty == NO-GO) THEN
  ⚠️ 대안 검토 필요
  - Docker 컨테이너 기반
  - Claude API 직접 호출
  - 세션 재사용 포기

  대안 선택 후 계획 수정 (+2~3주)
END IF

IF (Realtime == NO-GO) THEN
  ⚠️ Polling 기반으로 전환
  - 실시간성 포기 (5초 지연)
  - 안정성 우선
END IF

IF (Decomposer == NO-GO) THEN
  ⚠️ 사용자 인터페이스 강화
  - 역할 선택 UI 추가
  - 템플릿 기반 분해
END IF

IF (PixiJS == NO-GO) THEN
  ⚠️ 대안 렌더링 엔진
  - React Flow (Agent 수 제한)
  - LOD 최적화
END IF
```

---

## 결과 리포트 템플릿

### 각 Spike 리포트 구조

```markdown
# SPIKE-XX-XX 결과 리포트

## 실행 정보
- 실행일: YYYY-MM-DD
- 실행자: {name}
- 환경: {OS, Node.js version, etc.}

## 측정 결과

| 지표 | 목표 | 실제 | 판정 |
|------|------|------|------|
| ... | ... | ... | ✅/❌ |

## 세부 결과
{상세 데이터, 그래프, 로그}

## Go/No-Go 판정
**✅ GO** 또는 **❌ NO-GO**

{판정 이유}

## 권장 사항
{결과 기반 권장 사항}

## 첨부 파일
- results/metrics.json
- results/charts/*.png
```

### 종합 리포트

모든 Spike 완료 후 생성:

```bash
cd specs/spike-experiments
node generate-summary-report.js
```

생성 파일:
- `FINAL-REPORT.md`
- `decision-matrix.json`
- `charts/comparison.png`

---

## 리스크 매트릭스

| Spike | 실패 시 영향도 | 대안 복잡도 | 위험도 |
|-------|-------------|-----------|--------|
| node-pty | 매우 높음 (시스템 전체) | 높음 (+2주) | 🔴 High |
| Realtime | 중간 (실시간성) | 낮음 (+3일) | 🟡 Medium |
| Decomposer | 중간 (UX) | 중간 (+1주) | 🟡 Medium |
| PixiJS | 낮음 (UI 품질) | 낮음 (+5일) | 🟢 Low |

---

## 다음 단계

### Spike 실행 전

- [ ] PO/Architect와 Spike 우선순위 확정
- [ ] 실행 환경 준비 (API Key, Supabase 프로젝트 등)
- [ ] 팀원에게 Spike 목적 및 기대 결과 공유

### Spike 실행 중

- [ ] 각 Spike 실행 및 결과 기록
- [ ] 이슈 발견 시 즉시 기록 (GitHub Issue)
- [ ] 중간 결과 공유 (Daily Standup)

### Spike 완료 후

- [ ] 결과 리포트 작성 (`results/summary.md`)
- [ ] Go/No-Go 결정 회의
- [ ] plan.md 업데이트 (결과 반영)
- [ ] 대안 검토 (No-Go 시)
- [ ] 구현 일정 재조정

---

## 실행 체크리스트

```markdown
## SPIKE-00-02/04-01: node-pty 안정성
- [ ] 환경 설정 완료
- [ ] Test 1: 장시간 안정성 (30분) 실행
- [ ] Test 2: 동시 세션 (30개) 실행
- [ ] Test 3: 출력 버퍼링 실행
- [ ] Test 4: 크래시 복구 실행
- [ ] 결과 리포트 작성
- [ ] Go/No-Go 판정

## SPIKE-00-01: Supabase Realtime
- [ ] Supabase 프로젝트 생성
- [ ] 환경 변수 설정 (.env)
- [ ] Test 1: 메시지 처리량 실행
- [ ] Test 2: Presence 동기화 실행
- [ ] Test 3: Postgres Changes 실행
- [ ] Test 4: 재연결 안정성 실행
- [ ] 결과 리포트 작성
- [ ] Go/No-Go 판정

## SPIKE-02-01: Task Decomposer
- [ ] Anthropic API Key 설정
- [ ] 테스트 샘플 10개 준비
- [ ] Ground truth 작성
- [ ] Test 1: Few-shot 예제 비교 실행
- [ ] Test 2: 프로젝트 컨텍스트 효과 실행
- [ ] Test 3: 프롬프트 A/B 테스트 실행
- [ ] 결과 분석 및 프롬프트 튜닝
- [ ] 결과 리포트 작성
- [ ] Go/No-Go 판정

## SPIKE-06-01: PixiJS 성능
- [ ] PixiJS 프로젝트 설정
- [ ] Agent 스프라이트 이미지 준비
- [ ] Test 1: 기본 렌더링 실행
- [ ] Test 2: 애니메이션 부하 실행
- [ ] Test 3: 줌/팬 인터랙션 실행
- [ ] Test 4: 모바일 성능 실행 (선택)
- [ ] Test 5: 장시간 안정성 실행
- [ ] 결과 리포트 작성
- [ ] Go/No-Go 판정

## 종합
- [ ] 전체 Spike 완료
- [ ] 종합 리포트 생성
- [ ] 최종 Go/No-Go 결정
- [ ] plan.md 업데이트
- [ ] 구현 착수 준비
```

---

## 참고 자료

### 각 Spike 상세 문서

- [SPIKE-00-02/04-01: node-pty 안정성](./00-node-pty-stability/README.md)
- [SPIKE-00-01: Supabase Realtime](./01-supabase-realtime/README.md)
- [SPIKE-02-01: Task Decomposer](./02-task-decomposer/README.md)
- [SPIKE-06-01: PixiJS 성능](./03-pixi-performance/README.md)

### 관련 Spec 문서

- [00-overview/clarify-spike.md](../00-overview/clarify-spike.md)
- [04-session-execution/clarify-spike.md](../04-session-execution/clarify-spike.md)
- [02-task-decomposer/clarify-spike.md](../02-task-decomposer/clarify-spike.md)
- [06-realtime-ui/clarify-spike.md](../06-realtime-ui/clarify-spike.md)

---

## 연락처 및 지원

- **Spike 실행 문의**: [팀 Slack 채널]
- **기술 지원**: [Tech Lead]
- **결정 회의**: [PO/Architect]

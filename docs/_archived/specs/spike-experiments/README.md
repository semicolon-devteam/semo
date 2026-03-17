# Spike Experiments - MVP Complete 🎉

> Semo Office 구현 전 기술 검증 Spike 실험 - 모든 4개 Critical Spike MVP 완료!

---

## 🚀 실행 준비 완료

| Spike | 구현 상태 | 소요 시간 | API 필요 |
|-------|----------|----------|----------|
| **node-pty 안정성** | ✅ 완료 | ~35분 | ❌ |
| **PixiJS 성능** | ✅ 완료 | ~5분 | ❌ |
| **Supabase Realtime** | ✅ 완료 | ~10분 | ✅ Supabase |
| **Task Decomposer** | ✅ 완료 | ~15분 | ✅ Anthropic |

**총 예상 실행 시간**: 약 65분

---

## 🎯 Quick Start

### 1️⃣ node-pty 안정성 (가장 중요!)

```bash
cd 00-node-pty-stability
npm install
npm run test:all
```

**예상 결과**: 4개 테스트 + 자동 리포트 생성 (`results/report.html`)

### 2️⃣ PixiJS 성능

```bash
cd 03-pixi-performance
npm install
npm run dev    # http://localhost:3000 접속
```

**브라우저 테스트**: Test 1, 2, 3 버튼 클릭 → FPS 확인

### 3️⃣ Supabase Realtime

```bash
cd 01-supabase-realtime
npm install

# 환경 설정
cp .env.example .env
# .env 파일에 SUPABASE_URL, SUPABASE_ANON_KEY 입력

npm run test:all
```

**예상 결과**: 4개 테스트 + Go/No-Go 판정

### 4️⃣ Task Decomposer

```bash
cd 02-task-decomposer
npm install

# 환경 설정
cp .env.example .env
# .env 파일에 ANTHROPIC_API_KEY 입력

npm run test:all
```

**예상 결과**: 3개 테스트 (Few-shot/Context/Prompts) + 정확도 분석

---

## 📋 구현 상세

### node-pty 안정성 (7개 파일)

| 파일 | 설명 | 소요 시간 |
|------|------|----------|
| `test-long-running.js` | 30분 메모리 누수 감지 | 30분 |
| `test-concurrent.js` | 30개 동시 세션 | 2분 |
| `test-output-buffering.js` | 50,000줄 손실률 | 1분 |
| `test-crash-recovery.js` | 5회 크래시/복구 | 1분 |
| `monitor.js` | 실시간 대시보드 | - |
| `generate-report.js` | HTML/MD/CSV 리포트 | - |
| `run-all.js` | 통합 러너 | 35분 |

**성공 기준**:
- ✅ 30분 작업 성공률 > 95%
- ✅ 메모리 증가 < 100MB/h
- ✅ 동시 세션 안정성 > 90%
- ✅ 출력 손실률 < 1%
- ✅ 크래시 복구 100%

### PixiJS 성능 (3개 파일)

| 파일 | 설명 |
|------|------|
| `index.html` | 테스트 UI |
| `src/main.js` | 3가지 시나리오 |
| `vite.config.js` | Vite 설정 |

**테스트 시나리오**:
1. **Basic Rendering**: 30개 Agent 렌더링
2. **Animation**: 30개 Agent 애니메이션
3. **Zoom/Pan**: 마우스 인터랙션

**성공 기준**:
- ✅ Desktop 60fps 이상
- ✅ 메모리 < 500MB
- ✅ 줌/팬 부드러움

### Supabase Realtime (5개 파일)

| 파일 | 설명 | 소요 시간 |
|------|------|----------|
| `test-throughput.js` | 600개 메시지/분 | 2분 |
| `test-presence.js` | 8개 Presence 동기화 | 2분 |
| `test-postgres-changes.js` | DB 변경 감지 | 2분 |
| `test-reconnection.js` | 재연결 3회 | 2분 |
| `run-all.js` | 통합 러너 | 10분 |

**성공 기준**:
- ✅ 메시지 손실률 < 1%
- ✅ 평균 지연 < 500ms
- ✅ Presence 동기화 100%
- ✅ 재연결 성공률 > 66%

### Task Decomposer (5개 파일)

| 파일 | 설명 | 샘플 수 |
|------|------|---------|
| `evaluator.js` | 정확도 평가 로직 | - |
| `test-few-shot.js` | Few-shot 0/3/5개 비교 | 5개 |
| `test-context.js` | 컨텍스트 효과 | 5개 |
| `test-prompts.js` | 프롬프트 A/B | 5개 |
| `run-all.js` | 통합 러너 | 15회 API 호출 |

**평가 지표**:
- 역할 매칭 정확도 (목표: 80%)
- 의존성 추론 정확도 (목표: 85%)
- 종합 점수 = 역할 60% + 의존성 40%

**Ground Truth**: 10개 샘플 (simple/medium/complex)

---

## 📊 예상 결과

### Go 시나리오 (이상적)

```
✅ node-pty: 모든 테스트 통과
✅ PixiJS: 60fps 유지
✅ Supabase: 모든 기능 정상
✅ Task Decomposer: 정확도 80% 이상

→ 구현 진행 가능!
```

### No-Go 시나리오 (문제 발견)

```
❌ node-pty: 메모리 누수 or 크래시 발생
   → 대안 1: Docker 컨테이너
   → 대안 2: Claude API 직접 호출
   → 대안 3: 세션 재사용 포기

❌ Supabase: 지연 시간 초과
   → 대안: Polling 방식 (5초 주기)

❌ Task Decomposer: 정확도 60% 미만
   → 대안 1: 역할 선택 UI
   → 대안 2: 템플릿 기반
```

---

## 🛠️ 트러블슈팅

### node-pty 설치 오류

```bash
# macOS
xcode-select --install

# Linux
sudo apt-get install build-essential

# Windows
npm install --global windows-build-tools
```

### Supabase 테이블 생성

`test-postgres-changes.js` 실행 시 테이블 생성 SQL이 출력됩니다.
Supabase 대시보드에서 SQL을 실행하세요.

### Anthropic API 비용

- Test 1 (Few-shot): ~5 API 호출
- Test 2 (Context): ~5 API 호출
- Test 3 (Prompts): ~5 API 호출
- **총 예상 비용**: $0.50 ~ $1.00

---

## 📝 리포트 생성

### node-pty

```bash
npm run report    # results/report.html 생성
```

HTML 리포트에 포함:
- FPS 그래프
- 메모리 사용량 추이
- Go/No-Go 판정

### Supabase / Task Decomposer

```bash
npm run test:all    # results/summary.json, summary.md 생성
```

---

## 🎉 완료 체크리스트

### Phase 1: API 불필요 (즉시 실행)

- [ ] node-pty 테스트 실행
- [ ] PixiJS 테스트 실행
- [ ] 두 테스트 모두 통과 확인

### Phase 2: API 필요 (환경 설정 후)

- [ ] Supabase 프로젝트 생성
- [ ] .env 파일 설정 (Supabase)
- [ ] Supabase 테스트 실행
- [ ] Anthropic API 키 발급
- [ ] .env 파일 설정 (Anthropic)
- [ ] Task Decomposer 테스트 실행

### Phase 3: 결과 분석

- [ ] 모든 리포트 확인
- [ ] Go/No-Go 결정
- [ ] plan.md 업데이트

---

## 📚 디렉토리 구조

```
spike-experiments/
├── README.md                          ⬅️ 이 파일
├── SUMMARY.md                         # 종합 요약
│
├── 00-node-pty-stability/            # ✅ 완료
│   ├── package.json
│   ├── src/
│   │   ├── test-long-running.js
│   │   ├── test-concurrent.js
│   │   ├── test-output-buffering.js
│   │   ├── test-crash-recovery.js
│   │   ├── monitor.js
│   │   ├── generate-report.js
│   │   └── run-all.js
│   └── README.md
│
├── 01-supabase-realtime/             # ✅ 완료
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── test-throughput.js
│   │   ├── test-presence.js
│   │   ├── test-postgres-changes.js
│   │   ├── test-reconnection.js
│   │   └── run-all.js
│   └── README.md
│
├── 02-task-decomposer/               # ✅ 완료
│   ├── package.json
│   ├── .env.example
│   ├── data/
│   │   └── ground-truth.json
│   ├── src/
│   │   ├── evaluator.js
│   │   ├── test-few-shot.js
│   │   ├── test-context.js
│   │   ├── test-prompts.js
│   │   └── run-all.js
│   └── README.md
│
└── 03-pixi-performance/              # ✅ 완료
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── src/
    │   └── main.js
    └── README.md
```

---

## 🚀 Next Steps

1. ✅ **Phase 1 실행** (node-pty + PixiJS)
2. ✅ **환경 설정** (Supabase + Anthropic)
3. ✅ **Phase 2 실행** (Supabase + Task Decomposer)
4. 📊 **결과 분석** 및 Go/No-Go 결정
5. 📝 **plan.md 업데이트** (결과 반영)
6. 🏗️ **구현 시작** (통과 시)

---

## 📞 문의

- Spike 실행 중 문제 발생 시 각 디렉토리의 README.md 참조
- 기술적 질문: `SUMMARY.md`의 대안 섹션 확인
- 리포트 해석: `results/` 디렉토리 내 파일 참조

**모든 Spike가 MVP 수준으로 완료되었습니다. 즉시 실행 가능합니다! 🎉**

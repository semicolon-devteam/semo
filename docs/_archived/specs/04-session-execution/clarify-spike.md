# 04-Session Execution: Clarify & Spike

> Claude Code 세션 관리에 대한 불확실성 제거 및 기술 검증

---

## Clarify (명확화 필요 사항)

### 1. semo-remote-client 아키텍처

**질문**:
- Electron 필수인가? Node.js 서버로 대체 가능?
- 클라이언트 여러 대 실행 가능? (로드 밸런싱)
- 클라이언트 장애 시 세션 복구 전략?

**결정 필요**:
- 클라이언트-서버 통신 프로토콜 (Realtime vs WebSocket vs gRPC)
- 클라이언트 인증 방법
- 클라이언트 버전 관리

### 2. 세션 풀 관리

**질문**:
- Warm Pool 크기: Office당 고정 3개? 동적?
- Cold Pool 최대 크기?
- 세션 재사용 정책: 같은 역할만? 모든 역할?

**결정 필요**:
- 유휴 세션 정리 시간 (10분?)
- 세션 생성 실패 재시도 횟수
- 세션 크래시 감지 방법

### 3. Persona 주입

**질문**:
- .claude/CLAUDE.md 파일 생성 위치: Worktree마다? 공유?
- Persona 업데이트 시 기존 세션 재생성?
- Persona prompt 버전 관리?

**결정 필요**:
- CLAUDE.md 템플릿 구조
- scope_patterns 검증 방법
- Persona 오버라이드 허용 여부

### 4. 출력 완료 감지

**질문**:
- `[SEMO:DONE]` 패턴 외 추가 패턴?
- 암묵적 완료 감지 (30초 출력 없음)?
- 부분 완료 상태 필요? (50% 완료)

**결정 필요**:
- 완료 패턴 우선순위
- 오탐지 방지 전략
- 타임아웃 vs 완료 판단 기준

### 5. 에러 처리

**질문**:
- 세션 크래시 vs 타임아웃 vs 사용자 중단 구분?
- 에러 로그 저장 위치 및 기간?
- 자동 복구 가능한 에러 유형?

**결정 필요**:
- Circuit Breaker 패턴 적용 여부
- 에러 알림 채널 (Slack, Email)
- 세션 재생성 조건

---

## Spike (기술 검증 필요 사항)

### SPIKE-04-01: node-pty 장시간 안정성 테스트

**목적**: node-pty 기반 세션의 장시간 실행 안정성 검증

**실험 계획**:
1. 세션 10개 생성, 각 1시간 작업 실행
2. 메모리 누수 모니터링 (힙 크기, GC 빈도)
3. 크래시 발생 빈도 및 원인 분석
4. 출력 버퍼 오버플로우 테스트

**성공 기준**:
- 1시간 작업 성공률 > 95%
- 메모리 증가율 < 100MB/시간
- 크래시 시 자동 재시작 가능

**예상 시간**: 3일

---

### SPIKE-04-02: Supabase Realtime 명령 전달 지연

**목적**: Office Server → semo-remote-client 명령 전달 지연 시간 측정

**실험 계획**:
1. 명령 INSERT (agent_commands) → Realtime 수신 시간 측정
2. 동시 명령 10개 전송 시 처리 순서 확인
3. 네트워크 불안정 시 재연결 시간 측정
4. 명령 손실 가능성 테스트

**성공 기준**:
- 평균 지연 < 500ms
- 명령 손실률 < 0.1%
- 재연결 시간 < 5초

**예상 시간**: 2일

---

### SPIKE-04-03: 출력 파싱 정확도 테스트

**목적**: OutputMonitor의 완료 패턴 감지 정확도 검증

**실험 계획**:
1. 10가지 완료 시나리오 준비 (명시적 마커, PR 생성, 커밋 완료 등)
2. OutputMonitor로 감지 시도
3. False Positive/False Negative 측정
4. 패턴 개선

**성공 기준**:
- 완료 감지 정확도 > 95%
- False Positive < 5%
- 평균 감지 지연 < 3초

**예상 시간**: 2일

---

### SPIKE-04-04: 세션 풀 전략 비교

**목적**: Warm Pool vs On-Demand 생성 비교

**실험 계획**:
1. Warm Pool (Office당 3개 미리 생성)
2. On-Demand (Job 할당 시 생성)
3. Hybrid (1개 Warm + 나머지 On-Demand)
4. 첫 Job 실행 시간, 리소스 사용량 비교

**성공 기준**:
- Warm Pool: 첫 실행 < 5초
- On-Demand: 첫 실행 < 30초
- 리소스 효율성 비교

**예상 시간**: 2일

---

### SPIKE-04-05: semo-remote-client 배포 전략

**목적**: Electron 앱 빌드 및 배포 방법 검증

**실험 계획**:
1. electron-builder 설정
2. macOS, Linux, Windows 빌드 테스트
3. 자동 업데이트 메커니즘 (electron-updater)
4. 코드 서명 요구사항 확인

**성공 기준**:
- 3개 플랫폼 빌드 성공
- 자동 업데이트 동작
- 설치 파일 크기 < 200MB

**예상 시간**: 2일

---

## Decisions (결정 사항)

### ✅ 결정됨: 완료 패턴

```typescript
const COMPLETION_PATTERNS = [
  // 명시적 마커 (최우선)
  /\[SEMO:DONE\]/,

  // PR 생성
  /Created pull request #(\d+)/i,

  // 커밋 완료
  /\[main [a-f0-9]{7}\] .+/,

  // 테스트 성공
  /All tests passed/i,

  // 빌드 성공
  /Build completed successfully/i,
];

const ERROR_PATTERNS = [
  /Error:/i,
  /ENOENT:/,
  /Permission denied/i,
  /fatal:/i,
];
```

### ✅ 결정됨: 세션 풀 전략

- **Warm Pool**: Office 생성 시 FE, BE, QA 세션 1개씩 미리 생성
- **Cold Pool**: 추가 필요 시 On-Demand 생성
- **최대 동시 세션**: Office당 6개 (Warm 3 + Cold 3)
- **유휴 세션 정리**: 10분 동안 사용 안 되면 Cold Pool 세션 정리

### ✅ 결정됨: Persona 주입 위치

```
/workspace/agent/{role}/{task-id}/
└── .claude/
    └── CLAUDE.md    # Persona prompt 주입
```

각 Worktree마다 독립적인 .claude/CLAUDE.md 생성

### ✅ 결정됨: 에러 처리 흐름

```
세션 에러 발생
    ↓
에러 유형 판단
    ├─ ENOENT (파일 없음) → Job 실패, 재시도 없음
    ├─ Permission denied → Job 실패, 수동 해결 요청
    ├─ Timeout → 재시도 1회
    └─ 크래시 → 세션 재생성 후 재시도 1회
```

---

## Open Questions (미결정 사항)

| 질문 | 담당자 | 기한 |
|------|--------|------|
| Electron vs Node.js 서버 최종 결정 | Architect | SPIKE-04-05 후 |
| 클라이언트 로드 밸런싱 필요? | DevOps | Phase 7 |
| Persona 업데이트 시 세션 재생성 정책 | Tech Lead | Phase 5 |
| Circuit Breaker 적용 범위 | BE Dev | Phase 6 |

---

## Risk Mitigation (리스크 완화)

### 만약 SPIKE-04-01 실패 시 (node-pty 불안정)

**대안 1**: Docker 컨테이너 기반
- 각 세션 → 독립 Docker 컨테이너
- 더 무겁지만 격리 보장

**대안 2**: Claude API 직접 호출
- Claude Code CLI 대신 Anthropic API
- 터미널 세션 없이 API 워크플로우

**대안 3**: 세션 수명 단축
- 세션 재사용 없이 Job마다 새 세션 생성
- 안정성 우선, 성능 희생

---

## Next Steps

1. ✅ Clarify 문서 작성 완료
2. ⏳ SPIKE-04-01 최우선 실행 (node-pty 안정성)
3. ⏳ SPIKE-04-02 실행 (Realtime 지연)
4. ⏳ semo-remote-client Electron 프로젝트 초기화
5. ⏳ Open Questions 답변 수집

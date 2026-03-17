# 01-Core: Clarify & Spike

> Office/Agent/Persona CRUD에 대한 불확실성 제거 및 기술 검증

---

## Clarify (명확화 필요 사항)

### 1. Office 관리

**질문**:
- Office 소유권: 단일 소유자? 팀 공유?
- Office 삭제 시 관련 데이터 처리: 즉시 삭제? soft delete? 아카이빙?
- Office 이름 중복 허용 여부
- Office 템플릿 제공 여부 (예: "백엔드 팀", "풀스택 팀")

**결정 필요**:
- Office당 최대 Agent 수 (기본안: 8개)
- Office 비활성 기준 (7일 미사용?)
- Office 초대 링크 기능 필요 여부

### 2. Agent 상태 관리

**질문**:
- Agent 상태 전환 규칙: idle ↔ working ↔ blocked ↔ error 전환 조건?
- 에러 상태 Agent 자동 복구 정책
- Agent 삭제 시 진행 중인 Job 처리 방법

**결정 필요**:
- Agent 동시 Job 할당 수 (1개 vs 여러 개)
- Agent "휴식" 상태 필요 여부
- Agent 성능 메트릭 수집 여부

### 3. Persona 확장성

**질문**:
- 사용자 커스텀 Persona 생성 허용?
- Persona 버전 관리: 업데이트 시 기존 Agent에 반영?
- Persona 마켓플레이스 계획?

**결정 필요**:
- Persona prompt 최대 길이
- scope_patterns 정규식 복잡도 제한
- core_skills 표준 분류 체계

### 4. GitHub 연동

**질문**:
- GitHub Organization vs Personal Repository?
- 여러 레포지토리 연결 가능?
- Private 레포만? Public도?
- GitHub App vs OAuth App?

**결정 필요**:
- 토큰 갱신 전략
- 권한 최소 범위 (repo, read:org 등)
- 레포 변경 시 기존 Worktree 처리

---

## Spike (기술 검증 필요 사항)

### SPIKE-01-01: Supabase Row Level Security 성능

**목적**: RLS 활성화 시 쿼리 성능 영향도 측정

**실험 계획**:
1. RLS 없는 쿼리 vs RLS 있는 쿼리 벤치마크
2. Office 100개, Agent 800개 데이터 생성
3. 복잡한 JOIN 쿼리 (office + agents + jobs) 성능 측정

**성공 기준**:
- RLS 오버헤드 < 20%
- 복잡 쿼리 응답 시간 < 200ms

**예상 시간**: 1일

---

### SPIKE-01-02: Persona Prompt 최적화

**목적**: Persona prompt 길이가 세션 성능에 미치는 영향 측정

**실험 계획**:
1. Persona prompt 길이별 테스트 (500자, 2000자, 5000자)
2. 세션 생성 시간, 응답 속도 측정
3. Token 사용량 비교

**성공 기준**:
- 2000자 이하 prompt 권장
- 세션 생성 시간 < 5초
- 첫 응답 시간 < 10초

**예상 시간**: 1일

---

### SPIKE-01-03: GitHub Webhook vs Polling

**목적**: GitHub 레포 변경 감지 전략 결정

**실험 계획**:
1. Webhook 방식: 레포에 webhook 등록, 실시간 수신
2. Polling 방식: 5분마다 /commits API 호출
3. 지연 시간, 신뢰성, 비용 비교

**성공 기준**:
- Webhook 지연 < 30초
- Polling 비용 < $10/월 (API rate limit 고려)

**예상 시간**: 1일

---

## Decisions (결정 사항)

### ✅ 결정됨: Office 데이터 모델

```typescript
interface Office {
  id: string;
  name: string;
  description?: string;
  github_repo: string;      // "owner/repo"
  github_access_token: string;  // 암호화 저장
  owner_id?: string;        // 향후 인증 추가 시
  max_agents: number;       // 기본 8
  max_concurrent_jobs: number;  // 기본 3
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
}
```

### ✅ 결정됨: Agent 상태 전환

```
idle (대기)
  ↓ Job 할당
working (작업 중)
  ↓ 에러 발생
error (오류)
  ↓ 자동 재시작 or 수동 복구
idle
  ↓ 의존성 대기
blocked (차단됨)
  ↓ 의존성 해결
idle
```

### ✅ 결정됨: Persona 관리

- 기본 8개 Persona는 시스템 제공 (읽기 전용)
- v1.0에서는 커스텀 Persona 미지원
- v2.0에서 사용자 커스텀 Persona 추가 예정

---

## Open Questions (미결정 사항)

| 질문 | 담당자 | 기한 |
|------|--------|------|
| Office 다중 소유자 지원? | PO | Phase 1 시작 전 |
| GitHub App vs OAuth 최종 결정 | Architect | SPIKE-01-03 후 |
| Persona marketplace 로드맵 | PO | v0.2.0 계획 시 |
| Agent 성능 메트릭 수집 범위 | DevOps | Phase 3 |

---

## Next Steps

1. ✅ Clarify 문서 작성 완료
2. ⏳ Open Questions 답변 수집 (PO, Architect)
3. ⏳ SPIKE-01-01, 01-02 실행 (우선순위 높음)
4. ⏳ 결과 기반 plan.md 업데이트

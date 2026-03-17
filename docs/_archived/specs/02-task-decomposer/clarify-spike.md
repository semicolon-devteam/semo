# 02-Task Decomposer: Clarify & Spike

> Task 분해 시스템에 대한 불확실성 제거 및 기술 검증

---

## Clarify (명확화 필요 사항)

### 1. 분해 정확도

**질문**:
- 분해 실패 시 사용자에게 재시도 요청? 자동 재시도?
- 애매한 요청("사용자 관리 기능") 처리 방법
- 역할 매칭 오류 시 수정 인터페이스 필요?

**결정 필요**:
- 분해 타임아웃 시간 (기본 60초)
- Few-shot 예제 개수 및 선정 기준
- 역할 매칭 신뢰도 임계값

### 2. 의존성 추론

**질문**:
- 의존성 자동 추론 vs 사용자 명시?
- 순환 의존성 발견 시 처리: 차단? 경고 후 수정 요청?
- 병렬 가능 Job 자동 탐지 정확도?

**결정 필요**:
- 의존성 추론 규칙 명시화 (FE → BE, BE → QA 등)
- 사용자 의존성 수정 UI 제공 여부
- 의존성 그래프 시각화 필수 여부

### 3. Decomposer Persona

**질문**:
- Decomposer Persona 업데이트 주기?
- 프로젝트별 컨텍스트 캐싱 전략?
- Decomposer 실패율 목표치?

**결정 필요**:
- scope_patterns: ['*'] 유지 vs 제한?
- core_skills 확장 필요?
- 분해 프롬프트 템플릿 버전 관리

### 4. 분해 결과 검증

**질문**:
- 생성된 Job의 실현 가능성 검증?
- Job description 품질 체크?
- 과도한 Job 분해 방지 (예: 100개 Job)?

**결정 필요**:
- Job 최대 개수 제한
- Job description 최소/최대 길이
- 분해 후 사용자 승인 단계 필수 여부

---

## Spike (기술 검증 필요 사항)

### SPIKE-02-01: Decomposer Persona 프롬프트 최적화

**목적**: Few-shot 예제 개수에 따른 분해 정확도 측정

**실험 계획**:
1. Few-shot 예제 0개, 3개, 5개, 10개로 테스트
2. 10개 샘플 요청 분해
3. 역할 매칭, 의존성 정확도 평가
4. Token 사용량 vs 정확도 트레이드오프 분석

**성공 기준**:
- 5개 예제로 80% 이상 정확도
- Token 사용량 < 10k/분해

**예상 시간**: 2일

---

### SPIKE-02-02: 프로젝트 컨텍스트 수집 전략

**목적**: package.json, 디렉토리 구조 분석의 효과성 검증

**실험 계획**:
1. 최소 컨텍스트 (프로젝트명만)
2. package.json 포함
3. 디렉토리 구조 포함
4. 주요 파일(README, 주요 컴포넌트) 포함
5. 각 방식의 분해 정확도 비교

**성공 기준**:
- package.json + 디렉토리 구조로 70% 이상 정확도
- 컨텍스트 수집 시간 < 5초

**예상 시간**: 2일

---

### SPIKE-02-03: 의존성 그래프 자동 생성 정확도

**목적**: 역할 간 의존성 자동 추론 규칙의 정확도 검증

**실험 계획**:
1. 10개 샘플 태스크에서 의존성 그래프 생성
2. 수동 작성한 정답 그래프와 비교
3. False Positive/False Negative 분석
4. 규칙 개선

**성공 기준**:
- 의존성 정확도 > 85%
- 순환 의존성 감지율 100%

**예상 시간**: 2일

---

### SPIKE-02-04: 분해 결과 검증 전략

**목적**: 비현실적 분해 결과 자동 감지 방법 탐색

**실험 계획**:
1. 휴리스틱 기반 검증 (Job 개수, 설명 길이 등)
2. LLM 기반 자체 검증 (분해 결과를 다시 LLM에 검증 요청)
3. 규칙 기반 검증 (순환 의존성, 고아 Job 등)
4. 각 방식의 정확도/비용 비교

**성공 기준**:
- 비현실적 분해 감지율 > 90%
- 검증 시간 < 10초

**예상 시간**: 2일

---

## Decisions (결정 사항)

### ✅ 결정됨: 분해 프롬프트 구조

```markdown
# Task Decomposition Request

## Project Context
- Name: {project_name}
- Tech Stack: {from package.json}
- Directory Structure: {top-level dirs}

## User Request
{user_input}

## Instructions
1. Analyze the request and project context
2. Break down into role-based jobs (PO, Architect, FE, BE, QA, DevOps)
3. For each job, specify:
   - role: string
   - description: string (what to implement)
   - priority: number (lower = earlier)
   - estimated_time: string
4. Infer dependencies (which jobs must complete before others)
5. Output JSON format: { summary, jobs[], dependencyGraph[] }

## Few-shot Examples
{5 examples}

## Output
[SEMO:DECOMPOSE_DONE]
{json}
```

### ✅ 결정됨: 의존성 추론 규칙

```typescript
const dependencyRules = [
  // 아키텍처 → 모든 구현
  { from: 'Architect', to: ['FE', 'BE', 'DevOps'] },

  // 백엔드 API → 프론트엔드
  { from: 'BE', to: ['FE'] },

  // 구현 → QA
  { from: ['FE', 'BE'], to: ['QA'] },

  // QA → DevOps (배포)
  { from: 'QA', to: ['DevOps'] },
];
```

### ✅ 결정됨: 분해 제약 조건

- Job 최대 개수: 20개
- Job description: 50~500자
- 의존성 깊이: 최대 5레벨
- 분해 타임아웃: 60초

---

## Open Questions (미결정 사항)

| 질문 | 담당자 | 기한 |
|------|--------|------|
| Few-shot 예제 콘텐츠 최종 확정 | Architect | SPIKE-02-01 후 |
| 사용자 의존성 수정 UI 필요? | PO | Phase 6 계획 시 |
| 분해 실패 시 재시도 자동화? | Tech Lead | Phase 2 구현 중 |
| 프로젝트 컨텍스트 캐싱 전략 | BE Dev | Phase 2 |

---

## Risk Mitigation (리스크 완화)

### 만약 SPIKE-02-01 실패 시 (정확도 부족)

**대안 1**: 역할 선택 UI 추가
- 사용자가 먼저 역할을 선택하고 태스크 입력

**대안 2**: 템플릿 기반 분해
- 자주 사용하는 패턴 템플릿 제공 (예: "CRUD API 구현")

**대안 3**: 사용자 수정 인터페이스 강화
- 분해 결과를 드래그 앤 드롭으로 수정 가능하게

---

## Next Steps

1. ✅ Clarify 문서 작성 완료
2. ⏳ SPIKE-02-01 우선 실행 (가장 중요)
3. ⏳ Few-shot 예제 콘텐츠 작성
4. ⏳ 분해 프롬프트 템플릿 초안 작성
5. ⏳ Open Questions 답변 수집

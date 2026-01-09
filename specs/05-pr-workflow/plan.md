# 05-PR Workflow: 구현 계획

> PR 생성, 의존성 순서 병합, 자동 정리

---

## 요구사항 요약

- Agent 작업 완료 시 PR 자동 생성
- PR 제목: `[{role}] {job_description}`
- 의존성 순서에 따라 PR 병합
- PR 머지 후 Worktree 자동 정리
- GitHub `gh` CLI 사용

---

## 영향 범위 분석

| 영역 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/office-server/src/api/prs/` | 신규 | PR 관리 API |
| `packages/office-server/src/services/pr/` | 신규 | PRService, MergeQueue |
| `packages/office-server/src/db/migrations/` | 수정 | job_queue.pr_number 필드 추가 |

---

## 구현 단계

### Phase 1: PR 생성 로직

**작업 내용**:
1. `PRService` 작성
   - `createPR(job)` 메서드
   - `gh pr create` 명령 실행
   - PR 제목/본문 자동 생성
   - 라벨 자동 부여 (`agent:{role}`, `auto-generated`)
2. job_queue.pr_number 업데이트

**예상 시간**: 2일

**체크리스트**:
- [ ] `PRService` 클래스 작성
- [ ] `createPR(job, worktree)` 메서드
- [ ] PR 제목 템플릿: `[{role}] {job.description}`
- [ ] PR 본문 템플릿 (파일 변경 목록 포함)
- [ ] `gh pr create` 실행 (execa)
- [ ] PR 번호 파싱 및 DB 저장
- [ ] 단위 테스트 (Mock gh CLI)

---

### Phase 2: 의존성 기반 머지 큐

**작업 내용**:
1. `MergeQueue` 작성
   - `getReadyToMerge(officeId)` - 머지 가능한 PR 조회
   - `calculateMergeOrder(jobs)` - 토폴로지 정렬
2. 의존성 확인 로직 (모든 선행 Job의 PR이 머지됨)

**예상 시간**: 2일

**체크리스트**:
- [ ] `MergeQueue` 클래스
- [ ] `getReadyToMerge()` - depends_on 확인
- [ ] `calculateMergeOrder()` - 병렬 머지 그룹 계산
- [ ] 토폴로지 정렬 알고리즘
- [ ] 순환 의존성 재확인

---

### Phase 3: PR 머지 로직

**작업 내용**:
1. `mergePR(prNumber, method)` 메서드
   - `gh pr merge` 실행 (squash/merge/rebase)
   - 머지 충돌 감지
   - 머지 실패 시 rebase 시도
2. 머지 완료 후 Job 상태 업데이트 (`done`)

**예상 시간**: 2일

**체크리스트**:
- [ ] `mergePR()` 메서드
- [ ] `gh pr merge` 실행
- [ ] 머지 방식 선택 (기본: squash)
- [ ] 충돌 감지 및 처리
- [ ] 자동 rebase 시도
- [ ] 머지 실패 시 알림 및 수동 해결 안내
- [ ] Job 상태 업데이트

---

### Phase 4: Worktree 자동 정리

**작업 내용**:
1. PR 머지 후 Worktree 정리
   - `removeWorktree(worktreeId)` 호출
   - 원격 브랜치 삭제 (선택적)
2. WorktreeManager 연동

**예상 시간**: 1일

**체크리스트**:
- [ ] 머지 완료 후 `WorktreeManager.remove()` 호출
- [ ] 원격 브랜치 삭제 옵션 (`--delete-branch`)
- [ ] Worktree DB 상태 업데이트
- [ ] 정리 실패 시 로깅

---

### Phase 5: API 엔드포인트

**작업 내용**:
1. PR 관리 API
   - `GET /api/offices/:id/prs` - PR 목록
   - `GET /api/offices/:id/prs/:prNumber` - PR 상태
   - `POST /api/offices/:id/jobs/:jobId/create-pr` - PR 생성
   - `POST /api/offices/:id/prs/:prNumber/merge` - PR 머지
   - `POST /api/offices/:id/prs/:prNumber/sync` - 브랜치 동기화
2. 머지 큐 API
   - `GET /api/offices/:id/merge-queue` - 머지 큐 상태
   - `POST /api/offices/:id/merge-queue/process` - 머지 큐 처리 트리거

**예상 시간**: 2일

**체크리스트**:
- [ ] PR CRUD API (5개 엔드포인트)
- [ ] 머지 큐 API (2개 엔드포인트)
- [ ] 요청 검증
- [ ] 에러 핸들링 (GitHub API 오류 매핑)

---

### Phase 6: 자동 머지 플로우

**작업 내용**:
1. Job 완료 시 자동 PR 생성
   - OutputMonitor에서 완료 감지 → `createPR()` 호출
2. 머지 큐 자동 처리
   - PR 생성 시 머지 큐 확인
   - 머지 가능 시 자동 머지
3. 후속 Job 활성화
   - 머지 완료 시 의존하는 Job의 상태 확인 → ready 전환

**예상 시간**: 2일

**체크리스트**:
- [ ] `onJobComplete()` 훅에 `createPR()` 추가
- [ ] `createPR()` 완료 시 `processMergeQueue()` 호출
- [ ] 머지 큐 처리 로직 (의존성 순서)
- [ ] 머지 완료 시 Job Scheduler에 알림
- [ ] 후속 Job 활성화

---

### Phase 7: 통합 테스트

**작업 내용**:
1. E2E 시나리오
   - Job 완료 → PR 생성 → 의존성 확인 → 순서대로 머지 → Worktree 정리
2. 충돌 케이스 테스트
3. 머지 실패 처리 테스트

**예상 시간**: 2일

**체크리스트**:
- [ ] `e2e/pr-workflow.spec.ts`
- [ ] 의존성 순서 머지 테스트
- [ ] 충돌 발생 시 자동 rebase 테스트
- [ ] 머지 실패 시 알림 테스트
- [ ] Worktree 자동 정리 검증

---

## 의존성

### 외부 라이브러리
- `gh`: GitHub CLI (시스템 설치 필요)
- `execa`: 명령 실행

### 내부 모듈
- **03-Worktree**: Worktree 정리
- **04-Session Execution**: 작업 완료 감지
- **08-Job Scheduler**: 후속 Job 활성화

---

## 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| PR 머지 충돌 | 높음 | 자동 rebase 시도, 실패 시 수동 해결 안내 |
| GitHub API Rate Limit | 중간 | 토큰 갱신, 백오프 전략 |
| 의존성 순서 오류 | 중간 | 토폴로지 정렬 검증, 순환 의존성 방지 |
| Worktree 정리 실패 | 낮음 | 로깅, 수동 정리 가이드 |

---

## 예상 결과물

- [ ] `PRService` (PR 생성/머지)
- [ ] `MergeQueue` (의존성 기반 머지 순서)
- [ ] PR API (7개 엔드포인트)
- [ ] 자동 PR 생성 훅
- [ ] 자동 머지 큐 처리
- [ ] Worktree 정리 통합
- [ ] 통합 테스트 스위트

---

## 다음 단계

✅ 05-PR Workflow 완료 후:
- **06-Realtime UI** 구현 (PR 상태 실시간 표시)
- **07-Agent Communication** 구현 (PR 관련 Agent 간 통신)

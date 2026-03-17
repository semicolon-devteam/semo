# 03-Worktree: 구현 계획

> Agent별 독립된 Git 작업 공간 생성 및 관리

---

## 요구사항 요약

- Git Worktree 생성/삭제
- Agent별 독립 브랜치 (`feature/{role}-{task-id}`)
- Worktree 경로: `/workspace/agent/{role}/`
- Branch 동기화 (main → worktree)
- Git author 자동 설정 (Agent 정보 기반)

---

## 영향 범위 분석

| 영역 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/office-server/src/api/worktrees/` | 신규 | Worktree API |
| `packages/office-server/src/services/worktree/` | 신규 | WorktreeManager, GitService |
| `packages/office-server/src/db/migrations/` | 수정 | worktrees 테이블 추가 |
| `/workspace/` | 신규 | Worktree 디렉토리 (파일 시스템) |

---

## 구현 단계

### Phase 1: Git 유틸리티 작성

**작업 내용**:
1. `GitService` 작성 (simple-git 래퍼)
   - `createWorktree(path, branch, baseBranch)`
   - `removeWorktree(path)`
   - `syncBranch(path, baseBranch, strategy)`
   - `configureAuthor(path, name, email)`
2. 에러 핸들링 (브랜치 존재, 충돌 등)

**예상 시간**: 2일

**체크리스트**:
- [ ] `GitService` 클래스 작성
- [ ] `simple-git` 패키지 설치
- [ ] `createWorktree()` 메서드 (브랜치 생성 + worktree add)
- [ ] `removeWorktree()` 메서드 (worktree remove + prune)
- [ ] `syncBranch()` 메서드 (rebase 또는 merge)
- [ ] `configureAuthor()` 메서드 (git config user.*)
- [ ] 단위 테스트 (Mock Git 레포)

---

### Phase 2: WorktreeManager 서비스

**작업 내용**:
1. `WorktreeManager` 작성
   - Worktree 생성 요청 처리
   - DB 상태 관리 (worktrees 테이블)
   - 경로 관리 (`/workspace/agent/{role}/`)
   - 브랜치명 규칙 (`feature/{role}-{task-id}`)
2. Agent와 Worktree 연결

**예상 시간**: 2일

**체크리스트**:
- [ ] `WorktreeManager` 클래스
- [ ] `create(officeId, agentRole, taskId)` 메서드
- [ ] `remove(worktreeId)` 메서드
- [ ] `sync(worktreeId, strategy)` 메서드
- [ ] DB INSERT/UPDATE/DELETE 로직
- [ ] Agent의 `worktree_id` 필드 업데이트
- [ ] 경로 생성 및 정리 (fs-extra)

---

### Phase 3: API 엔드포인트

**작업 내용**:
1. Worktree CRUD API
   - `GET /api/offices/:id/worktrees`
   - `POST /api/offices/:id/worktrees`
   - `DELETE /api/offices/:id/worktrees/:wtId`
   - `POST /api/offices/:id/worktrees/:wtId/sync`

**예상 시간**: 1일

**체크리스트**:
- [ ] Worktree 목록 API
- [ ] Worktree 생성 API (Body: `{ agent_role, task_id }`)
- [ ] Worktree 삭제 API
- [ ] Branch 동기화 API (Body: `{ strategy: 'rebase' | 'merge' }`)
- [ ] 요청 검증 (Zod)
- [ ] 에러 응답 (Git 오류 매핑)

---

### Phase 4: Worktree 자동 정리

**작업 내용**:
1. PR 머지 후 자동 정리 로직
   - PR Workflow에서 `removeWorktree()` 호출
2. 유휴 Worktree 감지 및 정리
   - 7일 이상 업데이트 없는 Worktree 자동 삭제

**예상 시간**: 1일

**체크리스트**:
- [ ] `cleanupWorktree(worktreeId)` 함수
- [ ] PR 머지 후크 연동 (05-PR Workflow와 통합)
- [ ] 유휴 Worktree 감지 크론 작업 (node-cron)
- [ ] 정리 전 알림 (선택적)

---

### Phase 5: 통합 테스트

**작업 내용**:
1. Worktree 생성/삭제 E2E
2. Branch 동기화 (충돌 케이스 포함)
3. Git author 설정 검증

**예상 시간**: 1일

**체크리스트**:
- [ ] `e2e/worktree-lifecycle.spec.ts`
- [ ] Worktree 생성 → 파일 수정 → 커밋 → 삭제 플로우
- [ ] Branch 동기화 (rebase/merge 테스트)
- [ ] 충돌 발생 시나리오 테스트
- [ ] Git author 검증 (`git log --format='%an %ae'`)

---

## 의존성

### 외부 라이브러리
- `simple-git`: Git 명령 래퍼
- `fs-extra`: 파일 시스템 유틸리티
- `node-cron`: 유휴 Worktree 정리 크론

### 내부 모듈
- **01-Core**: Agent, Office 조회

---

## 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| Worktree 경로 충돌 | 중간 | 고유 경로 생성 (agent role + UUID) |
| 디스크 공간 부족 | 중간 | 자동 정리 정책, 디스크 사용량 모니터링 |
| Git 충돌 (sync 시) | 높음 | rebase 시도 → 실패 시 알림, 수동 해결 안내 |
| Bare 레포 vs 일반 레포 | 낮음 | 일반 레포로 시작, 필요 시 bare 전환 |

---

## 예상 결과물

- [ ] `GitService` (Git 명령 래퍼)
- [ ] `WorktreeManager` 서비스
- [ ] Worktree API (4개 엔드포인트)
- [ ] DB 마이그레이션 (worktrees 테이블)
- [ ] 자동 정리 로직 (PR 머지 후, 유휴)
- [ ] 통합 테스트 스위트

---

## 다음 단계

✅ 03-Worktree 완료 후:
- **04-Session Execution** 구현 (Worktree 경로에서 세션 실행)
- **05-PR Workflow** 구현 (Worktree 브랜치에서 PR 생성)

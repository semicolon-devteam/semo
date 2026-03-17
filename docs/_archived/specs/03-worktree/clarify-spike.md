# 03-Worktree: Clarify & Spike

> Git Worktree 관리에 대한 불확실성 제거 및 기술 검증

---

## Clarify (명확화 필요 사항)

### 1. Worktree 생명주기

**질문**:
- Worktree 생성 실패 시 재시도 정책?
- Worktree 경로 충돌 시 처리 방법?
- Agent 삭제 시 Worktree 자동 정리?

**결정 필요**:
- Worktree 디스크 사용량 모니터링 여부
- 유휴 Worktree 정리 기준 (7일 미사용?)
- Worktree 백업 필요 여부

### 2. Branch 전략

**질문**:
- Branch 네이밍: `feature/{role}-{task-id}` vs 다른 규칙?
- Base branch: 항상 main? develop 옵션?
- Branch 삭제 시점: PR 머지 즉시? 일정 기간 후?

**결정 필요**:
- 원격 branch 푸시 시점 (생성 즉시? 첫 커밋 후?)
- Branch 보호 규칙 설정
- Hotfix 같은 특수 branch 처리

### 3. Git 동기화

**질문**:
- Base branch 업데이트 시 Worktree 자동 동기화?
- 동기화 전략: rebase vs merge?
- 동기화 충돌 시 자동 해결 vs 수동 해결?

**결정 필요**:
- 동기화 주기 (수동? 자동? 트리거?)
- 충돌 발생 시 Agent 상태 (blocked?)
- 동기화 실패 재시도 정책

### 4. Git Author 설정

**질문**:
- Agent 별 Git author email 형식? (agent-fe@semo.ai?)
- Committer vs Author 구분?
- GPG 서명 필요?

**결정 필요**:
- Agent commit 메시지 템플릿
- Co-author 표시 (Claude Code와 함께)
- Commit hook 실행 여부

---

## Spike (기술 검증 필요 사항)

### SPIKE-03-01: Git Worktree 디스크 사용량

**목적**: Worktree 여러 개 생성 시 디스크 사용량 측정

**실험 계획**:
1. 베이스 레포 크기 측정 (예: 500MB)
2. Worktree 8개 생성
3. 각 Worktree 디스크 사용량 측정
4. 공유 객체(.git/objects) 효율성 확인

**성공 기준**:
- Worktree 추가 사용량 < 베이스 레포의 20%
- 8개 Worktree 총 사용량 < 1GB

**예상 시간**: 1일

---

### SPIKE-03-02: Branch 동기화 충돌 처리

**목적**: Rebase vs Merge 충돌 해결 난이도 비교

**실험 계획**:
1. 2개 Worktree에서 같은 파일 수정
2. Base branch에 변경 푸시
3. Rebase 시도 → 충돌 해결
4. Merge 시도 → 충돌 해결
5. 자동 해결 가능성, 충돌 복잡도 비교

**성공 기준**:
- 자동 해결 가능한 충돌 비율 > 60%
- 충돌 해결 시간 < 5분 (수동)

**예상 시간**: 1일

---

### SPIKE-03-03: simple-git 성능 테스트

**목적**: simple-git 라이브러리 안정성 및 성능 검증

**실험 계획**:
1. Worktree 생성 10회 반복 (속도, 성공률)
2. 대용량 레포(1GB+)에서 테스트
3. 에러 핸들링 케이스 (권한 없음, 디스크 부족 등)
4. 동시 Git 작업 10개 (병렬)

**성공 기준**:
- Worktree 생성 시간 < 5초
- 성공률 > 99%
- 동시 작업 지원 (race condition 없음)

**예상 시간**: 1일

---

### SPIKE-03-04: Worktree 정리 자동화

**목적**: Stale worktree 자동 감지 및 정리 전략 검증

**실험 계획**:
1. 유휴 Worktree 감지 기준 정의 (last_commit_at, last_access_at)
2. 자동 정리 스크립트 작성
3. 정리 전 백업 필요 여부 판단
4. 정리 실패 케이스 처리

**성공 기준**:
- 유휴 Worktree 감지율 100%
- 정리 시간 < 30초/Worktree
- 데이터 손실 없음

**예상 시간**: 1일

---

## Decisions (결정 사항)

### ✅ 결정됨: Worktree 경로 구조

```
/workspace/
├── main/                    # 메인 레포 (Bare Repository)
└── agent/
    ├── po/
    │   └── {task-id}/       # Worktree: feature/po-{task-id}
    ├── fe/
    │   └── {task-id}/       # Worktree: feature/fe-{task-id}
    ├── be/
    │   └── {task-id}/
    └── qa/
        └── {task-id}/
```

### ✅ 결정됨: Branch 네이밍 규칙

```
feature/{role}-{task-id}

예시:
- feature/fe-task-001
- feature/be-task-002
- feature/qa-task-003
```

### ✅ 결정됨: 동기화 전략

- **자동 동기화**: PR 생성 전
- **방식**: Rebase (base branch → worktree branch)
- **충돌 시**: 자동 rebase 시도 → 실패 시 Agent "blocked" 상태 + 수동 해결 요청

### ✅ 결정됨: Git Author 설정

```bash
git config user.name "Agent {role} ({name})"
git config user.email "agent-{role}@semo.internal"

예시:
name: "Agent FE (김프론트)"
email: "agent-fe@semo.internal"
```

---

## Open Questions (미결정 사항)

| 질문 | 담당자 | 기한 |
|------|--------|------|
| Bare repository vs 일반 repo? | DevOps | SPIKE-03-01 후 |
| Worktree 백업 전략 필요? | Architect | Phase 4 계획 시 |
| GPG 서명 지원 여부 | Security | v0.2.0 |
| Commit hook 실행 정책 | Tech Lead | Phase 1 |

---

## Risk Mitigation (리스크 완화)

### 만약 SPIKE-03-02 실패 시 (충돌 해결 어려움)

**대안 1**: Merge 전략으로 전환
- Rebase 대신 Merge 사용
- Merge commit 히스토리 허용

**대안 2**: 파일별 잠금
- Agent가 작업할 파일을 사전 선언
- 동시 수정 방지

**대안 3**: 충돌 방지 설계
- Agent 역할별 파일 영역 명확히 분리
- FE: src/pages, src/components
- BE: src/api, src/services

---

## Next Steps

1. ✅ Clarify 문서 작성 완료
2. ⏳ SPIKE-03-01 실행 (디스크 사용량 검증)
3. ⏳ SPIKE-03-03 실행 (simple-git 성능)
4. ⏳ Worktree 경로 구조 디렉토리 생성 스크립트 작성
5. ⏳ Open Questions 답변 수집

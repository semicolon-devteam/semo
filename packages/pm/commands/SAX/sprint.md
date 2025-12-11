# /SAX:sprint - Sprint 관리 커맨드

> Iteration 기반 Sprint 관리를 위한 통합 커맨드

## 사용법

```bash
/SAX:sprint <action> [options]
```

## Iteration 구조

```yaml
주기: 1주 (7일)
시작: 월요일
명명: "{월} {주차}/{월 총주차}"  # 예: "12월 1/4"
```

> GitHub Projects의 Iteration은 자동 생성됩니다. Sprint는 해당 Iteration을 "활성화"하고 목표를 설정하는 개념입니다.

---

## Actions

### create - Sprint 활성화

```bash
/SAX:sprint create "12월 1/4" --goals "댓글 기능 완성, 알림 연동"
/SAX:sprint create current --goals "로그인 개선"
```

**파라미터**:

- `iteration_title`: Iteration 이름 (필수, 예: "12월 1/4")
- `--goals`: Sprint 목표 (쉼표 구분)

**동작**:

1. Iteration 존재 확인 (GraphQL)
2. Sprint Issue 생성 (docs 레포)
3. sprint-current 라벨 설정

---

### add - Task 할당

```bash
/SAX:sprint add #123 #124 #125 --to "12월 1/4"
/SAX:sprint add #123 --to current
```

**파라미터**:

- `task_numbers`: 할당할 Task 번호들
- `--to`: 대상 Iteration 이름 또는 "current"

**동작**:

1. Task의 Iteration 필드 설정 (GraphQL)
2. 용량 체크 및 경고
3. 과할당 시 알림

---

### status - Sprint 현황

```bash
/SAX:sprint status
/SAX:sprint status "12월 1/4"
```

**파라미터**:

- `iteration_title`: Iteration 이름 (선택, 기본: 현재 Iteration)

**동작**:

1. Iteration Task 현황 조회
2. 상태별 집계
3. 리포트 출력

---

### estimate - 작업량 설정

```bash
/SAX:sprint estimate #123 --point 3
/SAX:sprint estimate #123 #124 #125 --point 5
```

**파라미터**:

- `task_numbers`: 작업량을 설정할 Task 번호들
- `--point`: 작업량 (피보나치: 1, 2, 3, 5, 8, 13)

**동작**:

1. Task의 Projects Item ID 조회
2. 작업량 필드 값 설정
3. 13pt 이상 시 분할 권장 메시지

> 💡 Sprint 할당 없이 작업량만 독립적으로 설정할 때 사용

---

### start - 작업 시작

```bash
/SAX:sprint start #123
/SAX:sprint start #123 #124 #125
/SAX:sprint start #123 --iteration "12월 1/4"
```

**파라미터**:

- `task_numbers`: 작업을 시작할 Task 번호들
- `--iteration`: 특정 이터레이션 지정 (선택, 기본: current)

**동작**:

1. Task 상태 → '작업중' 변경
2. 시작일 → 오늘 날짜 설정
3. 이터레이션 → 현재(Current) 이터레이션 자동 할당

> 💡 Task 작업 시작 시 상태, 시작일, 이터레이션을 한 번에 설정

---

### close - Sprint 종료

```bash
/SAX:sprint close "12월 1/4"
/SAX:sprint close "12월 1/4" --carry-to "12월 2/4"
```

**파라미터**:

- `iteration_title`: Iteration 이름 (필수)
- `--carry-to`: 미완료 Task 이관 대상 Iteration

**동작**:

1. 완료/미완료 집계
2. Velocity 계산 (작업량 필드 기준)
3. 회고 생성
4. Sprint Issue 종료
5. 미완료 Task Iteration 이관

---

### sync - Iteration 일괄 동기화

```bash
/SAX:sprint sync                 # 실행
/SAX:sprint sync --dry-run       # 미리보기만
```

**파라미터**:

- `--dry-run`: 실제 업데이트 없이 변경 예정 목록만 출력 (선택)

**동작**:

1. 현재(Current) Iteration 조회 (오늘 날짜 기준)
2. 모든 OPEN 상태 이슈 조회
3. Iteration이 current가 아니거나 없는 이슈 필터링
4. 각 이슈의 Iteration → current로 업데이트
5. 결과 리포트 출력

**대상 이슈**:

- OPEN 상태인 이슈 중:
  - Iteration이 현재가 아닌 이슈 (과거 Iteration)
  - Iteration이 설정되지 않은 이슈

> 트리거: "iteration 업데이트", "이터레이션 업데이트", "iteration 동기화"

---

## 예시

### Sprint 전체 워크플로우

```bash
# 1. Sprint 활성화 (Iteration은 이미 존재)
/SAX:sprint create "12월 1/4" --goals "댓글 기능 완성"

# 2. 작업량 설정 (백로그 그루밍)
/SAX:sprint estimate #123 --point 3
/SAX:sprint estimate #124 #125 --point 5

# 3. Task 할당 (Iteration 필드 설정)
/SAX:sprint add #123 #124 #125 --to "12월 1/4"

# 4. 작업 시작 (상태+시작일+이터레이션 자동 설정)
/SAX:sprint start #123

# 5. 진행중 현황 확인
/SAX:sprint status

# 6. Sprint 종료 (미완료 이관)
/SAX:sprint close "12월 1/4" --carry-to "12월 2/4"
```

### Iteration 목록 확인

```bash
# 활성 Iteration 조회
/SAX:sprint list
```

---

## Routing

이 커맨드는 `sprint-master` Agent에게 위임됩니다.

```markdown
[SAX] Orchestrator: 의도 분석 완료 → Sprint 관리

[SAX] Agent 위임: sprint-master (사유: Sprint {action} 요청)
```

## 연관 Skills

- `create-sprint`: Sprint 활성화
- `set-estimate`: Task 작업량 설정
- `start-task`: Task 작업 시작 (상태+시작일+이터레이션)
- `assign-to-sprint`: Task Iteration 할당
- `close-sprint`: Sprint 종료 및 회고
- `sync-iteration`: Iteration 일괄 동기화

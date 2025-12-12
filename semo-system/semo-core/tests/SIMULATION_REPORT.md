# SEMO Orchestrator-First 시뮬레이션 리포트

> 생성일: 2025-12-12
> 버전: v2.0.2

---

## 1. 시뮬레이션 목적

SEMO가 설치된 환경에서 사용자 명령이 의도된 대로 동작하는지 검증:

1. **명령이 Orchestrator를 타는지**
2. **답변 생성 전 코어 핵심 규칙 컨텍스트를 고려하는지**
3. **요청이 적절한 에이전트나 스킬을 찾아가는지**

---

## 2. 발견된 문제점 (개선 전)

### 2.1 CLAUDE.md의 한계

| 문제 | 설명 |
|------|------|
| Orchestrator-First 미명시 | 참조 링크만 있고 강제 규칙 없음 |
| 처리 흐름 부재 | 사용자 메시지 → 응답 흐름이 정의되지 않음 |
| 라우팅 테이블 미포함 | 스킬별 키워드 매핑 정보 없음 |
| 메시지 규칙 미포함 | SEMO 메시지 출력 규칙이 직접 명시되지 않음 |

### 2.2 예상 실패 시나리오

```
사용자: "댓글 기능 구현해줘"

❌ 잘못된 동작 (개선 전):
Claude가 직접 코드 작성 시작
→ [SEMO] 메시지 없음
→ Orchestrator 분석 없음
→ 스킬 위임 없음
```

---

## 3. 개선 사항

### 3.1 CLAUDE.md 개선

`.claude/CLAUDE.md`에 다음 섹션 추가:

```markdown
## ⚠️ Orchestrator-First Policy (필수)

### 모든 사용자 메시지 처리 흐름
[처리 흐름 다이어그램 포함]

### 카테고리별 라우팅 테이블
[8개 카테고리 매핑 테이블 포함]

### SEMO 메시지 출력 규칙
[예시와 규칙 포함]
```

### 3.2 변경된 파일

| 파일 | 변경 내용 |
|------|----------|
| `.claude/CLAUDE.md` | Orchestrator-First Policy 섹션 추가 |

---

## 4. 시뮬레이션 케이스

### 4.1 Skill 라우팅 케이스

#### Case 1: 코드 구현 요청

```
입력: "댓글 기능 구현해줘"

기대 흐름:
1. [SEMO] Orchestrator: 의도 분석 완료 → 코드 구현 요청
2. [SEMO] Skill 위임: semo-skills/coder/implement (platform: {auto})
3. [SEMO] Skill: implement 사용

검증 포인트:
✅ Orchestrator 메시지가 첫 번째로 출력
✅ 플랫폼 자동 감지 수행
✅ coder 스킬로 라우팅
```

#### Case 2: 테스트 요청

```
입력: "유닛 테스트 작성해줘"

기대 흐름:
1. [SEMO] Orchestrator: 의도 분석 완료 → 테스트 요청
2. [SEMO] Skill 위임: semo-skills/tester/
3. [SEMO] Skill: tester 사용

검증 포인트:
✅ 테스트 카테고리로 정확히 분류
✅ tester 스킬로 라우팅
```

#### Case 3: 메모리 저장 요청

```
입력: "이 결정 사항 기억해줘: API는 JSON Envelope 패턴 사용"

기대 흐름:
1. [SEMO] Orchestrator: 의도 분석 완료 → 메모리 저장 요청
2. [SEMO] Skill 위임: semo-skills/memory/
3. [SEMO] Skill: memory 호출 - save

검증 포인트:
✅ memory 스킬로 라우팅
✅ save 액션 호출
```

#### Case 4: Slack 알림 요청

```
입력: "배포 완료 알림을 슬랙에 보내줘"

기대 흐름:
1. [SEMO] Orchestrator: 의도 분석 완료 → Slack 알림 요청
2. [SEMO] Skill 위임: semo-skills/notify-slack/
3. [SEMO] Skill: notify-slack 사용

검증 포인트:
✅ notify-slack 스킬로 라우팅
```

---

### 4.2 Agent 호출 케이스

#### Case 1: SEMO 구조 변경

```
입력: "Semicolon AX - 새 스킬 추가해줘"

기대 흐름:
1. [SEMO] Orchestrator: 의도 분석 완료 → SEMO 메타 작업
2. [SEMO] Agent: semo-architect 호출 - 스킬 추가
3. semo-architect Agent가 작업 수행

검증 포인트:
✅ "Semicolon AX" 키워드 트리거 인식
✅ semo-architect Agent로 위임
✅ Agent 메시지가 Orchestrator 이후 출력
```

#### Case 2: 복잡한 아키텍처 변경

```
입력: "전체 폴더 구조를 리팩토링해줘"

기대 흐름:
1. [SEMO] Orchestrator: 의도 분석 완료 → 아키텍처 변경 (복잡)
2. [SEMO] Agent: semo-architect 호출
3. Agent가 구조 분석 및 리팩토링 계획 수립

검증 포인트:
✅ 복잡한 작업은 Agent로 위임
✅ Orchestrator가 작업 복잡도 판단
```

---

### 4.3 예외 케이스

#### Case 1: 단순 질문 (Orchestrator 생략)

```
입력: "이 함수가 뭐하는 거야?"

기대 흐름:
- Orchestrator 생략 - 단순 질문으로 판단
- 직접 응답

검증 포인트:
✅ [SEMO] Skill 위임: 없음
✅ 직접 응답 제공
```

#### Case 2: 라우팅 실패

```
입력: "점심 뭐 먹을까?"

기대 흐름:
1. [SEMO] Orchestrator: 라우팅 실패 → 적절한 Skill 없음
2. 직접 처리 (Claude Code 기본 동작)

검증 포인트:
✅ 라우팅 실패 메시지 출력
✅ 폴백으로 직접 처리
```

---

## 5. 테스트 케이스 파일

생성된 테스트 케이스:

| 파일 | 설명 | 테스트 수 |
|------|------|----------|
| `orchestrator-first.json` | Orchestrator-First 정책 검증 | 10개 |
| `agent-routing.json` | Agent 호출 라우팅 검증 | 8개 |

### 실행 방법

```bash
# 모든 테스트 실행
./semo-system/semo-core/tests/run-tests.sh

# Orchestrator-First 테스트만
./semo-system/semo-core/tests/run-tests.sh orchestrator-first

# Agent 라우팅 테스트만
./semo-system/semo-core/tests/run-tests.sh agent-routing
```

---

## 6. 검증 체크리스트

### 6.1 Orchestrator-First 검증

- [ ] 모든 요청에 `[SEMO] Orchestrator:` 메시지 출력
- [ ] 의도 분석 결과 명시
- [ ] 적절한 카테고리 분류

### 6.2 라우팅 검증

- [ ] 코드 관련 → coder 스킬
- [ ] 테스트 관련 → tester 스킬
- [ ] 기획 관련 → planner 스킬
- [ ] 문서 관련 → writer 스킬
- [ ] 배포 관련 → deployer 스킬
- [ ] 메모리 관련 → memory 스킬
- [ ] Slack 관련 → notify-slack 스킬

### 6.3 메시지 포맷 검증

- [ ] `[SEMO]` 접두사 포함
- [ ] 각 메시지 별도 줄 출력
- [ ] 메시지 사이 빈 줄 삽입
- [ ] 본문 시작 전 빈 줄 삽입

---

## 7. 결론

### 개선 효과

| 항목 | 개선 전 | 개선 후 |
|------|---------|---------|
| Orchestrator 호출 | 불확실 | 필수 |
| 라우팅 정확도 | 낮음 | 높음 (테이블 기반) |
| 메시지 일관성 | 불규칙 | 규칙화 |
| 디버깅 용이성 | 낮음 | 높음 (메시지 추적) |

### 권장 사항

1. **정기 테스트 실행**: `run-tests.sh`로 회귀 방지
2. **CLAUDE.md 동기화**: SEMO 업데이트 시 CLAUDE.md도 업데이트
3. **새 스킬 추가 시**: 라우팅 테이블에 반드시 추가

---

*이 리포트는 SEMO v2.0.2 기준으로 작성되었습니다.*

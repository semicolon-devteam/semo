# SEMO Skill: Tester

> 테스트 작성, 실행, 검증을 담당하는 스킬 그룹

**위치**: `semo-skills/tester/`
**Layer**: Layer 1 (Capabilities)

---

## 개요

Tester는 모든 테스트/QA 관련 작업을 처리하는 스킬 그룹입니다.

> **참고**: Test **Engine** (`semo-core/tests/`)과 구분됩니다.
> - Engine: 테스트 실행기 (run-tests.sh)
> - Skill: AI가 테스트를 작성/분석하는 기능

---

## 하위 스킬

| 스킬 | 역할 | 설명 |
|------|------|------|
| **execute** | 테스트 실행 | 테스트 스위트 실행 및 결과 수집 |
| **report** | 리포트 생성 | 테스트 결과 분석 및 리포트 |
| **validate** | 검증 | 구현이 요구사항을 충족하는지 검증 |

---

## 사용 예시

### 테스트 작성 요청

```
사용자: 이 함수에 대한 테스트 작성해줘

[SEMO] Skill: tester/execute 호출

## 테스트 케이스

1. 정상 케이스
2. 엣지 케이스
3. 에러 케이스
...
```

### 테스트 실행 요청

```
사용자: 테스트 돌려줘

[SEMO] Skill: tester/execute 호출

## 테스트 결과

✅ 10 passed
❌ 2 failed
...
```

---

## 디렉토리 구조

```
semo-skills/tester/
├── SKILL.md              # 이 파일
├── execute/
│   └── SKILL.md          # 테스트 실행
├── report/
│   └── SKILL.md          # 리포트 생성
└── validate/
    └── SKILL.md          # 요구사항 검증
```

---

## 매핑 정보 (SAX → SEMO)

| 기존 패키지 | 기존 스킬 | 새 위치 |
|-------------|----------|---------|
| sax-qa | run-tests | tester/execute |
| sax-qa | generate-report | tester/report |
| sax-qa | validate-spec | tester/validate |

---

## Engine vs Skill 구분

| 항목 | Test Engine | Tester Skill |
|------|-------------|--------------|
| **위치** | semo-core/tests/ | semo-skills/tester/ |
| **역할** | 실행기 (Bash 스크립트) | AI 기능 (분석, 작성) |
| **호출 주체** | CI/CD, 개발자 | Orchestrator |
| **예시** | run-tests.sh | "테스트 작성해줘" |

---

## 참조

- [SEMO Principles](../../semo-core/principles/PRINCIPLES.md)
- [Test Engine](../../semo-core/tests/README.md)

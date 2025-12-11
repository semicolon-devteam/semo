# /SAX:progress - 진행도 조회 커맨드

> Iteration 진행 현황을 실시간으로 조회

## 사용법

```bash
/SAX:progress [options]
```

## Options

### 기본 (현재 Iteration)

```bash
/SAX:progress
```

현재 진행중인 Iteration의 진행도를 표시합니다.

---

### 특정 Iteration

```bash
/SAX:progress --iteration "12월 1/4"
```

지정한 Iteration의 진행도를 표시합니다.

---

### 인원별

```bash
/SAX:progress --member @kyago
/SAX:progress --member all
```

특정 담당자 또는 전체 인원의 진행도를 표시합니다.

---

### 상세 모드

```bash
/SAX:progress --verbose
```

Task 목록을 포함한 상세 리포트를 출력합니다.

---

## 출력 예시

### 기본 출력

```markdown
# 📊 12월 1/4 진행 현황

**기간**: 2025-12-01 ~ 2025-12-07
**진행률**: ████████░░ 78%

## 📈 상태별 현황

| 상태 | 개수 | 작업량 |
|------|------|--------|
| ✅ 완료 | 7 | 12pt |
| 🔄 진행중 | 3 | 5pt |
| ⏳ 대기 | 2 | 3pt |

## ⏱️ 남은 기간: D-3
```

### 인원별 출력

```markdown
# 👥 담당자별 현황

| 담당자 | 완료 | 진행중 | 대기 | 완료율 |
|--------|------|--------|------|--------|
| @kyago | 5pt | 2pt | 0pt | 71% |
| @Garden | 4pt | 2pt | 1pt | 57% |
| @Roki | 3pt | 2pt | 1pt | 50% |
```

---

## Routing

이 커맨드는 `progress-tracker` Agent에게 위임됩니다.

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 진행도 조회

[SAX] Agent 위임: progress-tracker (사유: 진행 현황 조회)
```

## 연관 Skills

- `generate-progress-report`: 진행도 리포트 생성
- `generate-member-report`: 인원별 리포트 생성

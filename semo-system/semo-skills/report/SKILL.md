---
name: report
description: |
  보고서 생성 (Sprint/의사결정/진행상황). Use when:
  (1) Sprint 리포트, (2) 의사결정 기록, (3) 진행 상황 보고.
tools: [Read, Write, Bash]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: report 호출 - {type}` 시스템 메시지를 첫 줄에 출력하세요.

# report Skill

> 보고서 생성 (Sprint, 의사결정, 진행상황)

## Report Types

| Type | 설명 | 트리거 |
|------|------|--------|
| **sprint** | Sprint 리포트 | "Sprint 리포트", "스프린트 현황" |
| **decision** | 의사결정 기록 | "의사결정 기록", "ADR" |
| **progress** | 진행 상황 보고 | "진행 상황", "상태 보고" |

---

## Type: sprint (Sprint 리포트)

### 템플릿

```markdown
# Sprint 리포트 - {iteration_title}

## 📊 요약
- **기간**: {start_date} ~ {end_date}
- **완료**: {done_count}/{total_count} Task
- **Velocity**: {velocity}pt

## ✅ 완료
- [x] Task #123: {제목}
- [x] Task #456: {제목}

## 🚧 진행 중
- [ ] Task #789: {제목}

## ⏸️ 미완료 (다음 Sprint 이관)
- [ ] Task #012: {제목}

## 📈 Metrics
- **완료율**: {완료율}%
- **Velocity**: {velocity}pt
- **평균 Task 크기**: {avg_size}pt

## 🎯 회고
### Good
- {잘된 점}

### Improve
- {개선할 점}

### Action
- {액션 아이템}
```

---

## Type: decision (의사결정 기록)

### ADR (Architecture Decision Record) 템플릿

```markdown
# ADR-{번호}: {제목}

**날짜**: {YYYY-MM-DD}
**상태**: 승인됨 | 제안됨 | 거부됨 | 대체됨
**결정자**: {이름들}

## Context (배경)
왜 이 결정이 필요했는가?

## Decision (결정)
무엇을 결정했는가?

## Consequences (결과)
### Positive
- {긍정적 영향}

### Negative
- {부정적 영향}

### Trade-offs
- {트레이드오프}

## Alternatives (대안)
고려했지만 선택하지 않은 방법들

## References
- [링크1](url)
```

---

## Type: progress (진행 상황 보고)

### 템플릿

```markdown
# 진행 상황 보고 - {날짜}

## 🎯 목표
- {목표1}
- {목표2}

## ✅ 완료
- {완료 항목1}
- {완료 항목2}

## 🚧 진행 중
- {진행 항목1} (70%)
- {진행 항목2} (40%)

## 🚨 이슈
- {이슈1} - 조치: {조치사항}

## 📅 다음 단계
- {다음 계획}
```

---

## 출력

```markdown
[SEMO] Skill: report 완료 (decision)

✅ 의사결정 기록 생성 완료

**파일**: docs/decisions/ADR-012-use-postgresql.md
**상태**: 승인됨
```

---

## Related

- `sprint` - Sprint 관리
- `meeting` - 미팅 기록
- `board` - 프로젝트 현황

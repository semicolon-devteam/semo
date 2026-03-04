---
name: spike
description: |
  기술 스파이크 및 아이디어 탐색. Use when:
  (1) 기술 검증 필요, (2) 접근 방법 탐색, (3) POC 실험.
tools: [Read, Write, Bash]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: spike 호출` 시스템 메시지를 첫 줄에 출력하세요.

# spike Skill

> 기술 스파이크 및 아이디어 탐색

## Purpose

불확실성이 높은 기술적 과제에 대해 짧은 시간 내에 실험 및 검증을 수행합니다.

---

## Workflow

```
1. 탐색 목표 정의
2. 접근 방법 브레인스토밍
3. 실험 수행
4. 결과 정리
5. 권장 방향 제시
```

---

## Spike 템플릿

```markdown
# Spike: {주제}

## 🎯 목표
- 검증하려는 가설
- 답을 찾아야 할 질문

## 🔍 접근 방법
1. 방법 A: {설명}
   - 장점: {pros}
   - 단점: {cons}
2. 방법 B: {설명}
   - 장점: {pros}
   - 단점: {cons}

## 🧪 실험

### 실험 1: {제목}
```bash
# 실험 코드
```

**결과**: {결과}

### 실험 2: {제목}
```bash
# 실험 코드
```

**결과**: {결과}

## 📊 결론
- **권장 방향**: {A/B/C}
- **근거**: {이유}
- **다음 단계**: {액션 아이템}

## 📚 References
- [링크1](url)
- [링크2](url)
```

---

## 출력

```markdown
[SEMO] Skill: spike 완료

✅ Spike 문서 생성 완료

**주제**: GraphQL vs REST
**접근 방법**: 3가지
**권장**: REST API (팀 경험 고려)
**문서**: docs/spike/graphql-vs-rest.md
```

---

## Related

- `spec` - 스펙 문서 작성
- `epic` - Epic 생성
- `implement` - 구현 시작

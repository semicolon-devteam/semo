---
name: report-bug
description: |
  서비스 레포에 버그 리포트 이슈카드 생성. Use when (1) 버그 발견 시 이슈 생성,
  (2) QA 테스트 중 버그 리포팅, (3) 브랜치 생성까지 원스톱 처리 필요.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: report-bug 호출` 시스템 메시지를 첫 줄에 출력하세요.

# report-bug Skill

> 서비스 레포에 버그 리포트 이슈카드를 생성하고 작업 브랜치까지 준비

## Purpose

버그 발견 시 서비스 레포에 태스크카드 형태의 이슈를 생성하고, 바로 작업할 수 있도록 브랜치명까지 제공합니다.

## When to Use

| 트리거 | 설명 |
|--------|------|
| `버그 리포트`, `버그 신고`, `버그 등록` | 버그 이슈 생성 요청 |
| `QA 버그`, `테스트 버그` | QA 과정 중 버그 리포팅 |
| `{서비스}에 버그 이슈 만들어줘` | 특정 서비스 레포 지정 |

## Quick Start

```bash
# 버그 이슈 생성
gh issue create \
  --repo semicolon-devteam/{service-repo} \
  --title "[Bug] {버그 제목}" \
  --body "$(cat <<'EOF'
{이슈 본문}
EOF
)" \
  --label "bug"
```

## Workflow

### Step 1: 정보 수집

```markdown
[SAX] Skill: report-bug 호출

## 🐛 버그 리포트 생성

다음 정보를 알려주세요:

1. **어떤 서비스에서 발생했나요?** (예: app-client, app-server)
2. **버그 요약** (제목으로 사용됨)
3. **재현 단계** (어떻게 하면 버그가 발생하나요?)
4. **기대 동작** (원래 어떻게 동작해야 하나요?)
5. **실제 동작** (현재 어떻게 동작하나요?)
6. **심각도** (critical/high/medium/low)

자유롭게 설명해주시면 정리해드릴게요.
```

### Step 2: 이슈 생성

```bash
gh issue create \
  --repo semicolon-devteam/{service-repo} \
  --title "[Bug] {버그 요약}" \
  --body "$(cat <<'EOF'
## 🐛 버그 리포트

### 요약
{버그 요약 설명}

### 재현 단계
1. {단계 1}
2. {단계 2}
3. {단계 3}

### 기대 동작
{원래 동작해야 하는 방식}

### 실제 동작
{현재 동작하는 방식}

### 심각도
- [x] {severity}

### 환경
- 발생 위치: {위치}
- 관련 기능: {기능}

## ✅ Acceptance Criteria
- [ ] {완료 조건 1}
- [ ] {완료 조건 2}

## 🧪 QA 테스트 요구사항
- [ ] {사용자 시나리오 테스트 1}
- [ ] {사용자 시나리오 테스트 2}

## 🌿 Branch

`fix/{issue-number}-{slug}`

---
🤖 SAX report-bug Skill로 자동 생성됨
EOF
)" \
  --label "bug"
```

### Step 3: 완료 메시지

```markdown
[SAX] Bug Report: 이슈 생성 완료

✅ 버그 리포트가 등록되었습니다!

**이슈**: semicolon-devteam/{service-repo}#{이슈번호}
**제목**: [Bug] {버그 제목}
**심각도**: {severity}

## 🌿 작업 브랜치

브랜치를 생성하려면:

\`\`\`bash
git checkout -b fix/{이슈번호}-{slug}
\`\`\`

바로 작업을 시작하시겠어요?
```

## Issue Template

```markdown
## 🐛 버그 리포트

### 요약
{버그에 대한 간단한 설명}

### 재현 단계
1. {환경/페이지로 이동}
2. {특정 동작 수행}
3. {버그 발생}

### 기대 동작
{정상적으로 동작해야 하는 방식}

### 실제 동작
{현재 발생하는 문제}

### 심각도
- [ ] Critical - 서비스 불가
- [ ] High - 주요 기능 장애
- [ ] Medium - 기능 일부 문제
- [ ] Low - 사소한 이슈

### 환경
- 발생 위치: {페이지/API 경로}
- 관련 기능: {기능명}
- 스크린샷: {있다면 첨부}

## ✅ Acceptance Criteria
- [ ] {완료 조건 1 - 버그 수정 후 기대 동작}
- [ ] {완료 조건 2 - 추가 확인 사항}

## 🧪 QA 테스트 요구사항
- [ ] {사용자 시나리오 테스트 1 - 재현 단계 검증}
- [ ] {사용자 시나리오 테스트 2 - 엣지 케이스}
- [ ] {회귀 테스트 - 관련 기능 정상 동작}

## 🌿 Branch

`fix/{issue-number}-{slug}`

---
🤖 SAX report-bug Skill로 자동 생성됨
```

## SAX Message Format

```markdown
[SAX] Skill: report-bug 사용

[SAX] Bug Report: {repo}#{number} 생성 완료 → fix/{number}-{slug}
```

## Related

- [feedback Skill](../feedback/SKILL.md) - SAX 패키지 피드백
- [create-design-task Skill](../create-design-task/SKILL.md) - 태스크카드 생성 참고

## References

- [Issue Template](references/issue-template.md) - 버그 리포트 템플릿 상세
- [Severity Guide](references/severity-guide.md) - 심각도 기준

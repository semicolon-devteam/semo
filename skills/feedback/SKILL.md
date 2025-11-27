---
name: feedback
description: SAX-PO 패키지 피드백 수집 및 GitHub 이슈 생성. Use when (1) /SAX:feedback 명령어 호출, (2) 사용자가 SAX 동작 오류 지적, (3) 개선 제안 요청.
tools: [Bash, Read]
model: inherit
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: feedback 호출 - {피드백 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# feedback Skill

> SAX-PO 패키지에 대한 사용자 피드백을 GitHub 이슈로 생성
>
> **SoT 참조**: 피드백 프로세스는 `sax-meta`에서 관리됩니다. 메시지 포맷은 `sax-core/MESSAGE_RULES.md` 참조.

## When to Use (Orchestrator → Skill 호출 조건)

이 Skill은 Orchestrator에서 **자동으로 호출**됩니다:

| 감지 키워드 | 호출 조건 |
|-------------|-----------|
| `/SAX:feedback` | 명시적 피드백 명령 |
| `피드백`, `피드백해줘`, `버그 신고`, `제안할게` | 피드백 의도 표현 |
| `SAX가 왜`, `SAX 동작이`, `[SAX] 메시지가`, `SAX 결과가` | SAX 동작 오류 지적 |

**호출 흐름**:

```text
User → Orchestrator (의도 분석) → skill:feedback 라우팅 → feedback Skill 실행
```

**애매한 경우 확인 질문**:

SAX와 무관한 오류 지적일 수 있는 경우, Orchestrator가 먼저 확인합니다:

```markdown
[SAX] Orchestrator: 의도 확인 필요

⚠️ SAX 관련 피드백인가요?

- **예**: SAX Agent/Skill/Command의 동작 문제
- **아니오**: 일반 코드나 프로젝트 문제

"SAX 피드백이야" 또는 "아니야"로 응답해주세요.
```

## Purpose

SAX-PO 패키지 사용 중 발생한 버그 또는 개선 제안을 GitHub 이슈로 생성하여 협업 매니저(Reus)에게 전달합니다.

## Triggers

### 1. 명시적 트리거

- `/SAX:feedback` 명령어 호출

### 2. 암시적 트리거 (문제 해결 후)

사용자가 SAX 기반 에이전트 동작에 대해 의문을 제기하거나 지적할 때:

- "이건 이렇게 돼야 하는데 왜 이렇게 만들었어?"
- "이거 왜 이렇게 동작해?"
- "예상한 결과가 아닌데?"
- "의도한 대로 안 되네"

**암시적 트리거 시 프로세스**:
1. 문제 해결 먼저 수행
2. 해결 후 피드백 제안:

```markdown
[SAX] 문제 해결 완료

**원인**: {문제 원인 설명}

⚠️ 사용자가 의도하지 않은 동작이 발생했습니다.
협업 매니저 Reus를 위해 이 이슈를 피드백할까요?

> "피드백해줘" 또는 "괜찮아"로 응답해주세요.
```

## Feedback Types

| 유형 | 설명 | 라벨 |
|------|------|------|
| 버그 | 의도한 대로 동작하지 않음 | `bug`, `sax-po` |
| 제안 | 개선 아이디어, 새 기능 요청 | `enhancement`, `sax-po` |

## Quick Start

```bash
# GitHub 이슈 생성
gh issue create \
  --repo semicolon-devteam/sax-po \
  --title "[Feedback] {제목}" \
  --body "{본문}" \
  --label "{라벨}"
```

## Issue Template

### 버그 리포트

```markdown
## 버그 리포트

### 질문/프롬프트
{사용자가 입력한 질문 또는 명령}

### 실제 결과
{실제로 발생한 동작}

### 기대 결과
{사용자가 원했던 동작}

### 재현 단계
1. {단계 1}
2. {단계 2}
3. ...

### 환경
- SAX-PO 버전: {버전}
- 관련 Agent/Skill: {이름}

---
🤖 SAX Feedback Skill로 자동 생성됨
```

### 제안

```markdown
## 개선 제안

### 제안 내용
{개선 아이디어 설명}

### 현재 동작
{현재 어떻게 동작하는지}

### 제안 동작
{어떻게 개선되면 좋을지}

### 추가 컨텍스트
{추가 설명}

---
🤖 SAX Feedback Skill로 자동 생성됨
```

## Workflow

### Step 1: 피드백 유형 확인

```markdown
[SAX] Skill: feedback 호출

## 📝 SAX 피드백

어떤 유형의 피드백인가요?

1. **🐛 버그**: 의도한 대로 동작하지 않았어요
2. **💡 제안**: 개선 아이디어가 있어요

번호를 선택하거나 자유롭게 설명해주세요.
```

### Step 2: 정보 수집

**버그인 경우**:
```markdown
## 🐛 버그 리포트

다음 정보를 알려주세요:

1. **어떤 명령/질문을 했나요?**
2. **어떤 결과가 나왔나요?**
3. **어떤 결과를 원했나요?**

자유롭게 설명해주시면 제가 정리해드릴게요.
```

**제안인 경우**:
```markdown
## 💡 개선 제안

어떤 개선을 원하시나요?

자유롭게 설명해주시면 제가 정리해드릴게요.
```

### Step 3: 이슈 생성

```bash
# 버그 이슈 생성
gh issue create \
  --repo semicolon-devteam/sax-po \
  --title "[Bug] {요약된 제목}" \
  --body "$(cat <<'EOF'
## 버그 리포트

### 질문/프롬프트
{사용자 입력}

### 실제 결과
{실제 동작}

### 기대 결과
{원하는 동작}

---
🤖 SAX Feedback Skill로 자동 생성됨
EOF
)" \
  --label "bug,sax-po"
```

### Step 4: 완료 메시지

```markdown
[SAX] Feedback: 이슈 생성 완료

✅ 피드백이 등록되었습니다!

**이슈**: semicolon-devteam/sax-po#{이슈번호}
**제목**: {이슈 제목}
**유형**: {버그/제안}

협업 매니저 Reus가 검토 후 처리할 예정입니다.
감사합니다! 🙏
```

## SAX Message Format

```markdown
[SAX] Skill: feedback 사용

[SAX] Feedback: {package} 이슈 #{number} 생성 완료
```

## References

For detailed documentation, see:

- [Issue Templates](references/issue-templates.md) - 버그/제안 이슈 템플릿 상세
- [Trigger Detection](references/trigger-detection.md) - 암시적 트리거 감지 패턴
- [Output Format](references/output-format.md) - 출력 형식 및 메시지 템플릿

# Command Template

> command-manager Agent의 커맨드 파일 템플릿

## 커맨드 파일 구조

```markdown
# Command Title

> 1줄 요약 설명

## Purpose

커맨드의 목적과 역할을 명확히 설명합니다.

## Usage

\`\`\`bash
/SEMO:command-name
\`\`\`

커맨드 실행 방법 및 옵션 설명

## Workflow

1. **Step 1**: 첫 번째 단계
   - 상세 설명
   - 예상 소요 시간

2. **Step 2**: 두 번째 단계
   - Agent/Skill 호출
   - 사용자 입력 처리

3. **Step 3**: 완료 단계
   - 결과 출력
   - 후속 작업 안내

## Examples

### Example 1: Basic Usage

\`\`\`
사용자: /SEMO:command-name
Claude: [워크플로우 실행...]
결과: [출력 내용]
\`\`\`

### Example 2: Advanced Usage

\`\`\`
[고급 사용 예제]
\`\`\`

## Related

- [Related Agent](../agents/agent-name.md)
- [Related Skill](../skills/skill-name/SKILL.md)
```

## 파일 위치 규칙

### SEMO-PO 커맨드

```
sax/packages/semo-po/commands/SEMO/{command-name}.md
```

**예시**:
- `commands/SEMO/onboarding.md` → `/SEMO:onboarding`
- `commands/SEMO/health-check.md` → `/SEMO:health-check`
- `commands/SEMO/help.md` → `/SEMO:help`

### SEMO-Meta 커맨드

```
sax/packages/semo-meta/commands/SEMO/{command-name}.md
```

## 네이밍 규칙

### ✅ 올바른 파일명

| 파일명 | 호출 형식 | 설명 |
|--------|-----------|------|
| `onboarding.md` | `/SEMO:onboarding` | 단순 단어 |
| `health-check.md` | `/SEMO:health-check` | kebab-case |
| `task-progress.md` | `/SEMO:task-progress` | kebab-case |

### ❌ 잘못된 파일명

| 파일명 | 결과 | 이유 |
|--------|------|------|
| `:onboarding.md` | `/SEMO::onboarding` | 이중 콜론 발생 |
| `SAX:onboarding.md` | `/SEMO:SAX:onboarding` | 중복 프리픽스 |
| `OnBoarding.md` | `/SEMO:OnBoarding` | PascalCase 지양 |

## 섹션별 가이드

### Purpose 섹션

**필수 포함 내용**:
- 커맨드의 핵심 기능
- 대상 사용자 (PO/기획자/개발자)
- 기대 결과물

**예시**:
```markdown
## Purpose

이 커맨드는 **신규 PO/기획자**를 Semicolon 팀의 개발 워크플로우에 온보딩합니다.

- **대상**: PO, 기획자, 신규 팀원
- **결과**: 팀 규칙 이해, 도구 설정 완료, 첫 Epic 생성 가능
```

### Workflow 섹션

**작성 원칙**:
- 단계별로 명확하게 구분
- 각 단계의 소요 시간 명시 (선택)
- Agent/Skill 호출 시점 명시
- 사용자 입력 필요 시점 명시

**예시**:
```markdown
## Workflow

1. **환영 메시지 출력**
   - SEMO 시스템 소개
   - 예상 소요 시간: 5분

2. **팀 규칙 학습**
   - Team Codex Wiki 참조
   - 핵심 규칙 5가지 설명
   - 사용자 확인 요청

3. **도구 설정 확인**
   - `health-check` Skill 호출
   - 설정 상태 리포트

4. **첫 작업 안내**
   - `/epic-draft` 커맨드 소개
   - 다음 단계 가이드
```

### Examples 섹션

**필수 포함**:
- Basic Usage (기본 사용법)
- 사용자-Claude 대화 형식

**선택 포함**:
- Advanced Usage (고급 사용법)
- Edge Cases (예외 상황)

**예시**:
```markdown
## Examples

### Example 1: Basic Usage

\`\`\`
사용자: /SEMO:onboarding

Claude: [SEMO] Agent: onboarding-master 호출

👋 Semicolon 팀에 오신 것을 환영합니다!

온보딩을 시작하기 전에 몇 가지 질문드릴게요:
1. 어떤 역할로 참여하시나요? (PO / 기획자 / 개발자)
...

사용자: PO입니다

Claude: 좋아요! PO로 온보딩을 진행하겠습니다.
[워크플로우 계속...]
\`\`\`
```

### Related 섹션

**포함 항목**:
- 관련 Agent 링크
- 관련 Skill 링크
- 외부 문서 링크 (Team Codex, Wiki 등)

**예시**:
```markdown
## Related

- [onboarding-master Agent](../agents/onboarding-master.md)
- [health-check Skill](../skills/health-check/SKILL.md)
- [Team Codex](https://github.com/semicolon-devteam/docs/wiki/Team-Codex)
```

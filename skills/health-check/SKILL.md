---
name: health-check
description: Validate development environment and authentication status. Use when (1) new team member onboarding (triggered by /SAX:health-check), (2) orchestrator auto-runs at work start (if 30 days passed), (3) checking required tools (gh CLI, Git, Node, pnpm, Supabase), (4) verifying GitHub auth and repo access.
tools: [Bash, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: health-check 호출 - 환경 검증` 시스템 메시지를 첫 줄에 출력하세요.

# health-check Skill

> 개발 환경 및 인증 상태 자동 검증

## 역할

신규/기존 팀원의 개발 환경을 자동으로 검증하여 SAX 사용 준비 상태를 확인합니다.

## 트리거

- `/SAX:health-check` 명령어
- "환경 확인", "도구 확인", "설치 확인" 키워드
- onboarding-master Agent에서 자동 호출
- orchestrator가 업무 시작 시 자동 실행 (30일 경과 시)

## Quick Start

```bash
# 필수 도구 설치 확인
gh --version && git --version && node --version && pnpm --version && supabase --version

# GitHub 인증 상태 확인
gh auth status

# Organization 멤버십 확인
gh api user/orgs --jq '.[].login' | grep semicolon-devteam

# SAX 메타데이터 확인
cat ~/.claude.json | jq '.SAX'

# SAX 패키지 설치 상태 확인
ls -la .claude/sax-po/ 2>/dev/null && echo "✅ sax-po 설치됨"
ls -la .claude/sax-core/ 2>/dev/null && echo "✅ sax-core 설치됨"

# 심링크 상태 확인
ls -la .claude/CLAUDE.md
ls -la .claude/agents
ls -la .claude/skills
ls -la .claude/SAX/commands
```

**기대 결과**:

- ✅ 모든 필수 도구 설치됨
- ✅ GitHub 인증 완료
- ✅ semicolon-devteam 멤버십 확인
- ✅ SAX 메타데이터 존재
- ✅ SAX 패키지 설치됨 (sax-core, sax-po)
- ✅ 심링크 정상 연결됨

## Advanced Usage

상세한 검증 항목과 워크플로우는 다음을 참조하세요:

- **[Validation Items](references/validation-items.md)** - 5가지 검증 카테고리 (도구, 인증, Slack, claude.json, 패키지 설치)
- **[Output Formats](references/output-formats.md)** - 성공/실패 시 출력 예제
- **[Workflow](references/workflow.md)** - 실행 흐름 및 재검증 정책

## 패키지 이상 발견 시

심링크 오류 또는 패키지 미설치 감지 시:

```markdown
[SAX] health-check: ⚠️ 패키지 설치 이상 감지

**문제**:
- ❌ 심링크 연결 오류: .claude/CLAUDE.md
- ❌ sax-po 패키지 미설치

**해결**:
`SAX 업데이트해줘`를 실행하여 패키지를 설치/심링크를 재설정하세요.
```

## SAX Message

```markdown
[SAX] Skill: health-check 사용

[SAX] Reference: 개발 환경 검증 (도구/인증/조직) 완료
```

## Related

- [SAX Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/docs/blob/main/sax/core/MESSAGE_RULES.md)
- [Claude Code Settings](https://code.claude.com/docs/en/settings)
- [onboarding-master Agent](../../agents/onboarding-master.md)

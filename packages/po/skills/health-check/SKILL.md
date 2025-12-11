---
name: health-check
description: Validate development environment and authentication status. Use when (1) new team member onboarding (triggered by /SEMO:health-check), (2) orchestrator auto-runs at work start (if 30 days passed), (3) checking required tools (gh CLI, Git, Node, pnpm, Supabase), (4) verifying GitHub auth and repo access.
tools: [Bash, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: health-check 호출 - 환경 검증` 시스템 메시지를 첫 줄에 출력하세요.

# health-check Skill

> 개발 환경 및 인증 상태 자동 검증

## 역할

신규/기존 팀원의 개발 환경을 자동으로 검증하여 SEMO 사용 준비 상태를 확인합니다.

## 트리거

- `/SEMO:health-check` 명령어
- "환경 확인", "도구 확인", "설치 확인" 키워드
- onboarding-master Agent에서 자동 호출
- orchestrator가 업무 시작 시 자동 실행 (30일 경과 시)

## Quick Start

```bash
# 필수 도구 설치 확인
gh --version && git --version && node --version && pnpm --version && supabase --version

# GitHub 인증 상태 확인
gh auth status

# GitHub Projects 권한 확인 (SEMO-PO 필수)
gh auth status 2>&1 | grep -q 'project' && echo "✅ project 스코프 있음" || echo "❌ project 스코프 없음 - gh auth refresh -s project 실행 필요"

# Organization 멤버십 확인
gh api user/orgs --jq '.[].login' | grep semicolon-devteam

# SEMO 메타데이터 확인 및 검증
cat ~/.claude.json | jq '.SEMO'

# 필수 필드 검증
REQUIRED_FIELDS=("role" "position" "boarded" "boardedAt" "healthCheckPassed" "lastHealthCheck")
for field in "${REQUIRED_FIELDS[@]}"; do
  cat ~/.claude.json | jq -e ".SEMO.$field" >/dev/null 2>&1 || echo "❌ 필수 필드 누락: $field"
done

# SEMO 패키지 설치 상태 확인
ls -la .claude/semo-po/ 2>/dev/null && echo "✅ semo-po 설치됨"
ls -la .claude/semo-core/ 2>/dev/null && echo "✅ semo-core 설치됨"

# 심링크 상태 확인
ls -la .claude/CLAUDE.md
ls -la .claude/agents
ls -la .claude/skills
ls -la .claude/SEMO/commands
```

**기대 결과**:

- ✅ 모든 필수 도구 설치됨
- ✅ GitHub 인증 완료
- ✅ GitHub Projects 권한 확인 (project 스코프)
- ✅ semicolon-devteam 멤버십 확인
- ✅ SEMO 메타데이터 존재
- ✅ SEMO 패키지 설치됨 (semo-core, semo-po)
- ✅ 심링크 정상 연결됨

## Advanced Usage

상세한 검증 항목과 워크플로우는 다음을 참조하세요:

- **[Validation Items](references/validation-items.md)** - 5가지 검증 카테고리 (도구, 인증, Slack, claude.json, 패키지 설치)
- **[Output Formats](references/output-formats.md)** - 성공/실패 시 출력 예제
- **[Workflow](references/workflow.md)** - 실행 흐름 및 재검증 정책

## SEMO 메타데이터 검증

> **참조**: [SEMO Core Metadata Schema](https://github.com/semicolon-devteam/semo-core/blob/main/_shared/metadata-schema.md)

**필수 필드**: `role`, `position`, `boarded`, `boardedAt`, `healthCheckPassed`, `lastHealthCheck`

**검증 스크립트**:
```bash
# SEMO 필드 존재 확인
cat ~/.claude.json | jq -e '.SEMO' >/dev/null 2>&1 || echo "❌ SEMO 메타데이터 없음"

# 필수 필드 검증
REQUIRED_FIELDS=("role" "position" "boarded" "boardedAt" "healthCheckPassed" "lastHealthCheck")
for field in "${REQUIRED_FIELDS[@]}"; do
  cat ~/.claude.json | jq -e ".SEMO.$field" >/dev/null 2>&1 || echo "❌ 필수 필드 누락: $field"
done

# position 값 검증 (po)
POSITION=$(cat ~/.claude.json | jq -r '.SEMO.position')
if [ "$POSITION" != "po" ]; then
  echo "❌ position 값이 'po'가 아님: $POSITION"
fi
```

**검증 성공 시**:
```markdown
✅ SEMO 메타데이터: 정상
  - role: fulltime
  - position: po
  - boarded: true
  - boardedAt: 2025-12-09T10:30:00Z
  - healthCheckPassed: true
  - lastHealthCheck: 2025-12-09T10:30:00Z
```

**검증 실패 시**:
```markdown
❌ SEMO 메타데이터: 오류 발견

**문제**:
- ❌ 필수 필드 누락: lastHealthCheck
- ❌ 잘못된 position 값: product (올바른 값: po)

**해결**:
온보딩 프로세스를 완료하거나 `/SEMO:onboarding`을 실행하세요.
```

## 패키지 이상 발견 시

심링크 오류 또는 패키지 미설치 감지 시:

```markdown
[SEMO] health-check: ⚠️ 패키지 설치 이상 감지

**문제**:
- ❌ 심링크 연결 오류: .claude/CLAUDE.md
- ❌ semo-po 패키지 미설치

**해결**:
`SEMO 업데이트해줘`를 실행하여 패키지를 설치/심링크를 재설정하세요.
```

## SEMO Message

```markdown
[SEMO] Skill: health-check 사용

[SEMO] Reference: 개발 환경 검증 (도구/인증/조직) 완료
```

## Related

- [SEMO Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/docs/blob/main/sax/core/MESSAGE_RULES.md)
- [Claude Code Settings](https://code.claude.com/docs/en/settings)
- [onboarding-master Agent](../../agents/onboarding-master.md)

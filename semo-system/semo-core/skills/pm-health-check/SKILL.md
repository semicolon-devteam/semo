---
name: health-check
description: Validate PM environment and authentication status. Use when (1) new PM onboarding, (2) checking required tools (gh CLI, Git, GitHub Projects access), (3) verifying GitHub auth and project permissions, (4) orchestrator auto-runs at work start.
tools: [Bash, Read, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: health-check 호출 - PM 환경 검증` 시스템 메시지를 첫 줄에 출력하세요.

# health-check Skill

> PM 환경 및 인증 상태 자동 검증

## 역할

신규/기존 PM의 개발 환경을 자동으로 검증하여 SEMO 사용 준비 상태를 확인합니다.

## 트리거

- `/SEMO:health-check` 명령어
- "환경 확인", "도구 확인", "설치 확인" 키워드
- onboarding-master Agent에서 자동 호출
- orchestrator가 업무 시작 시 자동 실행 (30일 경과 시)

## Quick Start

```bash
# 필수 도구 설치 확인
gh --version && git --version && node --version

# GitHub 인증 상태 확인
gh auth status

# GitHub Projects 권한 확인 (PM 필수)
gh auth status 2>&1 | grep -q 'project' && echo "✅ project 스코프 있음" || echo "❌ project 스코프 없음 - gh auth refresh -s project 실행 필요"

# Organization 멤버십 확인
gh api user/orgs --jq '.[].login' | grep semicolon-devteam

# docs 레포 접근 확인
gh api repos/semicolon-devteam/docs/contents/README.md >/dev/null 2>&1 && echo "✅ docs 접근 가능"

# SEMO 메타데이터 확인
cat ~/.claude.json | jq '.SEMO'

# SEMO 패키지 설치 상태 확인
ls -la .claude/semo-pm/ 2>/dev/null && echo "✅ semo-pm 설치됨"
ls -la .claude/semo-core/ 2>/dev/null && echo "✅ semo-core 설치됨"

# 심링크 상태 확인
ls -la .claude/CLAUDE.md
ls -la .claude/agents
ls -la .claude/skills
ls -la .claude/commands/SEMO
```

## 검증 항목 요약

### 필수 도구

| 도구 | 명령어 | 최소 버전 | PM 용도 |
|------|--------|----------|---------|
| GitHub CLI | `gh --version` | - | 이슈/프로젝트 관리 |
| Git | `git --version` | - | 버전 관리 |
| Node.js | `node --version` | v18.0.0 | 스크립트 실행 |

### 인증 및 권한

| 항목 | 명령어 | 중요도 |
|------|--------|--------|
| GitHub 인증 | `gh auth status` | 필수 |
| **GitHub Projects 권한** | `gh auth status \| grep project` | **🔴 필수** |
| Organization | `gh api user/orgs --jq '.[].login' \| grep semicolon-devteam` | 필수 |
| docs 접근 | `gh api repos/semicolon-devteam/docs/contents/README.md` | 필수 |

### GitHub Projects 권한 설정

PM은 GitHub Projects 접근 권한이 **필수**입니다:

```bash
# project 스코ープ가 없는 경우
gh auth refresh -s project

# 재인증 후 확인
gh auth status 2>&1 | grep 'project'
```

### 글로벌 MCP 서버 설정 (~/.claude.json)

| 항목 | 필수 | 설명 |
|------|------|------|
| mcpServers 필드 | ✅ | `~/.claude.json`에 mcpServers 존재 |
| context7 | ✅ | 라이브러리 문서 조회 |
| sequential-thinking | ✅ | 구조적 사고 분석 |

### SEMO 메타데이터

- 파일: `~/.claude.json`
- 필수 필드: `SEMO.role`, `SEMO.position`, `SEMO.boarded`, `SEMO.boardedAt`, `SEMO.healthCheckPassed`, `SEMO.lastHealthCheck`
- PM 전용 필드: `SEMO.packageSpecific.githubProjectsAuth`

**검증 스크립트**:
```bash
# SEMO 필드 존재 확인
cat ~/.claude.json | jq -e '.SEMO' >/dev/null 2>&1 || echo "❌ SEMO 메타데이터 없음"

# 필수 필드 검증
REQUIRED_FIELDS=("role" "position" "boarded" "boardedAt" "healthCheckPassed" "lastHealthCheck")
for field in "${REQUIRED_FIELDS[@]}"; do
  cat ~/.claude.json | jq -e ".SEMO.$field" >/dev/null 2>&1 || echo "❌ 필수 필드 누락: $field"
done

# position 값 검증 (pm)
POSITION=$(cat ~/.claude.json | jq -r '.SEMO.position')
if [ "$POSITION" != "pm" ]; then
  echo "❌ position 값이 'pm'이 아님: $POSITION"
fi

# PM 전용 필드 검증
GITHUB_PROJECTS_AUTH=$(cat ~/.claude.json | jq -r '.SEMO.packageSpecific.githubProjectsAuth')
if [ "$GITHUB_PROJECTS_AUTH" != "true" ]; then
  echo "⚠️ GitHub Projects 권한 미설정 (project 스코프 필요)"
fi
```

**검증 성공 시**:
```markdown
✅ SEMO 메타데이터: 정상
  - role: fulltime
  - position: pm
  - boarded: true
  - boardedAt: 2025-12-09T10:30:00Z
  - healthCheckPassed: true
  - lastHealthCheck: 2025-12-09T10:30:00Z
  - packageSpecific.githubProjectsAuth: true
```

**검증 실패 시**:
```markdown
❌ SEMO 메타데이터: 오류 발견

**문제**:
- ❌ 필수 필드 누락: lastHealthCheck
- ⚠️ GitHub Projects 권한 미설정

**해결**:
1. 온보딩 프로세스를 완료하거나 `/SEMO:onboarding`을 실행하세요.
2. GitHub Projects 권한: `gh auth refresh -s project` 실행
```

> **참조**: [SEMO Core Metadata Schema](https://github.com/semicolon-devteam/semo-core/blob/main/_shared/metadata-schema.md)

### SEMO 패키지 설치 상태

| 항목 | 검증 방법 |
|------|----------|
| 패키지 디렉토리 | `.claude/semo-core/`, `.claude/semo-pm/` 존재 확인 |
| CLAUDE.md 심링크 | `.claude/CLAUDE.md` → `semo-pm/CLAUDE.md` |
| agents 심링크 | `.claude/agents` → `semo-pm/agents` |
| skills 심링크 | `.claude/skills` → `semo-pm/skills` |
| commands 심링크 | `.claude/commands/SEMO` → `../semo-pm/commands` |

## 기대 결과

```markdown
[SEMO] Skill: health-check 사용

=== PM 환경 검증 ===

✅ GitHub CLI: v2.40.0
✅ Git: v2.43.0
✅ Node.js: v20.10.0

✅ GitHub 인증: 완료
✅ GitHub Projects 권한: 확인 (project 스코프)
✅ semicolon-devteam 멤버십: 확인
✅ docs 레포 접근: 가능

✅ MCP 서버: context7, sequential-thinking
✅ SEMO 메타데이터: 존재
✅ SEMO 패키지: semo-core, semo-pm 설치됨
✅ 심링크: 정상

=== 결과 ===
✅ 모든 항목 정상
```

## 재검증 정책

- **온보딩 시**: 필수 실행
- **업무 시작 시**: 30일 경과 시 자동 실행
- **수동 요청 시**: `/SEMO:health-check` 명령어

## 패키지 이상 발견 시

심링크 오류 또는 패키지 미설치 감지 시:

```markdown
[SEMO] health-check: ⚠️ 패키지 설치 이상 감지

**문제**:
- ❌ 심링크 연결 오류: .claude/CLAUDE.md
- ❌ semo-pm 패키지 미설치

**해결**:
`SEMO 업데이트해줘`를 실행하여 패키지를 설치/심링크를 재설정하세요.
```

## SEMO Message

```markdown
[SEMO] Skill: health-check 사용

[SEMO] Reference: PM 환경 검증 (도구/인증/GitHub Projects) 완료
```

## Related

- [SEMO Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/semo-core/blob/main/MESSAGE_RULES.md)
- [onboarding-master Agent](../../agents/onboarding-master/onboarding-master.md)

## References

- [Validation Items](references/validation-items.md) - 검증 항목 상세
- [Output Formats](references/output-formats.md) - 성공/실패 출력 예제
- [Workflow](references/workflow.md) - 실행 흐름 및 재검증 정책

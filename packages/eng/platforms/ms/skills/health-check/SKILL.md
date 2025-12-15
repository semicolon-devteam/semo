---
name: health-check
description: Validate MSA development environment and tool availability. Use when (1) new MSA developer onboarding, (2) checking required tools (gh CLI, Git, Node, pnpm, Prisma, gRPC), (3) verifying GitHub auth and repo access, (4) orchestrator auto-runs at work start.
tools: [Bash, Read, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: health-check 호출 - MSA 환경 검증` 시스템 메시지를 첫 줄에 출력하세요.

# health-check Skill

> MSA 개발 환경 및 인증 상태 자동 검증

## 역할

신규/기존 MSA 개발자의 개발 환경을 자동으로 검증하여 SEMO 사용 준비 상태를 확인합니다.

## 트리거

- `/SEMO:health-check` 명령어
- "환경 확인", "도구 확인", "설치 확인" 키워드
- onboarding-master Agent에서 자동 호출
- orchestrator가 업무 시작 시 자동 실행 (30일 경과 시)

## Quick Start

```bash
# 필수 도구 설치 확인
gh --version && git --version && node --version && pnpm --version

# MSA 도구 확인
npx prisma --version 2>/dev/null || echo "❌ Prisma 미설치"
which grpcurl 2>/dev/null && echo "✅ grpcurl 설치됨" || echo "⚠️ grpcurl 미설치 (선택)"

# GitHub 인증 상태 확인
gh auth status

# Organization 멤버십 확인
gh api user/orgs --jq '.[].login' | grep semicolon-devteam

# SEMO 메타데이터 확인
cat ~/.claude.json | jq '.SEMO'

# SEMO 패키지 설치 상태 확인
ls -la .claude/semo-ms/ 2>/dev/null && echo "✅ semo-ms 설치됨"
ls -la .claude/semo-core/ 2>/dev/null && echo "✅ semo-core 설치됨"

# 심링크 상태 확인
ls -la .claude/CLAUDE.md
ls -la .claude/agents
ls -la .claude/skills
ls -la .claude/commands/SEMO
```

## 검증 항목 요약

### 필수 도구

| 도구 | 명령어 | 최소 버전 | MSA 용도 |
|------|--------|----------|---------|
| GitHub CLI | `gh --version` | - | 이슈/PR 관리 |
| Git | `git --version` | - | 버전 관리 |
| Node.js | `node --version` | v18.0.0 | 런타임 |
| pnpm | `pnpm --version` | - | 패키지 관리 |

### MSA 전용 도구

| 도구 | 명령어 | 용도 | 필수 |
|------|--------|------|------|
| Prisma | `npx prisma --version` | ORM 및 DB 스키마 | ✅ 필수 |
| grpcurl | `which grpcurl` | gRPC 테스트 | ⚠️ 선택 |

### 인증 및 권한

| 항목 | 명령어 |
|------|--------|
| GitHub 인증 | `gh auth status` |
| Organization | `gh api user/orgs --jq '.[].login' \| grep semicolon-devteam` |

### 글로벌 MCP 서버 설정 (~/.claude.json)

| 항목 | 필수 | 설명 |
|------|------|------|
| mcpServers 필드 | ✅ | `~/.claude.json`에 mcpServers 존재 |
| context7 | ✅ | 라이브러리 문서 조회 |
| sequential-thinking | ✅ | 구조적 사고 분석 |

### SEMO 메타데이터

- 파일: `~/.claude.json`
- 필수 필드: `SEMO.role`, `SEMO.position`, `SEMO.boarded`, `SEMO.boardedAt`, `SEMO.healthCheckPassed`, `SEMO.lastHealthCheck`

**검증 스크립트**:
```bash
# SEMO 필드 존재 확인
cat ~/.claude.json | jq -e '.SEMO' >/dev/null 2>&1 || echo "❌ SEMO 메타데이터 없음"

# 필수 필드 검증
REQUIRED_FIELDS=("role" "position" "boarded" "boardedAt" "healthCheckPassed" "lastHealthCheck")
for field in "${REQUIRED_FIELDS[@]}"; do
  cat ~/.claude.json | jq -e ".SEMO.$field" >/dev/null 2>&1 || echo "❌ 필수 필드 누락: $field"
done

# position 값 검증 (msa)
POSITION=$(cat ~/.claude.json | jq -r '.SEMO.position')
if [ "$POSITION" != "msa" ]; then
  echo "❌ position 값이 'msa'가 아님: $POSITION"
fi
```

**검증 성공 시**:
```markdown
✅ SEMO 메타데이터: 정상
  - role: fulltime
  - position: msa
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

**해결**:
온보딩 프로세스를 완료하거나 `/SEMO:onboarding`을 실행하세요.
```

> **참조**: [SEMO Core Metadata Schema](https://github.com/semicolon-devteam/semo-core/blob/main/_shared/metadata-schema.md)

### SEMO 패키지 설치 상태

| 항목 | 검증 방법 |
|------|----------|
| 패키지 디렉토리 | `.claude/semo-core/`, `.claude/semo-ms/` 존재 확인 |
| CLAUDE.md 심링크 | `.claude/CLAUDE.md` → `semo-ms/CLAUDE.md` |
| agents 심링크 | `.claude/agents` → `semo-ms/agents` |
| skills 심링크 | `.claude/skills` → `semo-ms/skills` |
| commands 심링크 | `.claude/commands/SEMO` → `../semo-ms/commands` |

## 기대 결과

```markdown
[SEMO] Skill: health-check 사용

=== MSA 환경 검증 ===

✅ GitHub CLI: v2.40.0
✅ Git: v2.43.0
✅ Node.js: v20.10.0
✅ pnpm: v8.14.0
✅ Prisma: v5.7.0
⚠️ grpcurl: 미설치 (선택)

✅ GitHub 인증: 완료
✅ semicolon-devteam 멤버십: 확인

✅ MCP 서버: context7, sequential-thinking
✅ SEMO 메타데이터: 존재
✅ SEMO 패키지: semo-core, semo-ms 설치됨
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
- ❌ semo-ms 패키지 미설치

**해결**:
`SEMO 업데이트해줘`를 실행하여 패키지를 설치/심링크를 재설정하세요.
```

## SEMO Message

```markdown
[SEMO] Skill: health-check 사용

[SEMO] Reference: MSA 환경 검증 (도구/인증/Prisma/gRPC) 완료
```

## Related

- [SEMO Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/semo-core/blob/main/MESSAGE_RULES.md)
- [onboarding-master Agent](../../agents/onboarding-master/onboarding-master.md)

## References

- [Validation Items](references/validation-items.md) - 검증 항목 상세
- [Output Formats](references/output-formats.md) - 성공/실패 출력 예제
- [Workflow](references/workflow.md) - 실행 흐름 및 재검증 정책

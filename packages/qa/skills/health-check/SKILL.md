---
name: health-check
description: Validate QA environment and authentication status. Use when (1) new QA member onboarding, (2) checking required tools (gh CLI, Git, Node, Playwright, test tools), (3) verifying GitHub auth and repo access, (4) orchestrator auto-runs at work start.
tools: [Bash, Read, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: health-check 호출 - QA 환경 검증` 시스템 메시지를 첫 줄에 출력하세요.

# health-check Skill

> QA 환경 및 인증 상태 자동 검증

## 역할

신규/기존 QA 팀원의 개발 환경을 자동으로 검증하여 SAX 사용 준비 상태를 확인합니다.

## 트리거

- `/SAX:health-check` 명령어
- "환경 확인", "도구 확인", "설치 확인" 키워드
- onboarding-master Agent에서 자동 호출
- orchestrator가 업무 시작 시 자동 실행 (30일 경과 시)

## Quick Start

```bash
# 필수 도구 설치 확인
gh --version && git --version && node --version && pnpm --version

# 테스트 도구 확인
npx playwright --version 2>/dev/null || echo "❌ Playwright 미설치"
npx vitest --version 2>/dev/null || echo "❌ Vitest 미설치"

# GitHub 인증 상태 확인
gh auth status

# Organization 멤버십 확인
gh api user/orgs --jq '.[].login' | grep semicolon-devteam

# SAX 메타데이터 확인
cat ~/.claude.json | jq '.SAX'

# SAX 패키지 설치 상태 확인
ls -la .claude/sax-qa/ 2>/dev/null && echo "✅ sax-qa 설치됨"
ls -la .claude/sax-core/ 2>/dev/null && echo "✅ sax-core 설치됨"

# 심링크 상태 확인
ls -la .claude/CLAUDE.md
ls -la .claude/agents
ls -la .claude/skills
ls -la .claude/commands/SAX
```

## 검증 항목 요약

### 필수 도구

| 도구 | 명령어 | 최소 버전 | QA 용도 |
|------|--------|----------|---------|
| GitHub CLI | `gh --version` | - | 이슈/PR 조회 |
| Git | `git --version` | - | 버전 관리 |
| Node.js | `node --version` | v18.0.0 | 테스트 실행 |
| pnpm | `pnpm --version` | - | 패키지 관리 |

### QA 전용 도구

| 도구 | 명령어 | 용도 |
|------|--------|------|
| Playwright | `npx playwright --version` | E2E 테스트 |
| Vitest | `npx vitest --version` | 단위 테스트 |

### 인증 및 권한

| 항목 | 명령어 |
|------|--------|
| GitHub 인증 | `gh auth status` |
| Organization | `gh api user/orgs --jq '.[].login' \| grep semicolon-devteam` |
| docs 접근 | `gh api repos/semicolon-devteam/docs/contents/README.md` |

### 글로벌 MCP 서버 설정 (~/.claude.json)

| 항목 | 필수 | 설명 |
|------|------|------|
| mcpServers 필드 | ✅ | `~/.claude.json`에 mcpServers 존재 |
| context7 | ✅ | 라이브러리 문서 조회 |
| sequential-thinking | ✅ | 구조적 사고 분석 |
| playwright | ⚠️ 권장 | 브라우저 자동화 (E2E 테스트용) |

### SAX 메타데이터

- 파일: `~/.claude.json`
- 필수 필드: `SAX.role`, `SAX.position`, `SAX.boarded`, `SAX.boardedAt`, `SAX.healthCheckPassed`, `SAX.lastHealthCheck`

**검증 스크립트**:
```bash
# SAX 필드 존재 확인
cat ~/.claude.json | jq -e '.SAX' >/dev/null 2>&1 || echo "❌ SAX 메타데이터 없음"

# 필수 필드 검증
REQUIRED_FIELDS=("role" "position" "boarded" "boardedAt" "healthCheckPassed" "lastHealthCheck")
for field in "${REQUIRED_FIELDS[@]}"; do
  cat ~/.claude.json | jq -e ".SAX.$field" >/dev/null 2>&1 || echo "❌ 필수 필드 누락: $field"
done

# position 값 검증 (qa)
POSITION=$(cat ~/.claude.json | jq -r '.SAX.position')
if [ "$POSITION" != "qa" ]; then
  echo "❌ position 값이 'qa'가 아님: $POSITION"
fi
```

**검증 성공 시**:
```markdown
✅ SAX 메타데이터: 정상
  - role: fulltime
  - position: qa
  - boarded: true
  - boardedAt: 2025-12-09T10:30:00Z
  - healthCheckPassed: true
  - lastHealthCheck: 2025-12-09T10:30:00Z
```

**검증 실패 시**:
```markdown
❌ SAX 메타데이터: 오류 발견

**문제**:
- ❌ 필수 필드 누락: lastHealthCheck

**해결**:
온보딩 프로세스를 완료하거나 `/SAX:onboarding`을 실행하세요.
```

> **참조**: [SAX Core Metadata Schema](https://github.com/semicolon-devteam/sax-core/blob/main/_shared/metadata-schema.md)

### SAX 패키지 설치 상태

| 항목 | 검증 방법 |
|------|----------|
| 패키지 디렉토리 | `.claude/sax-core/`, `.claude/sax-qa/` 존재 확인 |
| CLAUDE.md 심링크 | `.claude/CLAUDE.md` → `sax-qa/CLAUDE.md` |
| agents 심링크 | `.claude/agents` → `sax-qa/agents` |
| skills 심링크 | `.claude/skills` → `sax-qa/skills` |
| commands 심링크 | `.claude/commands/SAX` → `../sax-qa/commands` |

## 기대 결과

```markdown
[SAX] Skill: health-check 사용

=== QA 환경 검증 ===

✅ GitHub CLI: v2.40.0
✅ Git: v2.43.0
✅ Node.js: v20.10.0
✅ pnpm: v8.14.0
✅ Playwright: v1.40.0
⚠️ Vitest: 미설치 (선택)

✅ GitHub 인증: 완료
✅ semicolon-devteam 멤버십: 확인
✅ docs 레포 접근: 가능

✅ MCP 서버: context7, sequential-thinking, playwright
✅ SAX 메타데이터: 존재
✅ SAX 패키지: sax-core, sax-qa 설치됨
✅ 심링크: 정상

=== 결과 ===
✅ 모든 항목 정상
```

## 재검증 정책

- **온보딩 시**: 필수 실행
- **업무 시작 시**: 30일 경과 시 자동 실행
- **수동 요청 시**: `/SAX:health-check` 명령어

## 패키지 이상 발견 시

심링크 오류 또는 패키지 미설치 감지 시:

```markdown
[SAX] health-check: ⚠️ 패키지 설치 이상 감지

**문제**:
- ❌ 심링크 연결 오류: .claude/CLAUDE.md
- ❌ sax-qa 패키지 미설치

**해결**:
`SAX 업데이트해줘`를 실행하여 패키지를 설치/심링크를 재설정하세요.
```

## SAX Message

```markdown
[SAX] Skill: health-check 사용

[SAX] Reference: QA 환경 검증 (도구/인증/테스트 도구) 완료
```

## Related

- [SAX Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
- [onboarding-master Agent](../../agents/onboarding-master/onboarding-master.md)
- [qa-master Agent](../../agents/qa-master/qa-master.md)

## References

- [Validation Items](references/validation-items.md) - 검증 항목 상세
- [Output Formats](references/output-formats.md) - 성공/실패 출력 예제
- [Workflow](references/workflow.md) - 실행 흐름 및 재검증 정책

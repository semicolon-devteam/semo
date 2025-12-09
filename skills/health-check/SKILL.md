---
name: health-check
description: Validate infrastructure environment and tool availability. Use when (1) new infra engineer onboarding, (2) checking required tools (Docker, kubectl, terraform, nginx), (3) verifying GitHub auth and repo access, (4) orchestrator auto-runs at work start.
tools: [Bash, Read, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: health-check 호출 - 인프라 환경 검증` 시스템 메시지를 첫 줄에 출력하세요.

# health-check Skill

> 인프라 환경 및 인증 상태 자동 검증

## 역할

신규/기존 인프라 엔지니어의 개발 환경을 자동으로 검증하여 SAX 사용 준비 상태를 확인합니다.

## 트리거

- `/SAX:health-check` 명령어
- "환경 확인", "도구 확인", "설치 확인" 키워드
- onboarding-master Agent에서 자동 호출
- orchestrator가 업무 시작 시 자동 실행 (30일 경과 시)

## Quick Start

```bash
# 필수 도구 설치 확인
gh --version && git --version && docker --version

# 인프라 도구 확인
kubectl version --client 2>/dev/null || echo "⚠️ kubectl 미설치 (선택)"
terraform version 2>/dev/null || echo "⚠️ terraform 미설치 (선택)"
nginx -v 2>/dev/null || echo "⚠️ nginx 미설치 (선택)"
docker-compose --version 2>/dev/null || echo "⚠️ docker-compose 미설치 (선택)"

# GitHub 인증 상태 확인
gh auth status

# Organization 멤버십 확인
gh api user/orgs --jq '.[].login' | grep semicolon-devteam

# SAX 메타데이터 확인
cat ~/.claude.json | jq '.SAX'

# SAX 패키지 설치 상태 확인
ls -la .claude/sax-infra/ 2>/dev/null && echo "✅ sax-infra 설치됨"
ls -la .claude/sax-core/ 2>/dev/null && echo "✅ sax-core 설치됨"

# 심링크 상태 확인
ls -la .claude/CLAUDE.md
ls -la .claude/agents
ls -la .claude/skills
ls -la .claude/commands/SAX
```

## 검증 항목 요약

### 필수 도구

| 도구 | 명령어 | 최소 버전 | 인프라 용도 |
|------|--------|----------|-----------|
| GitHub CLI | `gh --version` | - | 이슈/PR 관리 |
| Git | `git --version` | - | 버전 관리 |
| Docker | `docker --version` | - | 컨테이너 관리 |

### 인프라 전용 도구 (선택)

| 도구 | 명령어 | 용도 | 필수 |
|------|--------|------|------|
| kubectl | `kubectl version --client` | Kubernetes 관리 | ⚠️ 선택 |
| terraform | `terraform version` | IaC 관리 | ⚠️ 선택 |
| nginx | `nginx -v` | 웹 서버 | ⚠️ 선택 |
| docker-compose | `docker-compose --version` | 멀티 컨테이너 | ⚠️ 선택 |

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

### SAX 메타데이터

- 파일: `~/.claude.json`
- 필수 필드: `SAX.role`, `SAX.position`, `SAX.boarded`, `SAX.healthCheckPassed`

### SAX 패키지 설치 상태

| 항목 | 검증 방법 |
|------|----------|
| 패키지 디렉토리 | `.claude/sax-core/`, `.claude/sax-infra/` 존재 확인 |
| CLAUDE.md 심링크 | `.claude/CLAUDE.md` → `sax-infra/CLAUDE.md` |
| agents 심링크 | `.claude/agents` → `sax-infra/agents` |
| skills 심링크 | `.claude/skills` → `sax-infra/skills` |
| commands 심링크 | `.claude/commands/SAX` → `../sax-infra/commands` |

## 기대 결과

```markdown
[SAX] Skill: health-check 사용

=== 인프라 환경 검증 ===

✅ GitHub CLI: v2.40.0
✅ Git: v2.43.0
✅ Docker: v24.0.0
⚠️ kubectl: 미설치 (선택)
⚠️ terraform: 미설치 (선택)
⚠️ nginx: 미설치 (선택)
✅ docker-compose: v2.20.0

✅ GitHub 인증: 완료
✅ semicolon-devteam 멤버십: 확인

✅ MCP 서버: context7, sequential-thinking
✅ SAX 메타데이터: 존재
✅ SAX 패키지: sax-core, sax-infra 설치됨
✅ 심링크: 정상

=== 결과 ===
✅ 모든 항목 정상 (선택 도구 제외)
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
- ❌ sax-infra 패키지 미설치

**해결**:
`SAX 업데이트해줘`를 실행하여 패키지를 설치/심링크를 재설정하세요.
```

## SAX Message

```markdown
[SAX] Skill: health-check 사용

[SAX] Reference: 인프라 환경 검증 (도구/인증/Docker) 완료
```

## Related

- [SAX Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
- [onboarding-master Agent](../../agents/onboarding-master/onboarding-master.md)

## References

- [Validation Items](references/validation-items.md) - 검증 항목 상세
- [Output Formats](references/output-formats.md) - 성공/실패 출력 예제
- [Workflow](references/workflow.md) - 실행 흐름 및 재검증 정책

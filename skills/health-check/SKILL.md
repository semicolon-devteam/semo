---
name: health-check
description: Automatically verify development environment and authentication status for SAX-Next. Use when (1) onboarding new team members, (2) checking tool installation status, (3) validating GitHub/Supabase authentication, (4) orchestrator starts workflow.
tools: [Bash, Read, Grep]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: health-check 실행` 시스템 메시지를 첫 줄에 출력하세요.

# health-check Skill

> 개발 환경 및 인증 상태 자동 검증

## 트리거

- `/SAX:health-check` 명령어
- "환경 확인", "도구 확인", "설치 확인" 키워드
- onboarding-master Agent에서 자동 호출
- orchestrator가 업무 시작 시 자동 실행

## 검증 항목 요약

### 필수 도구

| 도구 | 명령어 | 최소 버전 |
|------|--------|----------|
| GitHub CLI | `gh --version` | - |
| Git | `git --version` | - |
| Node.js | `node --version` | v18.0.0 |
| pnpm | `pnpm --version` | - |
| Supabase CLI | `supabase --version` | - |

### 인증 및 권한

| 항목 | 명령어 |
|------|--------|
| GitHub 인증 | `gh auth status` |
| Organization | `gh api user/orgs --jq '.[].login' \| grep semicolon-devteam` |
| docs 접근 | `gh api repos/semicolon-devteam/docs/contents/README.md` |
| core-supabase | `gh api repos/semicolon-devteam/core-supabase/contents/README.md` |

### 외부 서비스

| 항목 | 검증 방법 |
|------|----------|
| API 문서 사이트 | `curl` HTTP 200 체크 (`https://core-interface-ashen.vercel.app`) |

### SAX 메타데이터

- 파일: `~/.claude.json`
- 필수 필드: `SAX.role`, `SAX.position`, `SAX.boarded`, `SAX.healthCheckPassed`

## 재검증 정책

- **온보딩 시**: 필수 실행
- **업무 시작 시**: 30일 경과 시 자동 실행
- **수동 요청 시**: `/SAX:health-check` 명령어

## Related Skills

- `task-progress` - 작업 진행 추적
- Onboarding Agent - 온보딩 프로세스

## References

For detailed documentation, see:

- [Check Items](references/check-items.md) - 도구, 인증, 메타데이터 검증 상세
- [Output Format](references/output-format.md) - 성공/실패 출력, 해결 방법

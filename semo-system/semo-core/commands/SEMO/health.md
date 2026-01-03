# /SEMO:health

SEMO 환경 헬스체크. `.claude` 디렉토리 구조와 패키지 상태를 검증합니다.

## 사용법

```
/SEMO:health
```

## 동작

1. **구조 검증** - `.claude` 디렉토리 무결성 체크
2. **심링크 검증** - 깨진 심링크 탐지
3. **버전 체크** - 설치된 패키지 버전 확인
4. **자동 수정** - 문제 발견 시 자동 복구

## 라우팅

```
/SEMO:health → skill:semo-architecture-checker
```

## 검증 항목

| 항목 | 검증 내용 |
|------|----------|
| semo-core | 디렉토리 존재 여부 |
| semo-{pkg} | Extension 패키지 존재 여부 |
| CLAUDE.md | 심링크 유효성 |
| _shared | semo-core/_shared 참조 확인 |
| agents/ | .merged 마커 + 심링크 유효성 |
| skills/ | .merged 마커 + 심링크 유효성 |
| commands/SEMO | .merged 마커 + 심링크 유효성 |
| MCP 서버 | settings.json에 semo-integrations 설정 여부 |

## MCP 설정 안내 (v3.0+)

> **v3.0부터 GitHub/Slack MCP 도구가 CLI 기반으로 전환되었습니다.**

### 현재 MCP 통합 (semo-integrations)

| 기능 | 도구 | 비고 |
|------|------|------|
| Slack 토큰 | `semo_get_slack_token` | notify-slack 스킬에서 사용 |
| 장기 기억 | `semo_remember`, `semo_recall` 등 | 선택적 (DB 설정 필요) |
| Remote 제어 | `semo_remote_*` | semo-remote 패키지용 |

### 제거된 MCP 도구 (v3.0)

| 제거된 도구 | 대체 방법 |
|------------|----------|
| `github_create_issue` | `gh issue create` (CLI) |
| `github_create_pr` | `gh pr create` (CLI) |
| `slack_send_message` | `skill:notify-slack` (curl 사용) |

### MCP 설정이 없어도 동작하는 기능

- 모든 GitHub 작업 (gh CLI 사용)
- Slack 알림 (curl + 내장 토큰)
- Supabase 작업 (supabase CLI 사용)

## 출력 예시

### 정상 상태

```markdown
[SEMO] Skill: semo-architecture-checker 호출

## .claude 디렉토리 검증 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| semo-core | ✅ | 존재 |
| semo-meta | ✅ | Extension |
| CLAUDE.md | ✅ | 심링크 유효 |
| _shared | ✅ | semo-core/_shared |
| agents/ | ✅ | 6 symlinks |
| skills/ | ✅ | 14 symlinks |
| commands/SEMO | ✅ | 6 symlinks |

**결과**: ✅ 구조 정상
```

### 문제 발견 시

```markdown
[SEMO] Skill: semo-architecture-checker 호출

## .claude 디렉토리 검증 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| semo-core | ✅ | 존재 |
| agents/ | ⚠️ → ✅ | 심링크 2개 재생성 |
| skills/ | ❌ → ✅ | .merged 마커 추가 |

**결과**: 2개 항목 자동 수정됨

⚠️ **세션 재시작 권장**
심링크 구조가 변경되었습니다. 새 세션을 시작하세요.
```

## 관련 스킬

- `semo-architecture-checker` - 실제 검증 로직
- `version-updater` - 세션 시작 시 자동 호출 (Phase 2)

## 관련 커맨드

- `/SEMO:update` - 패키지 업데이트
- `/SEMO:dry-run` - 명령 시뮬레이션

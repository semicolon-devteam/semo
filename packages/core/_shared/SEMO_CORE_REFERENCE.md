# SEMO Core 참조 (공통)

> 모든 SEMO 패키지에서 공통으로 참조하는 semo-core 컴포넌트

## 필수 참조 파일

| 파일 | 용도 |
|------|------|
| `semo-core/PRINCIPLES.md` | SEMO 핵심 원칙 |
| `semo-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 |

## 공통 컴포넌트

### Agents

| Agent | 역할 |
|-------|------|
| `compliance-checker` | 작업 완료 후 규칙 준수 검증 |
| `orchestrator` | 요청 라우팅 (패키지별 확장) |

### Skills

| Skill | 역할 |
|-------|------|
| `version-updater` | 세션 시작 시 버전 체크/업데이트 |
| `notify-slack` | Slack 알림 전송 |
| `feedback` | 피드백 수집 → GitHub 이슈 |
| `semo-help` | SEMO 도움말 |
| `memory` | 세션 간 컨텍스트 영속화 |
| `onboarding` | 통합 온보딩 프로세스 |

### Commands

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | 도움말 |
| `/SEMO:slack` | Slack 메시지 |
| `/SEMO:update` | SEMO 업데이트 |
| `/SEMO:feedback` | 피드백 제출 |
| `/SEMO:health` | 환경/구조 검증 |
| `/SEMO:onboarding` | 온보딩 시작 |

## 참조 방법

```bash
# 로컬 (semo-core 추출 환경)
.claude/semo-core/PRINCIPLES.md

# GitHub API (semo-core 미추출 환경)
gh api repos/semicolon-devteam/semo-core/contents/PRINCIPLES.md --jq '.content' | base64 -d
```

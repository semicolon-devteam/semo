# SAX Core 참조 (공통)

> 모든 SAX 패키지에서 공통으로 참조하는 sax-core 컴포넌트

## 필수 참조 파일

| 파일 | 용도 |
|------|------|
| `sax-core/PRINCIPLES.md` | SAX 핵심 원칙 |
| `sax-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 |

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
| `sax-help` | SAX 도움말 |
| `memory` | 세션 간 컨텍스트 영속화 |
| `onboarding` | 통합 온보딩 프로세스 |

### Commands

| 커맨드 | 설명 |
|--------|------|
| `/SAX:help` | 도움말 |
| `/SAX:slack` | Slack 메시지 |
| `/SAX:update` | SAX 업데이트 |
| `/SAX:feedback` | 피드백 제출 |
| `/SAX:health` | 환경/구조 검증 |
| `/SAX:onboarding` | 온보딩 시작 |

## 참조 방법

```bash
# 로컬 (sax-core 추출 환경)
.claude/sax-core/PRINCIPLES.md

# GitHub API (sax-core 미추출 환경)
gh api repos/semicolon-devteam/sax-core/contents/PRINCIPLES.md --jq '.content' | base64 -d
```

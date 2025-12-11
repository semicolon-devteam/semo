# SEMO-MS

> Semicolon 마이크로서비스 개발을 위한 SEMO 패키지

## 개요

SEMO-MS는 Semicolon 팀의 마이크로서비스(ms-*) 개발을 지원하는 AI 에이전트 패키지입니다.

## 대상 레포지토리

- ms-notifier (알림 서비스)
- ms-scheduler (스케줄러 서비스)
- ms-ledger (장부 서비스)
- ms-media-processor (미디어 처리)
- ms-crawler (웹 스크래핑)

## 설치

```bash
# semo-core 필수 (이미 설치된 경우 생략)
git submodule add https://github.com/semicolon-devteam/semo-core.git .claude/semo-core

# semo-ms 설치
git submodule add https://github.com/semicolon-devteam/semo-ms.git .claude/semo-ms
```

## 주요 기능

### Agents

| Agent | 역할 |
|-------|------|
| `service-architect` | 마이크로서비스 설계 및 구조 |
| `event-designer` | 이벤트 봉투 설계 |
| `worker-architect` | 백그라운드 워커 설계 |

### Skills

| Skill | 역할 |
|-------|------|
| `scaffold-service` | 서비스 보일러플레이트 생성 |
| `create-event-schema` | 이벤트 스키마 생성 |
| `setup-prisma` | Prisma 스키마 설정 |

## 참조

- [SEMO Core](https://github.com/semicolon-devteam/semo-core) - 공통 원칙
- [마이크로서비스 규약](https://github.com/semicolon-devteam/semo-core/blob/main/_shared/microservice-conventions.md)

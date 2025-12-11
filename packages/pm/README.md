# SEMO-PM

> SEMO Package for Project Management - Sprint 관리, 진행도 추적, 인원별 업무 관리

## Overview

SEMO-PM은 PM/프로젝트 매니저를 위한 SEMO 패키지입니다. SEMO-PO가 "무엇을 만들까?"(기획)에 집중한다면, SEMO-PM은 "언제, 누가, 얼마나?"(관리)에 집중합니다.

## Features

### Sprint Management
- Sprint 생성 및 관리 (2주 단위)
- Task → Sprint 할당
- Sprint 종료 및 회고
- Velocity 계산

### Progress Tracking
- Sprint 진행도 실시간 추적
- 인원별 업무 현황
- 블로커/지연 감지
- 자동 알림

### Reporting
- 주간 진행 리포트
- 인원별 업무 리포트
- Slack 자동 전송

### Roadmap
- Epic 기반 Roadmap 생성
- Mermaid Gantt 차트
- 마일스톤 관리

## Installation

```bash
# SEMO 설치 스크립트 사용 (권장)
./install-sax.sh pm

# 또는 수동 설치
git submodule add https://github.com/semicolon-devteam/semo-pm.git .claude/semo-pm
```

## Quick Start

```bash
# Sprint 생성
/SEMO:sprint create "Sprint 23" --start 2024-12-02 --end 2024-12-13

# 진행도 확인
/SEMO:progress

# 주간 리포트
/SEMO:report weekly

# Roadmap 생성
/SEMO:roadmap generate
```

## Components

### Agents (4)
- `orchestrator` - 요청 라우팅
- `sprint-master` - Sprint 계획/관리
- `progress-tracker` - 진행도 추적/리포팅
- `roadmap-planner` - 장기 일정/Roadmap

### Skills (10)
- `create-sprint` - Sprint 생성
- `close-sprint` - Sprint 종료
- `assign-to-sprint` - Task Sprint 할당
- `calculate-velocity` - Velocity 계산
- `generate-progress-report` - 진행도 리포트
- `generate-member-report` - 인원별 리포트
- `detect-blockers` - 블로커 감지
- `generate-roadmap` - Roadmap 생성
- `sync-project-status` - Projects 동기화
- `semo-help` - 도움말

### Commands (4)
- `/SEMO:sprint` - Sprint 관리
- `/SEMO:progress` - 진행도 조회
- `/SEMO:report` - 리포트 생성
- `/SEMO:roadmap` - Roadmap 관리

## Dependencies

- **semo-core** (필수): 공통 규칙, notify-slack
- **semo-po** (권장): Epic/Task 구조 호환

## License

MIT License - Semicolon Dev Team

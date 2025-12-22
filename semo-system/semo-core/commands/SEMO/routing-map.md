# /SEMO:routing-map

SEMO 설치 현황 및 라우팅 구조를 시각화합니다.

## 호출

```
skill:routing-map
```

## 기능

1. **버전 정보**: 설치된 SEMO Core/Packages 버전 표시
2. **라우팅 구조**: CLAUDE.md → Orchestrator → Agent/Skill 경로
3. **컴포넌트 목록**: 사용 가능한 Agent, Skill, Command 전체 목록

## 출력 예시

```markdown
[SEMO] Skill: routing-map 호출

## SEMO 설치 현황

**환경**: Meta 설치됨
**스캔 일시**: 2025-01-15 14:30

### Core Components

| 구성 요소 | 버전 | 상태 |
|----------|------|------|
| semo-core | 1.2.0 | ✅ |
| semo-skills | 1.3.0 | ✅ |

### Installed Packages

| 패키지 | 버전 |
|--------|------|
| packages/core | 0.32.0 |
| packages/eng/nextjs | 1.1.0 |

## Routing Structure

CLAUDE.md (Entry Point)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Orchestrator                           │
└─────────────────────────────────────────────────────────────┘
    │
    ├── [코드 작성] ──────────► skill:coder
    ├── [테스트] ────────────► skill:tester
    ...

## Available Components

- Agents: 8개
- Skills: 14개
- Commands: 6개
```

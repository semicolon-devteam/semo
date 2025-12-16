# SEMO (Semicolon Orchestrate)

> AI Agent Orchestration Framework v3.0

[![npm version](https://img.shields.io/npm/v/@team-semicolon/semo-cli.svg)](https://www.npmjs.com/package/@team-semicolon/semo-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 빠른 시작

```bash
# CLI 설치
npm install -g @team-semicolon/semo-cli

# 프로젝트에 SEMO 설치
semo init

# 버전 확인
semo -v
```

## 주요 명령어

```bash
semo init                  # SEMO 설치 (프로젝트 유형 자동 감지)
semo add <package>         # Extension 패키지 추가
semo add biz               # Business 레이어 전체 설치
semo add eng               # Engineering 레이어 전체 설치
semo add ops               # Operations 레이어 전체 설치
semo list                  # 사용 가능한 패키지 목록
semo status                # 설치 상태 확인
semo update                # 최신 버전으로 업데이트
semo -v                    # 버전 및 업데이트 확인
```

## 3-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Business Layer (biz)                      │
│  discovery │ design │ management │ poc                       │
│  아이템발굴  │  UX설계  │  스프린트관리  │  PoC               │
├─────────────────────────────────────────────────────────────┤
│                   Engineering Layer (eng)                    │
│  nextjs │ spring │ ms │ infra                                │
│  프론트엔드 │ 백엔드  │ MSA │ 인프라                           │
├─────────────────────────────────────────────────────────────┤
│                   Operations Layer (ops)                     │
│  qa │ monitor │ improve                                      │
│  테스트 │ 모니터링 │ 개선제안                                  │
└─────────────────────────────────────────────────────────────┘
```

| 레이어 | 역할 | 패키지 |
|--------|------|--------|
| **biz** | 사업 (기획, 설계, 관리) | discovery, design, management, poc |
| **eng** | 개발 (구현, 배포) | nextjs, spring, ms, infra |
| **ops** | 운영 (테스트, 모니터링) | qa, monitor, improve |

## 패키지 구조

### Standard (필수)

모든 프로젝트에 기본 설치됩니다.

| 패키지 | 설명 |
|--------|------|
| `semo-core` | 원칙, 오케스트레이터, 공통 커맨드 |
| `semo-skills` | 13개 통합 스킬 (coder, tester, planner 등) |

### Extensions (선택)

#### Business Layer

| 패키지 | 설명 | 설치 |
|--------|------|------|
| `biz/discovery` | 아이템 발굴, 시장 조사, Epic/Task | `semo add biz/discovery` |
| `biz/design` | 컨셉 설계, 목업, UX | `semo add biz/design` |
| `biz/management` | 일정/인력/스프린트 관리 | `semo add biz/management` |
| `biz/poc` | 빠른 PoC, 패스트트랙 | `semo add biz/poc` |

#### Engineering Layer

| 패키지 | 설명 | 자동 감지 | 설치 |
|--------|------|----------|------|
| `eng/nextjs` | Next.js 프론트엔드 | `next.config.*` | `semo add eng/nextjs` |
| `eng/spring` | Spring Boot 백엔드 | `pom.xml` | `semo add eng/spring` |
| `eng/ms` | 마이크로서비스 | - | `semo add eng/ms` |
| `eng/infra` | 인프라/배포 | `Dockerfile` | `semo add eng/infra` |

#### Operations Layer

| 패키지 | 설명 | 설치 |
|--------|------|------|
| `ops/qa` | 테스트/품질 관리 | `semo add ops/qa` |
| `ops/monitor` | 서비스 현황 모니터링 | `semo add ops/monitor` |
| `ops/improve` | 개선 제안 | `semo add ops/improve` |

#### Meta

| 패키지 | 설명 | 설치 |
|--------|------|------|
| `meta` | SEMO 프레임워크 자체 개발 | `semo add meta` |

## 설치 후 구조

```
your-project/
├── .claude/
│   ├── CLAUDE.md              # 프로젝트 설정
│   ├── settings.json          # MCP 서버 설정
│   ├── memory/                # Context Mesh
│   ├── agents/                # 에이전트 링크
│   ├── skills/                # 스킬 링크
│   └── commands/SEMO/         # SEMO 커맨드
│
└── semo-system/               # White Box
    ├── semo-core/
    ├── semo-skills/
    └── {extensions}/
```

## 레포지토리 구조

```
semo/
├── semo-core/                 # 핵심 원칙, 오케스트레이터
├── semo-skills/               # 통합 스킬 (13개)
├── packages/
│   ├── cli/                   # @team-semicolon/semo-cli
│   ├── mcp-server/            # @team-semicolon/semo-mcp
│   ├── biz/                   # Business Layer
│   ├── eng/                   # Engineering Layer
│   ├── ops/                   # Operations Layer
│   └── meta/                  # Meta 패키지
└── docs/                      # 문서
```

## MCP 서버

SEMO는 다음 MCP 서버를 자동으로 등록합니다:

| 서버 | 설명 |
|------|------|
| `semo-integrations` | GitHub, Slack, Supabase 연동 |
| `context7` | 라이브러리 문서 조회 |
| `sequential-thinking` | 순차적 사고 지원 |

## 환경변수

```bash
export GITHUB_TOKEN="your-token"
export SLACK_BOT_TOKEN="your-token"
export SUPABASE_URL="your-url"
export SUPABASE_KEY="your-key"
```

## 모드 시스템

| 모드 | 용도 | 특성 |
|------|------|------|
| `mvp` | PoC, 프로토타입 | 속도 우선, 컨벤션 최소화 |
| `prod` | 실서비스 (기본값) | 품질 우선, 풀 컨벤션 |

## 관련 패키지

| 패키지 | npm | 설명 |
|--------|-----|------|
| [@team-semicolon/semo-cli](packages/cli) | [![npm](https://img.shields.io/npm/v/@team-semicolon/semo-cli.svg)](https://www.npmjs.com/package/@team-semicolon/semo-cli) | CLI 도구 |
| [@team-semicolon/semo-mcp](packages/mcp-server) | [![npm](https://img.shields.io/npm/v/@team-semicolon/semo-mcp.svg)](https://www.npmjs.com/package/@team-semicolon/semo-mcp) | MCP 서버 |

## 라이선스

MIT

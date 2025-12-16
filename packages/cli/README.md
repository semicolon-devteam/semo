# @team-semicolon/semo-cli

> SEMO CLI v3.0 - AI Agent Orchestration Framework Installer

## 설치

```bash
npm install -g @team-semicolon/semo-cli
```

## 빠른 시작

```bash
# 프로젝트에 SEMO 설치
semo init

# Extension 패키지 추가
semo add eng/nextjs

# 버전 확인 및 업데이트 체크
semo -v
```

## 명령어

### `semo init`

현재 프로젝트에 SEMO를 설치합니다.

```bash
semo init                    # 기본 설치 (프로젝트 유형 자동 감지)
semo init --force            # 기존 설정 덮어쓰기
semo init --skip-mcp         # MCP 설정 생략
semo init --with next,infra  # 특정 패키지와 함께 설치
```

### `semo add <packages>`

Extension 패키지를 추가로 설치합니다.

```bash
# 개별 패키지 설치
semo add eng/nextjs
semo add biz/discovery

# 그룹 일괄 설치
semo add biz      # Business 전체 (discovery, design, management, poc)
semo add eng      # Engineering 전체 (nextjs, spring, ms, infra)
semo add ops      # Operations 전체 (qa, monitor, improve)

# 여러 패키지 동시 설치
semo add eng/nextjs,eng/infra

# 레거시 별칭 지원
semo add next     # → eng/nextjs
semo add backend  # → eng/spring
semo add mvp      # → biz/poc
```

### `semo list`

사용 가능한 모든 패키지를 표시합니다.

```bash
semo list
```

### `semo status`

SEMO 설치 상태를 확인합니다.

```bash
semo status
```

### `semo version` / `semo -v`

버전 정보 및 업데이트 확인을 표시합니다.

```bash
semo version
semo -v
```

출력 예시:
```
📦 SEMO CLI 버전 정보

  현재 버전: 3.0.7
  최신 버전: 3.0.7

  ✓ 최신 버전을 사용 중입니다.
```

### `semo update`

SEMO를 최신 버전으로 업데이트합니다.

```bash
semo update              # CLI + semo-system 전체 업데이트
semo update --self       # CLI만 업데이트
semo update --system     # semo-system만 업데이트
semo update --skip-cli   # CLI 업데이트 건너뛰기
```

## 패키지 구조

### Standard (필수)

모든 프로젝트에 기본 설치됩니다.

| 패키지 | 설명 |
|--------|------|
| `semo-core` | 원칙, 오케스트레이터, 공통 커맨드 |
| `semo-skills` | 13개 통합 스킬 (coder, tester, planner, deployer 등) |

### Extensions (선택)

프로젝트 유형에 맞게 선택적으로 설치합니다.

#### Business Layer (`biz`)

| 패키지 | 설명 | 설치 |
|--------|------|------|
| `biz/discovery` | 아이템 발굴, 시장 조사, Epic/Task | `semo add biz/discovery` |
| `biz/design` | 컨셉 설계, 목업, UX | `semo add biz/design` |
| `biz/management` | 일정/인력/스프린트 관리 | `semo add biz/management` |
| `biz/poc` | 빠른 PoC, 패스트트랙 | `semo add biz/poc` |

#### Engineering Layer (`eng`)

| 패키지 | 설명 | 자동 감지 | 설치 |
|--------|------|----------|------|
| `eng/nextjs` | Next.js 프론트엔드 개발 | `next.config.*` | `semo add eng/nextjs` |
| `eng/spring` | Spring Boot 백엔드 개발 | `pom.xml`, `build.gradle` | `semo add eng/spring` |
| `eng/ms` | 마이크로서비스 아키텍처 | - | `semo add eng/ms` |
| `eng/infra` | 인프라/배포 관리 | `Dockerfile`, `docker-compose.yml` | `semo add eng/infra` |

#### Operations Layer (`ops`)

| 패키지 | 설명 | 설치 |
|--------|------|------|
| `ops/qa` | 테스트/품질 관리 | `semo add ops/qa` |
| `ops/monitor` | 서비스 현황 모니터링 | `semo add ops/monitor` |
| `ops/improve` | 개선 제안 | `semo add ops/improve` |

#### Meta

| 패키지 | 설명 | 설치 |
|--------|------|------|
| `meta` | SEMO 프레임워크 자체 개발/관리 | `semo add meta` |

## 설치 후 구조

```
your-project/
├── .claude/
│   ├── CLAUDE.md              # 프로젝트 설정 (Extension CLAUDE.md 병합)
│   ├── settings.json          # MCP 서버 설정
│   ├── memory/                # Context Mesh (세션 간 컨텍스트)
│   │   ├── context.md         # 프로젝트 상태
│   │   ├── decisions.md       # 아키텍처 결정
│   │   └── rules/             # 프로젝트별 규칙
│   ├── agents/                # 에이전트 심볼릭 링크
│   ├── skills/                # 스킬 심볼릭 링크
│   └── commands/SEMO/         # SEMO 커맨드
│
└── semo-system/               # White Box (읽기 전용)
    ├── semo-core/             # Layer 0: 원칙, 오케스트레이션
    ├── semo-skills/           # Layer 1: 통합 스킬
    ├── biz/                   # Business Layer (선택)
    ├── eng/                   # Engineering Layer (선택)
    └── ops/                   # Operations Layer (선택)
```

## MCP 서버

SEMO CLI는 다음 MCP 서버를 자동으로 등록합니다:

| 서버 | 설명 |
|------|------|
| `semo-integrations` | GitHub, Slack, Supabase 연동 |
| `context7` | 라이브러리 문서 조회 |
| `sequential-thinking` | 순차적 사고 지원 |

### 환경변수

MCP 연동을 위해 다음 환경변수를 설정하세요:

| 변수 | 설명 |
|------|------|
| `GITHUB_TOKEN` | GitHub API 토큰 |
| `SLACK_BOT_TOKEN` | Slack Bot 토큰 |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_KEY` | Supabase 서비스 키 |

## 프로젝트 유형 자동 감지

`semo init` 실행 시 프로젝트 파일을 분석하여 적절한 패키지를 추천합니다:

| 감지 파일 | 추천 패키지 |
|----------|-------------|
| `next.config.js`, `next.config.mjs`, `next.config.ts` | `eng/nextjs` |
| `pom.xml`, `build.gradle` | `eng/spring` |
| `Dockerfile`, `docker-compose.yml` | `eng/infra` |
| `semo-core`, `semo-skills` | `meta` |

## 레거시 명령어 호환

이전 버전 사용자를 위해 레거시 패키지명도 지원합니다:

| 레거시 | 현재 |
|--------|------|
| `semo add next` | `semo add eng/nextjs` |
| `semo add backend` | `semo add eng/spring` |
| `semo add ms` | `semo add eng/ms` |
| `semo add infra` | `semo add eng/infra` |
| `semo add qa` | `semo add ops/qa` |
| `semo add po` | `semo add biz/discovery` |
| `semo add pm` | `semo add biz/management` |
| `semo add design` | `semo add biz/design` |
| `semo add mvp` | `semo add biz/poc` |

## 참조

- [SEMO 레포지토리](https://github.com/semicolon-devteam/semo)
- [SEMO MCP Server](https://www.npmjs.com/package/@team-semicolon/semo-mcp)

## 라이선스

MIT

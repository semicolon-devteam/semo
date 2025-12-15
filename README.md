# SEMO (Semicolon Orchestrate)

> AI Agent Orchestration Framework v3.0.0-alpha

## 구조

```
semo/
├── packages/
│   ├── biz/                    # Business Layer (사업)
│   │   ├── discovery/          # 아이템 발굴, 시장 조사, Epic/Task
│   │   ├── design/             # 컨셉 설계, 목업, UX
│   │   ├── management/         # 일정/인력/스프린트 관리
│   │   └── poc/                # 빠른 PoC (패스트트랙)
│   │
│   ├── eng/                    # Engineering Layer (개발)
│   │   ├── platforms/
│   │   │   ├── nextjs/         # Next.js 프론트엔드
│   │   │   ├── spring/         # Spring Boot 백엔드
│   │   │   └── ms/             # 마이크로서비스
│   │   ├── infra/              # 인프라/배포
│   │   └── modes/              # MVP/Production 모드
│   │
│   ├── ops/                    # Operations Layer (운영)
│   │   ├── qa/                 # 테스트/품질
│   │   ├── monitor/            # 서비스 현황
│   │   └── improve/            # 개선 제안
│   │
│   ├── core/                   # 공통 원칙/스킬
│   ├── cli/                    # 설치 CLI
│   ├── mcp-server/             # MCP 연동
│   └── meta/                   # 메타 패키지 (자체 관리)
│
├── semo-system/                # 핵심 시스템 (White Box)
│   ├── semo-core/              # 원칙, 오케스트레이션
│   ├── semo-skills/            # 통합 스킬
│   └── meta/                   # 메타 스킬
│
├── infra/                      # 인프라 설정 (Docker 등)
├── docs/                       # 문서
└── .claude/                    # Claude Code 통합
```

## 설치

```bash
# 프로젝트에 SEMO 설치
npx @semicolon/semo init

# 특정 레이어/패키지 추가
npx @semicolon/semo add eng/nextjs
npx @semicolon/semo add biz/discovery
```

## 3-Layer Architecture

| 레이어 | 역할 | 키워드 |
|--------|------|--------|
| **biz** | 사업 (기획, 설계, 관리) | Epic, Task, 스프린트, 목업 |
| **eng** | 개발 (구현, 배포) | 코드, 구현, 배포, 인프라 |
| **ops** | 운영 (테스트, 모니터링) | QA, 테스트, 현황, 개선 |

## 모드 시스템

| 모드 | 용도 | 특성 |
|------|------|------|
| `mvp` | PoC, 프로토타입 | 속도 우선, 컨벤션 최소화 |
| `prod` | 실서비스 (기본값) | 품질 우선, 풀 컨벤션 |

## References

- [빠른 시작 가이드](docs/QUICKSTART.md)
- [패키지별 상세 설명](docs/PACKAGES.md)
- [아키텍처 개요](docs/ARCHITECTURE.md)

# SEMO (Semicolon Orchestrate)

> AI Agent Orchestration Framework - Monorepo

## 구조

```
semo/
├── packages/
│   ├── core/       # 핵심 에이전트, 스킬, 커맨드
│   ├── meta/       # 메타 패키지 (자체 관리)
│   ├── next/       # Next.js 프론트엔드용
│   ├── backend/    # 백엔드용
│   ├── po/         # PO용
│   ├── qa/         # QA용
│   ├── pm/         # PM용
│   ├── design/     # 디자인용
│   ├── infra/      # 인프라용
│   ├── ms/         # 마이크로서비스용
│   └── mvp/        # MVP용
├── .claude/        # Claude Code 통합
└── docs/           # 문서
```

## 설치

```bash
# 프로젝트에 SEMO 설치
npx @semicolon/semo init
```

## 마이그레이션

이 레포는 기존 sax-* 멀티레포에서 Git Subtree 방식으로 마이그레이션되었습니다.
각 패키지의 커밋 히스토리가 보존되어 있습니다.

## References

- [SAX → SEMO 마이그레이션 가이드](docs/SAX_TO_SEMO_MIGRATION.md)
- [SEMO 네이밍 규칙](docs/SEMO_NAMING_CONVENTION.md)

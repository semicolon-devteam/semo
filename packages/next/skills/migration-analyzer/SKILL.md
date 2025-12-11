---
name: migration-analyzer
description: 레거시 프로젝트를 세미콜론 커뮤니티 규격(cm-template)으로 이식 분석. Use when (1) 레거시 프로젝트 마이그레이션 필요, (2) cm-template 규격 차이 분석, (3) 마이그레이션 작업 범위 결정.
tools: [Bash, Read, Grep, GitHub CLI]
triggers:
  - 이 프로젝트를 세미콜론 커뮤니티 규격에 맞게 이식
  - 마이그레이션 분석해줘
  - cm-template 규격으로 변환
  - 세미콜론 표준에 맞게 리팩토링
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: migration-analyzer 호출 - {프로젝트명}` 시스템 메시지를 첫 줄에 출력하세요.

# Migration Analyzer Skill

레거시 프로젝트를 세미콜론 커뮤니티 규격(cm-template)으로 이식하기 위한 분석 도구입니다.

## Quick Start

### When to Use

- 레거시 프로젝트를 세미콜론 커뮤니티 규격으로 전환하고 싶을 때
- 기존 프로젝트가 cm-template 표준과 얼마나 차이나는지 파악하고 싶을 때
- 마이그레이션 작업 범위와 우선순위를 결정해야 할 때

### Analysis Phases

| Phase | Description |
|-------|-------------|
| **1. Structure** | DDD 4-Layer, Atomic Design 구조 분석 |
| **2. Documentation** | CLAUDE.md, README.md, Constitution 확인 |
| **3. Architecture** | DDD 패턴, SSR-First 준수 검사 |
| **4. Supabase** | Storage 버킷, RPC 패턴 확인 |
| **5. Quality** | ESLint, TypeScript, 코드 품질 검사 |
| **6. Team Codex** | 커밋 메시지, 브랜치 전략 확인 |

### cm-template 기준 구조

```text
src/
├── app/{domain}/
│   ├── _repositories/    # DDD Layer 1
│   ├── _api-clients/     # DDD Layer 2
│   ├── _hooks/           # DDD Layer 3
│   └── _components/      # DDD Layer 4
├── components/           # Atomic Design
│   ├── atoms/
│   ├── molecules/
│   ├── organisms/
│   └── templates/
└── models/               # 타입 정의
```

## Output Summary

| 항목 | 내용 |
|------|------|
| **전체 준수율** | X% |
| **예상 작업량** | Small/Medium/Large |
| **권장 우선순위** | Critical → Warning → Suggestion |

## Critical Rules

1. **분석만 수행**: 자동 수정 금지
2. **cm-template 기준**: 모든 비교는 cm-template 기준
3. **실행 가능한 태스크**: 구체적인 마이그레이션 태스크 제공
4. **문서 유효성 검증**: 404 응답 시 사용자에게 알림

## Related

- [Analysis Framework](references/analysis-framework.md)
- [Document Fusion Guide](references/document-fusion.md)
- [Output Format](references/output-format.md)

## Related Skills

- `scaffold-domain` - DDD 도메인 구조 생성
- `validate-architecture` - 아키텍처 검증
- `check-team-codex` - 코드 품질 검증
- `fetch-team-context` - 팀 표준 참조

## Dependencies

- `cm-template` 레포지토리 접근 (규격 참조용)
- `docs` 위키 접근 (Team Codex, Development Philosophy)
- GitHub CLI (`gh`) 인증

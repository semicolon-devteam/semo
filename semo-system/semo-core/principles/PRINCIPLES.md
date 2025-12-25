# SEMO Principles

> SEMO (Semicolon Orchestrate) 핵심 원칙

## 1. Orchestrator-First

모든 요청은 반드시 Orchestrator를 통해 라우팅됩니다.

```
사용자 요청 → Orchestrator → Agent/Skill → 결과
```

## 2. SEMO Message Format

모든 SEMO 동작은 시스템 메시지로 시작합니다:

```
[SEMO] {Component}: {Action} → {Result}
```

## 3. Quality Gate

코드 변경 커밋 전 필수 검증:

```bash
npm run lint           # ESLint
npx tsc --noEmit       # TypeScript
npm run build          # Build
```

## 4. Skill-Based Architecture

- 재사용 가능한 기능은 Skill로 분리
- Skill은 단일 책임 원칙 준수
- Agent는 복잡한 워크플로우 조율

## 5. Context Mesh

세션 간 컨텍스트는 `.claude/memory/`에 영속화:

- `context.md`: 프로젝트 상태
- `decisions.md`: 아키텍처 결정
- `rules/`: 프로젝트별 규칙

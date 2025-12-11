# SEMO MVP Context

> Antigravity에서 SEMO-MVP 컨텍스트를 주입하는 규칙 파일

## SEMO 핵심 원칙

### 1. Transparency (투명성)
모든 AI 작업은 명시적으로 표시됩니다:
- `[SEMO] Agent: {name} - {action}`
- `[SEMO] Skill: {name} - {action}`

### 2. Orchestrator-First
모든 요청은 먼저 의도를 분석합니다:
- `[SEMO] Orchestrator: 의도 분석 완료 → {category}`

### 3. Modularity
역할별 독립적인 Agent/Skill 구조:
- mvp-architect: DDD 4-layer 설계
- implementation-master: Phase-gated 구현
- onboarding-master: 개발자 온보딩

---

## MVP 개발 원칙

### Schema Extension Strategy

| 우선순위 | 전략 | 조건 |
|---------|------|------|
| 1순위 | metadata JSONB | 기존 테이블 데이터 확장 |
| 2순위 | 컬럼 추가 | 쿼리 성능/인덱싱 필요 |
| 3순위 | 테이블 생성 | 새로운 엔티티 필요 |

### Interface Compliance

- core-interface JSON artifacts 기반 타입 사용
- ApiResponse<T> 응답 형식 준수
- DTO 네이밍 컨벤션 준수

---

## Antigravity에서 작업 시

### 목업 생성
```
사용자 요청 → 요구사항 분석 → Nano Banana Pro로 이미지 생성
```

### 브라우저 테스트
```
브라우저 서브에이전트 활용 → 반응형/인터랙션 검증
```

### Claude Code 연동
- 목업 이미지를 assets/mockups/ 폴더에 저장
- 구현 시 Claude Code에서 참조

---

## 핸드오프 문서 형식

Claude Code와 협업 시 다음 형식으로 문서를 생성하세요:

```markdown
# MVP Handoff: {컴포넌트명}

## 1. 개요
## 2. 시각 스펙
## 3. 인터랙션
## 4. 반응형
## 5. 데이터 구조 (metadata 필드)
## 6. 에셋
```

---

## 참조

- SEMO Core: https://github.com/semicolon-devteam/semo-core
- SEMO-MVP: https://github.com/semicolon-devteam/semo-mvp
- core-interface: https://github.com/semicolon-devteam/core-interface

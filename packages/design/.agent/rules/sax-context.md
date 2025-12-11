# SAX Design Context

> Antigravity에서 SAX-Design 컨텍스트를 주입하는 규칙 파일

## SAX 핵심 원칙

### 1. Transparency (투명성)
모든 AI 작업은 명시적으로 표시됩니다:
- `[SAX] Agent: {name} - {action}`
- `[SAX] Skill: {name} - {action}`

### 2. Orchestrator-First
모든 요청은 먼저 의도를 분석합니다:
- `[SAX] Orchestrator: 의도 분석 완료 → {category}`

### 3. Modularity
역할별 독립적인 Agent/Skill 구조:
- design-master: 디자인 작업 총괄
- generate-mockup: 목업 생성
- design-handoff: 핸드오프 문서

---

## 디자인 원칙

### 반응형 우선 (Mobile-first)
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### 접근성 (WCAG 2.1 AA)
- 키보드 탐색 가능
- ARIA 레이블 필수
- 색상 대비 4.5:1 이상
- 포커스 표시 명확

### 디자인 토큰
- 색상: CSS 변수 사용
- 스페이싱: 4px 단위
- 타이포그래피: 프로젝트 폰트 스택

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
- design-handoff.md 문서를 통해 정보 전달
- 목업 이미지를 assets/ 폴더에 저장

---

## 핸드오프 문서 형식

Claude Code와 협업 시 다음 형식으로 문서를 생성하세요:

```markdown
# Design Handoff: {컴포넌트명}

## 1. 개요
## 2. 시각 스펙
## 3. 인터랙션
## 4. 반응형
## 5. 접근성
## 6. 에셋
```

---

## 참조

- SAX Core: https://github.com/semicolon-devteam/sax-core
- SAX-Design: https://github.com/semicolon-devteam/sax-design

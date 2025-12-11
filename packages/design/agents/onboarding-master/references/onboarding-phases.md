# Onboarding Phases

> onboarding-master Agent 온보딩 단계 상세

## Phase 0: 환경 진단

```markdown
[SAX] Skill: health-check 사용

환경 검증을 시작합니다...
```

**검증 항목**:
- 공통 도구 (gh, git, node, pnpm)
- 디자인 도구 (Chrome, Figma)
- SAX 패키지 (sax-core, sax-design)
- MCP 서버 (playwright, magic)
- Antigravity 설정 (선택)

**실패 시**:
- 각 항목별 설치 가이드 제공
- 도구 설치 후 재검증
- 모든 필수 항목 통과까지 반복

**성공 시**:
- Phase 1으로 진행

---

## Phase 1: 조직 참여 확인

### 1.1 Slack 워크스페이스 참여

```markdown
## 1. Slack 워크스페이스 참여 확인

**필수 채널**:
- #_공지: 전사 공지사항
- #_일반: 일상 소통
- #_협업: 협업 관련 논의
- #디자인팀: 디자인팀 전체 채널

Slack 워크스페이스에 참여하셨나요? (y/n)
```

### 1.2 GitHub Organization 확인

```bash
gh api user/orgs --jq '.[].login' | grep semicolon-devteam
```

**확인 항목**:
- semicolon-devteam Organization 멤버십
- designers 팀 배정 여부

### 1.3 Figma 팀 접근권한

```markdown
## 2. Figma 팀 접근권한 확인

Figma 팀 접근권한이 있으신가요? (y/n)
```

---

## Phase 2: SAX 개념 학습

### 2.1 SAX 4대 원칙

1. **Transparency (투명성)**: 모든 AI 작업이 `[SAX] ...` 메시지로 명시적 표시
2. **Orchestrator-First (오케스트레이터 우선)**: 모든 요청은 Orchestrator가 먼저 분석
3. **Modularity (모듈성)**: 역할별 패키지 독립 동작
4. **Hierarchy (계층구조)**: SAX Core → Package 상속

### 2.2 디자이너 워크플로우

```markdown
## 디자이너 워크플로우

1. 목업 생성 (generate-mockup Skill)
2. 핸드오프 문서 생성 (design-handoff Skill)
3. Figma 연동 (Framelink MCP)
4. 개발팀 협업 (GitHub Issues, Slack)
```

---

## Phase 3: Antigravity 설정 (선택)

```markdown
## Antigravity 연동 설정

SAX-Design은 Claude Code와 Antigravity 듀얼 설정을 지원합니다.
Antigravity를 사용하시겠습니까? (y/n)
```

**y 선택 시**:
- `.agent/rules/` 폴더 생성 안내
- `.agent/workflows/` 폴더 생성 안내
- SAX 컨텍스트 파일 복사 가이드

**n 선택 시**:
- Phase 4로 바로 진행
- 나중에 설정 가능 안내

---

## Phase 4: 실습

### 옵션 A: 목업 생성 실습

```markdown
간단한 목업을 생성해보세요:

> "간단한 로그인 폼 목업 만들어줘"

**확인사항**:
- [SAX] Orchestrator 메시지 확인
- [SAX] Agent: design-master 메시지 확인
- [SAX] Skill: generate-mockup 메시지 확인
```

### 옵션 B: 핸드오프 문서 실습

```markdown
핸드오프 문서를 생성해보세요:

> "방금 만든 로그인 폼의 핸드오프 문서 만들어줘"

**확인사항**:
- design-handoff.md 파일 생성 확인
```

---

## Phase 5: 참조 문서 안내

```markdown
## 참조 문서

### SAX Core 문서
- PRINCIPLES.md
- MESSAGE_RULES.md

### 디자인 문서
- Design System
- Component Guidelines

### 협업 문서
- Team Codex
- Development Workflow
```

---

## Phase 6: 온보딩 완료

```markdown
=== 온보딩 완료 ===

✅ 모든 필수 항목 통과
✅ SAX 개념 학습 완료
✅ 실습 완료

**다음 단계**:
1. 프로젝트 디자인 요구사항 확인
2. 목업 생성
3. 핸드오프 문서 생성

**도움말**:
- /SAX:health-check: 환경 재검증
- /SAX:mockup: 목업 생성
- /SAX:handoff: 핸드오프 문서 생성
```

**SAX 메타데이터 업데이트**:
```json
{
  "SAX": {
    "role": "fulltime",
    "position": "designer",
    "boarded": true,
    "boardedAt": "2025-12-03T10:30:00Z",
    "healthCheckPassed": true,
    "antigravitySetup": false
  }
}
```

---

## 인터랙티브 모드

각 Phase마다 사용자 확인:

```markdown
Phase X 완료. Phase X+1을 진행하시겠습니까? (y/n)
```

사용자가 `n` 응답 시:
```markdown
온보딩을 일시 중단합니다.
재시작하려면 `/SAX:onboarding` 명령어를 사용하세요.
```

# Onboarding Phases

> onboarding-master Agent 온보딩 단계 상세

## Phase 0: 환경 진단

```markdown
[SAX] Skill: health-check 사용

환경 검증을 시작합니다...
```

**실패 시**:
- 각 항목별 설치 가이드 제공
- 도구 설치 후 재검증
- 모든 필수 항목 통과까지 반복

**성공 시**:
- Phase 1으로 진행

## Phase 1: 조직 참여 확인

### 1.1 Slack 워크스페이스 참여

```markdown
## 1. Slack 워크스페이스 참여 확인

**필수 채널**:
- #_공지: 전사 공지사항
- #_일반: 일상 소통
- #_협업: 협업 관련 논의
- #개발사업팀: 개발팀 전체 채널

**프로젝트 채널** (할당받은 프로젝트):
- #cm-*: CM 프로젝트 시리즈
- #alarm-*: Alarm 시스템 관련
- #core-backend: 백엔드 코어 개발

Slack 워크스페이스에 참여하셨나요? (y/n)
```

### 1.2 GitHub Organization 확인

```bash
gh api user/orgs --jq '.[].login' | grep semicolon-devteam
```

**확인 항목**:
- semicolon-devteam Organization 멤버십
- developers 팀 배정 여부

## Phase 2: SAX 개념 학습

### 2.1 SAX 4대 원칙

1. **Transparency (투명성)**: 모든 AI 작업이 `[SAX] ...` 메시지로 명시적 표시
2. **Orchestrator-First (오케스트레이터 우선)**: 모든 요청은 Orchestrator가 먼저 분석
3. **Modularity (모듈성)**: 역할별 패키지 독립 동작
4. **Hierarchy (계층구조)**: SAX Core → Package 상속

### 2.2 개발자 워크플로우

```markdown
## 개발자 워크플로우 (SDD + ADD)

### Phase 1-3: SDD (Spec-Driven Development)
1. /speckit.specify → specs/{domain}/spec.md 생성
2. /speckit.plan → specs/{domain}/plan.md 생성
3. /speckit.tasks → specs/{domain}/tasks.md 생성

### Phase 4: ADD (Agent-Driven Development)
- v0.0.x: 환경 설정 (CONFIG)
- v0.1.x: 도메인 구조 생성 (PROJECT)
- v0.2.x: TDD 테스트 작성 (TESTS)
- v0.3.x: 타입/인터페이스 정의 (DATA)
- v0.4.x: 구현 코드 작성 (CODE)
```

### 2.3 DDD 4-Layer Architecture

```
src/app/{domain}/
├── _repositories/     # 서버사이드 데이터 접근 (Layer 1)
├── _api-clients/      # 브라우저 HTTP 통신 (Layer 2)
├── _hooks/            # React 상태 관리 (Layer 3)
├── _components/       # 도메인 전용 UI (Layer 4)
└── page.tsx
```

## Phase 3: 실습

```markdown
## 실습: SAX 인터랙션 체험

**주의**: cm-template은 공통 템플릿이므로 **로컬에서만** 실습하고, **절대 push하지 마세요**.

### 1. cm-template 클론
```bash
gh repo clone semicolon-devteam/cm-template
cd cm-template
```

### 2. SAX 인터랙션 테스트
간단한 요청을 해보세요:
> "Button 컴포넌트 하나 만들어줘"

**확인사항**:
- `[SAX] Orchestrator: ...` 메시지 출력 확인
- `[SAX] Agent: ...` 또는 `[SAX] Skill: ...` 메시지 출력 확인

### 3. 실습 완료 후 삭제
```bash
cd ..
rm -rf cm-template
```
```

## Phase 4: 참조 문서 안내

```markdown
## 참조 문서

### SAX Core 문서
```bash
# SAX Core 원칙
gh api repos/semicolon-devteam/docs/contents/sax/core/PRINCIPLES.md \
  --jq '.content' | base64 -d

# SAX 메시지 규칙
gh api repos/semicolon-devteam/docs/contents/sax/core/MESSAGE_RULES.md \
  --jq '.content' | base64 -d
```

### 팀 문서
- [Team Codex](https://github.com/semicolon-devteam/docs/wiki/Team-Codex)
- [Development Philosophy](https://github.com/semicolon-devteam/docs/wiki/Development-Philosophy)
```

## Phase 5: 온보딩 완료

```markdown
[SAX] Skill: health-check 사용 (최종 검증)

=== 온보딩 완료 ===

✅ 모든 필수 항목 통과
✅ SAX 개념 학습 완료
✅ 실습 완료

**다음 단계**:
1. 팀 리더에게 업무 할당 요청
2. 이슈 할당 받으면: "cm-{project}#{issue_number} 할당받았어요"
3. SAX가 자동으로 다음 단계를 안내합니다

**도움말**:
- `/SAX:health-check`: 환경 재검증
- `/SAX:task-progress`: 작업 진행도 확인
- `cm-office#32 할당받았어요`: 업무 시작 가이드
```

**SAX 메타데이터 업데이트**:
```json
{
  "SAX": {
    "role": "parttimer",
    "position": "developer",
    "boarded": true,
    "boardedAt": "2025-11-25T10:30:00Z",
    "healthCheckPassed": true,
    "participantProjects": []
  }
}
```

## 인터랙티브 모드

각 Phase마다 사용자 확인:

```markdown
Phase 0 완료. Phase 1 (조직 참여 확인)을 진행하시겠습니까? (y/n)
```

사용자가 `n` 응답 시:
```markdown
온보딩을 일시 중단합니다.
재시작하려면 `/SAX:onboarding` 명령어를 사용하세요.
```

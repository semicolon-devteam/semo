# Onboarding Phases 상세 가이드

> SEMO 온보딩 각 Phase별 상세 진행 방법

## Phase 0: 환경 진단

### 필수 도구

| 도구 | 용도 | 설치 방법 |
|------|------|----------|
| GitHub CLI (gh) | GitHub 연동 | `brew install gh` |
| Git | 버전 관리 | `brew install git` |
| Node.js | 런타임 | `brew install node` |
| pnpm | 패키지 관리 | `npm install -g pnpm` |

### 검증 명령어

```bash
# 버전 확인
gh --version    # GitHub CLI 2.x 이상
git --version   # Git 2.x 이상
node --version  # Node.js 18.x 이상
pnpm --version  # pnpm 8.x 이상

# GitHub 인증
gh auth status

# Organization 멤버십
gh api user/memberships/orgs/semicolon-devteam --jq '.state'
```

### 실패 시 안내

```markdown
❌ GitHub CLI 미설치

설치 방법:
\`\`\`bash
brew install gh
gh auth login
\`\`\`
```

## Phase 1: 조직 참여 확인

### GitHub Organization

- **확인 대상**: semicolon-devteam
- **확인 방법**: `gh api user/memberships/orgs/semicolon-devteam`
- **실패 시**: 팀 리더에게 초대 요청 안내

### Slack 채널

- **필수 채널**: #_협업
- **선택 채널**: #_개발, #_디자인, #_qa (역할별)
- **확인 방법**: 사용자에게 직접 확인 요청

## Phase 2: SEMO 개념 학습

### SEMO 4대 원칙

#### 1. Transparency (투명성)

모든 AI 작업은 `[SEMO] ...` 메시지로 시작합니다.

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → 개발 요청
[SEMO] Agent: next-developer 호출
[SEMO] Skill: health-check 호출
```

#### 2. Orchestrator-First (오케스트레이터 우선)

모든 요청은 Orchestrator가 먼저 분석하여 적절한 Agent/Skill로 위임합니다.

```text
사용자 요청 → Orchestrator 분석 → Agent/Skill 위임 → 결과 반환
```

#### 3. Modularity (모듈성)

역할별로 패키지가 분리됩니다:

| 역할 | 패키지 | 주요 기능 |
|------|--------|----------|
| PO/기획 | semo-po | Epic 생성, 이슈 관리 |
| 개발자 | semo-next | Next.js 개발 지원 |
| QA | semo-qa | 테스트 케이스 작성 |
| 디자이너 | semo-design | Figma 연동 |
| 백엔드 | semo-backend | API 설계 |
| PM | semo-pm | Task 관리 |

#### 4. Hierarchy (계층성)

SEMO Core의 원칙을 각 패키지가 상속합니다.

```text
semo-core (공통 원칙)
├── semo-po (PO 특화)
├── semo-next (개발자 특화)
├── semo-qa (QA 특화)
└── ...
```

### 개발자 워크플로우

```text
1. 이슈 할당
   → "cm-{project}#{issue_number} 할당받았어요"

2. SEMO 분석
   → 이슈 복잡도 분석
   → 작업 계획 제안

3. 개발 진행
   → "버튼 컴포넌트 만들어줘"
   → SEMO가 코드 작성 지원

4. PR 생성
   → SEMO가 PR 템플릿 자동 생성
   → 커밋 메시지 규칙 준수

5. 완료 보고
   → Slack #_협업 채널 알림
```

## Phase 3: 패키지별 온보딩

### 패키지 감지

```bash
# 설치된 패키지 목록
ls -d .claude/semo-*/ 2>/dev/null | xargs -I {} basename {} | sed 's/semo-//'
```

### 패키지별 스킬 호출

각 패키지의 `skill:onboarding-{package}` 호출:

```markdown
[SEMO] Skill: onboarding-next 호출

... 패키지별 실습 진행 ...

[SEMO] Skill: onboarding-next 완료
```

### 스킬 없을 경우

패키지에 온보딩 스킬이 없으면 건너뜁니다:

```markdown
⏭️ semo-infra: onboarding-infra 스킬 없음 - 건너뜀
```

## Phase 4: 온보딩 완료

### 메타데이터 저장

```json
{
  "SEMO": {
    "role": "fulltime",
    "position": "developer",
    "boarded": true,
    "boardedAt": "2025-12-10T10:00:00Z",
    "healthCheckPassed": true,
    "lastHealthCheck": "2025-12-10T10:00:00Z",
    "packages": ["next", "qa"]
  }
}
```

### Slack 알림

```bash
# skill:notify-slack 호출
{사용자명}님이 SEMO 온보딩을 완료했습니다!
- 패키지: semo-next, semo-qa
- 완료 시간: 2025-12-10 10:00:00
```

### 완료 메시지

```markdown
=== 온보딩 완료 ===

✅ 모든 필수 항목 통과
✅ SEMO 개념 학습 완료
✅ 패키지별 실습 완료

**다음 단계**:
1. 팀 리더에게 업무 할당 요청
2. 이슈 할당 받으면: "cm-{project}#{issue_number} 할당받았어요"
3. SEMO가 자동으로 다음 단계를 안내합니다
```

## 참조 문서

- [SEMO Core PRINCIPLES.md](https://github.com/semicolon-devteam/semo-core/blob/main/PRINCIPLES.md)
- [SEMO Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/semo-core/blob/main/MESSAGE_RULES.md)
- [Team Context Guide](https://github.com/semicolon-devteam/semo-core/blob/main/_shared/team-context.md)

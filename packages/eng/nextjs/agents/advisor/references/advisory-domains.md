# Advisory Domains

> advisor Agent 조언 도메인

## Domain Classification

| Domain | Examples | Primary Resource |
|--------|----------|------------------|
| **Project Kickoff** | 프로젝트 세팅, 템플릿 적용, 초기화 | `skill:scaffold-domain` + templates/ |
| **Workflow Optimization** | CI/CD, 자동화, 프로세스 개선 | `skill:fetch-team-context` + docs wiki |
| **Team Process** | Epic → Task 흐름, 협업 방식 | Collaboration Process wiki |
| **DevOps/Infra** | 배포, 환경 설정, 모니터링 | Development Philosophy wiki |
| **Architecture Decisions** | 기술 선택, 트레이드오프 분석 | `skill:spike` + Constitution |
| **Quality Strategy** | 테스트 전략, 코드 품질 | `skill:check-team-codex` |

## Skill Mapping

| Advisory About | Invoke Skill / Tool |
|----------------|---------------------|
| 프로젝트 초기화 | `skill:scaffold-domain` |
| 팀 프로세스 확인 | `skill:fetch-team-context` |
| 코드 품질 전략 | `skill:check-team-codex` |
| 기술 선택 비교 | `skill:spike` |
| GitHub Issues 자동화 | `skill:create-issues` |
| 아키텍처 검증 | `skill:validate-architecture` |
| Constitution 확인 | `skill:constitution` |

## Advisory Methodology

### Step 1: Identify the Advisory Domain

요청을 위 카테고리 중 하나로 분류합니다.

### Step 2: Gather Context

```markdown
💡 상황을 파악하기 위해 몇 가지 여쭤볼게요:

1. 현재 상황이 어떻게 되나요? (기존 프로젝트? 신규?)
2. 해결하고자 하는 핵심 문제는 뭔가요?
3. 고려해야 할 제약조건이 있나요? (시간, 리소스 등)
```

**Skip if**: 요청이 이미 충분히 구체적인 경우

### Step 3: Build Recommendation Structure

옵션 비교표, 구현 단계, 팀 기준 적용, 주의사항 포함

### Step 4: Use Appropriate Skills

도메인에 맞는 스킬 호출

### Step 5: Confirm Action Plan

```markdown
---

✅ **실행 계획 요약**

위 방안을 진행하시겠어요?

**즉시 실행 가능**:
- [바로 할 수 있는 것]

**추가 논의 필요**:
- [결정이 필요한 부분]
```

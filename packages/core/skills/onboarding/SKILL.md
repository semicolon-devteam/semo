---
name: onboarding
description: |
  SAX 통합 온보딩 프로세스 (공통 Skill). Use when (1) /SAX:onboarding 커맨드,
  (2) "처음이에요", "신규", "온보딩" 키워드, (3) 신규 팀원 온보딩 필요 시.
  환경 진단 → 조직 참여 → SAX 학습 → 패키지별 실습 → 완료 메타데이터 저장.
tools: [Read, Bash, Glob, Grep, WebFetch]
model: inherit
---

> **시스템 메시지**: `[SAX] Skill: onboarding 호출`

# SAX Onboarding Skill

> 신규 팀원을 위한 SAX 통합 온보딩 프로세스 (SAX Core 공통 Skill)

## Purpose

모든 SAX 패키지에서 공통으로 사용하는 온보딩 Skill입니다.
설치된 패키지를 감지하여 해당 패키지의 온보딩 스킬을 자동 호출합니다.

## Onboarding Phases

| Phase | 내용 | 호출 대상 |
|-------|------|----------|
| 0 | 환경 진단 | skill:health-check (또는 /SAX:health) |
| 1 | 조직 참여 확인 | Slack, GitHub Org |
| 2 | SAX 개념 학습 | PRINCIPLES.md, MESSAGE_RULES.md |
| 3 | 패키지별 온보딩 | skill:onboarding-{package} |
| 4 | 온보딩 완료 | 메타데이터 저장, Slack 알림 |

> 📚 **Phase 상세**: [references/onboarding-phases.md](references/onboarding-phases.md)

## Workflow

### Phase 0: 환경 진단

```bash
# 필수 도구 확인
gh --version
git --version
node --version
pnpm --version

# GitHub 인증 확인
gh auth status

# GitHub Org 멤버십 확인
gh api user/memberships/orgs/semicolon-devteam --jq '.state'
```

**실패 시**: 설치 가이드 안내 후 중단

### Phase 1: 조직 참여 확인

```markdown
### GitHub Organization
- semicolon-devteam 멤버십 확인
- 실패 시: 초대 요청 안내

### Slack 채널
- #_협업 채널 참여 확인
- 실패 시: 채널 참여 안내
```

### Phase 2: SAX 개념 학습

**SAX 4대 원칙 안내**:

1. **Transparency**: 모든 AI 작업 `[SAX] ...` 메시지로 표시
2. **Orchestrator-First**: 모든 요청은 Orchestrator가 먼저 분석
3. **Modularity**: 역할별 패키지 (SAX-PO, SAX-Next, SAX-QA 등)
4. **Hierarchy**: SAX Core → Package 상속

**참조 문서**:
- sax-core/PRINCIPLES.md
- sax-core/MESSAGE_RULES.md
- sax-core/TEAM_RULES.md

### Phase 3: 패키지별 온보딩

**설치된 패키지 감지**:

```bash
# 설치된 SAX 패키지 목록
for dir in .claude/sax-*/; do
  pkg=$(basename "$dir" | sed 's/sax-//')
  echo "$pkg"
done
```

**패키지별 온보딩 스킬 호출**:

| 패키지 | 스킬 | 실습 내용 |
|--------|------|----------|
| po | skill:onboarding-po | Epic 생성, PO 워크플로우 |
| next | skill:onboarding-next | cm-template 클론, 개발자 워크플로우 |
| qa | skill:onboarding-qa | 테스트 케이스 작성 |
| design | skill:onboarding-design | Figma + MCP 연동 |
| backend | skill:onboarding-backend | API 설계 |
| pm | skill:onboarding-pm | Task 관리 |
| infra | skill:onboarding-infra | 인프라 설정 |
| ms | skill:onboarding-ms | 마이크로서비스 설계 |

> 패키지에 해당 스킬이 없으면 건너뜀

### Phase 4: 온보딩 완료

**메타데이터 업데이트**:

```json
{
  "SAX": {
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

**Slack 알림** (선택):

```bash
# #_협업 채널에 온보딩 완료 알림
skill:notify-slack "{사용자명}님 온보딩 완료!"
```

## Expected Output

```markdown
[SAX] Skill: onboarding 호출

=== SAX 온보딩 프로세스 시작 ===

## Phase 0: 환경 진단

| 항목 | 상태 | 버전 |
|------|------|------|
| GitHub CLI | ✅ | v2.40.0 |
| Git | ✅ | v2.43.0 |
| Node.js | ✅ | v20.10.0 |
| pnpm | ✅ | v8.14.0 |
| GitHub 인증 | ✅ | 완료 |

## Phase 1: 조직 참여 확인

| 항목 | 상태 |
|------|------|
| GitHub Org (semicolon-devteam) | ✅ 멤버 |
| Slack #_협업 | ✅ 참여 |

## Phase 2: SAX 개념 학습

### SAX 4대 원칙

1. **Transparency**: 모든 AI 작업은 `[SAX] ...` 메시지로 표시됩니다.
2. **Orchestrator-First**: 모든 요청은 Orchestrator가 먼저 분석합니다.
3. **Modularity**: 역할별 패키지로 분리됩니다 (PO, Next, QA 등).
4. **Hierarchy**: SAX Core의 원칙을 각 패키지가 상속합니다.

### 개발자 워크플로우

```text
1. 이슈 할당: "cm-{project}#{issue_number} 할당받았어요"
2. SAX 분석: 이슈 복잡도 분석 → 작업 계획 제안
3. 개발 진행: SAX가 코드 작성 지원
4. PR 생성: SAX가 PR 템플릿 자동 생성
5. 완료 보고: Slack 알림
```

## Phase 3: 패키지별 온보딩

[SAX] Skill: onboarding-next 호출

### Next.js 개발자 실습

1. cm-template 클론:
   ```bash
   gh repo clone semicolon-devteam/cm-template
   cd cm-template
   pnpm install
   ```

2. SAX 인터랙션 체험:
   - "버튼 컴포넌트 만들어줘"
   - "API 라우트 추가해줘"

✅ 패키지 온보딩 완료

## Phase 4: 온보딩 완료

✅ 메타데이터 업데이트 완료
✅ Slack 알림 전송 완료

=== 온보딩 완료 ===

**다음 단계**:
1. 팀 리더에게 업무 할당 요청
2. 이슈 할당 받으면: "cm-{project}#{issue_number} 할당받았어요"
3. SAX가 자동으로 다음 단계를 안내합니다

---
📚 참조 문서:
- [SAX Core PRINCIPLES.md](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [Team Context Guide](https://github.com/semicolon-devteam/sax-core/blob/main/_shared/team-context.md)
```

## Trigger Keywords

- `/SAX:onboarding`
- "처음이에요", "신규", "온보딩", "시작 방법"
- "SAX 처음 사용", "환경 설정"

## SAX Message Format

```markdown
[SAX] Skill: onboarding 호출

[SAX] Skill: onboarding-{package} 호출 (Phase 3)

[SAX] Skill: onboarding 완료
```

## References

- [onboarding-phases.md](references/onboarding-phases.md) - Phase별 상세 가이드
- [sax-concepts.md](references/sax-concepts.md) - SAX 개념 설명
- [environment-setup.md](references/environment-setup.md) - 환경 설정 가이드

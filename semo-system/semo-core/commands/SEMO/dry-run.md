# /SEMO:dry-run

SEMO 명령 검증 (Dry Run). 실제 실행 없이 라우팅 플로우를 시뮬레이션합니다.

## 사용법

```
/SEMO:dry-run {프롬프트}
```

**예시:**
```
/SEMO:dry-run 로그인 기능 만들어줘
/SEMO:dry-run 랜드 stg 배포해줘
/SEMO:dry-run 테스트 작성해줘
```

## 동작

1. **CLAUDE.md 규칙 적용** - Orchestrator-First Policy 확인
2. **Runtime 감지** - 프로젝트 Runtime 자동 감지
3. **Orchestrator 분석** - 의도 분류 및 라우팅 대상 결정
4. **Skill 정보 조회** - 대상 스킬의 동작 설명
5. **예상 응답 포맷 표시** - 실제 출력 형식 미리보기

## 출력 포맷

```markdown
# SEMO Dry Run 결과

## 입력
> {사용자 프롬프트}

## 플로우 분석

### Step 1: CLAUDE.md 규칙 적용
- Orchestrator-First Policy: ✓ 적용
- Quality Gate: {해당 여부}
- Meta 환경 체크: {해당 여부}

### Step 2: Runtime 감지
- **감지된 Runtime**: nextjs (next.config.ts)
- **References 참조**: `references/runtimes/nextjs/`

### Step 3: Orchestrator 라우팅
- **의도 분류**: {intent_category}
- **매칭 키워드**: {matched_keywords}
- **라우팅 대상**: `{skill_name}` skill

### Step 4: Skill 정보
- **이름**: {skill_name}
- **설명**: {skill_description}
- **사용 도구**: {tools}

### Step 5: 예상 출력
```
[SEMO] Orchestrator: {의도} → skill:{skill_name}
[SEMO] Skill: {skill_name}

{예상 응답 형식}
```

## 참고
- 실제 실행되지 않음
- Memory/Context 변경 없음
- 외부 API 호출 없음
```

## Workflow

### 1. 프롬프트 분석

입력된 프롬프트에서 키워드를 추출하고 orchestrator의 Quick Routing Table과 매칭합니다.

### 2. Runtime 감지

```
파일 스캔 순서:
1. .claude/memory/runtime.md (캐시된 설정)
2. next.config.* → nextjs
3. build.gradle.kts → spring
4. go.mod → go
5. docker-compose.yml → infra
```

### 3. 라우팅 결정

```
키워드 매칭 우선순위:
1. 정확히 일치하는 키워드
2. Runtime 특화 스킬 (nextjs-implement, spring-implement)
3. Core 스킬 (implement, tester, git-workflow)
```

### 4. Skill 정보 조회

`semo-core/skills/{skill_name}/SKILL.md` 파일에서:
- description (frontmatter)
- tools (frontmatter)
- 동작 설명 섹션

### 5. 예상 결과 생성

Skill의 출력 포맷 섹션을 기반으로 예상 응답 형식을 표시합니다.

## 특수 케이스 처리

### Runtime 특화 스킬

```markdown
### Step 2: Runtime 감지
- **감지된 Runtime**: nextjs
- **스킬 선택**: nextjs-implement (Runtime 특화)
- **References**: references/runtimes/nextjs/architecture.md
```

### SEMO 수정 요청

```markdown
### Step 2: Orchestrator 라우팅
- **의도 분류**: SEMO 수정 요청
- **환경 체크 필요**: ✓

**Meta 환경 판별 조건** (모두 충족 필요):
1. 현재 프로젝트가 semo 레포지토리인지:
   - `[ -d ".git" ] && git remote -v | grep -q "semicolon-devteam/semo"`
2. 또는 meta 패키지가 설치되어 있는지:
   - `.claude/agents/` 디렉토리에 meta orchestrator 존재
   - `semo-system/meta/` 디렉토리 존재

**Meta 환경인 경우:**
→ 직접 수정 진행

**일반 환경인 경우 (semo init으로 설치):**
→ 피드백 유도 메시지 출력
```

### Meta 환경 판별 로직 상세

```bash
# Meta 환경 판별 (순서대로 체크)

# 1. 현재 프로젝트가 semo 레포 자체인지
if [ -d ".git" ] && git remote -v 2>/dev/null | grep -q "semicolon-devteam/semo"; then
  echo "✅ Meta 환경 (semo 레포지토리)"
  IS_META=true

# 2. meta 패키지가 설치되어 있는지
elif [ -d "semo-system/meta" ] && [ -f "semo-system/meta/VERSION" ]; then
  echo "✅ Meta 환경 (meta 패키지 설치됨)"
  IS_META=true

# 3. 일반 설치 (semo init)
else
  echo "❌ 일반 환경 (semo init으로 설치)"
  IS_META=false
fi
```

### Meta 환경 판별 결과 예시

**Case 1: semo 레포지토리 clone**
```
현재 상태:
- Git remote: semicolon-devteam/semo ✓
- semo-system/: 실제 semo 소스
- 수정 권한: 있음

→ ✅ Meta 환경 - 직접 수정 가능
```

**Case 2: semo init으로 설치 (일반 환경)**
```
현재 상태:
- Git remote: 다른 프로젝트 레포
- semo-system/: npm 패키지에서 복사됨
- meta 패키지: 미설치

→ ❌ 일반 환경 - /SEMO:feedback으로 요청 유도
```

**Case 3: meta 패키지 설치됨**
```
현재 상태:
- Git remote: 다른 프로젝트 레포
- semo-system/meta/: 설치됨
- meta VERSION: 존재

→ ✅ Meta 환경 - 직접 수정 가능
```

### 배포 요청 (별칭 사용)

```markdown
### Step 2: Orchestrator 라우팅
- **의도 분류**: 배포 요청
- **프로젝트 별칭**: "랜드" → cm-land
- **배포 환경**: STG
- **라우팅 대상**: `deployer` skill

### Step 3: 추가 정보
- **별칭 정의 위치**: `.claude/memory/projects.md`
- **배포 방식**: GitHub Milestone close
```

### 라우팅 실패

```markdown
### Step 2: Orchestrator 라우팅
- **의도 분류**: 분류 불가
- **매칭 키워드**: 없음
- **라우팅 대상**: 없음 (직접 처리)

### 예상 출력
```
[SEMO] Orchestrator: 라우팅 실패 → 적절한 Skill 없음 (직접 처리)
```
```

## Quick Routing Reference (v4.0)

### Core Skills

| 키워드 패턴 | 라우팅 대상 |
|-------------|-------------|
| 코드, 구현, 만들어줘 | `implement` |
| 테스트, 커버리지 | `tester` |
| 계획, 설계 | `planner` |
| 배포, deploy, {별칭} | `deployer` |
| 슬랙, 알림 | `notify-slack` |
| 피드백, 이슈 | `feedback` |
| 커밋, PR, 푸시 | `git-workflow` |
| 기억, 저장 | `memory` |
| 버그 목록 | `list-bugs` |
| 아키텍처, health | `semo-architecture-checker` |
| 도움말 | `semo-help` |

### Runtime 특화 Skills

| Runtime | 키워드 | 스킬 |
|---------|--------|------|
| nextjs | 도메인 생성 | `scaffold-domain` |
| nextjs | Supabase 타입 | `supabase-typegen` |
| nextjs | E2E 테스트 | `e2e-test` |
| spring | CQRS 구현 | `spring-implement` |
| spring | Reactive 검증 | `verify-reactive` |
| infra | Docker 구성 | `scaffold-compose` |
| infra | nginx 설정 | `scaffold-nginx` |

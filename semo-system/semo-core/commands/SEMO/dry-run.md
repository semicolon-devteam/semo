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
2. **Orchestrator 분석** - 의도 분류 및 라우팅 대상 결정
3. **Skill/Agent 정보 조회** - 대상 컴포넌트의 동작 설명
4. **예상 응답 포맷 표시** - 실제 출력 형식 미리보기

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

### Step 2: Orchestrator 라우팅
- **의도 분류**: {intent_category}
- **매칭 키워드**: {matched_keywords}
- **라우팅 대상**: `{skill_name}` skill

### Step 3: Skill 정보
- **이름**: {skill_name}
- **설명**: {skill_description}
- **사용 도구**: {tools}

### Step 4: 예상 출력
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

### 2. 라우팅 결정

```
키워드 매칭 우선순위:
1. 정확히 일치하는 키워드
2. 부분 일치 (contains)
3. 의미적 유사성 (fallback)
```

### 3. Skill 정보 조회

`.claude/skills/{skill_name}/SKILL.md` 파일에서:
- description (frontmatter)
- tools (frontmatter)
- Trigger Keywords 섹션

### 4. 예상 결과 생성

Skill의 출력 포맷 섹션을 기반으로 예상 응답 형식을 표시합니다.

## 특수 케이스 처리

### SEMO 수정 요청

```markdown
### Step 2: Orchestrator 라우팅
- **의도 분류**: SEMO 수정 요청
- **환경 체크 필요**: ✓
- **환경 판별 방법**: `[ -d "semo-system" ] && [ ! -L "semo-system" ]`

**Meta 설치된 경우:**
→ 직접 수정 진행

**패키지만 설치된 경우:**
→ 피드백 유도 메시지 출력
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

## Quick Routing Reference

| 키워드 패턴 | 라우팅 대상 |
|-------------|-------------|
| 코드, 구현, 만들어줘 | `coder` |
| 테스트, 커버리지 | `tester` |
| 계획, 설계 | `planner` |
| 배포, deploy, {별칭} | `deployer` |
| 슬랙, 알림 | `notify-slack` |
| 피드백, 이슈 | `feedback` |
| 버전, 업데이트 | `version-updater` |
| 기억, 저장 | `memory` |
| 버그 목록 | `list-bugs` |
| 아키텍처, health | `semo-architecture-checker` |
| 도움말 | `semo-help` |

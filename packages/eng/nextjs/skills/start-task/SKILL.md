---
name: start-task
description: |
  작업 시작. Use when (1) "랜드 #123 작업 진행", (2) "#45 시작하자",
  (3) "이슈 작업 시작해줘". 이슈 상태 변경 + 브랜치 생성 + Draft PR.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: start-task 호출`

# start-task Skill

> 작업 시작 자동화

## Purpose

GitHub 이슈 작업을 시작하기 위한 전체 프로세스를 자동화합니다:
1. 이슈 정보 조회
2. GitHub Projects 상태 → "작업중" 변경
3. Feature 브랜치 생성
4. Draft PR 생성
5. SDD 프로세스 안내

## Trigger Keywords

- "랜드 #123 작업", "오피스 #45 시작"
- "#123 진행하자", "이슈 시작"
- "작업 시작해줘"

## Input Parsing

```text
"랜드 #123 작업 진행하자"
→ repo: cm-land, issue: 123

"오피스 #45 시작"
→ repo: cm-office, issue: 45

"#123 작업 시작"
→ repo: (현재 디렉토리에서 추론), issue: 123
```

### 레포 별칭

| 별칭 | 실제 레포 |
|------|----------|
| 랜드 | cm-land |
| 오피스 | cm-office |
| 코어 | core-backend |
| 스몰 | cm-small |

## Workflow

### Step 1: 이슈 정보 조회

```bash
# 이슈 상세 정보 조회
gh issue view 123 --repo semicolon-devteam/cm-land --json title,body,labels,assignees,projectItems
```

### Step 1.5: Draft 이슈 감지 및 자동 전환 (NON-NEGOTIABLE)

> **🔴 CRITICAL**: `draft` 라벨이 있는 이슈는 작업 시작 전 자동으로 정식 이슈로 전환합니다.

```bash
# draft 라벨 확인
LABELS=$(gh issue view {number} --repo semicolon-devteam/{repo} --json labels --jq '.labels[].name')

if echo "$LABELS" | grep -q "draft"; then
  # Draft 이슈 감지됨 → 자동 전환 프로세스 시작
  echo "[SEMO] Draft 이슈 감지 → 정식 이슈 전환 시작"
fi
```

#### Draft 감지 시 자동 처리 워크플로우

```text
[draft 라벨 감지]
    ↓
1. 소스베이스 분석 (관련 코드 패턴 파악)
    ↓
2. 기술 구현 명세 자동 생성
    ↓
3. 테스트 케이스 정의
    ↓
4. 이슈 본문 업데이트
    ↓
5. draft 라벨 제거
    ↓
[정식 이슈로 전환 완료]
    ↓
[Step 2로 진행]
```

#### 1. 소스베이스 분석

```bash
# 관련 파일 패턴 분석
# - 기존 DDD 4-Layer 구조 확인
# - 유사 기능 구현 패턴 파악
# - 의존성 및 영향 범위 분석

# 예시: 이슈 제목에서 도메인 추출
DOMAIN=$(echo "{issue_title}" | grep -oE '(posts|comments|likes|users|offices|lands)' | head -1)

# 관련 파일 검색
find app/${DOMAIN} -name "*.ts" -o -name "*.tsx" 2>/dev/null | head -20
```

#### 2. 기술 구현 명세 생성

이슈 본문에 추가할 기술 명세:

```markdown
## 🔧 기술 구현 명세 (Auto-generated)

### 영향 범위
| 레이어 | 파일 | 변경 유형 |
|--------|------|----------|
| Repository | `app/{domain}/_repositories/{Domain}Repository.ts` | 신규/수정 |
| API Client | `app/{domain}/_api-clients/{domain}.client.ts` | 신규/수정 |
| Hooks | `app/{domain}/_hooks/use{Domain}.ts` | 신규/수정 |
| Components | `app/{domain}/_components/{Component}.tsx` | 신규/수정 |

### 구현 패턴
- DDD 4-Layer Architecture
- React Query for data fetching
- Supabase RPC 호출

### 의존성
- 기존 컴포넌트: {existing_components}
- 외부 라이브러리: {dependencies}
```

#### 3. 테스트 케이스 정의

```markdown
## 🧪 테스트 케이스 (Auto-generated)

### Unit Tests
- [ ] Repository: 데이터 조회 성공/실패
- [ ] Hooks: 로딩/성공/에러 상태
- [ ] Components: 렌더링, 인터랙션

### E2E Tests
- [ ] 페이지 로드 및 UI 표시
- [ ] 사용자 인터랙션 플로우
- [ ] 에러 상태 처리
```

#### 4. 이슈 본문 업데이트

```bash
# 기존 본문 + 기술 명세 + 테스트 케이스 병합
gh issue edit {number} --repo semicolon-devteam/{repo} \
  --body "{updated_body}"
```

#### 5. draft 라벨 제거

```bash
gh issue edit {number} --repo semicolon-devteam/{repo} \
  --remove-label "draft"
```

#### Draft 전환 출력

```markdown
[SEMO] Draft 이슈 전환 완료 ✅

### 📋 #{number} 정식 이슈 전환

| 항목 | Before | After |
|------|--------|-------|
| 라벨 | `draft` | (제거됨) |
| 기술 명세 | ❌ | ✅ 추가됨 |
| 테스트 케이스 | ❌ | ✅ 추가됨 |

### 추가된 내용
- 🔧 기술 구현 명세 (영향 범위, 패턴, 의존성)
- 🧪 테스트 케이스 (Unit, E2E)

→ Step 2로 진행합니다.
```

### Step 2: 상태 변경 (GitHub Projects)

```bash
# Project Item ID 조회
ITEM_ID=$(gh api graphql -f query='
query {
  repository(owner: "semicolon-devteam", name: "cm-land") {
    issue(number: 123) {
      projectItems(first: 1) {
        nodes {
          id
          project {
            id
          }
        }
      }
    }
  }
}' --jq '.data.repository.issue.projectItems.nodes[0].id')

# Status 필드 ID와 "작업중" 옵션 ID 조회
PROJECT_ID=$(gh api graphql -f query='...' --jq '...')
STATUS_FIELD_ID=$(gh api graphql -f query='...' --jq '...')
IN_PROGRESS_ID=$(gh api graphql -f query='...' --jq '...')

# 상태 변경
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: "'$PROJECT_ID'"
      itemId: "'$ITEM_ID'"
      fieldId: "'$STATUS_FIELD_ID'"
      value: { singleSelectOptionId: "'$IN_PROGRESS_ID'" }
    }
  ) {
    projectV2Item { id }
  }
}
'
```

### Step 3: Feature 브랜치 생성

```bash
# 이슈 제목에서 slug 생성
SLUG=$(echo "로그인 페이지 구현" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')

# 브랜치 생성
git checkout -b feature/123-${SLUG}

# 원격에 푸시
git push -u origin feature/123-${SLUG}
```

### Step 4: Draft PR 생성

```bash
gh pr create \
  --repo semicolon-devteam/cm-land \
  --title "[Draft] #123 로그인 페이지 구현" \
  --body "$(cat <<'EOF'
## 관련 이슈
closes #123

## 변경 사항
- [ ] 작업 진행 중

## 체크리스트
- [ ] Spec 작성 완료
- [ ] 구현 완료
- [ ] 테스트 통과
- [ ] 리뷰 요청

---
🤖 Generated by SEMO (eng/nextjs)
EOF
)" \
  --draft
```

### Step 5: 다음 단계 선택지 제시 (NON-NEGOTIABLE)

> **🔴 CRITICAL**: 작업 환경 세팅 완료 후 **반드시** 다음 단계 선택지를 제시합니다.

```markdown
## 🚀 작업 환경 준비 완료!

다음 단계를 선택해주세요:

| 옵션 | 적합한 경우 | 키워드 |
|------|------------|--------|
| **A. SDD 전체** (권장) | 새 기능, 복잡한 로직, AC 필요 | "스펙부터 시작" |
| **B. 바로 구현** | 명확한 요구사항, 간단한 기능 | "구현 시작" |
| **C. Fast-track** | 오타/스타일 수정, 3파일 이하 | "패스트트랙" |

**선택하세요**: A, B, 또는 C
```

### 선택지별 라우팅

| 선택 | 라우팅 대상 | 동작 |
|------|------------|------|
| A | `skill:spec` | SDD Phase 1-3 시작 |
| B | `implementation-master` | ADD Phase 4 바로 시작 (v0.0.x부터) |
| C | `skill:fast-track` | 간소화된 수정 프로세스 |

### 자동 권장 기준

| 이슈 라벨 | 권장 옵션 |
|----------|----------|
| `feature`, `enhancement` | A (SDD 전체) |
| `bug`, `hotfix` | B 또는 C |
| `typo`, `style` | C (Fast-track) |

## Output Format

```markdown
## 작업 시작: cm-land #123

### 이슈 정보

| 항목 | 내용 |
|------|------|
| **제목** | 로그인 페이지 구현 |
| **라벨** | feature, frontend |
| **담당자** | @reus |

### 완료된 작업

✅ GitHub Projects 상태 → "작업중" 변경
✅ 브랜치 생성: `feature/123-로그인-페이지-구현`
✅ Draft PR 생성: #150

### 🚀 다음 단계 선택

| 옵션 | 적합한 경우 | 키워드 |
|------|------------|--------|
| **A. SDD 전체** (권장) | 새 기능, 복잡한 로직 | "스펙부터 시작" |
| **B. 바로 구현** | 명확한 요구사항 | "구현 시작" |
| **C. Fast-track** | 경미한 수정 | "패스트트랙" |

**선택하세요**: A, B, 또는 C
```

## Expected Output

```markdown
[SEMO] Skill: start-task 호출

## 작업 시작: cm-land #123

### 이슈 정보

| 항목 | 내용 |
|------|------|
| **제목** | 로그인 페이지 구현 |
| **라벨** | feature |
| **담당자** | @reus |

### 완료된 작업

✅ 상태 변경: 대기중 → 작업중
✅ 브랜치: `feature/123-로그인-페이지-구현`
✅ Draft PR: #150

### 🚀 다음 단계 선택

| 옵션 | 적합한 경우 | 키워드 |
|------|------------|--------|
| **A. SDD 전체** (권장) | 새 기능, 복잡한 로직 | "스펙부터 시작" |
| **B. 바로 구현** | 명확한 요구사항 | "구현 시작" |
| **C. Fast-track** | 경미한 수정 | "패스트트랙" |

💡 **라벨 기반 권장**: `feature` 라벨 → **A. SDD 전체** 권장

**선택하세요**: A, B, 또는 C

[SEMO] Skill: start-task 완료
```

## Error Handling

### 이슈를 찾을 수 없는 경우

```markdown
❌ cm-land에서 #123 이슈를 찾을 수 없습니다.

확인사항:
- 이슈 번호가 올바른가요?
- 레포 이름이 올바른가요? (랜드 = cm-land)
- 이슈가 Open 상태인가요?
```

### 이미 작업중인 경우

```markdown
⚠️ #123은 이미 "작업중" 상태입니다.

현재 상태:
- 브랜치: feature/123-로그인-페이지-구현 (존재함)
- PR: #150 (Draft)

계속 진행하시겠습니까?
```

## References

- [eng/nextjs CLAUDE.md](../../CLAUDE.md)
- [git-workflow Skill](../git-workflow/SKILL.md)
- [implement Skill](../implement/SKILL.md)
- [spec Skill](../spec/SKILL.md)

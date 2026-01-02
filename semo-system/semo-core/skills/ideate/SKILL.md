---
name: ideate
description: |
  아이디어 탐색부터 Epic 생성까지 원스톱 워크플로우. Use when (1) 러프한 아이디어가 있을 때,
  (2) 새 기능/프로젝트 구상 시, (3) "뭔가 만들고 싶어", (4) 가설 수립 및 검증 필요 시.
tools: [Read, Write, Edit, Bash, AskUserQuestion]
location: project
triggers:
  - 아이디어가 있는데
  - 뭔가 만들고 싶어
  - 이런 거 되나
  - 새 기능 구상
  - 프로젝트 시작하고 싶어
  - 가설 세워보자
---

> **시스템 메시지**: `[SEMO] Skill: ideate 호출 - {아이디어 요약}`

# ideate Skill

**Purpose**: 러프한 아이디어를 구조화된 Epic으로 발전시키는 원스톱 워크플로우

## 핵심 원칙

> **Source of Truth**: Design Brief가 아이디어의 진실 소스
> **Epic 역할**: 팀 협업 허브 (Design Brief 링크 + 개발자 체크리스트)

## Workflow Overview

```text
[러프 아이디어]
      ↓
Phase 1: Brainstorming (3단계)
  - 아이디어 이해
  - 접근 방식 탐색
  - 디자인 합의
      ↓
Phase 2: 기술 검증 (선택)
  - spike 필요 여부 판단
  - explore-approach 연계
      ↓
Phase 3: Epic 생성
  - dev-checklist 자동 검증
  - Design Brief → Epic 자동 변환
      ↓
[Specification Phase로 진행]
```

## Phase 1: Brainstorming

### Step 1: 아이디어 이해

**단일 질문 원칙**으로 핵심 파악:

```markdown
💡 한 가지만 여쭤볼게요:
이 기능으로 사용자가 어떤 문제를 해결하게 되나요?
```

**집중 영역**:

| 영역 | 질문 |
|------|------|
| Purpose | 왜 이 기능이 필요한가? |
| Constraints | 어떤 제한이 있는가? |
| Success | 어떻게 성공을 측정하는가? |

### Step 2: 접근 방식 탐색

2-3가지 옵션을 **객관식**으로 제시:

```markdown
🔍 접근 방식 옵션

**A) 최소 구현 (MVP)**
- 장점: 빠른 검증, 낮은 리스크
- 단점: 기능 제한
- 추천: 아이디어 검증 필요 시

**B) 표준 구현** (권장)
- 장점: 균형잡힌 기능성
- 단점: 중간 복잡도
- 추천: 명확한 요구사항 존재 시

**C) 확장 구현**
- 장점: 완전한 기능 세트
- 단점: 높은 복잡도
- 추천: 장기 로드맵 확정 시

어떤 방향으로 진행할까요? (A/B/C)
```

### Step 3: 디자인 합의

Design Brief 작성 후 `docs/design-briefs/{feature-name}.md`에 저장:

```markdown
# Design Brief: {기능명}

## 1. 문제 정의
- 현재 상황: {현재 사용자 경험}
- 문제점: {해결해야 할 핵심 문제}
- 영향: {비즈니스/사용자 영향}

## 2. 목표
- Primary: {핵심 목표}
- Secondary: {부가 목표}
- Non-goals: {명시적 범위 외}

## 3. 사용자 시나리오
1. 사용자가 {action}
2. 시스템이 {response}
3. 결과로 {outcome}

## 4. 제약사항
- 기술적: {기존 스택, 성능}
- 비즈니스: {일정, 리소스}
- 사용자: {접근성, 호환성}

## 5. 성공 지표
- [ ] {측정 가능한 지표 1}
- [ ] {측정 가능한 지표 2}
```

## Phase 2: 기술 검증 (선택)

### spike 필요 여부 판단

**자동 감지 패턴**:

| 패턴 | 예시 |
|------|------|
| 가능성 불확실 | "이게 가능한지 모르겠어" |
| 성능 우려 | "성능이 괜찮을지..." |
| 라이브러리 선택 | "어떤 라이브러리가 좋을지" |
| 복수 옵션 | 구현 방식 간 선택 기준 부재 |

**spike 필요 시**:

```markdown
⚠️ 기술적 불확실성 감지

다음 사항에 대해 spike가 필요해 보입니다:
- {불확실한 기술 주제}

A) spike 먼저 진행 → skill:explore-approach 호출
B) 현재 정보로 계속 → 리스크 인지 후 진행
```

## Phase 3: Epic 생성

### 🔴 dev-checklist 자동 검증 (필수)

Design Brief 완성 후 개발자 관점 체크리스트 자동 검증:

| 카테고리 | 검증 항목 |
|----------|----------|
| 데이터 흐름 | 충돌 해결 정책, 멀티플랫폼 동기화, 삭제 정책 |
| 시간/계산 | 집계 기준, 일할 계산, 타임존 |
| 플랫폼 제약 | PWA/웹/네이티브 제약 및 대안 |
| 도메인 지식 | 업계 표준, 엣지 케이스 |

**누락 항목 발견 시**:

```markdown
⚠️ 개발자 관점 체크리스트 미충족

다음 항목이 Design Brief에 누락되었습니다:

| 항목 | 필요한 정보 |
|------|------------|
| 데이터 충돌 | 동시 수정 시 어떻게 처리? |
| 오프라인 | 오프라인 지원 필요? |

추가 정보를 입력해주세요.
```

### Epic 자동 생성

Design Brief + dev-checklist 검증 완료 후 Epic 생성:

```bash
# 1. Epic 본문 생성 (Design Brief 링크 포함)
EPIC_BODY=$(cat <<'EOF'
## 📋 {기능명}

## 🔗 Design Brief
[Design Brief 전문]({design_brief_url})

## 🎯 Goals
{goals_from_design_brief}

## ⚠️ 개발자 체크리스트
{dev_checklist_answers}

## 📊 Success Metrics
{success_metrics}
EOF
)

# 2. Epic Issue 생성
gh issue create \
  --repo semicolon-devteam/docs \
  --title "[Epic] {도메인} · {기능명}" \
  --body "$EPIC_BODY" \
  --label "{project_label}"

# 3. GitHub Projects 연동 + Issue Type 설정
# (create-epic과 동일한 로직)
```

## Output Format

### Ideation 완료

```markdown
[SEMO] Skill: ideate 완료

## 🎯 Ideation Summary

### Design Brief
- 파일: docs/design-briefs/{feature-name}.md
- GitHub: {design_brief_url}

### Epic 생성
- 번호: #{epic_number}
- URL: {epic_url}
- 상태: 검수대기

### 개발자 체크리스트
✅ 데이터 흐름: 충돌 시 최신 우선
✅ 시간/계산: KST 기준 일별 집계
✅ 플랫폼: PWA (오프라인 미지원)

### 다음 단계
1. **Spec 작성**: "spec 작성해줘" 또는 `/speckit.specify`
2. **Epic 검토**: {epic_url}에서 내용 확인
```

## Usage

```javascript
// 러프한 아이디어
skill: ideate("사용자 참여를 늘리고 싶은데");

// 명시적 기능 구상
skill: ideate({ idea: "댓글 기능", domain: "comments" });

// spike 포함 요청
skill: ideate({ idea: "실시간 알림", spike: true });
```

## Related Skills

- `explore-approach` - 기술 불확실성 탐색 (spike)
- `create-epic` - Epic 생성 (ideate에서 자동 호출)
- `generate-spec` - Specification Phase (ideate 이후)

## References

- [Brainstorming Guide](references/brainstorming-guide.md) - 질문 기법, 옵션 설계
- [Dev Checklist](references/dev-checklist.md) - 개발자 관점 검증 항목
- [Design Brief Template](references/design-brief-template.md) - 템플릿 및 예시

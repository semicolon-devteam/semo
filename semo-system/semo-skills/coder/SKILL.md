---
name: coder
description: |
  코드 작성 및 수정. Use when (1) "코드 작성해줘", "구현해줘",
  (2) 기능 추가/수정, (3) 버그 수정.
tools: [Read, Write, Edit, Bash, Glob, Grep]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: coder` 시스템 메시지를 첫 줄에 출력하세요.

# coder Skill

> 코드 작성 및 수정 자동화

## Trigger Keywords

- "코드 작성해줘", "구현해줘"
- "기능 추가해줘", "수정해줘"
- "버그 수정해줘"

## Workflow

1. 요구사항 분석
2. 기존 코드 파악 (Read, Glob, Grep)
3. 코드 작성/수정 (Write, Edit)
4. **증분 검증** (파일 작성 후 즉시)
5. 전체 검증 (Bash: lint, typecheck)

---

## 🔴 증분 검증 규칙 (NON-NEGOTIABLE)

> **⚠️ 파일 작성/수정 후 반드시 증분 검증을 수행합니다.**

### 검증 순서

```text
파일 작성/수정
    ↓
1. Import 경로 검증 (해당 경로 존재 여부)
2. ESLint 단일 파일 검증
3. TypeScript 타입 체크
    ↓
통과 시 → 다음 파일
실패 시 → 즉시 수정 후 재검증
```

### 검증 명령어

```bash
# 1. ESLint 단일 파일
npx eslint {file_path} --fix

# 2. TypeScript 타입 체크
npx tsc --noEmit

# 3. Import 경로 존재 확인 (선택)
# 새 import 추가 시 기존 코드베이스에서 해당 경로 사용 예시 확인
```

### 금지 행위

| 행위 | 상태 |
|------|------|
| 여러 파일 작성 후 한번에 검증 | ❌ 금지 |
| lint 에러 무시하고 다음 파일 진행 | ❌ 금지 |
| 존재하지 않는 import 경로 사용 | ❌ 금지 |
| DB 마이그레이션 후 타입 미동기화 | ❌ 금지 |

### Supabase 프로젝트 특별 규칙

```text
DB 마이그레이션 감지 시:
1. 마이그레이션 실행
2. npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
3. 코드 작성 시작
```

---

## Quality Rules

- 기존 코드 스타일 준수
- 타입 안전성 확보
- 불필요한 변경 최소화
- **증분 검증 필수** (파일당 즉시 검증)

---

## 🔴 Icon Pack Standard (React/Next.js)

> **⚠️ UI 컴포넌트 작성 시 SVG 인라인 작성 금지. 표준 아이콘 팩 사용.**

### 권장 패키지

| 패키지 | 설치 | 용도 |
|--------|------|------|
| **Lucide React** | `npm i lucide-react` | 기본 권장 (트리쉐이킹 최적) |
| Heroicons | `npm i @heroicons/react` | Tailwind 프로젝트 |

### 사용법

```tsx
import { Search, Menu, X } from 'lucide-react';
<Search className="w-5 h-5" />
```

### 금지

```tsx
// ❌ SVG path 직접 작성 금지 (렌더링 버그 위험)
<svg viewBox="0 0 24 24"><path d="..."/></svg>
```

---

## 🔴 Post-Action Triggers (구현 완료 후 자동 동작)

> **⚠️ 구현 작업 완료 시 반드시 아래 동작을 수행합니다.**

### 1. 커밋 프롬프트 자동 제시

```text
구현 완료 감지 조건:
- 파일 생성/수정 완료
- 증분 검증 통과 (lint + typecheck)
- 사용자 요청 작업 완료
    ↓
자동 프롬프트 출력
```

**출력 포맷**:

```markdown
[SEMO] Skill: coder 완료

✅ **구현 완료**: {작업 요약}
📁 **변경 파일**: {파일 목록}

---

💡 **다음 단계**: 변경사항을 커밋할까요?
   - "커밋해줘" → git-workflow 스킬 호출
   - "아니" → 추가 작업 대기
```

### 2. GitHub Issue 진행상황 코멘트 (선택)

> **⚠️ 현재 브랜치가 이슈 번호를 포함하는 경우에만 동작합니다.**

```bash
# 이슈 번호 추출
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
```

**마일스톤 감지 조건**:

| 마일스톤 | 감지 조건 | 코멘트 내용 |
|----------|----------|-------------|
| 구현 시작 | coder 스킬 최초 호출 | "🚀 구현 시작" |
| 주요 기능 완료 | 핵심 파일 생성/수정 완료 | "✅ {기능명} 구현 완료" |
| 전체 완료 | 모든 요청 작업 완료 | "🎉 구현 완료 - 리뷰 준비됨" |

**코멘트 명령**:

```bash
gh issue comment $ISSUE_NUM --body "🤖 **SEMO 진행상황 업데이트**

{마일스톤 내용}

---
_자동 생성된 코멘트입니다._"
```

### 3. 자동 동작 비활성화

사용자가 아래 키워드 사용 시 Post-Action 건너뛰기:

- "프롬프트 없이"
- "자동 커밋 안 해도 돼"
- "계속 작업할 거야"

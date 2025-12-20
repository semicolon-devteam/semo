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

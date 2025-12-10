---
name: memory
description: |
  SAX 세션 간 컨텍스트 영속화 (공통 Skill). Use when (1) 아키텍처 결정 사항 저장,
  (2) 팀 선호도 기록, (3) 자주 참조하는 파일 캐싱, (4) 세션 간 맥락 유지.
  "기억 상실" 문제 해결을 위한 장기 메모리 시스템.
tools: [Read, Write, Bash, Glob]
model: inherit
---

> **시스템 메시지**: `[SAX] Skill: memory 호출 - {action}`

# SAX Memory Skill

> 세션 간 컨텍스트 영속화를 위한 장기 메모리 시스템 (SAX Core 공통 Skill)

## Purpose

Claude Code의 "기억 상실(Amnesia)" 문제를 해결합니다:
- 세션 간 아키텍처 결정 사항 유지
- 팀 선호도 및 규칙 기록
- 자주 참조하는 파일/패턴 캐싱
- 프로젝트별 맥락 저장

## Memory Storage

```text
.claude/memory/
├── decisions.json      # 아키텍처 결정 사항
├── preferences.json    # 팀/사용자 선호도
├── cache/              # 자주 참조하는 패턴 캐시
│   ├── patterns.json
│   └── snippets.json
└── context/            # 프로젝트별 맥락
    └── {project}.json
```

## Actions

### 1. save - 메모리 저장

```markdown
skill:memory save {category} {key} {value}

예시:
skill:memory save decision "api-pattern" "모든 API 응답은 JSON Envelope 패턴 사용"
skill:memory save preference "code-style" "camelCase 변수명, PascalCase 컴포넌트명"
```

### 2. load - 메모리 로드

```markdown
skill:memory load {category} {key?}

예시:
skill:memory load decision              # 모든 결정 사항 로드
skill:memory load decision "api-pattern"  # 특정 결정 사항 로드
skill:memory load preference            # 모든 선호도 로드
```

### 3. list - 메모리 목록

```markdown
skill:memory list {category?}

예시:
skill:memory list                # 모든 카테고리 목록
skill:memory list decision       # 결정 사항 목록
skill:memory list preference     # 선호도 목록
```

### 4. delete - 메모리 삭제

```markdown
skill:memory delete {category} {key}

예시:
skill:memory delete decision "api-pattern"
```

### 5. sync - 세션 시작 시 자동 로드

```markdown
skill:memory sync

세션 시작 시 자동 호출:
1. decisions.json 로드 → 아키텍처 결정 복원
2. preferences.json 로드 → 선호도 복원
3. context/{project}.json 로드 → 프로젝트 맥락 복원
```

## Workflow

### 세션 시작 시 (자동)

```text
1. .claude/memory/ 존재 확인
2. 존재하면 skill:memory sync 자동 호출
3. 메모리 내용을 현재 세션 컨텍스트에 주입
```

### 아키텍처 결정 시

```text
사용자: "API 응답은 JSON Envelope 패턴을 사용하자"
    ↓
Claude: 결정 사항 적용
    ↓
자동: skill:memory save decision "api-envelope" "JSON Envelope 패턴 사용"
    ↓
다음 세션에서도 이 결정 유지
```

### 선호도 기록 시

```text
사용자: "변수명은 camelCase로 해줘"
    ↓
Claude: 선호도 적용
    ↓
자동: skill:memory save preference "naming-convention" "camelCase"
    ↓
다음 세션에서도 이 선호도 적용
```

## Memory Schema

### decisions.json

```json
{
  "version": "1.0.0",
  "updated_at": "2025-12-10T10:00:00Z",
  "decisions": {
    "api-envelope": {
      "value": "모든 API 응답은 JSON Envelope 패턴 사용",
      "created_at": "2025-12-10T10:00:00Z",
      "context": "API 설계 논의"
    },
    "error-handling": {
      "value": "Result 타입으로 에러 처리",
      "created_at": "2025-12-10T10:30:00Z",
      "context": "에러 처리 표준화"
    }
  }
}
```

### preferences.json

```json
{
  "version": "1.0.0",
  "updated_at": "2025-12-10T10:00:00Z",
  "preferences": {
    "naming-convention": {
      "variables": "camelCase",
      "components": "PascalCase",
      "files": "kebab-case"
    },
    "code-style": {
      "indent": 2,
      "quotes": "single",
      "semicolon": false
    },
    "language": "ko"
  }
}
```

### context/{project}.json

```json
{
  "project": "cm-office",
  "updated_at": "2025-12-10T10:00:00Z",
  "architecture": {
    "framework": "Next.js 14",
    "database": "Supabase",
    "styling": "Tailwind CSS"
  },
  "patterns": {
    "data-fetching": "Server Actions",
    "state-management": "Zustand"
  },
  "recent_files": [
    "src/app/dashboard/page.tsx",
    "src/components/Button.tsx"
  ]
}
```

## Expected Output

### save 예시

```markdown
[SAX] Skill: memory 호출 - save

✅ 메모리 저장 완료

| 항목 | 값 |
|------|------|
| 카테고리 | decision |
| 키 | api-pattern |
| 값 | 모든 API 응답은 JSON Envelope 패턴 사용 |
| 저장 위치 | .claude/memory/decisions.json |
```

### load 예시

```markdown
[SAX] Skill: memory 호출 - load

## 저장된 결정 사항

| 키 | 값 | 생성일 |
|------|------|------|
| api-pattern | JSON Envelope 패턴 사용 | 2025-12-10 |
| error-handling | Result 타입으로 에러 처리 | 2025-12-10 |
```

### sync 예시

```markdown
[SAX] Skill: memory 호출 - sync

=== 세션 메모리 복원 ===

✅ 결정 사항 2건 로드
✅ 선호도 3건 로드
✅ 프로젝트 맥락 로드 (cm-office)

세션 컨텍스트에 적용 완료
```

## Trigger Keywords

- `skill:memory {action}`
- "기억해줘", "저장해줘"
- "이전 결정 사항", "뭘로 했더라"
- "선호도 확인", "설정 확인"

## Integration

### 세션 초기화 연동

`skill:version-updater`의 세션 초기화 과정에서 자동 호출:

```text
1. 버전 체크
2. 구조 검증
3. skill:memory sync ← 자동 호출
4. 세션 초기화 완료
```

### MCP 연동 (선택)

Memory MCP 서버가 설치된 경우 연동 가능:

```json
// ~/.claude.json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@mkreyman/mcp-memory-keeper"]
    }
  }
}
```

## SAX Message Format

```markdown
[SAX] Skill: memory 호출 - {action}

[SAX] Skill: memory 완료 - {결과 요약}
```

## References

- [memory-schema.md](references/memory-schema.md) - 메모리 스키마 상세
- [memory-sync.md](references/memory-sync.md) - 동기화 워크플로우

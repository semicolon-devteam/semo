---
name: health
description: SEMO 환경 및 구조 통합 검증 - 개발 환경 + 구조 + 토큰 리포트
---

# /SEMO:health Command

SEMO 환경 및 구조 통합 검증

> **공통 커맨드**: 모든 SEMO 프로젝트에서 사용 가능

## Trigger

- `/SEMO:health` 명령어
- "환경 확인", "도구 확인", "설치 확인"
- "SEMO 상태", "구조 확인"

## Purpose

이 명령어는 다음을 검증합니다:

1. **개발 환경**: Node.js, Git, GitHub CLI 등
2. **SEMO 구조**: semo-system, .claude 디렉토리
3. **MCP 설정**: semo-integrations 연결 상태
4. **토큰 사용량**: 컨텍스트 비용 추정

## Action

```markdown
[SEMO] Command: health 실행

> SEMO 환경을 검증합니다.
```

## Workflow

### Phase 1: 개발 환경 검증

기본 개발 도구 설치 상태 확인:

| 도구 | 검증 명령 |
|------|----------|
| Node.js | `node --version` |
| Git | `git --version` |
| GitHub CLI | `gh --version` |
| pnpm/npm | `pnpm --version` |

### Phase 2: SEMO 구조 검증

```
your-project/
├── .claude/
│   ├── CLAUDE.md           # 프로젝트 설정
│   ├── settings.json       # MCP 설정
│   ├── memory/             # Context Mesh
│   ├── agents → ../semo-system/semo-core/agents
│   └── skills → ../semo-system/semo-skills
│
└── semo-system/            # White Box
    ├── semo-core/
    └── semo-skills/
```

### Phase 3: MCP 설정 검증

`.claude/settings.json`의 MCP 서버 설정 확인:

```json
{
  "mcpServers": {
    "semo-integrations": {
      "command": "npx",
      "args": ["-y", "@team-semicolon/semo-mcp"]
    }
  }
}
```

### Phase 4: Supabase 연결 검증 (Next.js 패키지 설치 시)

> 이 Phase는 `semo-system/next/` 또는 Next.js 프로젝트에서만 실행됩니다.

**검증 항목:**

| 항목 | 환경 변수 | 필수 |
|------|----------|------|
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` | 필수 |
| Supabase Anon Key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 필수 |
| Service Role Key | `SUPABASE_SERVICE_ROLE_KEY` | 선택 |

**Supabase CLI 확인:**

```bash
# CLI 설치 확인
supabase --version

# 로그인 상태 확인
supabase projects list
```

### Phase 5: 토큰 사용량 리포트

SEMO 구조의 토큰 사용량을 분석:

| 항목 | 예상 토큰 |
|------|----------|
| CLAUDE.md | ~500-1,000 |
| Principles | ~1,000-2,000 |
| Skills 정의 | ~5,000-10,000 |
| **총 예상** | ~10,000-15,000 |

**토큰 추정 방식**:
- 약 4자 = 1 토큰 (영문)
- 약 2자 = 1 토큰 (한글)

## Expected Output

```markdown
[SEMO] Command: health 실행

=== Phase 1: 개발 환경 검증 ===

| 도구 | 상태 | 버전 |
|------|------|------|
| Node.js | OK | v20.10.0 |
| Git | OK | v2.43.0 |
| GitHub CLI | OK | v2.40.0 |
| pnpm | OK | v8.14.0 |

=== Phase 2: SEMO 구조 검증 ===

| 항목 | 상태 |
|------|------|
| semo-system/ | OK |
| semo-core/ | OK |
| semo-skills/ | OK |
| .claude/CLAUDE.md | OK |
| .claude/settings.json | OK |
| .claude/memory/ | OK |
| agents symlink | OK |
| skills symlink | OK |

=== Phase 3: MCP 설정 검증 ===

| MCP 서버 | 상태 |
|----------|------|
| semo-integrations | OK |

=== Phase 4: Supabase 연결 검증 (Next.js 감지) ===

| 항목 | 상태 |
|------|------|
| NEXT_PUBLIC_SUPABASE_URL | OK |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | OK |
| SUPABASE_SERVICE_ROLE_KEY | ⚠️ 미설정 (선택) |
| Supabase CLI | OK (v1.x.x) |
| 연결된 프로젝트 | my-project (ap-northeast-1) |

=== Phase 5: 토큰 사용량 리포트 ===

| 항목 | 파일 수 | 예상 토큰 |
|------|---------|----------|
| CLAUDE.md | 1 | ~800 |
| Principles | 2 | ~1,500 |
| Skills | 15 | ~6,000 |
| **총 예상** | | **~8,300** |

=== 결과 ===
모든 항목 정상
```

## Troubleshooting

### semo-system/ 없음

```bash
npx @team-semicolon/semo-cli init
```

### MCP 설정 없음

`.claude/settings.json` 생성 또는:

```bash
npx @team-semicolon/semo-cli init --skip-subtree
```

### 심볼릭 링크 깨짐

```bash
npx @team-semicolon/semo-cli init --force
```

## Related

- [SEMO CLI](../../packages/cli/)
- [SEMO MCP Server](../../packages/mcp-server/)

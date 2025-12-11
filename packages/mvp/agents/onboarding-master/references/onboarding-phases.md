# Onboarding Phases Reference

## Phase Overview

```
Phase 0: 환경 검증 ─────────────────────────────────┐
  │ Node.js, pnpm, Git, gh, Supabase CLI           │
  ▼                                                 │
Phase 1: MCP 서버 검증 ─────────────────────────────│
  │ Context7, Sequential-thinking, TestSprite       │
  │ Supabase MCP, GitHub MCP                        │
  ▼                                                 │
Phase 2: Antigravity 설정 ──────────────────────────│
  │ .agent/rules/, .agent/workflows/                │
  ▼                                                 │
Phase 3: core-interface 동기화 ─────────────────────│
  │ OpenAPI spec → TypeScript types                 │
  ▼                                                 │
Phase 4: Supabase 연결 ─────────────────────────────│
  │ Client setup, 환경 변수, 연결 테스트            │
  ▼                                                 │
Phase 5: Schema Extension 학습 ─────────────────────┘
  │ metadata → 컬럼 → 테이블 패턴
  ▼
  ONBOARDING COMPLETE
```

---

## Phase 0: 환경 검증

### 필수 도구 체크리스트

| 도구 | 최소 버전 | 설치 명령어 |
|------|----------|------------|
| Node.js | v18.0.0 | `brew install node` |
| pnpm | v8.0.0 | `npm install -g pnpm` |
| Git | - | `brew install git` |
| GitHub CLI | - | `brew install gh` |
| Supabase CLI | - | `brew install supabase/tap/supabase` |

### 버전 확인 스크립트

```bash
#!/bin/bash
echo "=== MVP 환경 검증 ==="
echo "Node.js: $(node --version)"
echo "pnpm: $(pnpm --version)"
echo "Git: $(git --version | cut -d' ' -f3)"
echo "GitHub CLI: $(gh --version | head -1 | cut -d' ' -f3)"
echo "Supabase CLI: $(supabase --version | cut -d' ' -f2)"
```

---

## Phase 1: MCP 서버 검증

### Context7

- **용도**: 문서 검색, 코드베이스 탐색
- **검증 방법**: `resolve-library-id` 호출

### Sequential-thinking

- **용도**: 구조화된 추론, 복잡한 문제 분석
- **검증 방법**: 추론 요청 테스트

### TestSprite

- **용도**: 테스트 자동 생성
- **검증 방법**: 테스트 생성 요청

### Supabase MCP

- **용도**: 데이터베이스 직접 접근
- **검증 방법**: 프로젝트 목록 조회

### GitHub MCP

- **용도**: 리포지토리, 이슈, PR 관리
- **검증 방법**: `semicolon-devteam` 접근

---

## Phase 2: Antigravity 설정

### Rules 파일 역할

| 파일 | 역할 |
|------|------|
| sax-context.md | SAX 원칙 (Orchestrator-First, Transparency) 주입 |
| ddd-patterns.md | DDD 4-layer 아키텍처 규칙 |
| schema-extension.md | 스키마 확장 전략 (metadata 우선) |

### Workflows 파일 역할

| 파일 | 트리거 | 역할 |
|------|--------|------|
| mockup.md | `/mockup` | Nano Banana Pro로 UI 목업 생성 |
| component.md | `/component` | React 컴포넌트 스캐폴딩 |
| browser-test.md | `/browser-test` | 브라우저 서브에이전트로 시각적 검증 |

### `.agent/` 마이그레이션 스크립트

```bash
#!/bin/bash
# migrate-agent-folder.sh
# MVP 프로젝트에 .agent/ 폴더 마이그레이션

set -e

SAX_MVP_PATH="${SAX_MVP_PATH:-../sax/sax-mvp}"
TARGET_PATH="${1:-.}"

echo "=== .agent/ 폴더 마이그레이션 ==="
echo "Source: $SAX_MVP_PATH/.agent"
echo "Target: $TARGET_PATH/.agent"
echo ""

# 기존 .agent 폴더 확인
if [ -d "$TARGET_PATH/.agent" ]; then
    echo "⚠️  기존 .agent/ 폴더 발견"
    read -p "백업 후 진행하시겠습니까? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        BACKUP_NAME=".agent-backup-$(date +%Y%m%d%H%M%S)"
        mv "$TARGET_PATH/.agent" "$TARGET_PATH/$BACKUP_NAME"
        echo "✅ 백업 완료: $BACKUP_NAME"
    else
        echo "❌ 마이그레이션 취소"
        exit 1
    fi
fi

# .agent 폴더 복사
cp -r "$SAX_MVP_PATH/.agent" "$TARGET_PATH/"
echo "✅ .agent/ 폴더 복사 완료"

# 파일 확인
echo ""
echo "=== 마이그레이션 결과 ==="
echo "Rules:"
ls -la "$TARGET_PATH/.agent/rules/" 2>/dev/null || echo "  ❌ rules 폴더 없음"
echo ""
echo "Workflows:"
ls -la "$TARGET_PATH/.agent/workflows/" 2>/dev/null || echo "  ❌ workflows 폴더 없음"

echo ""
echo "🎉 마이그레이션 완료!"
echo "Antigravity IDE에서 프로젝트를 열어 확인하세요."
```

### 마이그레이션 검증 체크리스트

| 항목 | 확인 방법 |
|------|----------|
| `.agent/` 폴더 존재 | `ls -la .agent/` |
| rules 3개 파일 | `ls .agent/rules/*.md \| wc -l` (3) |
| workflows 3개 파일 | `ls .agent/workflows/*.md \| wc -l` (3) |
| Antigravity 인식 | IDE에서 프로젝트 열기 후 사이드바 확인 |
| `/mockup` 동작 | 채팅창에서 `/mockup 테스트` 실행 |

---

## Phase 3: core-interface 동기화

### 동기화 워크플로우

```bash
# 1. 최신 릴리스 확인
LATEST_TAG=$(gh api repos/semicolon-devteam/core-interface/releases/latest --jq '.tag_name')
echo "Latest release: $LATEST_TAG"

# 2. OpenAPI 스펙 다운로드
SPEC_URL=$(gh api repos/semicolon-devteam/core-interface/releases/latest \
  --jq '.assets[] | select(.name == "core.backend.spec.json") | .browser_download_url')
curl -L "$SPEC_URL" -o core.backend.spec.json

# 3. TypeScript 타입 생성
npx openapi-typescript core.backend.spec.json -o src/types/core-interface.ts

# 4. 정리
rm core.backend.spec.json
```

### 생성되는 타입 예시

```typescript
// src/types/core-interface.ts (자동 생성)
export interface components {
  schemas: {
    Post: {
      id: number;
      title: string;
      content: string;
      metadata: Record<string, unknown>;
      // ...
    };
    User: {
      id: string;
      username: string;
      // ...
    };
  };
}
```

---

## Phase 4: Supabase 연결

### 클라이언트 설정 파일 구조

```
lib/
└── supabase/
    ├── client.ts     # 브라우저 클라이언트
    ├── server.ts     # 서버 클라이언트
    └── middleware.ts # 미들웨어 설정
```

### 환경 변수

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# 서버 전용 (선택)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 연결 테스트

```typescript
// 테스트 스크립트
import { createSupabaseClient } from '@/lib/supabase/client';

const supabase = createSupabaseClient();
const { data, error } = await supabase.from('posts').select('count');

if (error) {
  console.error('Connection failed:', error);
} else {
  console.log('Connected! Post count:', data);
}
```

---

## Phase 5: Schema Extension 학습

### 핵심 원칙

1. **Core 스키마 보존**: 기존 테이블 구조는 최대한 유지
2. **metadata 우선**: JSONB 컬럼을 통한 확장 우선
3. **성능 고려**: 쿼리 빈도가 높은 필드는 컬럼으로
4. **마이그레이션 필수**: 컬럼/테이블 추가 시 Flyway

### 실습 시나리오 정답

**Q1: 오피스 예약 기능 추가**
- 정답: 3순위 (신규 테이블)
- 사유: 예약은 완전히 새로운 도메인, 별도 테이블 필요

**Q2: 게시글에 '공지' 플래그 추가**
- 정답: 1순위 (metadata)
- 사유: 기존 posts 테이블에 `metadata: {"pinned": true}` 추가

**Q3: 사용자에게 오피스 권한 추가**
- 정답: 1순위 (metadata) 또는 2순위 (컬럼)
- 사유: 단순 플래그면 metadata, 외래키 참조 필요시 컬럼

---
name: sync-interface
description: core-interface JSON artifacts를 TypeScript 타입으로 동기화
tools: [Bash, Read, Write, Glob]
---

> **시스템 메시지**: `[SEMO] Skill: sync-interface 호출 - 타입 동기화`

# Sync Interface Skill

## Purpose

core-interface 레포지토리의 OpenAPI 스펙을 다운로드하고 TypeScript 타입으로 변환합니다.

## Quick Start

```bash
# 트리거 키워드
"타입 동기화", "interface 동기화", "core-interface 업데이트"
```

---

## 동기화 워크플로우

### 1. 최신 릴리스 확인

```bash
gh api repos/semicolon-devteam/core-interface/releases/latest --jq '.tag_name'
```

### 2. OpenAPI 스펙 다운로드

```bash
SPEC_URL=$(gh api repos/semicolon-devteam/core-interface/releases/latest \
  --jq '.assets[] | select(.name == "core.backend.spec.json") | .browser_download_url')

curl -L "$SPEC_URL" -o core.backend.spec.json
```

### 3. TypeScript 타입 생성

```bash
npx openapi-typescript core.backend.spec.json -o src/types/core-interface.ts
```

### 4. 정리

```bash
rm core.backend.spec.json
```

---

## 출력 형식

```markdown
# 🔄 core-interface 동기화 완료

## 버전 정보
- 릴리스: {tag_name}
- 릴리스 일시: {published_at}
- 스펙 파일: core.backend.spec.json

## 생성된 파일
- `src/types/core-interface.ts`

## 주요 타입
- `components.schemas.Post`
- `components.schemas.User`
- `components.schemas.Location`
- `components.schemas.Board`
- `components.schemas.Comment`

## 사용 방법

\`\`\`typescript
import type { components } from '@/types/core-interface';

type Post = components['schemas']['Post'];
type User = components['schemas']['User'];
\`\`\`
```

---

## 도메인별 타입 분리

### 권장 구조

```
src/
├── types/
│   ├── core-interface.ts     # 자동 생성 (수정 금지)
│   └── index.ts              # Re-export
│
app/{domain}/
└── _types/
    ├── {domain}.types.ts     # 도메인 확장 타입
    └── index.ts
```

### 타입 확장 예시

```typescript
// app/office/_types/office.types.ts
import type { components } from '@/types/core-interface';

// core-interface 타입 가져오기
type BaseLocation = components['schemas']['Location'];

// MVP 확장 메타데이터
export interface OfficeMetadata {
  type: 'office';
  officeCode: string;
  capacity: number;
  amenities: string[];
}

// 확장된 타입
export interface Office extends BaseLocation {
  metadata: OfficeMetadata;
}

// DTO 타입
export interface CreateOfficeRequest {
  name: string;
  address: string;
  officeCode: string;
  capacity: number;
}

export interface UpdateOfficeRequest {
  name?: string;
  capacity?: number;
  amenities?: string[];
}
```

---

## 버전 관리

### 버전 추적

```typescript
// src/types/core-interface.version.ts
export const CORE_INTERFACE_VERSION = 'v2025.12.2';
export const SYNCED_AT = '2025-12-11T10:00:00Z';
```

### 버전 불일치 감지

```bash
# 현재 버전과 최신 버전 비교
LOCAL_VERSION=$(grep 'CORE_INTERFACE_VERSION' src/types/core-interface.version.ts | cut -d"'" -f2)
REMOTE_VERSION=$(gh api repos/semicolon-devteam/core-interface/releases/latest --jq '.tag_name')

if [ "$LOCAL_VERSION" != "$REMOTE_VERSION" ]; then
  echo "⚠️ 버전 불일치: 로컬 $LOCAL_VERSION, 원격 $REMOTE_VERSION"
  echo "→ skill:sync-interface 실행 권장"
fi
```

---

## CI/CD 통합

### GitHub Actions 워크플로우

```yaml
# .github/workflows/sync-types.yml
name: Sync core-interface types

on:
  workflow_dispatch:
  schedule:
    - cron: '0 9 * * 1'  # 매주 월요일 9시

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get latest release
        id: release
        run: |
          TAG=$(gh api repos/semicolon-devteam/core-interface/releases/latest --jq '.tag_name')
          echo "tag=$TAG" >> $GITHUB_OUTPUT
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Download spec
        run: |
          SPEC_URL=$(gh api repos/semicolon-devteam/core-interface/releases/latest \
            --jq '.assets[] | select(.name == "core.backend.spec.json") | .browser_download_url')
          curl -L "$SPEC_URL" -o core.backend.spec.json
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Generate types
        run: npx openapi-typescript core.backend.spec.json -o src/types/core-interface.ts

      - name: Create PR
        uses: peter-evans/create-pull-request@v5
        with:
          title: "chore: sync core-interface types to ${{ steps.release.outputs.tag }}"
          branch: chore/sync-core-interface
```

---

## 문제 해결

### 릴리스 에셋 없음

```markdown
⚠️ core.backend.spec.json 에셋이 없습니다.

가능한 원인:
1. 최신 릴리스에 에셋이 아직 업로드되지 않음
2. 릴리스 형식 변경

해결 방법:
1. GitHub에서 릴리스 에셋 확인
2. 이전 릴리스 사용: `gh api repos/.../releases/tags/v2025.12.1`
```

### 타입 생성 실패

```markdown
⚠️ TypeScript 타입 생성 실패

가능한 원인:
1. openapi-typescript 미설치
2. OpenAPI 스펙 형식 오류

해결 방법:
1. `pnpm add -D openapi-typescript`
2. 스펙 파일 JSON 유효성 검사
```

---

## References

- [Type Mapping](references/type-mapping.md)
- [Sync Workflow](references/sync-workflow.md)

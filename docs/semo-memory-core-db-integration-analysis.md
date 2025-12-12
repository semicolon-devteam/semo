# SEMO 장기기억 × Core DB 연동 가능성 분석 리포트

> **작성일**: 2025-12-12
> **작성자**: SEMO Technical Analysis
> **대상**: 팀 리더 토론용

---

## Executive Summary

SEMO의 장기기억(Context Mesh)을 core-supabase DB와 연동하여 **팀 전체가 공유하는 프로젝트 히스토리 및 AI 작업 로그**를 중앙 관리하는 방안을 검토했습니다. 4가지 연동 방안과 각각의 트레이드오프를 분석하여 팀 상황에 맞는 선택 기준을 제시합니다.

---

## 1. 현황 분석

### 1.1 현재 SEMO 메모리 구조

```
.claude/memory/
├── context.md          # 프로젝트 상태 (세션 간 영속)
├── decisions.md        # 아키텍처 결정 기록 (ADR)
├── rules/              # 프로젝트별 커스텀 규칙
│   └── project-specific.md
└── cache/              # 패턴/스니펫 캐시
    ├── patterns.json
    └── snippets.json
```

**특징**:
- 파일시스템 기반 (Git 추적 가능)
- 프로젝트별 독립 관리 (로컬 `.claude/` 디렉토리)
- MCP Memory Server 연동 옵션 존재 (`@mkreyman/mcp-memory-keeper`)
- 팀 간 공유 메커니즘 **부재**

### 1.2 core-supabase 인프라

| 항목 | 값 |
|------|-----|
| **DB** | PostgreSQL 17.4 (Supabase 호스팅) |
| **인증** | Supabase Auth (JWT) |
| **스토리지** | MinIO/S3 호환 |
| **실시간** | WebSocket (Realtime) |
| **스키마 분리** | 서비스별 독립 스키마 (`public`, `scheduler`, `ledger`, `notifier`) |

**기존 로그 테이블 예시**:
- `point_security_logs`: 포인트 조작 감지 로그
- `{prefix}_audit_logs`: 서비스별 감사 로그
- `{prefix}_jobs_outbox`: 이벤트 발행 (Outbox 패턴)

### 1.3 SEMO MCP 서버 현황

```json
// .claude/settings.json
{
  "mcpServers": {
    "semo-integrations": {
      "command": "npx",
      "args": ["-y", "@team-semicolon/semo-mcp"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_KEY": "${SUPABASE_KEY}"
      }
    }
  }
}
```

**이미 존재하는 도구**:
- `supabase_query`: Supabase 테이블 조회
- `slack_send_message`: Slack 알림 전송

---

## 2. 연동 시 필요한 데이터 구조

### 2.1 팀 공유 컨텍스트 (Shared Context)

```typescript
interface SharedContext {
  id: string;                    // UUID
  project_id: string;            // 프로젝트 식별자
  category: 'decision' | 'preference' | 'pattern' | 'rule';
  key: string;                   // 결정/선호도 키
  value: JSONB;                  // 실제 내용
  created_by: string;            // 작성자 (GitHub username)
  created_at: timestamp;
  updated_at: timestamp;
  deprecated_at?: timestamp;     // Soft delete
  metadata: JSONB;               // 태그, 관련 이슈 등
}
```

### 2.2 SEMO 작업 로그 (Activity Log)

```typescript
interface SemoActivityLog {
  id: string;                    // UUID
  session_id: string;            // Claude Code 세션 ID
  project_id: string;            // 프로젝트 식별자
  user_id: string;               // 사용자 식별자

  // 요청 정보
  request_type: 'command' | 'skill' | 'agent' | 'natural';
  request_raw: string;           // 원본 요청
  parsed_intent?: string;        // 파싱된 의도

  // 실행 정보
  executed_component: string;    // 실행된 Agent/Skill 이름
  component_type: 'agent' | 'skill' | 'orchestrator';
  execution_path: string[];      // 실행 경로 (체인)

  // 결과 정보
  response_summary: string;      // 응답 요약 (토큰 절약)
  response_full?: string;        // 전체 응답 (선택적)
  files_modified: string[];      // 수정된 파일 목록

  // 메타데이터
  duration_ms: number;           // 실행 시간
  token_usage?: {
    input: number;
    output: number;
  };
  error?: string;                // 에러 발생 시

  created_at: timestamp;
}
```

---

## 3. 연동 방안 비교

### 방안 A: MCP 서버 확장 (권장)

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code Session                       │
├─────────────────────────────────────────────────────────────┤
│  .claude/memory/  ←→  semo-mcp ←→  core-supabase (semo 스키마)│
│  (로컬 캐시)           (동기화)       (중앙 저장소)            │
└─────────────────────────────────────────────────────────────┘
```

**구현 방식**:
1. `semo-mcp` 서버에 memory 관련 도구 추가
   - `semo_memory_save`: 컨텍스트 저장 (로컬 + DB 동시)
   - `semo_memory_load`: 컨텍스트 로드 (DB 우선, 로컬 폴백)
   - `semo_memory_sync`: 로컬 ↔ DB 동기화
   - `semo_log_activity`: 작업 로그 기록

2. core-supabase에 `semo` 스키마 추가
   ```sql
   CREATE SCHEMA IF NOT EXISTS semo;

   -- 공유 컨텍스트
   CREATE TABLE semo.shared_contexts (...);

   -- 작업 로그
   CREATE TABLE semo.activity_logs (...);

   -- 프로젝트 설정
   CREATE TABLE semo.project_configs (...);
   ```

3. 동기화 전략: **Write-Through + Read-Behind**
   - 저장 시: 로컬 + DB 동시 기록
   - 로드 시: DB에서 최신 데이터 조회, 로컬 캐시 업데이트

**장점**:
| 항목 | 설명 |
|------|------|
| 기존 인프라 활용 | core-supabase 그대로 사용 |
| 점진적 도입 | MCP 도구 단위로 점진 배포 |
| 오프라인 지원 | 로컬 캐시로 오프라인에서도 동작 |
| 실시간 공유 | Supabase Realtime으로 팀 동기화 |

**단점**:
| 항목 | 설명 |
|------|------|
| MCP 서버 개발 필요 | semo-mcp 확장 작업 필요 |
| 동기화 복잡도 | 충돌 해결 로직 필요 |
| 환경변수 의존 | SUPABASE_URL/KEY 설정 필수 |

**예상 공수**: 2-3주 (MCP 확장 + DB 스키마 + 테스트)

---

### 방안 B: Git 기반 공유 저장소

```
┌─────────────────────────────────────────────────────────────┐
│  Local Project A     Local Project B     Local Project C    │
│  .claude/memory/  →  .claude/memory/  →  .claude/memory/    │
│        ↓                   ↓                   ↓            │
│        └───────────── Git Sync ──────────────┘             │
│                           ↓                                 │
│              semo-memory-central (Private Repo)             │
└─────────────────────────────────────────────────────────────┘
```

**구현 방식**:
1. `semo-memory-central` 비공개 레포 생성
2. 각 프로젝트별 디렉토리로 컨텍스트 관리
3. `skill:memory sync` 시 Git push/pull

**장점**:
| 항목 | 설명 |
|------|------|
| 버전 관리 | Git 히스토리로 변경 추적 |
| 인프라 없음 | 추가 서버/DB 불필요 |
| 단순함 | 구현 복잡도 낮음 |
| 리뷰 가능 | PR로 중요 결정 리뷰 |

**단점**:
| 항목 | 설명 |
|------|------|
| 실시간 공유 불가 | push/pull 필요 |
| 로그 저장 부적합 | 대량 로그 시 Git 비효율 |
| 검색 어려움 | 텍스트 기반 검색만 가능 |
| 충돌 가능성 | 동시 수정 시 merge 필요 |

**예상 공수**: 1주

---

### 방안 C: 하이브리드 (컨텍스트 Git + 로그 DB)

```
┌─────────────────────────────────────────────────────────────┐
│  컨텍스트/결정 (저빈도, 중요)     로그 (고빈도, 분석용)      │
│  ─────────────────────────       ─────────────────────      │
│  Git 기반 공유                    core-supabase 직접 저장   │
│  - decisions.md                  - semo.activity_logs      │
│  - rules/                        - semo.error_logs         │
│  - patterns/                                                │
└─────────────────────────────────────────────────────────────┘
```

**구현 방식**:
1. 컨텍스트/결정: 방안 B (Git 저장소)
2. 작업 로그: 방안 A의 일부 (DB 직접 저장)
3. `semo-mcp`에 로그 전용 도구만 추가

**장점**:
| 항목 | 설명 |
|------|------|
| 데이터 특성 맞춤 | 각 데이터에 적합한 저장소 |
| 로그 분석 용이 | SQL로 로그 분석 가능 |
| 컨텍스트 리뷰 | PR로 중요 결정 리뷰 |

**단점**:
| 항목 | 설명 |
|------|------|
| 이중 관리 | 두 시스템 모두 운영 |
| 복잡도 증가 | 동기화 로직 2개 필요 |

**예상 공수**: 2-3주

---

### 방안 D: 전용 Memory MCP 서버 (ms-memory)

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code Session                       │
│                           ↓                                  │
│                      semo-mcp                                │
│                           ↓                                  │
│            ms-memory (새 마이크로서비스)                      │
│            ├── POST /api/contexts                           │
│            ├── GET /api/contexts/{project}                  │
│            ├── POST /api/logs                               │
│            └── GET /api/logs/search                         │
│                           ↓                                  │
│                 core-supabase (semo 스키마)                  │
└─────────────────────────────────────────────────────────────┘
```

**구현 방식**:
1. 기존 ms-* 패턴을 따르는 새 마이크로서비스 생성
2. 서비스 코드: `SM` (SEMO Memory)
3. 테이블 Prefix: `sm_`
4. 포트: 3004

**장점**:
| 항목 | 설명 |
|------|------|
| 아키텍처 일관성 | 기존 ms-* 패턴 준수 |
| 확장성 | 독립 스케일링 가능 |
| API 재사용 | 다른 시스템에서도 사용 가능 |
| 고급 기능 | 벡터 검색, 요약 등 추가 가능 |

**단점**:
| 항목 | 설명 |
|------|------|
| 운영 오버헤드 | 새 서비스 배포/관리 |
| 개발 공수 | 전체 서비스 구축 필요 |
| 복잡도 | 단순 작업에 과도한 인프라 |

**예상 공수**: 4-6주

---

## 4. 로그 저장의 장단점 및 트레이드오프

### 4.1 장점

| 항목 | 상세 |
|------|------|
| **팀 학습 가속** | 다른 멤버가 어떤 문제를 어떻게 해결했는지 검색 가능 |
| **디버깅 용이** | SEMO 오작동 시 원인 분석 가능 |
| **패턴 발견** | 반복 요청 분석 → Skill/Agent 개선 포인트 도출 |
| **온보딩 지원** | 신규 멤버가 프로젝트 히스토리 파악 가능 |
| **품질 측정** | Agent/Skill별 성공률, 평균 실행 시간 등 메트릭 |
| **컴플라이언스** | AI 작업 이력 감사 가능 |

### 4.2 단점 및 리스크

| 항목 | 상세 | 완화 방안 |
|------|------|----------|
| **스토리지 비용** | 로그 누적 시 DB 용량 증가 | 보존 정책 (30일/90일) |
| **개인정보** | 민감 정보가 로그에 포함될 수 있음 | 마스킹, RLS 정책 |
| **성능 영향** | 매 요청마다 DB 쓰기 | 비동기 배치 저장 |
| **네트워크 의존** | 오프라인 시 로그 손실 | 로컬 큐 + 재시도 |
| **프라이버시** | 개인 작업 패턴 노출 | 익명화 옵션 |

### 4.3 트레이드오프 매트릭스

| 기준 | 방안 A (MCP 확장) | 방안 B (Git) | 방안 C (하이브리드) | 방안 D (ms-memory) |
|------|------------------|--------------|-------------------|-------------------|
| 구현 복잡도 | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 실시간 동기화 | ✅ | ❌ | 부분 | ✅ |
| 로그 분석 | ✅ | ❌ | ✅ | ✅✅ |
| 오프라인 지원 | ✅ | ✅ | ✅ | ❌ |
| 버전 관리 | 부분 | ✅✅ | ✅ | ❌ |
| 운영 비용 | 낮음 | 매우 낮음 | 중간 | 높음 |
| 확장성 | 중간 | 낮음 | 중간 | 높음 |
| 기존 인프라 활용 | ✅✅ | ✅ | ✅✅ | ✅ |

---

## 5. 권장 사항

### 5.1 단기 (1-2주): 방안 B 부분 도입

**목표**: 최소 비용으로 팀 공유 시작

1. `semo-memory-central` 레포 생성 (비공개)
2. 주요 결정 사항만 수동 커밋
3. `CLAUDE.md`에서 참조하도록 가이드

```markdown
<!-- CLAUDE.md 추가 -->
## Team Decisions

공유 결정 사항은 [semo-memory-central](https://github.com/semicolon-devteam/semo-memory-central)을 참조하세요.
```

### 5.2 중기 (1-2개월): 방안 A 구현

**목표**: 자동화된 동기화 + 로그 수집

1. `semo-mcp`에 memory 도구 추가
2. core-supabase에 `semo` 스키마 생성
3. `skill:memory` 자동 동기화 활성화

**DB 스키마 제안**:

```sql
-- core-supabase/docker/volumes/db/init/schemas/99-semo.sql

CREATE SCHEMA IF NOT EXISTS semo;

-- 공유 컨텍스트
CREATE TABLE semo.shared_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('decision', 'preference', 'pattern', 'rule')),
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deprecated_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::JSONB,

    UNIQUE (project_id, category, key)
);

-- 작업 로그
CREATE TABLE semo.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,

    request_type TEXT NOT NULL,
    request_raw TEXT NOT NULL,
    parsed_intent TEXT,

    executed_component TEXT NOT NULL,
    component_type TEXT NOT NULL,
    execution_path TEXT[] DEFAULT '{}',

    response_summary TEXT,
    files_modified TEXT[] DEFAULT '{}',

    duration_ms INTEGER,
    token_usage JSONB,
    error TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_contexts_project ON semo.shared_contexts(project_id);
CREATE INDEX idx_logs_project_time ON semo.activity_logs(project_id, created_at DESC);
CREATE INDEX idx_logs_user ON semo.activity_logs(user_id);
CREATE INDEX idx_logs_component ON semo.activity_logs(executed_component);

-- 보존 정책 (90일)
CREATE OR REPLACE FUNCTION semo.cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM semo.activity_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
```

### 5.3 장기 (선택적): 방안 D 고려

다음 조건이 충족되면 검토:
- 로그 볼륨이 월 100만 건 이상
- 벡터 검색/시맨틱 검색 필요
- 외부 시스템 연동 필요

---

## 6. 결론

### 권장 접근법: **방안 A (MCP 서버 확장)**

| 선택 이유 | 설명 |
|----------|------|
| 기존 투자 활용 | semo-mcp, core-supabase 이미 존재 |
| 점진적 도입 | 도구 단위로 배포 가능 |
| 적정 복잡도 | 팀 규모에 적합한 수준 |
| 미래 확장성 | ms-memory로 전환 가능한 구조 |

### 다음 단계

1. **토론 안건**:
   - 로그 저장 범위 (모든 요청 vs 중요 요청만)
   - 개인정보 정책 (익명화 필요 여부)
   - 보존 기간 (30일 vs 90일 vs 무제한)

2. **파일럿 프로젝트**:
   - 단일 프로젝트에서 수동 테스트
   - 2주간 데이터 수집 후 볼륨/유용성 평가

3. **의사결정 필요**:
   - [ ] 로그 저장 범위 결정
   - [ ] 개인정보 처리 방침 확정
   - [ ] 구현 우선순위 결정

---

## 부록 A: 참조 문서

- [SEMO Memory Skill](semo-skills/memory/SKILL.md)
- [core-supabase README](https://github.com/semicolon-devteam/core-supabase)
- [마이크로서비스 규약](packages/core/_shared/microservice-conventions.md)
- [팀 컨텍스트 가이드](packages/core/_shared/team-context.md)

## 부록 B: 용어 정리

| 용어 | 설명 |
|------|------|
| **Context Mesh** | SEMO의 세션 간 컨텍스트 영속화 시스템 |
| **White Box** | 파일시스템 기반 설정 (semo-core, semo-skills) |
| **Black Box** | MCP 기반 외부 연동 (semo-integrations) |
| **ADR** | Architecture Decision Record, 아키텍처 결정 기록 |
| **RLS** | Row Level Security, 행 수준 보안 정책 |

---

*이 문서는 SEMO Technical Analysis에 의해 자동 생성되었습니다.*

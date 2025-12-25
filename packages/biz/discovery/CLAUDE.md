# SEMO Business - Discovery Package

> 아이템 발굴, 시장 조사, Epic/Task 생성

## Package Info

- **Package**: biz/discovery
- **Version**: [../VERSION](../VERSION) 참조
- **Target**: docs repository
- **Audience**: PO, 기획자

---

## 핵심 역할

| 기능 | 설명 |
|------|------|
| 아이템 발굴 | 새로운 제품/서비스 아이디어 도출 |
| 시장 조사 | 경쟁사 분석, 시장 트렌드 파악 |
| Epic 생성 | 대규모 기능 단위 정의 |
| Task 생성 | 실행 가능한 작업 단위 분해 |
| AC 작성 | Acceptance Criteria 정의 |

---

## Routing Keywords

| 키워드 | 트리거 |
|--------|--------|
| Epic, 에픽 | Epic 생성/관리 |
| Task, 태스크 | Task 생성/관리 |
| AC, 수락조건 | Acceptance Criteria 작성 |
| 아이템, 아이디어 | 아이템 발굴 |
| 시장조사, 경쟁사 | 시장 조사 |
| 요구사항, 스펙 | 요구사항 정의 |

---

## 🔴 Draft Task 생성 규칙 (NON-NEGOTIABLE)

### 금지 행위

| 행위 | 상태 |
|------|------|
| `gh issue create` 직접 실행 | 절대 금지 |
| Epic 분석 없이 Task 생성 | 절대 금지 |
| 레포지토리 임의 결정 | 절대 금지 |

### 필수 프로세스

```text
"Draft Task 생성해줘" → Orchestrator → draft-task-creator Agent
    ↓
1. Epic 분석 (대상 레포 확인)
2. check-backend-duplication Skill 호출 (백엔드 작업 시)
3. 올바른 레포에 Draft Task 생성
4. Projects 연결 + Assignee 확인
```

### 레포지토리 라우팅

| 작업 유형 | 대상 레포지토리 |
|----------|----------------|
| Backend (API, 서버, DB) | `semicolon-devteam/core-backend` (고정) |
| Frontend (UI, 화면) | Epic에 명시된 서비스 레포 |
| Design | 디자인팀 Slack 알림 |

---

## Agents

| Agent | 역할 | 원본 |
|-------|------|------|
| orchestrator | discovery 작업 라우팅 | po/orchestrator |
| epic-master | Epic 분석 및 생성 | po/epic-master |
| draft-task-creator | Draft Task 생성 | po/draft-task-creator |

---

## Skills

| Skill | 역할 | 원본 |
|-------|------|------|
| create-epic | Epic 생성 | po/create-epic |
| detect-project-from-epic | 프로젝트 감지 | po/detect-project-from-epic |
| estimate-epic-timeline | 타임라인 산정 | po/estimate-epic-timeline |
| check-backend-duplication | 백엔드 중복 체크 | po/check-backend-duplication |
| generate-acceptance-criteria | AC 생성 | po/generate-acceptance-criteria |
| health-check | 환경 검증 | 공통 |

---

## 다음 단계 연동

```text
discovery (Epic/Task 정의)
    ↓
biz/design (목업/스펙 완성)
    ↓
biz/management (스프린트 할당)
```

---

## 🔴 데이터베이스 시스템 구분 (NON-NEGOTIABLE)

> **⚠️ "중앙 DB"와 "core-supabase"는 서로 다른 시스템입니다.**

| 구분 | 용도 | 레포지토리 | 대상 |
|------|------|-----------|------|
| **core-supabase** | 커뮤니티 솔루션 스키마/RPC/RLS 템플릿 | `semicolon-devteam/core-supabase` | 커뮤니티 서비스 개발 |
| **중앙 DB (core-central-db)** | 팀 시스템 데이터 + 마이크로서비스 DB | `semicolon-devteam/core-central-db` | 팀 운영/마이크로서비스 |

### 중앙 DB 역할

- 팀 전체 프로젝트 관리
- 재무/사업 정보
- 팀원 정보
- 마이크로서비스 공통 데이터베이스

### 올바른 참조

| 요청 | 참조해야 할 시스템 |
|------|-------------------|
| "커뮤니티 서비스 DB 스키마" | core-supabase |
| "팀 데이터베이스", "중앙 DB" | core-central-db |
| "마이크로서비스 DB" | core-central-db |

> 📖 상세: [중앙 DB 컨텍스트](../../semo-core/_shared/central-db.md)

---

## MVP/PoC 개발 시 커뮤니티 솔루션 컨텍스트

> MVP/PoC 개발 요청 시 커뮤니티 솔루션 기반 옵션 제공

### 트리거 키워드

- "MVP 개발", "PoC 만들어줘", "프로토타입"
- "빠른 검증", "패스트트랙"

### 선택 워크플로우

MVP/PoC 요청 감지 시 다음 옵션 제공:

| 옵션 | 설명 |
|------|------|
| **커뮤니티 솔루션 기반** | cm-template + DDD 4-Layer + core-supabase 스키마 |
| **패스트트랙 (독립)** | 최소 구조, 자체 스키마, 빠른 프로토타이핑 |

### 커뮤니티 솔루션 선택 시

1. DB 스키마: `core-supabase/document/combined.sql` 사용 (별도 SQL 제공 금지)
2. 프로젝트 템플릿: cm-template 클론
3. 상세 컨텍스트: [community-solution.md](../../semo-core/_shared/community-solution.md) 참조

### poc 패키지 미설치 시 안내

```markdown
[SEMO] MVP/PoC 개발 권장 패키지

⚠️ `biz/poc` 패키지가 설치되어 있지 않습니다.

추천 액션:
1. `semo add biz/poc` - PoC/MVP 전용 워크플로우 설치
2. 현재 `discovery` 패키지로 진행 (Epic/Task 기반)
```

---

## References

- [biz 레이어](../CLAUDE.md)
- [design 패키지](../design/CLAUDE.md)
- [management 패키지](../management/CLAUDE.md)
- [커뮤니티 솔루션 컨텍스트](../../semo-core/_shared/community-solution.md)

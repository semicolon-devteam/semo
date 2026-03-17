# 01-Core: 구현 계획

> Office, Agent, Persona 관리 기능 구현

---

## 요구사항 요약

- Office 생성/조회/수정/삭제 CRUD
- Agent 인스턴스 관리
- Persona 템플릿 관리
- GitHub 인증 (팀 공용 계정, Agent별 커밋 author)
- 기본 Persona 데이터 시딩

---

## 영향 범위 분석

| 영역 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/office-server/src/api/offices/` | 신규 | Office API 엔드포인트 |
| `packages/office-server/src/api/agents/` | 신규 | Agent API 엔드포인트 |
| `packages/office-server/src/api/personas/` | 신규 | Persona API 엔드포인트 |
| `packages/office-server/src/db/migrations/` | 신규 | DB 마이그레이션 파일 |
| `packages/office-server/src/services/` | 신규 | Service 레이어 |
| `packages/office-web/src/app/offices/` | 신규 | Office 관리 UI |
| `packages/office-web/src/components/` | 신규 | Office/Agent/Persona 컴포넌트 |

---

## 구현 단계

### Phase 1: 데이터베이스 설정

**작업 내용**:
1. Supabase 프로젝트 생성 (로컬 + 클라우드)
2. DB 스키마 마이그레이션 파일 작성
   - `offices` 테이블
   - `agent_personas` 테이블
   - `office_agents` 테이블
3. Supabase Client 설정

**예상 시간**: 1일

**체크리스트**:
- [ ] `supabase/migrations/001_create_offices.sql` 작성
- [ ] `supabase/migrations/002_create_agent_personas.sql` 작성
- [ ] `supabase/migrations/003_create_office_agents.sql` 작성
- [ ] 로컬 Supabase 실행 및 마이그레이션 테스트
- [ ] Supabase Client 환경변수 설정 (`.env`)

---

### Phase 2: Persona 시드 데이터

**작업 내용**:
1. 기본 Persona 정의 (PO, PM, Architect, FE, BE, QA, DevOps, Decomposer)
2. Persona 시드 데이터 SQL 작성
3. 시드 데이터 마이그레이션

**예상 시간**: 0.5일

**체크리스트**:
- [ ] `supabase/seed.sql` 작성 (8개 기본 Persona)
- [ ] 각 Persona의 `persona_prompt`, `scope_patterns`, `core_skills` 정의
- [ ] 시드 실행 및 검증

---

### Phase 3: API 엔드포인트 (Backend)

**작업 내용**:
1. Office CRUD API
   - `GET /api/offices`
   - `POST /api/offices`
   - `GET /api/offices/:id`
   - `PATCH /api/offices/:id`
   - `DELETE /api/offices/:id`

2. Agent CRUD API
   - `GET /api/offices/:id/agents`
   - `POST /api/offices/:id/agents`
   - `GET /api/offices/:id/agents/:agentId`
   - `PATCH /api/offices/:id/agents/:agentId`
   - `DELETE /api/offices/:id/agents/:agentId`

3. Persona CRUD API
   - `GET /api/personas`
   - `POST /api/personas`
   - `GET /api/personas/:id`
   - `PUT /api/personas/:id`
   - `DELETE /api/personas/:id`

**예상 시간**: 3일

**체크리스트**:
- [ ] Express 라우터 설정
- [ ] Office Service 작성
- [ ] Agent Service 작성
- [ ] Persona Service 작성
- [ ] 각 API 엔드포인트 테스트 (Jest + Supertest)
- [ ] OpenAPI 스펙 문서 작성

---

### Phase 4: UI 컴포넌트 (Frontend)

**작업 내용**:
1. Office 관리 페이지
   - Office 목록 (`/offices`)
   - Office 생성 폼
   - Office 삭제 확인 다이얼로그

2. Agent 관리 컴포넌트
   - Agent 카드
   - Agent 생성 폼 (Persona 선택)
   - Agent 상태 업데이트

3. Persona 관리 페이지
   - Persona 목록 (`/personas`)
   - Persona 생성 폼
   - 커스텀 Persona 편집

**예상 시간**: 3일

**체크리스트**:
- [ ] `app/offices/page.tsx` (Office 목록)
- [ ] `app/offices/[id]/page.tsx` (Office 상세)
- [ ] `components/OfficeCard.tsx`
- [ ] `components/AgentCard.tsx`
- [ ] `components/CreateOfficeDialog.tsx`
- [ ] `components/CreateAgentDialog.tsx`
- [ ] `app/personas/page.tsx` (Persona 목록)
- [ ] `components/PersonaForm.tsx`
- [ ] Tailwind CSS 스타일링

---

### Phase 5: GitHub 인증 설정

**작업 내용**:
1. `gh` CLI 인증 가이드 문서
2. Git config 자동 설정 함수
   - Worktree 생성 시 Agent별 author 설정
   - `user.name`: `{role}-Agent ({name})`
   - `user.email`: `{role.toLowerCase()}-agent@semo.ai`

**예상 시간**: 0.5일

**체크리스트**:
- [ ] `docs/github-auth.md` 작성
- [ ] `configureGitAuthor()` 함수 작성
- [ ] Worktree 생성 시 자동 호출 통합

---

### Phase 6: 통합 테스트

**작업 내용**:
1. E2E 시나리오 작성
   - Office 생성 → Agent 추가 → Persona 변경 → Office 삭제
2. API 통합 테스트
3. UI 인터랙션 테스트 (Playwright)

**예상 시간**: 1일

**체크리스트**:
- [ ] `e2e/office-workflow.spec.ts` 작성
- [ ] `tests/integration/office-api.test.ts` 작성
- [ ] `tests/integration/agent-api.test.ts` 작성
- [ ] CI/CD 파이프라인에 테스트 추가

---

## 의존성

### 외부 라이브러리
- `@supabase/supabase-js`: Supabase 클라이언트
- `express`: API 서버
- `zod`: 스키마 검증
- `react-query` (TanStack Query): API 상태 관리
- `zustand`: 클라이언트 상태 관리

### 내부 모듈
- 없음 (Core는 최하위 모듈)

---

## 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| Supabase 로컬 개발 환경 불안정 | 중간 | Docker Compose로 PostgreSQL 직접 사용 옵션 준비 |
| GitHub 인증 실패 | 높음 | 사전 테스트, 명확한 설정 가이드 제공 |
| Agent 수 증가 시 DB 성능 | 낮음 | 인덱스 최적화, 필요 시 쿼리 튜닝 |

---

## 예상 결과물

- [ ] Office CRUD API (5개 엔드포인트)
- [ ] Agent CRUD API (5개 엔드포인트)
- [ ] Persona CRUD API (5개 엔드포인트)
- [ ] Office 관리 UI (`/offices`)
- [ ] Persona 관리 UI (`/personas`)
- [ ] DB 마이그레이션 파일 (3개)
- [ ] 시드 데이터 (8개 기본 Persona)
- [ ] API 문서 (OpenAPI)
- [ ] 통합 테스트 스위트

---

## 다음 단계

✅ 01-Core 완료 후:
- **02-Task Decomposer** 구현 시작 (Core에서 Office/Agent 조회 필요)
- **03-Worktree** 구현 시작 (Agent에 Worktree 연결 필요)

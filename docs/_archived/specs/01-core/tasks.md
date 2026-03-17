# 01-Core: Implementation Tasks

---

## Task Summary

| Layer | Tasks | Version |
|-------|-------|---------|
| CONFIG | 2 | v0.1.0 |
| DATA | 2 | v0.1.1 |
| INFRA | 2 | v0.1.2 |
| APPLICATION | 3 | v0.1.3 |
| PRESENTATION | 4 | v0.1.4 |
| **Total** | **13** | |

---

## Layer 0: CONFIG

### TASK-C01: DB 스키마 - Core 테이블

**파일**: `004_office_tables.sql`

**작업 내용**:
- [ ] offices 테이블 생성
- [ ] agent_personas 테이블 생성
- [ ] office_agents 테이블 생성
- [ ] 인덱스 생성
- [ ] RLS 정책 설정

---

### TASK-C02: 기본 Persona 시드 데이터

**파일**: `004_office_tables.sql`

**작업 내용**:
- [ ] 7개 기본 Persona INSERT (PO, PM, Architect, FE, BE, QA, DevOps)
- [ ] persona_prompt, scope_patterns, core_skills 설정

---

## Layer 1: DATA

### TASK-C03: TypeScript 타입 정의

**파일**: `packages/office-server/src/types.ts`

**작업 내용**:
- [ ] Office 인터페이스
- [ ] AgentPersona 인터페이스
- [ ] OfficeAgent 인터페이스
- [ ] AgentRole, AgentStatus 타입

---

### TASK-C04: Frontend 타입 정의

**파일**: `packages/office-web/src/lib/types.ts`

**작업 내용**:
- [ ] API 응답 타입
- [ ] UI Props 타입

---

## Layer 2: INFRA

### TASK-C05: Supabase 클라이언트

**파일**: `packages/office-server/src/db/supabase.ts`

**작업 내용**:
- [ ] createClient 설정
- [ ] 타입 안전 쿼리 헬퍼

---

### TASK-C06: Supabase 클라이언트 (Frontend)

**파일**: `packages/office-web/src/lib/supabase.ts`

**작업 내용**:
- [ ] 브라우저용 클라이언트
- [ ] Realtime 연결 설정

---

## Layer 3: APPLICATION

### TASK-C07: Office Service

**파일**: `packages/office-server/src/services/officeService.ts`

**작업 내용**:
```typescript
class OfficeService {
  async createOffice(data: CreateOfficeInput): Promise<Office>;
  async getOffice(id: string): Promise<Office>;
  async listOffices(): Promise<Office[]>;
  async updateOffice(id: string, data: UpdateOfficeInput): Promise<Office>;
  async deleteOffice(id: string): Promise<void>;
}
```

---

### TASK-C08: Agent Service

**파일**: `packages/office-server/src/services/agentService.ts`

**작업 내용**:
```typescript
class AgentService {
  async createAgent(officeId: string, personaId: string): Promise<OfficeAgent>;
  async getAgents(officeId: string): Promise<OfficeAgent[]>;
  async updateAgent(id: string, data: UpdateAgentInput): Promise<OfficeAgent>;
  async updateAgentStatus(id: string, status: AgentStatus): Promise<void>;
}
```

---

### TASK-C09: Persona Service

**파일**: `packages/office-server/src/services/personaService.ts`

**작업 내용**:
```typescript
class PersonaService {
  async listPersonas(): Promise<AgentPersona[]>;
  async getPersona(id: string): Promise<AgentPersona>;
  async createPersona(data: CreatePersonaInput): Promise<AgentPersona>;
  async updatePersona(id: string, data: UpdatePersonaInput): Promise<AgentPersona>;
}
```

---

## Layer 4: PRESENTATION

### TASK-C10: Offices API Routes

**파일**: `packages/office-server/src/api/routes/offices.ts`

**작업 내용**:
- [ ] GET /api/offices
- [ ] POST /api/offices
- [ ] GET /api/offices/:id
- [ ] PATCH /api/offices/:id
- [ ] DELETE /api/offices/:id

---

### TASK-C11: Agents API Routes

**파일**: `packages/office-server/src/api/routes/agents.ts`

**작업 내용**:
- [ ] GET /api/offices/:id/agents
- [ ] POST /api/offices/:id/agents
- [ ] PATCH /api/offices/:id/agents/:agentId
- [ ] DELETE /api/offices/:id/agents/:agentId

---

### TASK-C12: Personas API Routes

**파일**: `packages/office-server/src/api/routes/personas.ts`

**작업 내용**:
- [ ] GET /api/personas
- [ ] POST /api/personas
- [ ] PUT /api/personas/:id

---

### TASK-C13: Frontend API Client

**파일**: `packages/office-web/src/lib/api.ts`

**작업 내용**:
```typescript
const api = {
  offices: {
    list: () => fetch('/api/offices'),
    create: (data) => fetch('/api/offices', { method: 'POST' }),
    get: (id) => fetch(`/api/offices/${id}`),
    delete: (id) => fetch(`/api/offices/${id}`, { method: 'DELETE' }),
  },
  agents: { ... },
  personas: { ... },
};
```

---

## Completion Checklist

- [ ] DB 스키마 적용 완료
- [ ] 기본 Persona 시드 데이터 삽입
- [ ] Office CRUD API 동작
- [ ] Agent CRUD API 동작
- [ ] Persona CRUD API 동작
- [ ] Frontend API 클라이언트 구현

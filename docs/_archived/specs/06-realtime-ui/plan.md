# 06-Realtime UI: 구현 계획

> GatherTown 스타일 2D 오피스, Agent 아바타, 실시간 상태 동기화

---

## 요구사항 요약

- PixiJS 기반 2D 오피스 뷰
- Agent 아바타 및 상태 애니메이션 (idle, working, blocked)
- 실시간 동기화 (Supabase Realtime)
- 작업 진행 패널 (Job 목록, 진행률)
- 대화 로그 (Agent 간 메시지)
- 명령 입력창 (Task 요청)

---

## 영향 범위 분석

| 영역 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/office-web/src/app/office/[id]/` | 신규 | 오피스 뷰 페이지 |
| `packages/office-web/src/components/pixi/` | 신규 | PixiJS 컴포넌트 |
| `packages/office-web/src/components/panels/` | 신규 | UI 패널 (진행, 로그, 입력) |
| `packages/office-web/src/stores/` | 신규 | Zustand 스토어 |
| `packages/office-web/src/hooks/` | 신규 | Realtime 구독 훅 |
| `packages/office-web/public/sprites/` | 신규 | 아바타 스프라이트 이미지 |

---

## 구현 단계

### Phase 1: Next.js 프로젝트 설정

**작업 내용**:
1. Next.js 14 앱 초기화
2. 필수 라이브러리 설치
   - PixiJS, @pixi/react
   - Zustand
   - TanStack Query (React Query)
   - Supabase Client
3. 기본 라우팅 설정

**예상 시간**: 1일

**체크리스트**:
- [ ] `packages/office-web` 초기화 (Next.js 14)
- [ ] 의존성 설치 (pixi.js, zustand, @tanstack/react-query)
- [ ] Tailwind CSS 설정
- [ ] Supabase Client 설정 (`.env`)
- [ ] 기본 레이아웃 (`app/layout.tsx`)

---

### Phase 2: PixiJS 기본 구조

**작업 내용**:
1. PixiJS Stage 컴포넌트
   - `<OfficeStage>` (PixiJS Application 래퍼)
   - `<OfficeBackground>` (타일맵 배경)
   - `<FurnitureLayer>` (가구 레이어)
   - `<AgentLayer>` (Agent 레이어)
2. 줌/팬 기능

**예상 시간**: 3일

**체크리스트**:
- [ ] `OfficeStage.tsx` (PixiJS Application)
- [ ] `OfficeBackground.tsx` (PIXI.Sprite)
- [ ] `FurnitureLayer.tsx` (책상, 의자 등)
- [ ] `AgentLayer.tsx` (Agent 아바타 컨테이너)
- [ ] 줌/팬 인터랙션 (마우스 휠, 드래그)
- [ ] 뷰포트 관리 (Zustand store)

---

### Phase 3: Agent 아바타 및 애니메이션

**작업 내용**:
1. `<Agent>` 컴포넌트
   - PIXI.Sprite 기반 아바타
   - 역할별 색상 (PO, FE, BE, QA 등)
   - 상태별 애니메이션 (idle, working, blocked)
2. 말풍선 (`<MessageBubble>`)

**예상 시간**: 3일

**체크리스트**:
- [ ] `Agent.tsx` (PIXI.Container)
- [ ] 아바타 스프라이트 이미지 (8개 역할)
- [ ] 상태별 애니메이션 (펄스, 깜빡임)
- [ ] `MessageBubble.tsx` (PIXI.Text + PIXI.Graphics)
- [ ] 말풍선 페이드 인/아웃 애니메이션
- [ ] 상태 변경 트랜지션

---

### Phase 4: Realtime 구독 및 상태 동기화

**작업 내용**:
1. `useRealtimeSubscription()` 훅
   - Presence (Agent 온라인 상태)
   - Broadcast (메시지)
   - Postgres Changes (DB 변경)
2. Zustand 스토어 업데이트

**예상 시간**: 2일

**체크리스트**:
- [ ] `useRealtimeSubscription(officeId)` 훅 작성
- [ ] Presence 구독 (`agent:online`)
- [ ] Broadcast 구독 (`agent_message`, `system_event`)
- [ ] Postgres Changes 구독 (`office_agents`, `job_queue`)
- [ ] Zustand 스토어 자동 업데이트
- [ ] 재연결 처리

---

### Phase 5: 작업 진행 패널

**작업 내용**:
1. `<TaskProgress>` 컴포넌트
   - Job 목록 (카드 형태)
   - 상태별 필터 (pending, ready, processing, done)
   - 진행률 표시
   - PR 정보 (번호, 상태)
2. 의존성 시각화 (선택적)

**예상 시간**: 2일

**체크리스트**:
- [ ] `TaskProgress.tsx` 컴포넌트
- [ ] `JobCard.tsx` (Job 정보 카드)
- [ ] 상태별 필터링
- [ ] 진행률 바 (`[========  ] 80%`)
- [ ] PR 링크 표시
- [ ] 의존성 화살표 (SVG)

---

### Phase 6: 대화 로그 패널

**작업 내용**:
1. `<MessageLog>` 컴포넌트
   - 시간순 메시지 표시
   - Agent 간 메시지
   - 시스템 이벤트 (Job 시작, PR 생성)
   - 스크롤, 검색, 필터

**예상 시간**: 2일

**체크리스트**:
- [ ] `MessageLog.tsx` 컴포넌트
- [ ] `MessageItem.tsx` (메시지 아이템)
- [ ] 시간 표시 (상대 시간)
- [ ] Agent별 색상/아이콘
- [ ] 자동 스크롤 (최신 메시지)
- [ ] 검색/필터 기능

---

### Phase 7: 명령 입력창

**작업 내용**:
1. `<CommandInput>` 컴포넌트
   - 텍스트 입력
   - 전송 버튼 (또는 엔터)
   - Task Decomposer API 호출
   - 로딩 상태 표시

**예상 시간**: 1일

**체크리스트**:
- [ ] `CommandInput.tsx` 컴포넌트
- [ ] 텍스트 입력 (Textarea)
- [ ] 전송 버튼 + 엔터 키 핸들링
- [ ] API 호출 (POST /api/offices/:id/tasks)
- [ ] 로딩 스피너
- [ ] 성공/실패 피드백

---

### Phase 8: 오피스 관리 페이지

**작업 내용**:
1. Office 목록 페이지 (`/offices`)
   - Office 카드 목록
   - 생성 버튼
2. Office 상세 페이지 (`/office/[id]`)
   - 헤더 (Office 이름, 설정)
   - 메인 캔버스 (PixiJS)
   - 사이드 패널 (진행, 로그)
   - 하단 입력창

**예상 시간**: 2일

**체크리스트**:
- [ ] `app/offices/page.tsx` (Office 목록)
- [ ] `app/office/[id]/page.tsx` (Office 상세)
- [ ] `components/Header.tsx`
- [ ] `components/SidePanel.tsx`
- [ ] 레이아웃 구성 (Flexbox)
- [ ] 반응형 디자인

---

### Phase 9: Zustand 스토어

**작업 내용**:
1. `officeStore`: Office, Agent, Job, Message 상태
2. `viewStore`: 뷰포트, 줌, 선택된 Agent
3. 액션 함수 (updateAgent, addJob, addMessage 등)

**예상 시간**: 1일

**체크리스트**:
- [ ] `stores/officeStore.ts`
- [ ] `stores/viewStore.ts`
- [ ] 상태 타입 정의
- [ ] 액션 함수 작성
- [ ] Persist 설정 (선택적)

---

### Phase 10: 통합 테스트

**작업 내용**:
1. E2E 시나리오 (Playwright)
   - Office 생성 → 오피스 뷰 → Task 입력 → Agent 상태 변화 확인
2. 실시간 동기화 테스트
3. UI 인터랙션 테스트

**예상 시간**: 2일

**체크리스트**:
- [ ] `e2e/office-ui.spec.ts`
- [ ] Office 생성 플로우
- [ ] Task 입력 및 Job 생성 확인
- [ ] Agent 상태 변화 확인
- [ ] 실시간 메시지 수신 확인
- [ ] 줌/팬 인터랙션 테스트

---

## 의존성

### 외부 라이브러리
- `pixi.js`, `@pixi/react`: 2D 렌더링
- `zustand`: 상태 관리
- `@tanstack/react-query`: API 상태
- `@supabase/supabase-js`: Realtime

### 내부 모듈
- **01-Core**: Office, Agent, Job API
- **02-Task Decomposer**: Task 요청 API
- **04-Session Execution**: 실시간 세션 상태

---

## 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| PixiJS 성능 (Agent 수 증가 시) | 중간 | 렌더링 최적화, Agent 수 제한 (30개) |
| Realtime 연결 불안정 | 중간 | 재연결 로직, 폴링 폴백 |
| 브라우저 호환성 | 낮음 | PixiJS는 대부분 브라우저 지원 |
| 아바타 스프라이트 제작 | 낮음 | 간단한 도트 스타일 사용 |

---

## 예상 결과물

- [ ] PixiJS 오피스 뷰 (`/office/[id]`)
- [ ] Agent 아바타 및 애니메이션
- [ ] 작업 진행 패널
- [ ] 대화 로그 패널
- [ ] 명령 입력창
- [ ] Realtime 구독 시스템
- [ ] Zustand 스토어
- [ ] E2E 테스트 스위트

---

## 다음 단계

✅ 06-Realtime UI 완료 후:
- **07-Agent Communication** 구현 (Agent 간 메시지 UI)
- **UI 개선** (아바타 스프라이트 업그레이드, 애니메이션 추가)

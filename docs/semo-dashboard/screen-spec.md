# SEMO Dashboard - 화면 정의서

> **프로젝트:** AI 봇 오케스트레이션 모니터링 + KB/벡터DB 관리 대시보드  
> **작성일:** 2026-03-07  
> **작성자:** PlanClaw  

---

## 1. 프로젝트 개요

### 목적
SEMO 시스템의 AI 봇 팀(SemiClaw, PlanClaw, WorkClaw, ReviewClaw, DesignClaw 등) 현황을 실시간으로 모니터링하고, Knowledge Base, 온톨로지, 벡터 DB를 관리하는 통합 대시보드.

### 주요 기능
- 봇별 상태, 설정, 메모리, 활동 로그 조회
- SEMO Core(에이전트/스킬) 카탈로그
- Knowledge Base 검색/CRUD
- 온톨로지 구조 시각화 및 벡터 유사도 탐색

### 데이터 소스
- 봇 워크스페이스: `semo-system/bot-workspaces/{봇이름}/`
- SEMO Core: `semo-system/semo-core/`, `semo-system/meta/`
- KB/벡터DB: appdb semo 스키마 (pgvector, Voyage-3 임베딩)

---

## 2. 전체 레이아웃 구조

### 글로벌 레이아웃
```
+------------------+--------------------------------+
| Sidebar Nav      | Main Content Area             |
| - Bot Team       |                                |
| - SEMO Core      |  (선택된 화면 표시)           |
| - Knowledge Base |                                |
| - Ontology & VDB |                                |
| - Settings       |                                |
+------------------+--------------------------------+
| Global Header                                    |
| [SEMO Dashboard] [Last Update: ...] [Refresh]    |
+--------------------------------------------------+
```

### 네비게이션
- **사이드바 네비게이션** (왼쪽 고정, 200-250px)
  - Bot Team Overview
  - SEMO Core
  - Knowledge Base
  - Ontology & Vector DB
  - Settings (향후 추가)

- **글로벌 헤더** (상단 고정)
  - SEMO Dashboard 타이틀
  - 마지막 업데이트 시간
  - 새로고침 버튼

- **메인 콘텐츠 영역** (오른쪽, 나머지 공간)
  - 선택된 화면 표시

---

## 3. 화면별 상세 정의

### 3.1. 🤖 Bot Team Overview

#### 목적
봇 팀 전체 현황을 한눈에 파악 — 각 봇의 상태, 설정, 메모리, 최근 활동

#### 주요 섹션

**A. Bot Status Cards (그리드 레이아웃)**

각 봇별 카드 표시 (3-4열 그리드):
- **봇 이름 + 이모지** (IDENTITY.md에서 추출)
- **역할 요약** (USER.md/SOUL.md에서 R&R)
- **상태 인디케이터:**
  - 🟢 Active (최근 1시간 내 활동)
  - 🟡 Idle (1시간 이상 비활성)
  - 🔴 Error (크래시/오류)
- **마지막 활동 시간**
- **워크스페이스 경로**

**B. Bot Detail View (카드 클릭 시 슬라이드인 패널)**

**설정 파일 내용:**
- SOUL.md 요약 (Core Truths, Boundaries, Vibe)
- AGENTS.md 핵심 규칙 (R&R, 프로토콜)
- USER.md 정보 (이름, 타임존 등)

**워크스페이스 파일 트리:**
- `semo-system/bot-workspaces/{봇이름}/` 하위 구조 표시
- 파일 클릭 → 내용 미리보기 모달 (읽기 전용)
- 주요 파일: SOUL.md, AGENTS.md, USER.md, MEMORY.md, TOOLS.md

**메모리 파일:**
- `memory/decisions.md` — 주요 의사결정/원칙
- `memory/team.md` — 팀원/프로젝트 정보
- `memory/YYYY-MM-DD.md` — 최근 3일 일일 로그

**최근 활동 로그:**
- 크론 작업 실행 내역 (최근 10개)
- 하트비트 체크 내역
- 세션 히스토리 요약 (최근 대화)

#### 데이터 소스
- 파일시스템: `semo-system/bot-workspaces/{봇이름}/**`
- OpenClaw API: 세션 목록, 크론 상태
- 세션 히스토리: `sessions_history` API

#### 인터랙션
- 봇 카드 클릭 → 상세 패널 슬라이드인 (오른쪽)
- 파일 클릭 → 내용 모달 표시
- 새로고침 버튼 → 전체 봇 상태 갱신

---

### 3.2. ⚙️ SEMO Core (Agents & Skills)

#### 목적
SEMO 시스템의 에이전트, 스킬, 컨텍스트 관리 현황 조회

#### 주요 섹션

**A. Agents Registry (테이블)**

| Agent ID | 이름 | 역할 | 소유 봇 | 등록 날짜 | 상태 |
|----------|------|------|---------|-----------|------|
| ... | ... | ... | ... | ... | active/deprecated |

- **필터:** 상태별 (active/deprecated), 봇별
- **정렬:** 이름/날짜
- 데이터 소스: `semo-system/semo-core/agents/`, `semo-system/meta/agents/`

**B. Skills Catalog (카드 그리드)**

각 스킬별 카드:
- **스킬 이름**
- **설명** (SKILL.md 첫 문단 또는 description)
- **사용 봇 목록** (태그 형태)
- **마지막 업데이트** 날짜
- **클릭 → 상세 모달** (SKILL.md 전체 내용 + 참조 파일 리스트)

데이터 소스: `semo-system/meta/skills/`

**C. Context Managers (리스트)**

| 컨텍스트 이름 | 스코프 | 활성 상태 |
|--------------|--------|----------|
| ... | global/bot-specific | active/inactive |

데이터 소스: `semo-system/meta/contexts/`

**D. System Version & Changelog**

- 현재 SEMO 버전 표시
- 최근 변경 내역 (CHANGELOG.md 또는 Git log)

#### 인터랙션
- 검색 필터 (에이전트/스킬 이름으로 검색)
- 정렬 (이름/날짜/상태)
- 스킬 카드 클릭 → 상세 모달 (SKILL.md 렌더링)

---

### 3.3. 📚 Knowledge Base (KB)

#### 목적
도메인별 KB 항목 관리 + 시맨틱 검색

#### 주요 섹션

**A. KB Search (상단 검색 바)**

- **시맨틱 검색 입력창**
  - 플레이스홀더: "Search knowledge base..."
  - 검색 결과: 유사도 점수 + 항목 리스트 (Top 20)
  - 데이터 소스: appdb semo 스키마 (pgvector, Voyage-3 임베딩)

**B. KB Items by Domain (탭 또는 드롭다운 필터)**

도메인별로 필터:
- decision (의사결정)
- service (서비스 정보)
- infra (인프라)
- team (팀원)
- operations (운영)
- (기타 도메인)

**C. KB Items Table**

| 도메인 | 키(key) | 값 요약 | 소유 봇 | 생성일 | 수정일 | 액션 |
|--------|---------|---------|---------|--------|--------|------|
| decision | 2026-03-01-ui-handoff | "DesignClaw UI..." | SemiClaw | 2026-03-07 | 2026-03-07 | 조회/수정/삭제 |

- **값 요약:** value의 첫 100자 (너무 길면 truncate)
- **액션 버튼:**
  - 👁️ 조회 (전체 값 표시 모달)
  - ✏️ 수정 (value 수정 폼)
  - 🗑️ 삭제 (확인 모달)

**D. KB CRUD**

- **조회:** 항목 클릭 또는 👁️ 버튼 → 전체 값 표시 모달 (JSON 포맷팅)
- **추가:** "Add KB Item" 버튼 → 폼 모달
  - 입력: domain, key, value, owner_bot
  - 저장 → DB INSERT
- **수정:** ✏️ 버튼 → 수정 폼 모달 (value만 수정 가능)
  - 저장 → DB UPDATE
- **삭제:** 🗑️ 버튼 → 확인 모달 → DB DELETE

**E. Bot-specific KB View (필터)**

- 봇 선택 드롭다운 → 해당 봇이 소유한 KB만 필터링

#### 데이터 소스
- appdb semo 스키마
- API: KB CLI 래핑 또는 직접 PostgreSQL 쿼리

#### 인터랙션
- 검색 → 시맨틱 유사도 결과 하이라이트
- 도메인 필터 → 테이블 갱신
- CRUD 폼 → DB 반영 → 테이블 자동 새로고침

---

### 3.4. 🧠 Ontology & Vector DB

#### 목적
온톨로지 구조 시각화 + 벡터 임베딩 탐색

#### 주요 섹션

**A. Ontology Structure (그래프 시각화)**

- **인터랙티브 그래프** (D3.js, Cytoscape.js, 또는 vis.js)
  - 노드: KB 항목 (domain + key)
  - 엣지: 관계 (유사도 또는 명시적 링크)
  - 노드 클릭 → 해당 KB 항목 상세 표시

**B. Vector Embedding Stats (통계 대시보드)**

- **총 임베딩 개수** (전체 KB 항목 수)
- **도메인별 분포** (파이 차트 or 바 차트)
  - decision: 15개
  - service: 8개
  - infra: 5개
  - ...
- **평균 유사도 통계** (도메인 간 평균 유사도)

**C. Similarity Explorer (유사도 탐색기)**

- **입력:** 
  - KB 항목 key 입력 또는 텍스트 쿼리
- **출력:** 
  - 가장 유사한 항목 Top 10 (유사도 점수 포함)
  - 테이블 형태: 순위 | KB key | 도메인 | 유사도 | 값 요약
- **데이터 소스:** pgvector 코사인 유사도 쿼리

**D. Embedding Preview (옵션)**

- 특정 항목의 임베딩 벡터 미리보기 (처음 10차원 정도)
- 차원 축소 시각화 (t-SNE/UMAP) — 향후 추가 가능

#### 데이터 소스
- appdb semo 스키마 (pgvector)
- Voyage-3 임베딩

#### 인터랙션
- 그래프 노드 클릭 → KB 상세 패널
- 유사도 탐색 → 쿼리 결과 리스트
- 차트 호버 → 통계 툴팁

---

## 4. 유저 플로우

### 시나리오 1: 봇 상태 확인

```
사용자 → Bot Team Overview 클릭
  → 봇 카드 리스트 표시
    → 특정 봇 카드 클릭 (예: PlanClaw)
      → 상세 패널 슬라이드인
        → SOUL.md, AGENTS.md, 메모리 파일 조회
        → 파일 클릭 → 내용 모달 표시
          → 닫기 또는 다른 파일 클릭
```

### 시나리오 2: KB 항목 검색 및 수정

```
사용자 → Knowledge Base 클릭
  → 검색창에 "UI handoff" 쿼리 입력
    → 시맨틱 검색 결과 표시 (유사도 순)
      → 항목 클릭 → 전체 값 표시 모달
        → "Edit" 버튼 클릭 → 수정 폼
          → 값 수정 후 저장
            → DB 반영 → 테이블 갱신
```

### 시나리오 3: 스킬 탐색

```
사용자 → SEMO Core 클릭
  → Skills Catalog 섹션 스크롤
    → 검색창에 "github" 입력
      → github 스킬 카드 표시
        → 카드 클릭 → 스킬 상세 모달 (SKILL.md 렌더링)
          → 닫기 또는 다른 스킬 탐색
```

### 시나리오 4: 온톨로지 구조 확인 및 유사도 탐색

```
사용자 → Ontology & Vector DB 클릭
  → 온톨로지 그래프 표시
    → 노드 클릭 (예: "decision/2026-03-01-ui-handoff")
      → 해당 KB 항목 상세 패널
    → Similarity Explorer 탭으로 전환
      → "design process" 텍스트 입력
        → 유사 항목 Top 10 표시
          → 항목 클릭 → 상세 조회
```

### 시나리오 5: 새 KB 항목 추가

```
사용자 → Knowledge Base 클릭
  → "Add KB Item" 버튼 클릭
    → 폼 모달 표시
      → domain: "service"
      → key: "cm-land-api-endpoint"
      → value: "https://api.cm-land.com"
      → owner_bot: "SemiClaw"
      → 저장 버튼 클릭
        → DB INSERT → 테이블 갱신
        → 새 항목 하이라이트 표시
```

---

## 5. 기술 요구사항

### 프론트엔드
- **프레임워크:** Next.js (React)
- **스타일:** TailwindCSS
- **차트:** Chart.js 또는 Recharts
- **그래프 시각화:** D3.js, Cytoscape.js, 또는 vis.js
- **반응형:** 데스크탑 우선, 태블릿 대응
- **다크 모드:** 옵션 (향후 추가 가능)

### 백엔드 API
- **옵션 1:** semo-office-server 확장 (기존 KB CLI 활용)
- **옵션 2:** Next.js API Routes (파일시스템 직접 읽기 + DB 쿼리)
- **DB 연동:** PostgreSQL (appdb semo 스키마, pgvector)
- **임베딩:** Voyage-3 (기존 KB CLI 사용)

### 파일 시스템 접근
- `semo-system/bot-workspaces/` 직접 읽기
- `semo-system/semo-core/`, `semo-system/meta/` 읽기

### OpenClaw API 연동
- 세션 목록: `sessions_list`
- 세션 히스토리: `sessions_history`
- 크론 상태: `cron` tool (status, list)

### 실시간 갱신
- **옵션 1:** WebSocket (봇 상태 실시간 업데이트)
- **옵션 2:** 폴링 (30초마다)

### 권한
- **Phase 1:** 읽기 전용 (인증 없음)
- **Phase 2:** CRUD 작업 시 인증 추가 (봇 토큰 또는 OAuth)

---

## 6. 우선순위 및 단계별 구현

### Phase 1 (MVP) — 기본 조회 기능
1. **Bot Team Overview**
   - 봇 카드 리스트
   - 봇 상세 패널 (설정 파일, 워크스페이스 파일 트리)
2. **Knowledge Base**
   - 시맨틱 검색
   - KB 항목 테이블 (도메인 필터)
   - 항목 조회 (읽기 전용)

### Phase 2 — 고급 기능
3. **SEMO Core**
   - 에이전트/스킬 목록
   - 스킬 상세 모달
4. **Ontology & Vector DB**
   - 벡터 임베딩 통계
   - 유사도 탐색기

### Phase 3 — CRUD 및 시각화
5. **Knowledge Base CRUD**
   - 항목 추가/수정/삭제
   - 인증 추가
6. **Ontology 그래프 시각화**
   - 인터랙티브 그래프
   - 차원 축소 시각화 (옵션)
7. **실시간 갱신**
   - WebSocket 또는 폴링

---

## 7. 디자인 가이드라인

### 색상 팔레트 (제안)
- **Primary:** 파란색 계열 (신뢰, 기술)
- **Secondary:** 초록색 (활성 상태), 주황색 (Idle), 빨강 (오류)
- **배경:** 흰색/라이트 그레이 (다크 모드 옵션)

### 타이포그래피
- **헤더:** Inter, SF Pro, 또는 시스템 폰트
- **본문:** 기본 sans-serif
- **코드:** monospace (Fira Code, JetBrains Mono)

### 레이아웃
- **사이드바:** 200-250px 고정
- **메인 콘텐츠:** 나머지 공간, 최대 너비 1200px
- **카드 그리드:** 3-4열 (반응형)
- **패딩/마진:** TailwindCSS 기본 스케일 (4px 단위)

---

## 8. 다음 단계 (핸드오프)

### DesignClaw 핸드오프
1. 이 화면 정의서를 기반으로 HTML 프로토타입 작성
2. TailwindCSS 기반 인터랙티브 프로토타입
3. `docs/ui-designs/semo-dashboard/` 에 배포 (GitHub Pages)
4. Reus 리뷰 후 WorkClaw 인계

### WorkClaw 구현 단계
1. Next.js 프로젝트 셋업 (`packages/semo-dashboard`)
2. Phase 1 구현 (Bot Team Overview + KB 기본 조회)
3. API 연동 (파일시스템 + DB)
4. 배포 (로컬 또는 VPS)

---

**화면 정의서 작성 완료**  
작성일: 2026-03-07  
작성자: PlanClaw  
버전: 1.0

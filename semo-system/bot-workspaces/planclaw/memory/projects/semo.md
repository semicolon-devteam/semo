# SEMO 프로젝트 컨텍스트

> 마지막 업데이트: 2026-03-12

---

## ⚠️ 중요: 프로젝트 구분

### 1. semo-office (레거시, 나중에)
- **URL:** https://semo.semi-colon.space/
- **내용:** GatherTown 스타일 가상 오피스 (PixiJS), Agent 아바타, 실시간 동기화
- **Spec 위치:** `/Users/reus/Desktop/Sources/semicolon/projects/semo/specs/06-realtime-ui/spec.md`
- **상태:** 레거시 프로젝트, 향후 추가 예정 (Phase 2/3)
- **현재 구현 진행률:** ~30% (ReviewClaw 리뷰 기준)
- **주의:** 현재는 긴급 작업 아님!

### 2. **SEMO Dashboard (현재 긴급 MVP)** ✅
- **목적:** 봇 팀 모니터링 + KB/벡터DB 관리 대시보드
- **화면 정의서:** `/Users/reus/Desktop/Sources/semicolon/projects/semo/docs/semo-dashboard/screen-spec.md`
- **GitHub 이슈:** #135 "SEMO Dashboard - 화면 정의서 작성 완료"
- **상태:** `bot:in-progress` (DesignClaw 핸드오프 대기)
- **우선순위:** 현재 긴급

---

## SEMO Dashboard - 주요 기능

### 4개 화면

1. **🤖 Bot Team Overview**
   - 봇 카드 그리드 (상태, 역할, 마지막 활동)
   - 봇 상세 패널 (SOUL.md, AGENTS.md, 메모리 파일)
   - 워크스페이스 파일 트리 조회

2. **⚙️ SEMO Core (Agents & Skills)**
   - 에이전트 레지스트리 (테이블)
   - 스킬 카탈로그 (카드 그리드)
   - 컨텍스트 매니저 목록

3. **📚 Knowledge Base**
   - 시맨틱 검색 (pgvector + Voyage-3)
   - KB 항목 CRUD (도메인별 필터)
   - 봇별 KB 필터

4. **🧠 Ontology & Vector DB**
   - 온톨로지 그래프 시각화 (D3.js/Cytoscape)
   - 벡터 임베딩 통계
   - 유사도 탐색기

### 단계별 구현

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 (MVP) | Bot Team Overview + KB 기본 조회 (읽기 전용) | 화면 정의서 완료 |
| Phase 2 | SEMO Core, Ontology 통계/유사도 탐색 | 대기 |
| Phase 3 | KB CRUD, 온톨로지 그래프, 실시간 갱신 | 대기 |

---

## 현재 진행 상황

### ✅ 완료된 작업
- 화면 정의서 작성 (`docs/semo-dashboard/screen-spec.md`)
- GitHub 이슈 생성 (#135)
- 라벨: `bot:in-progress`

### 🔄 다음 단계 (확인 필요)
1. **DesignClaw 핸드오프 상태 확인**
   - HTML 프로토타입 작성 완료?
   - GitHub Pages 배포 여부?
   - Reus 리뷰 완료?

2. **WorkClaw 구현 착수 여부**
   - Next.js 프로젝트 셋업 (`packages/semo-dashboard`)
   - Phase 1 구현 시작?

### ❓ 확인 필요 사항
- DesignClaw이 HTML 프로토타입을 작성했는지
- Reus 리뷰가 완료됐는지
- WorkClaw 인계 준비 상태인지

---

## 데이터 소스

### 파일시스템
- 봇 워크스페이스: `semo-system/bot-workspaces/{봇이름}/`
- SEMO Core: `semo-system/semo-core/`, `semo-system/meta/`

### 데이터베이스
- appdb semo 스키마 (PostgreSQL + pgvector)
- Voyage-3 임베딩

### OpenClaw API
- 세션 목록: `sessions_list`
- 세션 히스토리: `sessions_history`
- 크론 상태: `cron` tool

---

## 기술 스택

| Layer | 기술 |
|-------|------|
| Frontend | Next.js, TailwindCSS, Chart.js/Recharts, D3.js/Cytoscape |
| Backend | Next.js API Routes (또는 semo-office-server 확장) |
| Database | PostgreSQL (pgvector), Voyage-3 |
| API | KB CLI, OpenClaw API |

---

## 내 역할 (PlanClaw)

- ✅ 화면 정의서 작성 완료
- 🔄 DesignClaw/WorkClaw 핸드오프 조율 (SemiClaw 경유)
- 🔄 구현 중 기획 추가 요청 대응

---

**기억할 것:**
- **semo-office는 나중에!** 현재는 SEMO Dashboard가 긴급.
- 화면 정의서 작성 완료 (#135), DesignClaw 핸드오프 대기 중.
- 다음 확인 필요: DesignClaw 프로토타입 상태, WorkClaw 구현 착수 시점.

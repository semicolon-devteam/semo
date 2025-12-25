# 중앙 DB (core-central-db) 컨텍스트

> 팀 시스템 데이터 및 마이크로서비스 공통 데이터베이스

## 개요

**중앙 DB**는 팀 전체의 운영 데이터와 마이크로서비스들의 공통 데이터베이스입니다.

| 항목 | 값 |
|------|-----|
| **레포지토리** | `semicolon-devteam/core-central-db` |
| **용도** | 팀 운영 + 마이크로서비스 DB |
| **인프라** | On-premise Supabase |

---

## core-supabase와의 구분

| 구분 | core-supabase | core-central-db (중앙 DB) |
|------|---------------|--------------------------|
| **용도** | 커뮤니티 솔루션 템플릿 | 팀 운영 + 마이크로서비스 |
| **대상** | 커뮤니티 서비스 개발 | 팀 시스템/마이크로서비스 |
| **스키마** | RPC/RLS 템플릿 | 실제 운영 스키마 |
| **레포** | `core-supabase` | `core-central-db` |

---

## 중앙 DB 역할

### 팀 시스템 데이터

- 팀 전체 프로젝트 관리
- 재무/사업 정보
- 팀원 정보

### 마이크로서비스 공통 DB

마이크로서비스들이 공유하는 데이터베이스:

| 서비스 | 레포지토리 | DB Prefix | 설명 |
|--------|-----------|-----------|------|
| **Crawler** | `ms-crawler` | `gt_` | 데이터 수집 (구 Gatherer) |
| **Collector** | `ms-collector` | `ag_` | 데이터 집계 (구 Aggregator) |
| **Media-Processor** | `media-processor` | `pl_` | 미디어 처리 (구 Polisher) |
| **Gamer** | `ms-gamer` | `gm_` | 게임 서비스 |
| **Ledger** | `ledger` | `lg_` | 재무 관리 |

---

## 명칭 히스토리

과거 문서와의 호환성을 위한 명칭 매핑:

| 기존 명칭 (문서) | 현재 명칭 (레포) | 비고 |
|-----------------|-----------------|------|
| Gatherer | **Crawler** | `ms-crawler` |
| Aggregator | **Collector** | `ms-collector` |
| Polisher | **Media-Processor** | `media-processor` |

---

## 운영 현황

| 상태 | 서비스 |
|------|--------|
| **운영 중** | ms-gamer (중앙 DB 연동 완료) |
| **마이그레이션 예정** | crawler, media-processor, ledger |

---

## 참조 자료

- `semicolon-devteam/core-central-db` - CLAUDE.md, APPLICATION_GUIDE.md
- `semicolon-devteam/core-supabase` - 커뮤니티 솔루션 스키마

---

## 라우팅 가이드

| 사용자 요청 | 참조 시스템 |
|------------|------------|
| "커뮤니티 DB 스키마" | core-supabase |
| "중앙 DB", "팀 데이터베이스" | core-central-db |
| "마이크로서비스 DB" | core-central-db |
| "게이머 서비스 DB" | core-central-db (gm_ prefix) |
| "크롤러 데이터" | core-central-db (gt_ prefix) |

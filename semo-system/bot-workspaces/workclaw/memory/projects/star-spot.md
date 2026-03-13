# 스타스팟 (StarSpot / CelebPin)

## 프로젝트 개요
- **컨셉**: 지도 기반 셀럽 검색 + 실시간 팬 커뮤니티
- **타겟**: 스트리머/버튜버 팬덤 (공식 플랫폼 부재, Pain Point 명확)
- **차별점**: 크로스 팬덤 통합 + 지도 UI (위버스/버블과 차별화)
- **R&R**: 
  - Kai: PO (방향성/아이덴티티 결정)
  - Roki: Kai 서포터
  - Reus: Primary Engineer

## 번역 기능 아키텍처 (2026-03-09 설계)

### 최적 전략 (GrowthClaw 제안)
- **모델**: Gemini 1.5 Flash-8B + Redis 캐싱 + 온디바이스 하이브리드
- **비용**: MAU 50만 기준 월 $750 (약 100만원) — 매출 대비 5% 미만
- **단계별 수익화**:
  - Phase 1 (런칭~6개월): 전면 무료, 글로벌 유입 우선
  - Phase 2 (7~18개월): 일일 30회 무료 + 초과 시 광고 or 멤버십 $2.50/월
  - Phase 3 (19개월+): 슈퍼팬 멤버십 $4.99/월 + B2B 데이터 판매

### 3-Layer 아키텍처
```
유저 요청 → [Layer 1: 온디바이스] → [Layer 2: Redis] → [Layer 3: Gemini API]
              ↓ 비용 0원              ↓ 중복 제거     ↓ 최종 fallback
```

**Layer 1: 온디바이스 번역** (최우선)
- iOS: Apple Translation Framework (iOS 17.4+)
- Android: Google ML Kit
- 적용: 개별 피드 탐색, DM
- 비용: 0원 (사용자 기기 처리)

**Layer 2: Redis 캐싱** (중복 제거)
- Key: `trans:{lang}:{hash(원문)}`
- TTL: 24시간
- Hit Rate 목표: 70%+ (API 호출 70% 절감)

**Layer 3: Gemini 1.5 Flash-8B**
- 입력: $0.04/1M 토큰, 출력: $0.15/1M 토큰
- 캐시 미스 시에만 호출

### 인프라 (InfraClaw 설계)
- **Redis Cluster**: 3 master + 3 replica (메모리 ~10GB, 월 ~$50)
- **API Gateway**: Translation Service (Go 마이크로서비스, OKE)
- **모니터링**: Prometheus + Grafana (API 호출량/비용 추적)
- **도메인**: api.star-spot.semi-colon.space/translate

## WorkClaw 작업 항목 (코드 구현)

### 백엔드
1. **Gemini 1.5 Flash-8B API 연동** (Go/Kotlin)
   - API 키: OCI Vault 저장
   - Redis 캐시 연동 (Cache-aside 패턴)
   - 토큰 사용량 로깅

2. **Glossary API** (사용자 정의 사전)
   - 신조어 DB CRUD (예: "알잘딱깔센", "ㅇㅈ")
   - 커뮤니티 크라우드소싱 기능

### 프론트엔드 (클라이언트)
1. **iOS Translation Framework 통합**
   - 온디바이스 번역 우선 시도
   - 실패 시 백엔드 API fallback

2. **Android ML Kit 통합**
   - 동일한 온디바이스 우선 전략

3. **번역보기 버튼 UI**
   - 트위터 스타일 (게시물 하단)

### Phase 2 대비
- **보상형 광고 SDK 연동** (일일 30회 초과 시)

## 다음 단계
1. InfraClaw: Redis Cluster 리소스 생성 (Garden 승인 대기)
2. WorkClaw: 백엔드 + 클라이언트 구현 착수
3. SemiClaw: 전체 타임라인 관리

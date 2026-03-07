# google-api.md — Google API 연동 상세

## 인증 현황 (✅ 완료, 2026-02-19 설정)

### 서비스 계정 방식
- **키 파일 위치**: `~/.openclaw-growthclaw/credentials/google-service-account.json`
- **파일 크기**: 2,366 bytes
- **인증 스코프**:
  - Search Console API: `https://www.googleapis.com/auth/webmasters.readonly`
  - Google Analytics Data API (GA4): 기본 스코프
- **권한 부여 대상**:
  - `jungchipan.net` (Search Console + GA4)
  - `axoracle.com` (Search Console + GA4)

---

## 자동화 스크립트

### 통합 리포트 스크립트 (권장)
- **파일**: `~/.openclaw-growthclaw/workspace/report-with-insights.js`
- **기능**:
  - Search Console + GA4 데이터 통합
  - AI 기반 성장 인사이트 자동 생성
  - Slack 채널별 자동 전송
  - 급상승 키워드, 개선 기회, 트래픽 급변 알림
- **사용법**:
  ```bash
  node ~/.openclaw-growthclaw/workspace/report-with-insights.js jungchipan
  node ~/.openclaw-growthclaw/workspace/report-with-insights.js axoracle
  ```
- **출력**: Slack 포맷 메시지 + JSON (channel, service)

### 개별 리포트 스크립트 (레거시)
- `report-jungchipan.js`: 정치판 전용
- `report-axoracle.js`: axoracle 전용

---

## 수집 가능한 데이터

### Search Console API
| 메트릭 | 설명 |
|---|---|
| `clicks` | 검색 결과 클릭 수 |
| `impressions` | 검색 결과 노출 수 |
| `ctr` | 클릭률 (clicks / impressions) |
| `position` | 평균 검색 순위 |
| `query` | 검색어 (dimension) |

**추가 분석**:
- 급상승 키워드 (어제 vs 그저께 노출수 비교, 50% 이상 증가)
- 개선 기회 키워드 (노출 10+ but CTR < 2%)

### Google Analytics Data API (GA4)
| 메트릭 | 설명 |
|---|---|
| `activeUsers` | 활성 사용자 수 |
| `sessions` | 세션 수 |
| `screenPageViews` | 페이지뷰 수 |
| `averageSessionDuration` | 평균 체류 시간 (초) |
| `bounceRate` | 이탈률 (0.0~1.0) |
| `pagePath` | 페이지 경로 (dimension) |
| `sessionSource` | 트래픽 소스 (dimension) |

---

## 클라이언트 사이드 연동 (프로덕션 배포)

### 정치판 (jungchipan.net)
- **GA4**: `GoogleAnalytics.tsx` (`NEXT_PUBLIC_GA_ID` 환경변수)
- **GTM**: `GoogleTagManager.tsx` (GTM ID 하드코딩: `GTM-TJHH9X6N`)
- **적용 위치**: `src/app/layout.tsx`

### axoracle.com
- **GTM**: `GoogleTagManager.tsx` (GTM ID 하드코딩: `GTM-MPLD6Q62`)
- **적용 위치**: `src/app/layout.tsx`

---

## 크론잡 설정 (확인 필요)
- **현재 상태**: 크론잡 확인 명령어 실패 (`openclaw cron list`)
- **실제 실행 로그**: 2026-02-26 09:14 정치판 리포트 자동 생성됨 (memory/2026-02-26.md)
- **추정**: 다른 봇 또는 수동 실행 중

---

## 문제 해결 가이드

### Search Console 노출 0회 문제 (정치판)
1. Search Console 웹 UI에서 URL 검사 실행
2. `robots.txt` 확인 (크롤러 차단 여부)
3. `sitemap.xml` 제출 상태 확인
4. 색인 요청 재시도
5. Next.js SSR 렌더링 이슈 확인 (크롤러가 빈 페이지 수신 가능성)

### API 인증 오류
- 서비스 계정 JSON 키 파일 존재 확인: `ls -la ~/.openclaw-growthclaw/credentials/`
- GCP Console에서 API 활성화 확인 (Search Console API, Google Analytics Data API)
- Property ID 정확성 확인 (GA4 설정 → 속성 설정 → 속성 ID)

---

## 업데이트 이력
- **2026-02-26**: 연동 현황 최초 문서화 (GrowthClaw)
- **2026-02-19**: 서비스 계정 JSON 키 생성 및 권한 부여

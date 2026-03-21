# AXOracle Project Context

> **AI Transformation Oracle** - AI 전환(AX)에 따른 직업, 직무 영향도를 알려주는 서비스

---

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **이름** | AXOracle (AI Transformation Oracle) |
| **SEMO 버전** | 3.14.1 |
| **설치일** | 2026-02-07 |
| **프로젝트 유형** | 실제 서비스 런칭 + 기술 검증 (PoC) |

---

## 현재 작업 상태

**Phase**: Discovery 완료 → Planning 진행 중
**마지막 업데이트**: 2026-02-07

### 완료된 작업
- ✅ Discovery 단계 (5W1H 아이디어 구조화)
- ✅ 타겟 사용자 정의 (일반 직장인, 취업 준비생, HR 담당자)
- ✅ 데이터 수집 전략 수립 (주기적 크롤링 + DB 저장)
- ✅ MVP 범위 설정 (3개국, 50개 직업)

### 진행 중인 작업
- 🔄 기획 보고서 작성 (앱 구현 + 데이터 수집 계획)

### 다음 단계
- ⏳ Speckit 문서 생성 (specify → plan → tasks)
- ⏳ 프로젝트 구조 설정
- ⏳ 데이터 수집 구현
- ⏳ 애플리케이션 구현

---

## 기술 스택

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts (위험도 시각화)

### Backend
- **API**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma 또는 Supabase Client

### Data Collection
- **Crawling**: Playwright
- **Scheduler**: Vercel Cron Jobs 또는 GitHub Actions

### Deployment
- **Hosting**: Vercel
- **Database**: Supabase Cloud

---

## 프로젝트 목표

### Vision
AI 시대의 직업 안정성을 투명하게 공개하여, 누구나 자신의 커리어를 선제적으로 준비할 수 있도록 돕는다

### MVP 성공 지표
- 3개국(한국, 미국, 일본) × 50개 직업 데이터 제공
- 각 직무당 평균 3개 이상의 AI 서비스 매핑
- 위험도 계산 공식의 일관성 확보
- 완전한 사용자 플로우 구현 (국가 선택 → 직업 입력 → 결과 표시)

---

## 데이터 전략

### 대상 국가 및 출처

| 국가 | 연봉 데이터 출처 | 직무 데이터 출처 |
|------|---------------|----------------|
| 한국 | 사람인, 잡코리아 | O*NET (번역 필요) |
| 미국 | BLS (노동통계청) | O*NET Online |
| 일본 | 후생노동성 | O*NET (번역 필요) |

### AI 서비스 데이터
- **MVP**: 수동 큐레이션 (~50개 서비스)
- **향후**: Product Hunt API, GitHub Trending 연동

### 위험도 계산 공식
```
Risk Score = Σ(Task AI Replacement % × Task Time %) / Total Tasks
```

**Risk Level**:
- 0-25%: 낮음 (Low)
- 26-50%: 보통 (Medium)
- 51-75%: 높음 (High)
- 76-100%: 매우 높음 (Critical)

---

## 사용자 플로우

```
1. 국가 선택 (한국/미국/일본)
   ↓
2. 직업명 + 연차 입력
   ↓
3. 결과 표시
   ├─ 평균 연봉
   ├─ 직무(Task) 목록
   ├─ 각 직무별 AI 서비스
   └─ 총 위험도 점수 (0-100%)
```

---

## 개발 타임라인

**전체 기간**: 1개월+ (폴리싱 포함)

- **Week 1**: 프로젝트 설정 + 데이터 수집 스크립트
- **Week 2**: DB 스키마 + 크롤링 + 데이터 정제
- **Week 3**: 프론트엔드 UI/UX 구현
- **Week 4**: 위험도 계산 로직 + 테스트
- **Week 5+**: 디자인 폴리싱 + 배포

---

*마지막 업데이트: 2026-02-07*

# CAT (Crypto Automation Trader) 구현계획서
## HeyChartist.ai 카피 프로젝트

**작성일:** 2026-02-26  
**작성자:** PlanClaw  
**프로젝트 코드명:** CAT (Crypto Automation Trader)  
**벤치마크:** HeyChartist.ai (<https://heychartist.ai/>)  
**기존 레포:** <https://github.com/reus-jeon/CAT> (Python Flask 기반)

---

## 📋 프로젝트 개요

### 목적
HeyChartist.ai의 핵심 기능을 카피하여, 암호화폐 차트 분석을 AI가 자동으로 해주는 웹 서비스 프로토타입 개발

### 핵심 가치제안
- 코인 이름만 입력하면 3초 안에 AI가 7개 지표를 분석
- 전문가 용어 없이 한글로 쉽게 설명
- 24/7 실시간 분석 (30초 단위 업데이트)
- 무료로 사용 가능 (프로토타입 단계)

### 타겟 사용자
- 차트를 볼 줄 모르는 암호화폐 투자 초보자
- 감정적 투자보다 데이터 기반 의사결정을 원하는 투자자

---

## 🎯 구현 범위

### Phase 1: 프로토타입 (MVP)
**목표:** 빠르게 동작하는 프로토타입 완성

1. **홈 대시보드**
   - 실시간 시장 지표 상단바 (시가총액, BTC 도미넌스, 공포탐욕지수)
   - 메인 코인 분석 카드 (BTC/ETH/SOL)
   - AI 신호 (상승/하락/중립) + 신뢰도 점수

2. **코인 상세 분석 페이지**
   - AI 분석 엔진 (1시간봉 기준)
   - 12개 기술적 지표 (RSI, MACD, 볼린저, SMA, EMA 등)
   - 주요 가격대 표시 (저항선/지지선)

3. **AI 채팅**
   - 미리 정의된 프롬프트 버튼 (예: "비트코인 지금 어때?")
   - 대화형 AI 응답 (한글, 이모지 포함)
   - 실시간 데이터 기반 답변

4. **요금제 페이지**
   - 무료 플랜 정보 표시 (프로토타입 단계는 전체 무료)

### Phase 2: 고도화 (이후)
- 멀티 타임프레임 지원 (15분/4시간/일봉)
- 내 자산 (포트폴리오) 기능
- 실시간 알림 (텔레그램/이메일)
- 유료 구독 모델

---

## 🛠️ 기술 스택

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Charts:** Lightweight Charts (TradingView)
- **Icons:** Lucide React

### Backend
- **BaaS:** Supabase
  - Authentication (이메일/소셜 로그인)
  - Database (PostgreSQL)
  - Realtime (30초 단위 데이터 업데이트)
  - Storage (사용자 프로필 이미지 등)
- **API Routes:** Next.js API Routes (서버리스)

### AI/ML
- **AI Provider:** Google AI Studio (Gemini API)
  - Model: gemini-1.5-flash (무료 플랜)
  - 용도: 차트 분석, 대화형 챗봇, 한글 설명 생성
- **Prompt Engineering:** 기술 지표 데이터 → 한글 분석 텍스트

### External APIs
- **Cryptocurrency Data:** Binance API
  - Ticker Price: `/api/v3/ticker/price`
  - 24h Stats: `/api/v3/ticker/24hr`
  - Klines (OHLCV): `/api/v3/klines`
  - Funding Rate: `/fapi/v1/fundingRate`
  - Open Interest: `/fapi/v1/openInterest`
- **Market Sentiment:** Alternative.me Fear & Greed Index API
- **ETF Data:** 수동 입력 또는 크롤링 (TBD)

### Technical Indicators
- **Library:** technicalindicators (npm)
  - RSI, MACD, Bollinger Bands, SMA, EMA, Stochastic, CCI, ADX, Ichimoku, Williams %R, MFI, ATR

### Deployment
- **Hosting:** Vercel
- **Database:** Supabase (PostgreSQL)
- **CDN:** Vercel Edge Network
- **Domain:** TBD

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (Browser)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Next.js 14 (App Router)                     │  │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────┐     │  │
│  │  │   Home     │ │  Coin      │ │  AI Chat    │     │  │
│  │  │ Dashboard  │ │  Detail    │ │             │     │  │
│  │  └────────────┘ └────────────┘ └─────────────┘     │  │
│  │                                                       │  │
│  │  Tailwind CSS + shadcn/ui + Lightweight Charts      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes (Vercel)              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/market/ticker         - 가격 정보             │  │
│  │  /api/market/indicators     - 기술 지표 계산        │  │
│  │  /api/ai/analyze            - AI 분석 생성          │  │
│  │  /api/ai/chat               - AI 채팅              │  │
│  │  /api/sentiment/fear-greed  - 공포탐욕지수          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │                    │                    │
           │ Binance API        │ Google AI         │ Supabase
           ▼                    ▼                    ▼
┌───────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  Binance          │  │  Google AI       │  │  Supabase       │
│  ┌─────────────┐  │  │  Studio          │  │  ┌───────────┐  │
│  │ Market Data │  │  │  ┌────────────┐  │  │  │ Auth      │  │
│  │ OHLCV       │  │  │  │ Gemini 1.5 │  │  │  │ Database  │  │
│  │ Funding     │  │  │  │ Flash      │  │  │  │ Realtime  │  │
│  │ OI          │  │  │  └────────────┘  │  │  └───────────┘  │
│  └─────────────┘  │  └──────────────────┘  └─────────────────┘
└───────────────────┘
```

---

## 🗄️ 데이터베이스 스키마 (Supabase)

### 1. users (Supabase Auth 기본 제공)
```sql
-- Supabase Auth 테이블 (자동 생성)
-- id, email, created_at, updated_at 등
```

### 2. user_profiles
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  ai_chat_quota_daily INT DEFAULT 5,
  ai_interpret_quota_daily INT DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. coin_analysis_cache
```sql
CREATE TABLE coin_analysis_cache (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,               -- BTC, ETH, SOL
  timeframe TEXT NOT NULL,            -- 1h, 4h, 1d
  price DECIMAL(20, 8),
  change_24h DECIMAL(10, 4),
  indicators JSONB,                   -- {rsi, macd, bollinger, ...}
  ai_signal TEXT,                     -- uptrend, downtrend, neutral
  ai_confidence INT,                  -- 0-100
  ai_summary TEXT,                    -- AI 생성 한줄 요약
  support_price DECIMAL(20, 8),
  resistance_price DECIMAL(20, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, timeframe)
);

-- 인덱스
CREATE INDEX idx_coin_analysis_symbol ON coin_analysis_cache(symbol);
CREATE INDEX idx_coin_analysis_created_at ON coin_analysis_cache(created_at DESC);
```

### 4. chat_history
```sql
CREATE TABLE chat_history (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_chat_user_session ON chat_history(user_id, session_id);
CREATE INDEX idx_chat_created_at ON chat_history(created_at DESC);
```

### 5. user_activity_log
```sql
CREATE TABLE user_activity_log (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,        -- CHAT, INTERPRET
  symbol TEXT,                        -- BTC, ETH, etc.
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_activity_user_date ON user_activity_log(user_id, created_at DESC);
```

### 6. market_sentiment
```sql
CREATE TABLE market_sentiment (
  id SERIAL PRIMARY KEY,
  fear_greed_index INT,               -- 0-100
  market_cap DECIMAL(20, 2),
  btc_dominance DECIMAL(5, 2),
  total_24h_liquidation DECIMAL(20, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_sentiment_created_at ON market_sentiment(created_at DESC);
```

---

## 📡 API 설계

### 1. Market Data APIs

#### GET /api/market/ticker
**Description:** 코인 현재 가격 및 24시간 통계
**Query Params:**
- `symbols`: string[] (예: ["BTC", "ETH", "SOL"])

**Response:**
```json
{
  "data": [
    {
      "symbol": "BTC",
      "price": 68123.45,
      "change24h": 2.34,
      "high24h": 70000,
      "low24h": 66200,
      "volume24h": 1900000000
    }
  ]
}
```

#### GET /api/market/ohlcv
**Description:** OHLCV 차트 데이터
**Query Params:**
- `symbol`: string (예: "BTC")
- `interval`: string (예: "1h", "4h", "1d")
- `limit`: number (기본값: 100)

**Response:**
```json
{
  "data": [
    {
      "timestamp": 1703275200000,
      "open": 67800,
      "high": 68500,
      "low": 67500,
      "close": 68123,
      "volume": 123456.78
    }
  ]
}
```

#### GET /api/market/indicators
**Description:** 기술적 지표 계산
**Query Params:**
- `symbol`: string
- `interval`: string

**Response:**
```json
{
  "data": {
    "rsi": 46.1,
    "macd": {
      "value": 404.4,
      "signal": "bearish",
      "histogram": -12.3
    },
    "bollinger": {
      "upper": 69500,
      "middle": 68000,
      "lower": 66500
    },
    "sma20": 67890,
    "ema50": 67500,
    "stochastic": 36.7,
    "cci": -93.1,
    "adx": 100.0,
    "ichimoku": {
      "tenkan": 68200,
      "kijun": 67800,
      "senkouA": 68000,
      "senkouB": 67500
    },
    "williamsR": -63.3,
    "mfi": 50.6,
    "atr": 1200.5
  }
}
```

#### GET /api/market/derivatives
**Description:** 파생상품 데이터 (OI, Funding Rate, Long/Short Ratio)
**Query Params:**
- `symbol`: string

**Response:**
```json
{
  "data": {
    "openInterest": 5400000000,
    "oiChange24h": 2.4,
    "fundingRate": -0.0011,
    "longShortRatio": 1.61,
    "liquidations1h": {
      "long": 964900,
      "short": 813300
    }
  }
}
```

---

### 2. AI Analysis APIs

#### POST /api/ai/analyze
**Description:** AI 차트 분석 생성
**Request Body:**
```json
{
  "symbol": "BTC",
  "interval": "1h",
  "indicators": { /* 기술 지표 데이터 */ },
  "price": 68123.45,
  "change24h": 2.34
}
```

**Response:**
```json
{
  "data": {
    "signal": "downtrend",
    "confidence": 66,
    "summary": "하락 신호가 감지됐어요",
    "reason": "가격이 최근 평균(SMA20) 아래에 있어요 — 단기 약세 신호",
    "supportPrice": 66052,
    "resistancePrice": 69797,
    "recommendedAction": "관망"
  }
}
```

#### POST /api/ai/chat
**Description:** AI 대화형 채팅
**Request Body:**
```json
{
  "message": "비트코인 지금 어때?",
  "sessionId": "uuid",
  "context": {
    "symbol": "BTC",
    "currentPrice": 68123.45
  }
}
```

**Response:**
```json
{
  "data": {
    "message": "지금 BTC, 반등 중인데 70K 벽에서 막혀있어요 📊\n\n현재 $68,200 (+4.31%), 원화로 약 9,889만원이에요...",
    "usageCount": 3,
    "remainingQuota": 17
  }
}
```

---

### 3. Sentiment APIs

#### GET /api/sentiment/fear-greed
**Description:** 공포탐욕지수 조회

**Response:**
```json
{
  "data": {
    "value": 51,
    "classification": "neutral",
    "timestamp": 1703275200000
  }
}
```

---

### 4. User APIs

#### GET /api/user/profile
**Description:** 사용자 프로필 조회 (인증 필요)

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "demo10",
    "plan": "pro",
    "quota": {
      "aiChat": { "used": 18, "limit": 20 },
      "aiInterpret": { "used": 49, "limit": 50 }
    }
  }
}
```

#### GET /api/user/activity
**Description:** 사용자 활동 내역 (7일)

**Response:**
```json
{
  "data": {
    "chat": [0, 0, 0, 0, 0, 2, 2],
    "interpret": [0, 0, 0, 0, 0, 0, 1]
  }
}
```

---

## 🎨 UI/UX 구현 계획

### 디자인 시스템
- **Color Palette:**
  - Primary: Indigo (차트/버튼)
  - Success: Green (상승)
  - Danger: Red (하락)
  - Warning: Yellow (중립)
  - Background: Slate (다크 모드 지원)

- **Typography:**
  - Heading: Pretendard Bold
  - Body: Pretendard Regular

- **Components:**
  - shadcn/ui 기본 컴포넌트 사용
  - 커스텀 차트 컴포넌트 (Lightweight Charts 래핑)

### 주요 화면 구성

#### 1. 홈 대시보드 (`/`)
```
┌─────────────────────────────────────────────────────────┐
│ [Logo]  홈 | 요금제 | AI 채팅 | 내 자산    [다크] [계정] │
├─────────────────────────────────────────────────────────┤
│ 시가총액 $2.42T +1.3% | BTC 도미넌스 56.1% | 공포 51 ... │
├─────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│ │ [BTC 아이콘]  │ │ [ETH 아이콘]  │ │ [SOL 아이콘]  │    │
│ │ Bitcoin      │ │ Ethereum     │ │ Solana       │    │
│ │ $68,123      │ │ $2,070       │ │ $87.9        │    │
│ │ ▲ +2.3%      │ │ ▲ +4.8%      │ │ ▲ +4.0%      │    │
│ │              │ │              │ │              │    │
│ │ 🟢 상승 신호  │ │ 🟢 상승 신호  │ │ 🟢 상승 신호  │    │
│ │ 신뢰도 52%    │ │ 신뢰도 66%    │ │ 신뢰도 52%    │    │
│ │              │ │              │ │              │    │
│ │ [자세히 →]   │ │ [자세히 →]   │ │ [자세히 →]   │    │
│ └──────────────┘ └──────────────┘ └──────────────┘    │
├─────────────────────────────────────────────────────────┤
│ 시장 펄스 (BTC 파생) | 미결제약정 $5.4B +2.4% ...      │
├─────────────────────────────────────────────────────────┤
│ 비트코인 ETF | IBIT $64.8B +7.39% | FBTC $16.1B ...   │
└─────────────────────────────────────────────────────────┘
```

#### 2. 코인 상세 분석 (`/coin/[symbol]`)
```
┌─────────────────────────────────────────────────────────┐
│ [BTC 아이콘] Bitcoin BTC/USDT    [15분|1시간|4시간|일봉] │
│ $68,123  ▲ +2.3% 24h                                    │
├─────────────────────────────────────────────────────────┤
│ [차트 영역 - Lightweight Charts]                        │
│                                                          │
│   70K ─────────────────────────────                     │
│   68K ─────●──────────────────                          │
│   66K ───────────────────────────                       │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ ✦ AI ANALYSIS ENGINE                                    │
│                                                          │
│ 하락 흐름 (Downtrend)                                    │
│ 하락 신호가 감지됐어요                                    │
│ 분석 기준: 1시간봉                                        │
│                                                          │
│ • 기준 가격대: $68,095                                   │
│ • 상방 가격대: $69,797                                   │
│ • 하방 가격대: $66,052                                   │
│                                                          │
│ [분석 업데이트] [AI 상세 해석 (1시간봉)]                  │
│                                                          │
│ AI 신뢰도 점수: 66 / 100                                 │
├─────────────────────────────────────────────────────────┤
│ 🔧 기술적 지표                                            │
│                                                          │
│ RSI(14)      46.1   하락세                               │
│ MACD        404.4   데드크로스 ↓                         │
│ 볼린저밴드    중간    중간 구간                           │
│ SMA(20)      아래    상승 추세                           │
│ ...                                                      │
└─────────────────────────────────────────────────────────┘
```

#### 3. AI 채팅 (`/chat`)
```
┌─────────────────────────────────────────────────────────┐
│ [Logo]  홈 | 요금제 | AI 채팅 | 내 자산    [다크] [계정] │
├─────────────────────────────────────────────────────────┤
│ 물어보기                              [119개 남음] [초기화]│
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ✦ Chartist AI                                           │
│                                                          │
│ 크립토 궁금한 거, 뭐든 물어보세요                          │
│ 실시간 데이터 기반으로 쉽게 알려드려요                      │
│                                                          │
│ [비트코인 지금 어때?] [이더리움 전망 어때?]                │
│ [지금 시장 분위기는?] [고래들 뭐 하고 있어?]               │
│ [청산 현황 알려줘] [BTC vs ETH 비교해줘]                  │
│                                                          │
│ [이전 대화내역 보기]                                      │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ [입력창: 비트코인 지금 어때?]                [전송 버튼]   │
└─────────────────────────────────────────────────────────┘
```

---

## 📅 개발 단계별 로드맵

### Week 1-2: 프로젝트 셋업 및 기본 인프라
- [x] 프로젝트 구조 설계
- [ ] Next.js 14 프로젝트 초기화
- [ ] Tailwind CSS + shadcn/ui 설정
- [ ] Supabase 프로젝트 생성 및 DB 스키마 구축
- [ ] Vercel 프로젝트 연결
- [ ] 환경 변수 설정 (API Keys)
- [ ] Git 레포지토리 생성 및 초기 커밋

### Week 3-4: 데이터 레이어 구축
- [ ] Binance API 연동
  - [ ] Ticker Price API
  - [ ] 24h Stats API
  - [ ] Klines (OHLCV) API
  - [ ] Funding Rate API
  - [ ] Open Interest API
- [ ] 기술적 지표 계산 함수 구현
  - [ ] RSI, MACD, Bollinger Bands
  - [ ] SMA, EMA, Stochastic
  - [ ] CCI, ADX, Ichimoku, Williams %R, MFI, ATR
- [ ] Fear & Greed Index API 연동
- [ ] Supabase 데이터 캐싱 로직 구현

### Week 5-6: AI 분석 엔진 구축
- [ ] Google AI Studio (Gemini) 연동
- [ ] Prompt Engineering
  - [ ] 차트 분석 프롬프트 설계
  - [ ] 한글 설명 생성 프롬프트
  - [ ] 대화형 챗봇 프롬프트
- [ ] AI 분석 API 구현 (`/api/ai/analyze`)
- [ ] AI 채팅 API 구현 (`/api/ai/chat`)
- [ ] 신뢰도 점수 알고리즘 구현

### Week 7-8: 프론트엔드 - 홈 대시보드
- [ ] 레이아웃 구조 구현
- [ ] 상단 시장 지표 바 구현
- [ ] 메인 코인 분석 카드 구현 (BTC/ETH/SOL)
- [ ] 시장 펄스 위젯 구현
- [ ] 비트코인 ETF 정보 위젯 구현
- [ ] 고래 동향 위젯 구현
- [ ] 실시간 청산 롤링 베너 구현
- [ ] 반응형 디자인 적용

### Week 9-10: 프론트엔드 - 코인 상세 분석
- [ ] 차트 컴포넌트 구현 (Lightweight Charts)
- [ ] AI 분석 엔진 섹션 구현
- [ ] 타임프레임 선택기 구현 (1시간봉만 우선)
- [ ] 기술적 지표 테이블 구현
- [ ] 파생상품 분석 위젯 구현
- [ ] 실시간 청산 모니터 구현
- [ ] 거래소 순유출입 차트 구현
- [ ] 고래 활동 섹션 구현

### Week 11-12: 프론트엔드 - AI 채팅
- [ ] 채팅 UI 구현
- [ ] 미리 정의된 프롬프트 버튼 구현
- [ ] 대화 내역 저장 및 불러오기
- [ ] 실시간 타이핑 애니메이션 구현
- [ ] 이모지 및 포맷팅 지원
- [ ] 사용량 표시 (일일 쿼터)

### Week 13: 프론트엔드 - 기타 페이지
- [ ] 요금제 페이지 구현 (무료 플랜만)
- [ ] 내 계정 페이지 구현
  - [ ] 프로필 정보
  - [ ] 일일 사용량 그래프
  - [ ] 최근 활동 테이블
- [ ] 랜딩 페이지 구현 (비로그인 사용자용)

### Week 14: 인증 및 사용자 관리
- [ ] Supabase Auth 연동
- [ ] 이메일 로그인 구현
- [ ] 소셜 로그인 구현 (Google, GitHub)
- [ ] 회원가입 플로우 구현
- [ ] 사용자 프로필 생성 로직
- [ ] 일일 쿼터 리셋 로직 (Cron Job)

### Week 15: 실시간 업데이트 및 최적화
- [ ] Supabase Realtime 연동
- [ ] 30초 단위 데이터 업데이트 구현
- [ ] TanStack Query 캐싱 최적화
- [ ] 이미지 최적화 (Next.js Image)
- [ ] 코드 스플리팅 및 번들 사이즈 최적화
- [ ] Lighthouse 성능 테스트 및 개선

### Week 16: 테스트 및 버그 수정
- [ ] E2E 테스트 작성 (Playwright)
- [ ] Unit 테스트 작성 (Jest)
- [ ] 브라우저 호환성 테스트
- [ ] 모바일 반응형 테스트
- [ ] 버그 수정 및 리팩토링

### Week 17-18: 배포 및 모니터링
- [ ] Vercel 프로덕션 배포
- [ ] 도메인 연결
- [ ] SSL 인증서 설정
- [ ] Sentry 오류 모니터링 설정
- [ ] Vercel Analytics 연동
- [ ] 최종 QA 및 성능 테스트

### Week 19-20: 프로토타입 완성 및 피드백
- [ ] 내부 테스트 및 피드백 수렴
- [ ] UI/UX 개선
- [ ] 문서화 (README, API 문서)
- [ ] 프로토타입 공개

---

## ⚠️ 예상 이슈 및 해결 방안

### 1. Binance API Rate Limit
**문제:** 무료 API는 분당 요청 제한이 있음
**해결:**
- Supabase 캐싱 레이어 활용 (30초 단위 업데이트)
- 여러 심볼을 한 번에 조회하는 API 사용 (`/api/v3/ticker/24hr`)
- IP 기반 제한 회피를 위한 서버리스 함수 분산

### 2. Google AI Studio 무료 플랜 제한
**문제:** 일일 API 호출 제한 (예: 60 RPM)
**해결:**
- 사용자 쿼터 시스템 구현 (일일 5회 무료)
- AI 분석 결과 캐싱 (동일 요청 중복 방지)
- Rate Limit 도달 시 에러 메시지 표시

### 3. 실시간 데이터 업데이트 성능
**문제:** 30초마다 모든 사용자에게 데이터 전송 시 서버 부하
**해결:**
- Supabase Realtime을 활용한 WebSocket 연결
- 클라이언트 사이드 캐싱 (TanStack Query)
- 화면에 보이는 코인만 업데이트 (lazy loading)

### 4. 기술적 지표 계산 정확도
**문제:** HeyChartist와 동일한 지표 값을 얻기 어려움
**해결:**
- `technicalindicators` 라이브러리 사용
- 벤치마크 서비스와 비교 테스트
- 필요 시 수동 계산 로직 구현

### 5. AI 분석 품질
**문제:** Gemini가 정확한 한글 분석을 생성하지 못할 수 있음
**해결:**
- Prompt Engineering 반복 개선
- Few-shot Learning (예시 데이터 제공)
- 후처리 로직 (텍스트 포맷팅, 이모지 추가)

### 6. 다크 모드 구현
**문제:** Lightweight Charts 다크 모드 지원
**해결:**
- 라이브러리 테마 커스터마이징
- Tailwind CSS 다크 모드와 동기화
- shadcn/ui 다크 모드 프리셋 활용

### 7. SEO 최적화
**문제:** SPA 특성상 SEO가 약할 수 있음
**해결:**
- Next.js App Router의 Server Components 활용
- 메타 태그 최적화 (Open Graph, Twitter Card)
- Sitemap 및 robots.txt 생성

### 8. 모바일 반응형
**문제:** 복잡한 차트와 테이블이 모바일에서 깨질 수 있음
**해결:**
- 모바일 우선 디자인 (Mobile-First)
- 차트 줌/팬 제스처 지원
- 테이블 → 카드 레이아웃 전환

---

## 🔐 보안 고려사항

### 1. API Key 관리
- **환경 변수 사용:** `.env.local` 파일에 저장, Git에 커밋하지 않음
- **서버 사이드에서만 사용:** 클라이언트에 노출되지 않도록 API Routes에서 호출

### 2. 사용자 인증
- **Supabase Auth:** Row Level Security (RLS) 활성화
- **세션 관리:** JWT 토큰 기반, httpOnly 쿠키 사용
- **CSRF 방어:** Supabase 기본 제공

### 3. Rate Limiting
- **API Routes:** Vercel Edge Functions의 기본 Rate Limit 활용
- **추가 구현:** Upstash Redis를 활용한 커스텀 Rate Limit

### 4. 데이터 검증
- **Input Validation:** Zod 라이브러리 사용
- **XSS 방어:** React의 기본 보안 기능 + DOMPurify 추가

---

## 📊 성능 목표

### 1. Lighthouse 점수
- **Performance:** 90+ (모바일 기준)
- **Accessibility:** 95+
- **Best Practices:** 100
- **SEO:** 95+

### 2. Core Web Vitals
- **LCP (Largest Contentful Paint):** &lt; 2.5초
- **FID (First Input Delay):** &lt; 100ms
- **CLS (Cumulative Layout Shift):** &lt; 0.1

### 3. API 응답 시간
- **Market Data APIs:** &lt; 500ms
- **AI Analysis APIs:** &lt; 3초 (Gemini 응답 시간 포함)
- **Chat APIs:** &lt; 2초

---

## 📚 참고 자료

### 기술 문서
- Next.js 14 Docs: <https://nextjs.org/docs>
- Supabase Docs: <https://supabase.com/docs>
- Google AI Studio: <https://ai.google.dev/docs>
- Binance API Docs: <https://binance-docs.github.io/apidocs/>
- Lightweight Charts: <https://tradingview.github.io/lightweight-charts/>
- shadcn/ui: <https://ui.shadcn.com/>

### 벤치마크
- HeyChartist.ai: <https://heychartist.ai/>
- TradingView: <https://www.tradingview.com/>
- CoinMarketCap: <https://coinmarketcap.com/>
- Binance: <https://www.binance.com/>

### 기존 프로젝트
- CAT (Python Flask): <https://github.com/reus-jeon/CAT>

---

## 🎯 다음 단계

1. **Reus 승인:** 구현계획서 검토 및 피드백
2. **SemiClaw 인계:** 프로젝트 디렉토리 세팅 요청
3. **WorkClaw 인계:** 구현 시작 (Week 1-2부터)
4. **정기 체크인:** 주간 진행상황 보고 (매주 금요일)

---

**작성자:** PlanClaw  
**최종 수정:** 2026-02-26 23:42 KST

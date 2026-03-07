# 게임랜드 (proj-game-land)

## 기본 정보
- 채널: #proj-game-land (C0AEV7QN6R0)
- 레포: cm-land → proj-game-land (변경 예정, Garden 공지 2/14)
- Dev URL: game-land-dev.semi-colon.space
- Supabase: game-supabase-dev.semi-colon.space
- Spring 백엔드: game-backend-dev.semi-colon.space

## 게임존 (/game) — Roki 작업 (2026-02-15)
로그인 필수 (ServerAuthGuard), 포인트 기반 베팅 시스템
포인트 차감/지급: Supabase RPC (points_use / points_issue)
잔액: user_point_wallets 테이블

### 게임 목록 (총 5개)
1. **포인트 룰렛** `/game/roulette` — 🆕 신규
   - 12개 세그먼트, 배당 0x~10x, 베팅 100~50,000P
   - CSS rotate + transition 애니메이션
2. **가위바위보** `/game/rps` — 기존 (이번 작업 범위 외)
3. **바카라** `/game/baccarat` — 🆕 신규
   - 8벌 덱, 3rd card rule, 플레이어(2x)/뱅커(1.95x)/타이(9x)
   - CSS rotateY 카드 뒤집기 애니메이션
4. **사다리** `/game/ladder` — 🆕 신규
   - 4줄 8행, 좌/우(필수 1.95x) + 홀/짝(선택 1.95x) 이중 베팅
   - CSS div 기반 사다리 + 빨간 경로 순차 애니메이션 (300ms/step)
5. **포인트 배팅** `/game/bet` — 기존 (이번 작업 범위 외)

### 공통 아키텍처 패턴
```
Model (타입/상수)
  → API Route (Next.js Route Handler, 게임 로직 + 포인트 RPC)
    → Service (API 호출 래퍼, baseService 사용)
      → Hook (React 상태 관리)
        → Components (UI, CSS 애니메이션)
          → Page (ServerAuthGuard + metadata)
```

### SEO 메타데이터 — DB 기반 전환
- 하드코딩 → site_config_kv 테이블의 site.metadata 키 (JSON)
- NEXT_PUBLIC_APP_NAME env var 폴백
- 배포 없이 Supabase DB에서 직접 수정 가능

### 인프라/버그 수정
- Supabase URL: land-supabase-dev → game-supabase-dev.semi-colon.space
- Spring 백엔드 URL: land-backend-dev → game-backend-dev.semi-colon.space  
- Supabase 클라이언트 Lazy Proxy 패턴 적용
- 콘솔 에러 정리, 시맨틱 마크업 개선

### 포인트 API 전환 (Supabase RPC → core-backend Internal API)
- **상태**: 진행 중 (2026-02-16)
- Supabase RPC(`points_use`/`points_issue`) → `POST /rest/v1/internal/points/use|issue`
- 인증: `X-Internal-Api-Key` + `X-Internal-Service-Id: game-land`
- **TODO (Garden, 2/17)**:
  - [ ] core-backend `application.yml`에 `game-land` 키 항목 추가
  - [ ] K8s 환경변수 `INTERNAL_API_KEY_GAME_LAND` 주입 (DEV)
  - [ ] game-land에 `INTERNAL_API_KEY` 환경변수 세팅 (서버 전용, NEXT_PUBLIC ❌)
- **TODO (kyago)**:
  - [ ] `point_policies`에 GAME_POINT 정책 생성 → policyId 확정
  - [ ] 잔액 조회 Internal API 추가 검토 (`GET /rest/v1/internal/points/wallets?userId=`)
- API Key: `47c0c256269ebcc9f35f30d91b07434afe2bb7c9d9ccb072ee6829f7718b9df6`

### 커밋 이력
- `dee5f96` — feat: 게임존 바카라/사다리 게임 추가 및 SEO 최적화 (54 files)
- `91d8338` — refactor: SEO 하드코딩 제거, site_config_kv DB 기반으로 전환 (3 files)

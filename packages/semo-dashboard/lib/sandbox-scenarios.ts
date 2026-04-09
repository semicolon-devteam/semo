/**
 * Sandbox Scenarios — 시나리오별 프로젝트 정의 + Mock 섹션 콘텐츠.
 *
 * Mock 섹션은 Phase 0부터 점진적으로 확충.
 * 아직 mock이 없는 Phase에서는 해당 Phase의 placeholder 섹션을 자동 생성.
 */

import type { SandboxScenario } from '@/types';

export const SANDBOX_SCENARIOS: Record<string, SandboxScenario> = {
  minicafe: {
    id: 'minicafe',
    project_name: 'MiniCafe',
    persona_id: 'cafe-owner',
    preset: 'parallel',
    initial_description:
      '동네 카페 모바일 주문앱. 고객이 줄 서지 않고 모바일로 메뉴 확인, 주문, 결제까지 할 수 있는 앱. 매장 내 픽업 전용. 메뉴 관리와 일일 매출 확인 기능 필요.',
    mock_sections: {
      0: [
        {
          section_key: 'identity',
          title: '프로젝트 정체성',
          content:
            '## MiniCafe\n\n**한 줄 설명**: 동네 카페 모바일 주문/결제 앱\n\n**서비스 도메인**: F&B / 커머스\n\n**핵심 가치**: 대기 시간 제거, 매장 운영 효율화\n\n**타겟 사용자**: 카페 단골 고객 + 카페 사장(관리자)\n\n**PO**: 민아 (카페 사장, 비전공자)',
          source: 'semiclaw',
        },
        {
          section_key: 'setup-context',
          title: '셋업 컨텍스트',
          content:
            '## 프로젝트 배경\n\n- 10년차 카페 운영, 피크 시간 대기열 문제 심각\n- 키오스크 도입 검토했으나 비용 부담\n- 모바일 주문으로 대기 제거 + 재주문 편의성 제공 목표\n\n## 기술 환경\n\n- PO 기술 수준: non-technical\n- 기존 시스템: POS (포스기), 없음\n- 예산 제약: 소규모 (월 50만원 이하 유지비)',
          source: 'semiclaw',
        },
      ],
      1: [
        {
          section_key: 'discovery-overview',
          title: '디스커버리 개요',
          content:
            '## 핵심 요구사항\n\n### 고객 앱\n- 메뉴 조회 (카테고리별 분류, 사진, 가격)\n- 장바구니 + 주문하기\n- 간편 결제 (카카오페이, 네이버페이)\n- 주문 상태 확인 (준비중 → 완료)\n- 재주문 (최근 주문 목록)\n\n### 관리자 (카페 사장)\n- 메뉴 등록/수정/삭제\n- 주문 접수/완료 처리\n- 일일 매출 요약\n- 품절 메뉴 표시 토글\n\n### 비기능 요구사항\n- 모바일 웹앱 (앱스토어 등록 불필요)\n- 한국어 전용\n- 동시 접속 50명 이하',
          source: 'planclaw',
        },
      ],
      2: [
        {
          section_key: 'prd',
          title: 'PRD (제품 요구사항 정의서)',
          content:
            '## MiniCafe PRD\n\n### 1. 제품 비전\n카페 고객이 줄 서지 않고 1분 내 주문을 완료할 수 있는 모바일 웹앱.\n\n### 2. 사용자 페르소나\n- **단골 고객 수진**: 30대 직장인, 출근길에 매일 아메리카노 주문. 빠른 재주문이 핵심.\n- **카페 사장 민아**: 비전공자, 메뉴 관리와 매출 확인이 편해야 함.\n\n### 3. 핵심 기능 (MVP)\n| 우선순위 | 기능 | 설명 |\n|---------|------|------|\n| P0 | 메뉴 조회 | 카테고리, 사진, 가격, 옵션 |\n| P0 | 주문 + 결제 | 장바구니 → 카카오페이 결제 |\n| P0 | 주문 관리 | 사장용 주문 접수/완료 대시보드 |\n| P1 | 재주문 | 최근 주문 1탭 재주문 |\n| P1 | 매출 요약 | 일간/주간 매출 그래프 |\n| P2 | 알림 | 주문 완료 시 고객 푸시 |\n\n### 4. 제외 사항 (MVP)\n- 배달 기능\n- 멤버십/포인트\n- 다국어 지원',
          source: 'planclaw',
        },
      ],
      3: [
        {
          section_key: 'clarification-qa',
          title: '명확화 Q&A 요약',
          content:
            '## 명확화 Q&A\n\n### Q1. 메뉴 옵션 구조\n**Q:** 메뉴 옵션(사이즈, 샷 추가 등)은 어떤 구조인가요?\n**A:** 사이즈(R/L), 샷 추가(+500원), 시럽 변경 정도. 옵션 그룹은 최대 3개면 충분합니다.\n\n### Q2. 결제 수단 범위\n**Q:** 카카오페이 외 다른 결제 수단이 필요한가요?\n**A:** MVP는 카카오페이만. 런칭 후 네이버페이 추가 예정.\n\n### Q3. 주문 접수 방식\n**Q:** 주문이 들어오면 자동 접수인가요, 사장이 수동 수락하나요?\n**A:** 수동 수락. 재료 소진 시 거절할 수 있어야 합니다. 3분 내 미응답 시 자동 알림.\n\n### Q4. 영업시간 외 주문\n**Q:** 영업시간 외에 주문이 가능한가요?\n**A:** 아닙니다. 영업시간 설정 기능이 필요하고, 시간 외에는 "영업 준비 중" 표시.\n\n### Q5. 테이블 번호 / 픽업 구분\n**Q:** 매장 내 테이블 번호 입력이 필요한가요?\n**A:** 아니요. 카운터 픽업 전용이라 닉네임만 입력받으면 됩니다.',
          source: 'planclaw',
        },
      ],
      4: [
        {
          section_key: 'ds-color',
          title: '디자인 시스템 — 색상 팔레트',
          content:
            '## 색상 팔레트\n\n### Primary\n- **Espresso Brown** `#4A2C2A` — 주요 CTA, 헤더\n- **Cream White** `#FFF8F0` — 배경\n- **Latte Beige** `#D4A574` — 보조 강조, 아이콘\n\n### Secondary\n- **Mint Green** `#A8D8B9` — 성공 상태, 주문 완료\n- **Warm Gray** `#8C8279` — 비활성, 보조 텍스트\n- **Alert Red** `#E74C3C` — 에러, 품절 표시\n\n### Semantic\n- `--color-bg`: #FFF8F0\n- `--color-text-primary`: #2C1810\n- `--color-text-secondary`: #8C8279\n- `--color-accent`: #4A2C2A\n- `--color-success`: #A8D8B9\n- `--color-error`: #E74C3C\n\n### 적용 원칙\n- 카페의 따뜻한 분위기를 반영한 브라운 계열 기본\n- 배경은 크림 화이트로 메뉴 사진이 돋보이도록\n- CTA 버튼은 Espresso Brown + White 텍스트',
          source: 'designclaw',
        },
        {
          section_key: 'ds-typography',
          title: '디자인 시스템 — 타이포그래피',
          content:
            '## 타이포그래피\n\n### 폰트 패밀리\n- **본문**: Pretendard (400, 500, 600)\n- **강조/가격**: Pretendard SemiBold (600)\n- **숫자/금액**: Pretendard (tabular-nums)\n\n### 스케일\n| 토큰 | 사이즈 | 용도 |\n|------|--------|------|\n| `text-xs` | 12px | 보조 텍스트, 품절 뱃지 |\n| `text-sm` | 14px | 옵션 설명, 카테고리 |\n| `text-base` | 16px | 메뉴 이름, 본문 |\n| `text-lg` | 18px | 섹션 제목 |\n| `text-xl` | 20px | 페이지 제목 |\n| `text-2xl` | 24px | 가격 강조 |\n\n### 행간\n- 본문: 1.6\n- 제목: 1.3\n- 가격: 1.0',
          source: 'designclaw',
        },
        {
          section_key: 'ds-component',
          title: '디자인 시스템 — 컴포넌트 정의',
          content:
            '## 컴포넌트 정의\n\n### MenuCard\n- 썸네일(1:1 비율, 80px) + 메뉴명 + 가격 + 옵션 요약\n- 품절 시 오버레이 + "품절" 뱃지\n- 탭 시 상세 바텀시트 오픈\n\n### CartItem\n- 메뉴명 + 옵션 태그 + 수량 스테퍼(-, +) + 소계\n- 스와이프 삭제 지원\n\n### OrderStatusBadge\n- `접수대기` (Yellow) → `준비중` (Blue) → `완료` (Green)\n- 실시간 업데이트 (SSE/polling)\n\n### BottomCTA\n- 화면 하단 고정, Safe area 대응\n- 장바구니: "N개 담김 · 합계 ₩12,500 → 주문하기"\n- 결제: "카카오페이로 ₩12,500 결제"\n\n### AdminOrderCard\n- 주문번호 + 닉네임 + 메뉴 목록 + 접수시간\n- "접수" / "완료" / "거절" 버튼 그룹\n- 3분 경과 시 카드 테두리 경고색\n\n### CategoryTab\n- 수평 스크롤 탭, 선택 시 Espresso Brown 언더라인\n- "전체" 탭 기본 선택',
          source: 'designclaw',
        },
      ],
      5: [
        {
          section_key: 'epics',
          title: '에픽 — 기능 목록 및 로드맵',
          content:
            '## 에픽 목록\n\n### Epic 1: 메뉴 시스템\n- 카테고리 관리 (커피, 논커피, 디저트, 시즌)\n- 메뉴 CRUD (사진, 가격, 옵션 그룹)\n- 품절 토글\n- 메뉴 정렬/순서 변경\n\n### Epic 2: 주문 플로우\n- 메뉴 탐색 → 옵션 선택 → 장바구니\n- 장바구니 수정 (수량, 삭제)\n- 닉네임 입력 → 카카오페이 결제\n- 주문 확인 화면 + 대기번호\n\n### Epic 3: 주문 관리 (관리자)\n- 실시간 주문 대시보드\n- 주문 접수/완료/거절 처리\n- 미응답 3분 경과 알림\n- 일별 주문 내역\n\n### Epic 4: 매출/운영\n- 일간/주간 매출 요약\n- 인기 메뉴 TOP 5\n- 영업시간 설정\n\n### Epic 5: 재주문\n- 최근 주문 목록 (최대 10개)\n- 1탭 재주문 → 장바구니 자동 채움\n\n### 로드맵\n| 스프린트 | 에픽 | 기간 |\n|---------|------|------|\n| Sprint 1 | Epic 1 + Epic 2 | 2주 |\n| Sprint 2 | Epic 3 | 1.5주 |\n| Sprint 3 | Epic 4 + Epic 5 | 1.5주 |\n| Buffer | QA + 피드백 반영 | 1주 |',
          source: 'planclaw',
        },
      ],
      6: [
        {
          section_key: 'feature-spec-order',
          title: '기능 스펙 — 주문 플로우',
          content:
            '## 기능 스펙: 주문 플로우\n\n### 1. 메뉴 탐색\n- 진입 시 카테고리 탭 노출 (기본: "전체")\n- 카테고리 선택 시 해당 메뉴만 필터\n- 메뉴 카드: 썸네일 + 이름 + 가격\n- 품절 메뉴는 하단 배치 + 품절 오버레이\n\n### 2. 옵션 선택\n- 메뉴 탭 → 바텀시트 오픈\n- 옵션 그룹별 라디오/체크 선택\n  - 사이즈: R(기본) / L(+500)\n  - 샷: 기본 / +1샷(+500)\n  - 시럽: 없음 / 바닐라 / 헤이즐넛\n- 수량 선택 (기본 1, 최대 10)\n- "장바구니 담기" CTA → 토스트 알림\n\n### 3. 장바구니\n- 담긴 아이템 목록 (메뉴명, 옵션, 수량, 소계)\n- 수량 변경 스테퍼\n- 스와이프 삭제\n- 합계 금액 실시간 계산\n- "주문하기" CTA\n\n### 4. 결제\n- 닉네임 입력 (2~6자, 한글/영문)\n- 결제 수단: 카카오페이\n- 카카오페이 SDK → 결제 완료 콜백\n- 실패 시 재시도 안내\n\n### 5. 주문 완료\n- 대기번호 표시\n- 예상 준비시간 (평균 5분)\n- 주문 상태 실시간 표시\n\n### 예외 처리\n- 결제 중 품절 전환 → "선택하신 메뉴가 품절되었습니다" 알림\n- 영업시간 외 접속 → 주문 버튼 비활성 + "영업 준비 중" 안내',
          source: 'planclaw',
        },
        {
          section_key: 'feature-spec-admin',
          title: '기능 스펙 — 관리자 대시보드',
          content:
            '## 기능 스펙: 관리자 대시보드\n\n### 1. 주문 관리 화면\n- 실시간 주문 카드 목록 (최신순)\n- 카드: 주문번호, 닉네임, 메뉴 목록, 접수 시간\n- 액션 버튼: "접수" / "완료" / "거절"\n- 접수 후 3분 경과 시 카드 테두리 경고색\n- 거절 시 사유 선택 (재료 소진 / 영업 종료 / 기타)\n\n### 2. 메뉴 관리\n- 메뉴 목록 (카테고리별 그룹)\n- 등록: 사진 업로드 + 이름 + 가격 + 옵션 그룹 설정\n- 수정: 인라인 편집 (가격, 품절 토글)\n- 삭제: 소프트 삭제 (주문 이력 보존)\n- 카테고리 순서 드래그 정렬\n\n### 3. 매출 요약\n- 오늘 매출 (건수 + 금액)\n- 주간 추이 그래프 (막대 차트)\n- 인기 메뉴 TOP 5\n\n### 4. 설정\n- 영업시간 설정 (요일별)\n- 카페 이름/로고 변경\n- 알림 수신 설정',
          source: 'planclaw',
        },
      ],
      7: [
        {
          section_key: 'tech-architecture',
          title: '기술 설계 — 아키텍처',
          content:
            '## 기술 아키텍처\n\n### 기술 스택\n- **Frontend**: Next.js 15 (App Router) + Tailwind CSS\n- **Backend**: Next.js API Routes (Route Handlers)\n- **Database**: Supabase (PostgreSQL + Realtime)\n- **결제**: 카카오페이 SDK (REST API)\n- **이미지 저장**: Supabase Storage\n- **배포**: Vercel\n\n### 시스템 구조\n```\n고객 모바일 브라우저\n  └── Next.js Frontend (Vercel)\n        ├── /api/menu — 메뉴 조회\n        ├── /api/orders — 주문 생성/조회\n        ├── /api/payments — 카카오페이 연동\n        └── /api/admin/* — 관리자 API\n              └── Supabase (DB + Realtime + Storage)\n```\n\n### DB 스키마 (핵심)\n\n**categories**\n- id, name, sort_order, created_at\n\n**menus**\n- id, category_id (FK), name, description, price, image_url, is_sold_out, sort_order, created_at\n\n**menu_option_groups**\n- id, menu_id (FK), name, is_required, max_select\n\n**menu_options**\n- id, group_id (FK), name, price_delta\n\n**orders**\n- id, nickname, status (pending/accepted/completed/rejected), total_amount, created_at, completed_at\n\n**order_items**\n- id, order_id (FK), menu_id (FK), quantity, unit_price, options_json\n\n**settings**\n- key, value (JSON) — 영업시간, 카페 정보 등\n\n### API 설계 (주요)\n| Method | Path | 설명 |\n|--------|------|------|\n| GET | /api/menu | 카테고리+메뉴 전체 조회 |\n| POST | /api/orders | 주문 생성 |\n| GET | /api/orders/:id | 주문 상태 조회 |\n| PATCH | /api/admin/orders/:id | 주문 상태 변경 |\n| GET | /api/admin/orders | 주문 목록 (관리자) |\n| POST | /api/admin/menus | 메뉴 등록 |\n| PATCH | /api/admin/menus/:id | 메뉴 수정 |\n| GET | /api/admin/sales | 매출 요약 |\n| POST | /api/payments/ready | 카카오페이 결제 준비 |\n| POST | /api/payments/approve | 카카오페이 결제 승인 |',
          source: 'workclaw',
        },
      ],
      8: [
        {
          section_key: 'task-breakdown',
          title: '태스크 분해 — 스프린트 계획',
          content:
            '## 태스크 분해\n\n### Sprint 1 (2주) — 메뉴 + 주문\n\n**T1.1 프로젝트 초기 설정** (0.5d)\n- [ ] Next.js 15 프로젝트 생성\n- [ ] Supabase 프로젝트 생성 + DB 스키마 마이그레이션\n- [ ] Tailwind + 디자인 토큰 설정\n- [ ] Vercel 배포 파이프라인\n\n**T1.2 메뉴 조회 (고객)** (2d)\n- [ ] categories, menus 테이블 seed 데이터\n- [ ] GET /api/menu 엔드포인트\n- [ ] 카테고리 탭 UI\n- [ ] MenuCard 컴포넌트\n- [ ] 메뉴 상세 바텀시트 (옵션 선택)\n\n**T1.3 장바구니** (1.5d)\n- [ ] 장바구니 상태 관리 (zustand)\n- [ ] CartItem 컴포넌트\n- [ ] 수량 변경, 삭제\n- [ ] BottomCTA (합계 + 주문하기)\n\n**T1.4 주문 + 결제** (3d)\n- [ ] POST /api/orders 엔드포인트\n- [ ] 닉네임 입력 UI\n- [ ] 카카오페이 결제 연동 (ready → approve)\n- [ ] 주문 완료 화면 + 대기번호\n- [ ] 결제 실패 처리\n\n**T1.5 주문 상태 조회** (1d)\n- [ ] GET /api/orders/:id\n- [ ] OrderStatusBadge 컴포넌트\n- [ ] Supabase Realtime 구독\n\n### Sprint 2 (1.5주) — 관리자\n\n**T2.1 관리자 인증** (1d)\n- [ ] 간단한 비밀번호 인증 (/admin)\n- [ ] 세션 관리\n\n**T2.2 주문 관리 대시보드** (2d)\n- [ ] GET /api/admin/orders\n- [ ] AdminOrderCard 컴포넌트\n- [ ] 접수/완료/거절 액션\n- [ ] 3분 미응답 경고 표시\n- [ ] Realtime 신규 주문 알림\n\n**T2.3 메뉴 관리** (2d)\n- [ ] 메뉴 CRUD UI\n- [ ] 이미지 업로드 (Supabase Storage)\n- [ ] 품절 토글\n- [ ] 카테고리 정렬\n\n### Sprint 3 (1.5주) — 매출 + 재주문\n\n**T3.1 매출 요약** (1.5d)\n- [ ] GET /api/admin/sales\n- [ ] 일간/주간 차트 (recharts)\n- [ ] 인기 메뉴 TOP 5\n\n**T3.2 재주문** (1d)\n- [ ] 최근 주문 목록 UI\n- [ ] 1탭 재주문 → 장바구니 자동 채움\n\n**T3.3 운영 설정** (1d)\n- [ ] 영업시간 설정 UI\n- [ ] 영업시간 외 주문 차단 로직\n\n### Buffer (1주)\n- [ ] QA + 버그 수정\n- [ ] 모바일 반응형 검수\n- [ ] 성능 최적화 (이미지 lazy load)',
          source: 'workclaw',
        },
      ],
      9: [
        {
          section_key: 'handoff-checklist',
          title: '핸드오프 — 최종 체크리스트',
          content:
            '## 핸드오프 체크리스트\n\n### 산출물 확인\n- [x] PRD 최종 승인\n- [x] 디자인 시스템 (색상, 타이포, 컴포넌트)\n- [x] 기술 설계서 (아키텍처, DB 스키마, API)\n- [x] 태스크 분해 + 스프린트 계획\n\n### 환경 준비\n- [ ] Supabase 프로젝트 생성\n- [ ] Vercel 프로젝트 연동\n- [ ] 카카오페이 개발자 계정 + API 키\n- [ ] 도메인 설정 (minicafe.example.com)\n\n### 코드 레포지토리\n- [ ] GitHub repo 생성\n- [ ] 초기 프로젝트 scaffold\n- [ ] CI/CD 파이프라인 (Vercel 자동 배포)\n- [ ] ESLint + Prettier 설정\n\n### 개발 우선순위 재확인\n1. **Sprint 1**: 메뉴 조회 + 주문/결제 (핵심 플로우)\n2. **Sprint 2**: 관리자 대시보드 (주문 관리 + 메뉴 CRUD)\n3. **Sprint 3**: 매출 + 재주문 + 운영 설정\n4. **Buffer**: QA, 반응형, 성능\n\n### PO 확인 사항\n- [ ] 최소 10개 메뉴 데이터 준비 (사진 포함)\n- [ ] 카테고리 목록 확정 (커피, 논커피, 디저트, 시즌)\n- [ ] 영업시간 확정\n- [ ] 테스트용 카카오페이 계정\n\n### 리스크\n| 리스크 | 대응 |\n|--------|------|\n| 카카오페이 심사 지연 | 테스트 모드로 개발, 심사 병행 |\n| 메뉴 사진 미준비 | placeholder 이미지로 우선 개발 |\n| Supabase 무료 플랜 한도 | 론칭 전 Pro 플랜 전환 검토 |',
          source: 'planclaw',
        },
      ],
    },
    expected_section_counts: {
      0: 2,
      1: 1,
      2: 1,
      3: 1,
      4: 3,
      5: 1,
      6: 2,
      7: 1,
      8: 1,
      9: 1,
    },
  },

  'creator-pulse': {
    id: 'creator-pulse',
    project_name: 'CreatorPulse',
    persona_id: 'creator',
    preset: 'parallel',
    initial_description:
      '1인 크리에이터 수익 대시보드. 유튜브, 인스타그램, 틱톡 등 멀티 플랫폼 수익을 한 곳에서 분석하고, 콘텐츠 캘린더와 협찬 관리까지.',
    mock_sections: {
      0: [
        {
          section_key: 'identity',
          title: '프로젝트 정체성',
          content:
            '## CreatorPulse\n\n**한 줄 설명**: 크리에이터를 위한 멀티 플랫폼 수익 분석 대시보드\n\n**서비스 도메인**: Creator Economy / SaaS\n\n**핵심 가치**: 수익 투명성, 콘텐츠 기획 효율화\n\n**타겟 사용자**: 구독자 1만~10만 중소 크리에이터\n\n**PO**: 준혁 (유튜브 크리에이터)',
          source: 'semiclaw',
        },
        {
          section_key: 'setup-context',
          title: '셋업 컨텍스트',
          content:
            '## 프로젝트 배경\n\n- 스프레드시트로 수익 관리 → 플랫폼마다 형식이 달라 집계에 시간 소모\n- 협찬 문의 메일 관리가 혼란스러움\n- 콘텐츠 업로드 일정 관리 필요\n\n## 기술 환경\n\n- PO 기술 수준: basic (HTML 기초 이해)\n- YouTube/Instagram API 연동 필요\n- 예산: 월 30만원 이하',
          source: 'semiclaw',
        },
      ],
      1: [
        {
          section_key: 'discovery-overview',
          title: '디스커버리 개요',
          content:
            '## 핵심 요구사항\n\n### 수익 대시보드\n- YouTube/Instagram/TikTok 수익 데이터 연동\n- 플랫폼별 수익 추이 그래프 (일/주/월)\n- 총 수익 합산 뷰\n- 수익원별 비중 파이차트\n\n### 콘텐츠 캘린더\n- 업로드 일정 관리 (플랫폼별)\n- 드래그앤드롭 일정 변경\n- 반복 일정 설정 (매주 수/금 업로드)\n\n### 협찬 관리\n- 협찬 문의 목록 (브랜드, 금액, 상태)\n- 진행 상태 트래킹 (문의 → 협의 → 계약 → 완료)\n- 수익 자동 집계\n\n### 비기능 요구사항\n- 웹 대시보드 (데스크톱 우선, 모바일 반응형)\n- OAuth 기반 플랫폼 연동\n- 한국어 전용',
          source: 'planclaw',
        },
      ],
      2: [
        {
          section_key: 'prd',
          title: 'PRD (제품 요구사항 정의서)',
          content:
            '## CreatorPulse PRD\n\n### 1. 제품 비전\n크리에이터가 흩어진 수익 데이터를 한 곳에서 분석하고, 콘텐츠 일정과 협찬을 효율적으로 관리하는 SaaS.\n\n### 2. 사용자 페르소나\n- **준혁**: 구독자 5만 유튜버, 인스타 2만. 월 수익 300~500만원이지만 정확한 집계를 모름.\n- **소연**: 틱톡 10만 크리에이터, 협찬 문의가 DM으로 와서 놓치는 경우 빈번.\n\n### 3. 핵심 기능 (MVP)\n| 우선순위 | 기능 | 설명 |\n|---------|------|------|\n| P0 | 플랫폼 연동 | YouTube, Instagram OAuth 연동 |\n| P0 | 수익 대시보드 | 플랫폼별 수익 추이, 합산 |\n| P1 | 콘텐츠 캘린더 | 업로드 일정 관리 |\n| P1 | 협찬 관리 | 문의 목록, 상태 트래킹 |\n| P2 | TikTok 연동 | TikTok Creator Fund 수익 |\n\n### 4. 제외 사항 (MVP)\n- 자동 콘텐츠 생성/추천\n- 팀 협업 기능\n- 세금 계산/신고',
          source: 'planclaw',
        },
      ],
    },
    expected_section_counts: { 0: 2, 1: 1, 2: 1, 4: 3, 5: 1, 7: 1 },
  },

  quickdrop: {
    id: 'quickdrop',
    project_name: 'QuickDrop',
    persona_id: 'local-biz',
    preset: 'parallel',
    initial_description:
      '동네 배달 서비스 주문/배차 시스템. 전화/카톡 주문을 앱으로 전환하고, 배달기사 자동 배차와 실시간 배달 추적 기능 제공.',
    mock_sections: {
      0: [
        {
          section_key: 'identity',
          title: '프로젝트 정체성',
          content:
            '## QuickDrop\n\n**한 줄 설명**: 소규모 로컬 배달 서비스 주문/배차 플랫폼\n\n**서비스 도메인**: 물류 / O2O\n\n**핵심 가치**: 주문 접수 자동화, 배달 추적 투명성\n\n**타겟 사용자**: 동네 상점 사장 + 배달기사 + 소비자\n\n**PO**: 영수 (배달 사업자)',
          source: 'semiclaw',
        },
        {
          section_key: 'setup-context',
          title: '셋업 컨텍스트',
          content:
            '## 프로젝트 배경\n\n- 3년간 카톡/전화로 주문 접수 → 누락, 배차 혼란 빈번\n- 배달기사 5명, 하루 평균 80건 배달\n- 배민/요기요 수수료 부담 → 자체 시스템 구축 의지\n\n## 기술 환경\n\n- PO 기술 수준: non-technical\n- GPS 추적 필요\n- 예산: 초기 500만원 + 월 30만원',
          source: 'semiclaw',
        },
      ],
      1: [
        {
          section_key: 'discovery-overview',
          title: '디스커버리 개요',
          content:
            '## 핵심 요구사항\n\n### 소비자 앱\n- 주변 가맹점 목록 + 메뉴 조회\n- 장바구니 + 주문 + 결제\n- 실시간 배달 추적 (지도)\n- 주문 이력 + 재주문\n\n### 가맹점 (상점 사장)\n- 주문 접수/거절\n- 메뉴 관리 (등록, 수정, 품절)\n- 일별 매출 확인\n\n### 배달기사 앱\n- 배차 수락/거절\n- 네비게이션 연동\n- 배달 완료 처리\n\n### 관리자 (영수)\n- 배차 알고리즘 설정\n- 기사/가맹점 관리\n- 전체 매출/배달 통계\n\n### 비기능 요구사항\n- 모바일 앱 (React Native)\n- GPS 실시간 추적\n- 동시 배달 80건 처리',
          source: 'planclaw',
        },
      ],
      2: [
        {
          section_key: 'prd',
          title: 'PRD (제품 요구사항 정의서)',
          content:
            '## QuickDrop PRD\n\n### 1. 제품 비전\n동네 상점과 소비자를 연결하는 자체 배달 플랫폼. 배민/요기요 수수료 없이 직접 배달 운영.\n\n### 2. 사용자 페르소나\n- **소비자 지은**: 동네 주민, 배달앱 수수료로 비싸진 음식값에 불만.\n- **상점 사장 철수**: 치킨집 운영, 배달앱 수수료 20%가 부담.\n- **배달기사 동환**: 오토바이 배달, 건당 수익으로 생계.\n\n### 3. 핵심 기능 (MVP)\n| 우선순위 | 기능 | 설명 |\n|---------|------|------|\n| P0 | 주문 + 결제 | 소비자 → 가맹점 주문 |\n| P0 | 자동 배차 | 가까운 기사에게 자동 배정 |\n| P0 | 실시간 추적 | GPS 기반 배달 현황 |\n| P1 | 가맹점 관리 | 메뉴/주문/매출 |\n| P1 | 기사 앱 | 배차 수락, 네비, 완료 처리 |\n| P2 | 리뷰 | 배달 완료 후 평점 |\n\n### 4. 제외 사항 (MVP)\n- 쿠폰/프로모션\n- 예약 배달\n- 다지역 확장 (1개 동네 집중)',
          source: 'planclaw',
        },
      ],
    },
    expected_section_counts: { 0: 2, 1: 1, 2: 1, 4: 2, 5: 1, 7: 1 },
  },

  'office-hub': {
    id: 'office-hub',
    project_name: 'OfficeHub',
    persona_id: 'office-manager',
    preset: 'parallel',
    initial_description:
      '스타트업 사내 운영 통합 시스템. 채용 파이프라인, 신규 입사자 온보딩 체크리스트, 장비 관리, 비품 발주를 하나의 대시보드에서.',
    mock_sections: {
      0: [
        {
          section_key: 'identity',
          title: '프로젝트 정체성',
          content:
            '## OfficeHub\n\n**한 줄 설명**: 스타트업 사내 운영 통합 대시보드\n\n**서비스 도메인**: HR / 사내 시스템\n\n**핵심 가치**: 운영 도구 통합, 온보딩 자동화\n\n**타겟 사용자**: 운영팀, 팀 리드, 신규 입사자\n\n**PO**: 하은 (스타트업 운영팀장)',
          source: 'semiclaw',
        },
        {
          section_key: 'setup-context',
          title: '셋업 컨텍스트',
          content:
            '## 프로젝트 배경\n\n- 30인 스타트업, 노션+슬랙+구글시트로 운영 → 정보 분산\n- 월 2~3명 채용 시 온보딩 체크리스트 누락 빈번\n- 장비/비품 현황 파악 불가\n\n## 기술 환경\n\n- PO 기술 수준: basic\n- 슬랙 연동 필수\n- 예산: 월 20만원 이하',
          source: 'semiclaw',
        },
      ],
      1: [
        {
          section_key: 'discovery-overview',
          title: '디스커버리 개요',
          content:
            '## 핵심 요구사항\n\n### 채용 파이프라인\n- 채용 공고 관리 (포지션, 상태, 지원자 수)\n- 지원자 단계 트래킹 (서류 → 면접 → 최종)\n- 면접 일정 캘린더 연동\n\n### 온보딩 체크리스트\n- 입사자별 자동 체크리스트 생성 (부서별 템플릿)\n- 담당자 배정 + 진행률 대시보드\n- 슬랙 알림 (체크리스트 미완료 리마인더)\n\n### 장비/비품 관리\n- 장비 대장 (노트북, 모니터, 의자 등)\n- 입사/퇴사 시 자동 배정/회수 워크플로우\n- 비품 발주 요청 + 승인\n\n### 비기능 요구사항\n- 웹 대시보드 (데스크톱 전용)\n- 슬랙 연동 필수\n- SSO (Google Workspace)',
          source: 'planclaw',
        },
      ],
      2: [
        {
          section_key: 'prd',
          title: 'PRD (제품 요구사항 정의서)',
          content:
            '## OfficeHub PRD\n\n### 1. 제품 비전\n스타트업 운영팀이 채용, 온보딩, 장비, 비품을 하나의 대시보드에서 관리하는 사내 운영 시스템.\n\n### 2. 사용자 페르소나\n- **하은 (운영팀장)**: 채용부터 장비 관리까지 혼자 담당. 노션 템플릿 복사가 일상.\n- **민수 (팀 리드)**: 신규 입사자 온보딩 멘토. 체크리스트 누락으로 첫 주 혼란 경험.\n- **새 입사자**: 첫 날 뭘 해야 하는지 한눈에 보고 싶음.\n\n### 3. 핵심 기능 (MVP)\n| 우선순위 | 기능 | 설명 |\n|---------|------|------|\n| P0 | 온보딩 체크리스트 | 부서별 템플릿, 자동 생성, 진행률 |\n| P0 | 장비 대장 | 장비 CRUD, 배정/회수 |\n| P1 | 채용 파이프라인 | 포지션별 지원자 칸반 보드 |\n| P1 | 슬랙 연동 | 리마인더, 알림 |\n| P2 | 비품 발주 | 요청 → 승인 워크플로우 |\n\n### 4. 제외 사항 (MVP)\n- 급여/정산\n- 근태 관리\n- 성과 평가',
          source: 'planclaw',
        },
      ],
    },
    expected_section_counts: { 0: 2, 1: 1, 2: 1, 4: 2, 5: 1, 7: 1 },
  },

  petcare: {
    id: 'petcare',
    project_name: 'PetCare',
    persona_id: 'vet-clinic',
    preset: 'parallel',
    initial_description:
      '동물병원 예약/진료기록 관리 시스템. 보호자가 온라인으로 예약하고, 진료기록을 디지털로 관리하며, 접종/투약 알림을 자동 발송.',
    mock_sections: {
      0: [
        {
          section_key: 'identity',
          title: '프로젝트 정체성',
          content:
            '## PetCare\n\n**한 줄 설명**: 동물병원 예약/진료기록 디지털 관리 시스템\n\n**서비스 도메인**: 헬스케어 / 수의학\n\n**핵심 가치**: 종이 차트 탈피, 보호자 소통 자동화\n\n**타겟 사용자**: 동물병원 수의사/스태프 + 반려동물 보호자\n\n**PO**: 지훈 (동물병원 원장)',
          source: 'semiclaw',
        },
        {
          section_key: 'setup-context',
          title: '셋업 컨텍스트',
          content:
            '## 프로젝트 배경\n\n- 종이 차트 기반 진료기록 → 검색/통계 불가\n- 전화 예약만 가능 → 부재 시 예약 누락\n- 접종 리마인더를 수기로 카톡 발송 중\n\n## 기술 환경\n\n- PO 기술 수준: intermediate\n- 개인정보보호법 준수 필수 (동물 진료기록)\n- 예산: 초기 300만원 + 월 20만원',
          source: 'semiclaw',
        },
      ],
      1: [
        {
          section_key: 'discovery-overview',
          title: '디스커버리 개요',
          content:
            '## 핵심 요구사항\n\n### 보호자 앱\n- 온라인 예약 (날짜/시간 선택, 진료 유형)\n- 내 반려동물 프로필 (종, 나이, 체중, 알러지)\n- 진료 기록 열람 (진단, 처방, 사진)\n- 접종/투약 알림 수신\n\n### 병원 관리 시스템\n- 일별 예약 현황 대시보드\n- 전자 차트 (진료기록 CRUD)\n- 환자(동물) 검색 + 이력 조회\n- 접종/투약 스케줄 자동 알림 발송\n\n### 비기능 요구사항\n- 보호자: 모바일 웹앱\n- 병원: 웹 대시보드 (태블릿/PC)\n- 개인정보보호법 준수\n- 동시 접속 30명 이하',
          source: 'planclaw',
        },
      ],
      2: [
        {
          section_key: 'prd',
          title: 'PRD (제품 요구사항 정의서)',
          content:
            '## PetCare PRD\n\n### 1. 제품 비전\n동물병원의 종이 차트를 디지털로 전환하고, 보호자와의 소통을 자동화하는 진료 관리 시스템.\n\n### 2. 사용자 페르소나\n- **지훈 원장**: 하루 30마리 진료, 종이 차트 검색에 매번 5분 소요.\n- **보호자 미영**: 고양이 2마리, 접종 시기를 자주 놓침. 예약 전화가 번거로움.\n\n### 3. 핵심 기능 (MVP)\n| 우선순위 | 기능 | 설명 |\n|---------|------|------|\n| P0 | 전자 차트 | 진료기록 CRUD, 검색, 사진 첨부 |\n| P0 | 온라인 예약 | 날짜/시간 선택, 자동 확인 |\n| P1 | 접종 알림 | 카카오 알림톡 자동 발송 |\n| P1 | 보호자 포털 | 진료 이력 열람, 반려동물 프로필 |\n| P2 | 통계 | 월별 진료 건수, 매출 요약 |\n\n### 4. 제외 사항 (MVP)\n- 원격 진료 (화상)\n- 약국 연동\n- 보험 청구',
          source: 'planclaw',
        },
      ],
    },
    expected_section_counts: { 0: 2, 1: 1, 2: 1, 3: 1, 4: 2, 5: 1, 7: 1 },
  },
};

/** Phase별 placeholder 섹션 생성 (mock이 아직 없는 Phase용) */
export function generatePlaceholderSection(
  phase: number,
  scenarioId: string,
): { section_key: string; title: string; content: string; source: string } {
  const PHASE_TITLES: Record<number, string> = {
    0: '온보딩',
    1: '디스커버리',
    2: 'PRD',
    3: '명확화 Q&A',
    4: '디자인 시스템',
    5: '에픽',
    6: '기능 스펙',
    7: '기술 설계',
    8: '태스크 분해',
    9: '핸드오프',
  };
  const PHASE_SOURCES: Record<number, string> = {
    0: 'semiclaw',
    1: 'planclaw',
    2: 'planclaw',
    3: 'planclaw',
    4: 'designclaw',
    5: 'planclaw',
    6: 'planclaw',
    7: 'workclaw',
    8: 'workclaw',
    9: 'planclaw',
  };

  return {
    section_key: `sandbox-${phase}-overview`,
    title: `[SANDBOX] Phase ${phase} — ${PHASE_TITLES[phase] ?? `Phase ${phase}`}`,
    content: `## ${PHASE_TITLES[phase] ?? `Phase ${phase}`}\n\n> 이 섹션은 Sandbox Mock으로 자동 생성되었습니다.\n> 시나리오: ${scenarioId}\n\nPhase ${phase}의 산출물이 여기에 표시됩니다.`,
    source: PHASE_SOURCES[phase] ?? 'semiclaw',
  };
}

export function getScenario(scenarioId: string): SandboxScenario | null {
  return SANDBOX_SCENARIOS[scenarioId] ?? null;
}

export function listScenarios(): SandboxScenario[] {
  return Object.values(SANDBOX_SCENARIOS);
}

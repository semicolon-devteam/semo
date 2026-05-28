# Customer 봇 페르소나 정합성 — 디자인 ↔ 카탈로그 통일

> 작성: 2026-05-28 (reus "전체 적용" 요청)
> 통합 대상: [Customer 봇 페르소나 카탈로그(초안)](./2026-05-27-customer-bot-personas.md) ↔ Claude Design 핸드오프가 확정한 7봇.
> 결과: **디자인의 7봇을 v1 정본(canonical)으로 채택.** 대시보드가 이미 이 7봇으로 렌더되고 시각 정체성(아바타 색·액세서리)이 완비됐기 때문.

---

## 1. 정본 v1 라인업 (디자인 = SoT)

| slug(=agent_listings.agent_slug) | 이름     | 역할         | dept   | 아바타 색 | 액세서리  | 플랜    |
| -------------------------------- | -------- | ------------ | ------ | --------- | --------- | ------- |
| `jumuni`                         | 주문이   | 주문 응대    | 응대   | peach     | headset   | Starter |
| `hwegyedo-ri`                    | 회계도리 | 회계·세무    | 회계   | mint      | calc      | Pro     |
| `algorim-i`                      | 알리미   | 마케팅·SNS   | 마케팅 | lavender  | megaphone | Pro     |
| `chae-wo`                        | 채워     | 재고·발주    | 재고   | coral     | box       | Starter |
| `sem-i`                          | 셈이     | 매출 분석    | 분석   | sky       | chart     | Starter |
| `dangol-i`                       | 단골이   | CS·단골 관리 | CS     | butter    | heart     | Starter |
| `bi-seo`                         | 비서     | 스케줄       | 스케줄 | rose      | clock     | Pro     |

- slug·이름·역할·색·액세서리·연동·플랜은 `app/(customer)/_ui/agents.jsx` 의 `AGENTS` 배열이 현재 SoT (mock). 실데이터 전환 시 `agent_listings` 시드의 기준값이 된다.
- `/my/library/{slug}` 라우트가 이 slug 를 그대로 사용.

## 2. 초안 카탈로그(12개)와의 매핑

| 초안(2026-05-27)   | → 정본 처리                      |
| ------------------ | -------------------------------- |
| 주문이(응대)       | = `jumuni` (동일)                |
| 새미(회계)         | → `hwegyedo-ri` 회계도리 로 통일 |
| 재고지기(재고)     | → `chae-wo` 채워 로 통일         |
| 마케타(SNS)        | → `algorim-i` 알리미 로 통일     |
| 스케줄러(일정)     | → `bi-seo` 비서 로 통일          |
| 정산이(매출리포트) | → `sem-i` 셈이 로 통일           |
| 친절이(VOC/리뷰)   | → `dangol-i` 단골이 에 흡수 (CS) |
| 메뉴쟁이(상품등록) | Phase 2 백로그                   |
| 알림이(CRM)        | Phase 2 (단골이와 통합 검토)     |
| 모집책(채용)       | Phase 2                          |
| 안내봇(FAQ)        | Phase 2                          |
| 응대왕(다국어)     | Phase 2                          |

## 3. 결정

- **v1 출시 = 디자인 7봇.** 초안의 작명/분류는 디자인 명칭으로 흡수·통일.
- **Phase 2 백로그** = 메뉴쟁이·모집책·안내봇·다국어 응대(4종). 수요 검증 후 `agent_listings` 에 community/preset 으로 추가.
- 내부 7봇(semiclaw 등)은 `metadata.audience='internal'` 로 Customer 라이브러리 제외 — 트랙 B `008` 결정 유지.
- 카탈로그 초안 문서(2026-05-27)는 본 통일안으로 **superseded**. Phase 2 아이디어 소스로만 참조.

## 4. 후속

- [ ] PlanClaw: 7봇 1인칭 자기소개·리뷰 mock 을 디자인 명칭 기준으로 확정 (현재 `agents.jsx` bio 가 임시값).
- [ ] DesignClaw: 7봇 캐릭터 아트를 SVG 캐릭터(현 프로토타입) → 정식 일러스트로.
- [ ] 실데이터 전환 시 `agents.jsx` AGENTS → `agent_listings` 시드 스크립트.

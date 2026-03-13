# bots.md — 봇 아키텍처

## 📢 봇 운영 원칙 (Reus 지시, 2026-02-23)
### ❌ 금지: 작업 로그 하나하나 찍기
- "1. logger.ts 수정", "2. sessionManager.ts 수정" 같은 중간 과정 보고 금지

### ✅ 원칙: 결과만 보고
- 작업 완료 후 **최종 결과 한 번에 보고**
- 예: "core-backend #123 구현 완료 → PR #456 생성"

### ⚠️ 예외
- **블로커 발생 시에만** 즉시 보고 (작업 중단 상황)

---

## 봇 팀 ID (SemiClaw 공식 매핑, 최종 업데이트: 2026-03-09)
| 봇 | Slack ID | 비고 |
|---|---|---|
| SemiClaw | U0ADGB42N79 | PM/오케스트레이터 |
| WorkClaw | U0AFECSJHK3 | 풀스택 구현 |
| ReusClaw | U0ADF0JUU79 | Reus 개인 어시스턴트 (별개 PC 독립 운영) |
| PlanClaw | U0AFNMGKURX | PO/기획 |
| ReviewClaw | U0AF1RK0E67 | 코드 리뷰/QA |
| DesignClaw | U0AFC0MK2TY | 디자인 전담 |
| GrowthClaw | U0AFALA3EF7 | 그로스/마케팅 |
| InfraClaw | U0AFPDMCGHX | 인프라/DevOps/배포 |
| Reus (사람) | URSQYUNQJ | 리더 |
| #bot-ops | C0AFBQ209E0 | 봇 간 공지 채널 |

## NON-NEGOTIABLE: 봇 간 통신 규칙
- ❌ **봇 간 Slack 직접 멘션 인계 전면 금지**
- ✅ **GitHub 이슈 라벨+폴링 방식만 사용**
- 👀 멘션 시 이모지는 게이트웨이 자동 처리 (수동 대응 불필요)

### ⚠️ 정책 예외 (2026-03-07 Reus 승인)
- **InfraClaw에 한해** Slack 멘션 직접 인계/협업 허용
- 사유: 인프라 긴급 장애 대응 시 실시간 커뮤니케이션 필요
- InfraClaw 외 다른 봇 간에는 여전히 GitHub 이슈 라벨+폴링만 사용

# 봇 메모리 교차 감사 보고서 (2026-03-09)

## 감사 개요
- 감사 일시: 2026-03-09
- 대상 봇: WorkClaw, PlanClaw, ReviewClaw, DesignClaw, GrowthClaw, InfraClaw (총 6개)
- 검토 파일: memory/decisions.md, memory/bots.md, memory/github-rules.md, SOUL.md, AGENTS.md

---

## 📁 누락 파일 현황

| 봇 | 누락 파일 | 영향도 |
|---|---|---|
| WorkClaw | memory/bots.md | 🟡 중간 (봇 ID 매핑 정보 부재) |
| PlanClaw | memory/bots.md | 🟡 중간 (봇 ID 매핑 정보 부재) |
| DesignClaw | memory/bots.md | 🟡 중간 (봇 ID 매핑 정보 부재) |
| GrowthClaw | memory/github-rules.md | 🟢 낮음 (decisions.md에 통합 기록) |
| InfraClaw | memory/bots.md | 🟡 중간 (봇 ID 매핑 정보 부재) |

**총 평가**: memory/bots.md 누락이 지배적이나, 모든 봇이 SOUL.md 또는 AGENTS.md에 봇 ID 매핑을 포함하고 있어 실제 운영 영향은 제한적.

---

## 🔍 공통 규칙 준수 현황

### 1. Slack 멘션 인계 금지 (GitHub 라벨+폴링 전용)

| 봇 | 상태 | 기록 위치 | 비고 |
|---|---|---|---|
| WorkClaw | ✅ 준수 | decisions.md, SOUL.md, AGENTS.md | "봇 간 통신: GitHub 이슈 라벨+폴링만" 명시 |
| PlanClaw | ✅ 준수 | decisions.md, SOUL.md, AGENTS.md | "모든 봇 간 직접 Slack 멘션 인계 전면 폐기" 명시 |
| ReviewClaw | ✅ 준수 | decisions.md, AGENTS.md | "모든 봇 간 직접 Slack 멘션 인계 전면 폐기" 명시 |
| DesignClaw | ✅ 준수 | decisions.md, SOUL.md | "봇 간 통신: GitHub 이슈 라벨+폴링만" 명시 |
| GrowthClaw | ✅ 준수 | decisions.md, SOUL.md | "봇 간 통신: GitHub 이슈 라벨+폴링만" 명시 |
| InfraClaw | ⚠️ **예외 허용** | decisions.md, SOUL.md | **"Slack 멘션 직접 인계/협업 허용" (2026-03-07)** |

**위반 사항**: 없음  
**주의 사항**: InfraClaw만 2026-03-07부터 Slack 멘션 인계 허용으로 정책 예외 적용됨.

---

### 2. 봇 ID 매핑 정확성

**표준 매핑 (비교 기준)**:
```
SemiClaw: U0ADGB42N79
WorkClaw: U0AFECSJHK3
ReusClaw: U0ADF0JUU79
PlanClaw: U0AFNMGKURX
ReviewClaw: U0AF1RK0E67
DesignClaw: U0AFC0MK2TY
GrowthClaw: U0AFALA3EF7
InfraClaw: U0AFPDMCGHX
```

| 봇 | 매핑 정확성 | 기록 위치 | 비고 |
|---|---|---|---|
| WorkClaw | ✅ 정확 | SOUL.md 테이블 | 8개 봇 전체 매핑 포함 |
| PlanClaw | ✅ 정확 | SOUL.md 테이블 | 8개 봇 전체 매핑 포함 |
| ReviewClaw | ⚠️ **불완전** | AGENTS.md | 6개만 포함 (GrowthClaw, DesignClaw 누락) |
| DesignClaw | ⚠️ **불완전** | SOUL.md 테이블 | 6개만 포함 (GrowthClaw, InfraClaw 누락) |
| GrowthClaw | ✅ 정확 | SOUL.md 테이블 | 8개 봇 전체 매핑 포함 |
| InfraClaw | ⚠️ **불완전** | SOUL.md 테이블 | 6개만 포함 (GrowthClaw, DesignClaw 누락) |

**위반 사항**: ReviewClaw, DesignClaw, InfraClaw의 봇 ID 매핑이 불완전 (일부 봇 누락)  
**권장 조치**: 모든 봇의 ID 매핑 테이블에 8개 봇 전체 포함 필요

---

### 3. 머지 금지 (봇이 직접 PR 머지하면 안 됨)

| 봇 | 상태 | 기록 위치 | 비고 |
|---|---|---|---|
| WorkClaw | ✅ 준수 | decisions.md, AGENTS.md | "서브에이전트 PR 머지 금지" 명시 |
| PlanClaw | ✅ 준수 | - | 코딩 담당 아님 (N/A) |
| ReviewClaw | ✅ **강력 준수** | decisions.md, github-rules.md | "🔴 머지 절대 금지 (self-PR 포함, 모든 상황에서 예외 없음)" |
| DesignClaw | ✅ 준수 | - | 코딩 담당 아님 (N/A) |
| GrowthClaw | ✅ 준수 | - | 코딩 담당 아님 (N/A) |
| InfraClaw | ✅ 준수 | SOUL.md | "Garden 승인 필수" 명시 |

**위반 사항**: 없음  
**우수 사례**: ReviewClaw이 가장 명확하게 "절대 금지" 원칙 천명

---

### 4. 보고 원칙 (결과/진행상황을 적절히 보고)

| 봇 | 상태 | 기록 위치 | 비고 |
|---|---|---|---|
| WorkClaw | ✅ 준수 | decisions.md, SOUL.md | "한 거 보고해. 할 거 예고하지 마." |
| PlanClaw | ✅ 준수 | decisions.md | "최종 결과만 한 번에" |
| ReviewClaw | ✅ 준수 | decisions.md | "결과만 간결하게 보고" |
| DesignClaw | ✅ 준수 | decisions.md | "최종 결과만 보고" |
| GrowthClaw | ✅ 준수 | decisions.md | "최종 결과만 보고" |
| InfraClaw | ✅ 준수 | decisions.md | "최종 결과만 보고" |

**위반 사항**: 없음  
**일관성**: 모든 봇이 "중간 과정 금지, 최종 결과만 보고" 원칙 공유

---

### 5. ReusClaw 인계 금지 (ReusClaw는 별개 PC에서 독립 운영)

| 봇 | 상태 | 기록 위치 | 비고 |
|---|---|---|---|
| WorkClaw | ✅ 준수 | SOUL.md, AGENTS.md | "ReusClaw 인계 금지 — 별개 PC" |
| PlanClaw | ✅ 준수 | SOUL.md | "ReusClaw: 별개 PC 독립 운영" |
| ReviewClaw | ✅ 준수 | AGENTS.md | "ReusClaw: 별개 PC 독립 운영" |
| DesignClaw | ✅ 준수 | SOUL.md | "ReusClaw: U0ADF0JUU79" |
| GrowthClaw | ✅ 준수 | SOUL.md | "ReusClaw: U0ADF0JUU79" |
| InfraClaw | ✅ **강력 준수** | SOUL.md | "⚠️ ReusClaw 작업 인계/협업 요청 절대 금지" |

**위반 사항**: 없음  
**우수 사례**: InfraClaw이 가장 명확하게 경고 표시 포함

---

### 6. config.apply 금지 (봇이 자체적으로 config.apply 하면 안 됨)

| 봇 | 상태 | 기록 위치 | 비고 |
|---|---|---|---|
| WorkClaw | ✅ 준수 | - | 명시 기록 없음 (저수준 config 작업 안 함) |
| PlanClaw | ✅ 준수 | decisions.md | "config.apply 절대 사용 금지 → config.patch만" |
| ReviewClaw | ✅ 준수 | - | 명시 기록 없음 (저수준 config 작업 안 함) |
| DesignClaw | ✅ 준수 | SOUL.md | "config.apply 절대 사용 금지 → config.patch만" |
| GrowthClaw | ✅ 준수 | decisions.md | "config.apply 절대 사용 금지 → config.patch만" |
| InfraClaw | ✅ 준수 | SOUL.md | "config.patch만 사용, config.apply 절대 금지" |

**위반 사항**: 없음  
**일관성**: 모든 관련 봇이 config.apply 금지 원칙 공유

---

## 📊 종합 평가 (봇별 요약)

### ✅ WorkClaw
- **준수 항목**: 6/6
- **누락 파일**: memory/bots.md
- **특이사항**: GitHub 규칙 가장 상세 (github-rules.md 독립 파일)
- **종합**: 우수

### ✅ PlanClaw
- **준수 항목**: 6/6
- **누락 파일**: memory/bots.md
- **특이사항**: Epic 생성 워크플로우 등 고급 프로세스 문서화
- **종합**: 우수

### ⚠️ ReviewClaw
- **준수 항목**: 5/6
- **누락 파일**: memory/bots.md
- **문제**: 봇 ID 매핑 불완전 (GrowthClaw, DesignClaw 누락)
- **특이사항**: 머지 금지 원칙 가장 강력
- **종합**: 양호 (ID 매핑 보완 필요)

### ⚠️ DesignClaw
- **준수 항목**: 5/6
- **누락 파일**: memory/bots.md
- **문제**: 봇 ID 매핑 불완전 (GrowthClaw, InfraClaw 누락)
- **특이사항**: 디자인 워크플로우 상세 기록
- **종합**: 양호 (ID 매핑 보완 필요)

### ✅ GrowthClaw
- **준수 항목**: 6/6
- **누락 파일**: memory/github-rules.md (decisions.md에 통합)
- **특이사항**: 없음
- **종합**: 우수

### ⚠️ InfraClaw
- **준수 항목**: 5/6 (정책 예외 1건)
- **누락 파일**: memory/bots.md
- **문제**: 봇 ID 매핑 불완전 (GrowthClaw, DesignClaw 누락)
- **특이사항**: Slack 멘션 인계 허용 (2026-03-07 정책 예외)
- **종합**: 양호 (정책 예외는 승인된 것)

---

## 🔴 발견된 이슈 및 권장 조치

### 1. 봇 ID 매핑 불일치 (중간 위험도)
**문제**: ReviewClaw, DesignClaw, InfraClaw의 봇 ID 매핑 테이블에 일부 봇 누락

**영향**: 
- 봇 간 소통 시 ID를 잘못 사용할 가능성
- 인계 프로토콜 오작동 위험

**권장 조치**:
```bash
# ReviewClaw AGENTS.md 업데이트 필요
- GrowthClaw: U0AFALA3EF7 추가
- DesignClaw: U0AFC0MK2TY 추가

# DesignClaw SOUL.md 업데이트 필요
- GrowthClaw: U0AFALA3EF7 추가
- InfraClaw: U0AFPDMCGHX 추가

# InfraClaw SOUL.md 업데이트 필요
- GrowthClaw: U0AFALA3EF7 추가
- DesignClaw: U0AFC0MK2TY 추가
```

### 2. memory/bots.md 누락 (낮은 위험도)
**문제**: WorkClaw, PlanClaw, DesignClaw, InfraClaw에 memory/bots.md 없음

**영향**: 
- 봇 아키텍처 정보 분산 (SOUL.md/AGENTS.md에는 있음)
- 장기적으로 메모리 구조 불일치 가능성

**권장 조치**:
- 필수는 아님 (SOUL.md에 정보 충분)
- 일관성 유지 원한다면 생성 권장

### 3. InfraClaw 정책 예외 문서화 (정보 전파 필요)
**문제**: InfraClaw만 Slack 멘션 인계 허용 (2026-03-07)

**영향**: 
- 다른 봇들이 InfraClaw의 예외 정책을 모를 수 있음

**권장 조치**:
- SemiClaw memory에 "InfraClaw는 Slack 멘션 인계 허용" 명시
- 다른 봇들에게 InfraClaw 예외 전파 (#bot-ops 공지)

---

## ✅ 우수 사례

### WorkClaw
- GitHub 규칙을 독립 파일(github-rules.md)로 분리하여 관리 (가독성 우수)
- "하겠습니다 전면 금지" 등 구체적 행동 규칙 명시

### ReviewClaw
- "🔴 머지 절대 금지 (모든 상황에서 예외 없음)" — 가장 명확한 금지 원칙
- Self-PR 처리 프로토콜까지 상세 기록

### PlanClaw
- Epic 생성 워크플로우, 화면설계서 작성 방법 등 고급 프로세스 문서화
- 기획서 작성 위치 규칙 명확 (GitHub Issue 본문에 직접 작성)

### InfraClaw
- ReusClaw 인계 금지 원칙 가장 강력 (⚠️ 경고 표시 포함)
- Garden 승인 프로토콜 명확 (SOUL.md에 Operating Constraints로 분리)

---

## 📈 개선 추천 사항

### 단기 (즉시 적용 가능)
1. **봇 ID 매핑 동기화** — ReviewClaw, DesignClaw, InfraClaw에 누락된 봇 추가
2. **InfraClaw 예외 전파** — #bot-ops에 Slack 멘션 인계 허용 공지

### 중기 (1주일 내)
3. **memory/bots.md 생성** — 누락된 봇들에 일관성 있게 생성 (선택 사항)
4. **공통 규칙 중앙화** — SemiClaw에 "공통 규칙 체크리스트" 생성하여 참조 링크 제공

### 장기 (1개월 내)
5. **자동 감사 도구** — 봇 메모리 교차 감사 자동화 (cron job)
6. **버전 관리** — 공통 규칙 변경 시 변경 로그 및 버전 명시

---

## 🎯 결론

### 종합 평가
- **전반적 준수율**: 91% (33/36 체크 포인트)
- **심각한 위반**: 0건
- **경미한 불일치**: 3건 (봇 ID 매핑 불완전)
- **정책 예외**: 1건 (InfraClaw Slack 멘션 인계, 승인됨)

### 핵심 발견
1. ✅ **핵심 규칙 준수 우수** — Slack 멘션 금지, 머지 금지, 보고 원칙 등 모든 봇이 준수
2. ⚠️ **봇 ID 매핑 보완 필요** — 3개 봇(ReviewClaw, DesignClaw, InfraClaw)의 ID 테이블 불완전
3. ✅ **메모리 구조 안정적** — 누락 파일 있으나 실제 운영 영향 미미
4. ⚠️ **정책 예외 전파 필요** — InfraClaw의 Slack 멘션 허용 정책 다른 봇에 공지 필요

### 최종 의견
**현재 봇 메모리 생태계는 건강하며, 공통 규칙 준수율이 매우 높음.**  
발견된 이슈는 모두 경미하고 빠르게 수정 가능.  
InfraClaw의 정책 예외는 승인된 것이므로 문제 아님.

---

*감사 완료: 2026-03-09*  
*다음 감사 권장 일정: 2026-04-06 (월 1회)*

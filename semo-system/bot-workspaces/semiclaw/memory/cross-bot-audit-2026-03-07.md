# 봇 간 교차 감사 결과 (2026-03-07)

> **감사 범위**: 전 봇(SemiClaw, WorkClaw, PlanClaw, ReviewClaw, DesignClaw, GrowthClaw, InfraClaw)  
> **감사 대상 파일**: memory/decisions.md, memory/bots.md, memory/github-rules.md, SOUL.md, AGENTS.md  
> **감사 일시**: 2026-03-07 21:46 KST  
> **감사자**: Cross-bot Audit Subagent

---

## 🔴 충돌 (봇 간 불일치)

### 1. Slack 멘션 인계 규칙 — 업데이트 시점 불일치

| 봇 | 최신 규칙 반영 여부 | 파일 내용 | 파일 경로 |
|---|---|---|---|
| SemiClaw | ✅ 반영됨 (3/7) | "✅ Slack 멘션 인계 허용 (3/7 규칙 변경)" | decisions.md |
| WorkClaw | ✅ 반영됨 (3/7) | "✅ Slack 멘션 인계 허용 (3/7 변경)" | decisions.md, SOUL.md, AGENTS.md |
| PlanClaw | ✅ 반영됨 (3/7) | "✅ 봇 간 Slack 멘션 허용 (3/7 변경)" | decisions.md, SOUL.md |
| ReviewClaw | ✅ 반영됨 (3/7) | "✅ 봇 간 Slack 멘션 허용 (3/7 Reus 지시)" | decisions.md, bots.md, AGENTS.md |
| DesignClaw | ⚠️ 구버전 (2/20) | "~~봇 간 Slack 멘션 인계 전면 폐기~~ → 순수 라벨+폴링", 3/7 변경 섹션 있음 | decisions.md (취소선 처리되어 있으나 혼란 가능) |
| GrowthClaw | ✅ 반영됨 (3/7) | "✅ 봇 간 Slack 멘션 허용 (3/7 Reus 지시)" | decisions.md, bots.md, SOUL.md |
| InfraClaw | ⚠️ 구버전 (2/23) | "모든 봇 간 직접 Slack 멘션 인계 전면 폐기" (취소선 없음) | decisions.md, SOUL.md 일부 반영 |

**분석**:
- DesignClaw과 InfraClaw이 3/7 변경사항을 명확하게 반영하지 못함
- DesignClaw: 구규칙에 취소선 처리는 있으나 최신 규칙이 여러 위치에 산재
- InfraClaw: decisions.md에는 구규칙(2/23) 그대로 유지, SOUL.md에만 3/7 변경 반영

**최신 정답**: 
```markdown
✅ 봇 간 Slack 멘션 인계/협업 허용 (2026-03-07 변경)
✅ GitHub 이슈 라벨+폴링 방식도 병행 가능
```

**권장 조치**:
1. DesignClaw: decisions.md에서 구규칙 취소선 처리 + 최신 규칙만 남기기
2. InfraClaw: decisions.md 구규칙 취소선 처리 + 최신 규칙 추가

---

### 2. 봇 ID 매핑 — ReusClaw 설명 일관성

| 봇 | ReusClaw 설명 | 파일 |
|---|---|---|
| SemiClaw | "별개 PC에서 독립 운영" | SOUL.md, bots.md |
| WorkClaw | "⚠️ 별개 PC에서 독립 운영" | SOUL.md |
| PlanClaw | "별개 PC 독립 운영, 코딩 에이전트 아님" | SOUL.md |
| ReviewClaw | "⚠️ Reus 전용 개인 비서 (작업 인계 금지!)" | AGENTS.md |
| DesignClaw | "⚠️ Reus 전용 개인 비서 (작업 인계 금지)" | SOUL.md |
| GrowthClaw | "Reus 전용 개인 비서 (작업 인계 금지)" | SOUL.md |
| InfraClaw | "⚠️ Reus 전용 개인 비서 — 작업 인계/협업 요청 절대 금지" | SOUL.md |

**분석**:
- ReusClaw에 대한 설명이 봇마다 약간씩 다름
- 핵심(작업 인계 금지)은 모두 포함되어 있으나 표현 방식이 불일치

**최신 정답**:
```markdown
ReusClaw (U0ADF0JUU79): Reus 전용 개인 비서 (별개 PC 독립 운영, 코딩 에이전트 아님)
⚠️ 절대 금지: ReusClaw에게 작업 인계/협업 요청
```

**권장 조치**: 
- 모든 봇의 ReusClaw 설명을 위 형식으로 통일

---

### 3. 라벨 전환 규칙 — 이전 라벨 제거 명시

| 봇 | 이전 라벨 제거 규칙 명시 여부 | 파일 |
|---|---|---|
| SemiClaw | ✅ 명시됨 (3/6) | decisions.md, github-rules.md |
| WorkClaw | ❌ 미반영 | - |
| PlanClaw | ✅ 명시됨 (3/6) | decisions.md |
| ReviewClaw | ✅ 명시됨 (3/6) | github-rules.md |
| DesignClaw | ✅ 명시됨 (3/6) | decisions.md |
| GrowthClaw | ✅ 명시됨 (3/6) | decisions.md, github-rules.md |
| InfraClaw | ❌ 미반영 | - |

**분석**:
- WorkClaw과 InfraClaw이 라벨 전환 시 이전 라벨 제거 규칙을 명시하지 않음
- 이는 2026-03-06 추가된 규칙으로, 일부 봇이 누락

**최신 정답**:
```markdown
라벨 전환 시 이전 단계 라벨 반드시 제거 (2026-03-06 Reus 지시)
- bot:in-progress → bot:done 전환 시: bot:in-progress 제거 필수
- 이슈 close 시에도 bot:in-progress 잔존 여부 확인
```

**권장 조치**:
- WorkClaw과 InfraClaw의 decisions.md 또는 github-rules.md에 규칙 추가

---

## 🟡 누락 (특정 봇에 규칙 미반영)

### 1. memory/bots.md 파일 누락

| 봇 | bots.md 존재 여부 |
|---|---|
| SemiClaw | ✅ 존재 |
| WorkClaw | ❌ 파일 없음 |
| PlanClaw | ❌ 파일 없음 |
| ReviewClaw | ✅ 존재 |
| DesignClaw | ❌ 파일 없음 |
| GrowthClaw | ✅ 존재 |
| InfraClaw | ❌ 파일 없음 |

**분석**:
- WorkClaw, PlanClaw, DesignClaw, InfraClaw가 memory/bots.md 파일 없음
- 봇 아키텍처 정보가 SOUL.md나 AGENTS.md에 산재
- Single Source of Truth 부재

**권장 조치**:
- 봇 ID 매핑, R&R, 봇 간 통신 규칙은 memory/bots.md로 통합 권장
- 또는 SOUL.md를 Single Source로 지정하고 다른 파일에서는 포인터만

---

### 2. memory/github-rules.md 파일 누락

| 봇 | github-rules.md 존재 여부 |
|---|---|
| SemiClaw | ✅ 존재 |
| WorkClaw | ✅ 존재 |
| PlanClaw | ✅ 존재 |
| ReviewClaw | ✅ 존재 |
| DesignClaw | ✅ 존재 |
| GrowthClaw | ❌ 파일 없음 |
| InfraClaw | ✅ 존재 |

**분석**:
- GrowthClaw만 memory/github-rules.md 파일 없음
- GitHub 운영 규칙이 decisions.md에만 포함됨

**권장 조치**:
- GrowthClaw에 memory/github-rules.md 생성 권장
- 또는 decisions.md의 GitHub 섹션을 별도 파일로 분리

---

### 3. PR 리뷰어 지정 규칙 (AI/봇 관련 = Reus) — 누락

| 봇 | 규칙 명시 여부 | 파일 |
|---|---|---|
| SemiClaw | ✅ 명시됨 | decisions.md |
| WorkClaw | ❌ 미반영 | - |
| PlanClaw | ❌ 미반영 | - |
| ReviewClaw | ❌ 미반영 | - |
| DesignClaw | ❌ 미반영 | - |
| GrowthClaw | ❌ 미반영 | - |
| InfraClaw | ❌ 미반영 | - |

**분석**:
- SemiClaw만 "AI/봇/에이전트 관련 PR 리뷰는 Reus에게 요청" 규칙 보유
- 다른 봇들은 모두 누락 (2026-03-07 추가 규칙)

**권장 조치**:
- 전 봇의 decisions.md에 규칙 추가:
  ```markdown
  ## PR 리뷰어 지정 — AI/봇/에이전트 관련은 Reus
  - AI 오케스트레이션, 봇, 에이전트 관련 PR 리뷰는 Reus에게 요청
  - Garden(시스템 아키텍처)이 아닌 Reus가 이 영역 리뷰 오너
  ```

---

### 4. 머지/approve 요청 시 링크 필수 — 일부 봇 누락

| 봇 | 규칙 명시 여부 | 파일 |
|---|---|---|
| SemiClaw | ✅ 명시됨 (3/7) | decisions.md |
| WorkClaw | ✅ 명시됨 (3/7) | decisions.md |
| PlanClaw | ✅ 명시됨 (3/7) | decisions.md |
| ReviewClaw | ✅ 명시됨 (3/7) | github-rules.md |
| DesignClaw | ✅ 명시됨 (3/7) | decisions.md |
| GrowthClaw | ✅ 명시됨 (3/7) | decisions.md |
| InfraClaw | ❌ 미반영 | - |

**분석**:
- InfraClaw만 "머지/approve 요청 시 링크 필수" 규칙 누락
- 2026-03-07 추가된 규칙

**권장 조치**:
- InfraClaw의 decisions.md에 규칙 추가

---

### 5. 인프라 정보 검증 의무 (Hallucination 방지) — 일부 봇 누락

| 봇 | 규칙 명시 여부 | 파일 |
|---|---|---|
| SemiClaw | ✅ 명시됨 (3/7) | decisions.md (Cloudflare 도메인 목록 포함) |
| WorkClaw | ❌ 미반영 | - |
| PlanClaw | ✅ 명시됨 (3/7) | decisions.md |
| ReviewClaw | ✅ 명시됨 (3/7) | decisions.md |
| DesignClaw | ✅ 명시됨 (3/7) | decisions.md |
| GrowthClaw | ✅ 명시됨 (3/7) | decisions.md |
| InfraClaw | ❌ 미반영 | - |

**분석**:
- WorkClaw과 InfraClaw이 인프라 정보 검증 의무 규칙 누락
- 특히 InfraClaw은 hallucination 사건의 당사자였으나 자신의 메모리에 규칙 미반영

**최신 정답**:
```markdown
## 인프라 정보 검증 의무 (2026-03-07, Hallucination 방지)
1. 인프라 정보(DNS, 도메인, 서버 등)는 반드시 CLI/콘솔로 실제 확인 후 발언
2. 확인 불가능하면 "확인 필요"라고 명시 — 추정을 사실처럼 기술 절대 금지
3. 도메인별 DNS 제공자가 다를 수 있음 — 하나를 보고 전체 일반화 금지

Cloudflare 실제 관리 도메인 (이 외는 Cloudflare 아님):
- jungchipan.net
- semi-colon.space
- site-ranking.info
```

**권장 조치**:
- WorkClaw과 InfraClaw의 decisions.md에 규칙 추가 (특히 InfraClaw는 필수)

---

### 6. 주간 봇 메모리 감사 루틴 — 일부 봇 누락

| 봇 | 규칙 명시 여부 | 감사 방법 |
|---|---|---|
| SemiClaw | ✅ 명시됨 (3/7) | 중복→Single Source 지정, 충돌→최신 기준 통일 |
| WorkClaw | ❌ 미반영 | - |
| PlanClaw | ✅ 명시됨 (3/7) | 발견 즉시 수정 → 보고 |
| ReviewClaw | ✅ 명시됨 (3/7) | 전수 조사 → 보고 |
| DesignClaw | ✅ 명시됨 (3/7) | 전수 조사 → 수정 → 보고 |
| GrowthClaw | ✅ 명시됨 (3/7) | 5단계 프로세스 (수정 먼저, 보고 나중) |
| InfraClaw | ❌ 미반영 | - |

**분석**:
- WorkClaw과 InfraClaw이 주간 메모리 감사 루틴 규칙 누락
- 2026-03-07 추가된 규칙 (매주 월요일 10:00 KST)

**권장 조치**:
- WorkClaw과 InfraClaw의 decisions.md에 규칙 추가

---

## ✅ 정상 (전 봇 일치)

### 1. ReusClaw 인계 금지 규칙
- **전 봇 일치**: 모든 봇이 "ReusClaw에게 작업 인계/협업 요청 절대 금지" 규칙 보유
- 파일: SOUL.md, decisions.md, bots.md 등

### 2. 보고 원칙 ("결과만 보고, 중간 과정 금지")
- **전 봇 일치**: 모든 봇이 "Slack 메시지는 최종 결과만, 중간 과정 절대 금지" 규칙 보유
- 파일: decisions.md, SOUL.md

### 3. config.apply 금지 (config.patch만 사용)
- **전 봇 일치**: 모든 봇이 "config.apply 절대 금지 → config.patch만 사용" 규칙 보유
- 파일: SOUL.md, decisions.md

### 4. GitHub 이슈 생성 시 프로젝트 보드 등록 필수
- **전 봇 일치**: 모든 봇이 `gh project item-add 1 --owner semicolon-devteam --url <이슈URL>` 규칙 보유
- 파일: github-rules.md, decisions.md

### 5. 봇 ID 매핑 테이블 (8개 봇 전체 포함)
- **전 봇 일치**: 모든 봇이 8개 봇(SemiClaw, WorkClaw, ReusClaw, PlanClaw, ReviewClaw, DesignClaw, GrowthClaw, InfraClaw) ID 전체 보유
- 파일: SOUL.md, bots.md

### 6. 블로커 보고 시 GitHub 이슈 링크 필수
- **전 봇 일치**: 모든 봇이 블로커 보고 시 이슈 URL 포함 규칙 보유
- 파일: decisions.md

### 7. 봇 간 정보 공유 프로토콜
- **전 봇 일치**: 모든 봇이 `[bot:info-req]` 형식의 정보 질의 프로토콜 보유
- 파일: decisions.md

### 8. 교육/지시 수용 프로토콜
- **전 봇 일치**: 모든 봇이 "즉시 memory 파일에 기록" 프로토콜 보유
- 파일: AGENTS.md, decisions.md

### 9. GitHub OAT 정책 (Claude Code OAT만 사용)
- **전 봇 일치**: 모든 봇이 "Claude Code OAT만, Copilot OAT 금지" 규칙 보유
- 파일: github-rules.md, decisions.md

### 10. 디자인 워크플로우 (프리뷰 필수) — DesignClaw
- **DesignClaw ✅**: 인터랙티브 프리뷰 필수, GitHub Pages 배포, 승인 후 구현 이슈 생성 규칙 보유
- 파일: decisions.md, AGENTS.md

### 11. 프로젝트 클론 경로 규칙 — WorkClaw/InfraClaw
- **WorkClaw ❌, InfraClaw ❌**: 두 봇 모두 프로젝트 클론 경로 규칙은 없으나, 프로젝트 디렉토리 관리 원칙은 보유
- 파일: decisions.md (프로젝트 디렉토리 매핑은 모든 봇 공통 보유)

### 12. 봇 PR 머지 절대 금지 규칙
- **ReviewClaw ✅**: "봇은 절대 PR 머지 금지 (self-PR 포함)" 규칙 명시
- 파일: decisions.md, SOUL.md, github-rules.md
- 기타 봇: 직접적인 머지 권한 없음 (ReviewClaw 전용 규칙)

---

## 📊 종합 분석

### 규칙 반영률 (봇별)

| 봇 | 최신 규칙 반영률 | 주요 누락 항목 |
|---|---|---|
| SemiClaw | 100% (7/7) | - |
| WorkClaw | 71% (5/7) | 라벨 제거 규칙, 인프라 검증, 메모리 감사 |
| PlanClaw | 100% (7/7) | - |
| ReviewClaw | 100% (7/7) | - |
| DesignClaw | 86% (6/7) | Slack 멘션 규칙 명확화 필요 |
| GrowthClaw | 100% (7/7) | - |
| InfraClaw | 57% (4/7) | Slack 멘션, 라벨 제거, 인프라 검증, 머지 링크, 메모리 감사 |

### 파일 구조 일관성

| 파일 | 존재 봇 수 | 누락 봇 |
|---|---|---|
| memory/decisions.md | 7/7 | - |
| memory/bots.md | 3/7 | WorkClaw, PlanClaw, DesignClaw, InfraClaw |
| memory/github-rules.md | 6/7 | GrowthClaw |
| SOUL.md | 7/7 | - |
| AGENTS.md | 7/7 | - |

---

## 🎯 우선순위별 권장 조치

### 🔴 긴급 (즉시 수정 필요)

1. **InfraClaw 인프라 정보 검증 규칙 누락**
   - hallucination 당사자였으나 자신의 메모리에 규칙 미반영
   - 재발 위험 높음 → 즉시 decisions.md 추가 필요

2. **WorkClaw, InfraClaw 라벨 전환 규칙 누락**
   - bot:in-progress 잔존 이슈 방지 목적
   - 즉시 반영 필요

3. **DesignClaw, InfraClaw Slack 멘션 규칙 명확화**
   - 구규칙 취소선 처리 + 최신 규칙만 명시
   - 혼란 방지 위해 즉시 수정

### 🟡 중요 (이번 주 내 수정)

4. **전 봇 PR 리뷰어 지정 규칙 추가**
   - AI/봇 관련 PR은 Reus에게
   - SemiClaw만 보유 → 전 봇 반영 필요

5. **WorkClaw, InfraClaw 메모리 감사 루틴 추가**
   - 매주 월요일 10:00 KST 크론
   - 다음 감사일(3/9) 전까지 반영

6. **InfraClaw 머지/approve 링크 필수 규칙 추가**
   - 전 봇 반영 완료했으나 InfraClaw만 누락

### 🟢 개선 (다음 주 내 검토)

7. **memory/bots.md 파일 통합**
   - WorkClaw, PlanClaw, DesignClaw, InfraClaw에 파일 생성
   - 봇 아키텍처 정보를 Single Source로 집중

8. **memory/github-rules.md 파일 통합**
   - GrowthClaw에 파일 생성
   - GitHub 운영 규칙을 별도 파일로 분리

9. **ReusClaw 설명 표현 통일**
   - 핵심은 동일하나 표현 방식 불일치
   - 전 봇 통일 권장

---

## 📝 발견된 패턴 (근본 원인 분석)

### 1. 3/7 변경사항 전파 누락
- **원인**: 최신 규칙(3/7 Slack 멘션 허용)이 일부 봇에만 전파됨
- **영향**: DesignClaw, InfraClaw이 구규칙 유지 중
- **재발 방지**: 전체 봇 공지 시 #bot-ops 스레드 체크리스트 활용

### 2. 메모리 파일 구조 비일관성
- **원인**: bots.md, github-rules.md 파일이 일부 봇에만 존재
- **영향**: Single Source of Truth 부재 → 정보 산재
- **재발 방지**: 메모리 구조 표준화 (모든 봇 동일 파일 구조)

### 3. 신규 규칙 전파 프로세스 미흡
- **원인**: 3/6~3/7 추가된 규칙들이 일부 봇에만 반영됨
- **영향**: 규칙 반영률 격차 (57%~100%)
- **재발 방지**: 신규 규칙 추가 시 전 봇 동시 업데이트 체크리스트

### 4. 역할별 규칙 누락
- **원인**: 역할별 전용 규칙(디자인 워크플로우, 프로젝트 클론 경로 등)이 해당 봇에만 반영되어야 하나, 일부 공통 규칙도 누락됨
- **영향**: InfraClaw hallucination 규칙 미반영 등
- **재발 방지**: 역할별 규칙과 공통 규칙 구분 명확화

---

## 🔄 다음 단계

1. **즉시 수정 항목 (🔴)**: 각 봇의 해당 파일에 규칙 추가
2. **SemiClaw 취합**: 이 감사 결과를 Reus에게 DM 보고
3. **재발 방지 방안**:
   - 신규 규칙 추가 시 전 봇 체크리스트 의무화
   - 메모리 파일 구조 표준화 (bots.md, github-rules.md 전 봇 생성)
   - 주간 메모리 감사 루틴에서 규칙 반영률 자동 체크

---

**감사 완료**: 2026-03-07 21:46 KST  
**다음 감사**: 2026-03-09 (월) 10:00 KST (주간 정기 감사)

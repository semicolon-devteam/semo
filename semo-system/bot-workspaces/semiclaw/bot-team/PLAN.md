# 🤖 봇 팀 구성 최종안 (v1.0)
> 작성: SemiClaw | 승인 대기: Reus | 날짜: 2026-02-16

## 1. 봇 구성 (8봇)

| # | 봇 | 이모지 | 역할 | 모델 | 인스턴스 유형 | 호스트 | Anthropic 계정 |
|---|---|---|---|---|---|---|---|
| 1 | **SemiClaw** | 🦀 | 오케스트레이터/PM | Opus | 독립 (현재) | 팀 공용 MacBook | snsmanager0 (팀공용) |
| 2 | **PlanClaw** | 📋 | PO/기획 | Opus | SemiClaw 서브에이전트 → Phase2에서 독립 검토 | (SemiClaw 내) | snsmanager0 |
| 3 | **WorkClaw** | ⚙️ | 풀스택 구현 (FE+BE+퍼블리싱) | Sonnet | 독립 (현재) | Reus Mac Mini | reus7042 (개인) |
| 4 | **InfraClaw** | 🏗 | 인프라/DevOps | Sonnet | 독립 (신규) | TBD (Garden Mac Mini or 별도) | baba920630 (Garden) |
| 5 | **ReviewClaw** | 🔍 | 코드리뷰/QA + claude-code-review.yml 인계 | Opus | 독립 (신규) | 팀 공용 MacBook (SemiClaw 동일) | snsmanager0 (팀공용) |
| 6 | **DesignClaw** | 🎨 | 디자인/퍼블리싱 | Sonnet | SemiClaw 서브에이전트 → Phase3에서 독립 검토 | (SemiClaw 내) | snsmanager0 |
| 7 | **GrowthClaw** | 📈 | SEO/마케팅 | Sonnet | SemiClaw 서브에이전트 → Phase3에서 독립 검토 | (SemiClaw 내) | snsmanager0 |
| 8 | **ReusClaw** | 🔧 | Reus 개인 어시스턴트 (팀 완전 분리) | Opus | 독립 (현재) | ⚠️ 별개 PC 독립 운영 — 이식 대상 아님 | reus7042 (개인) |

### 서브에이전트 vs 독립 판단 기준
- **코드 실행 필요** → 독립 인스턴스 (WorkClaw, InfraClaw, ReviewClaw)
- **코드 실행 불필요 + 기획/분석 위주** → SemiClaw 서브에이전트 (PlanClaw, DesignClaw, GrowthClaw)
- 서브에이전트는 Slack 앱 추가 없이 `sessions_spawn`으로 구현. SemiClaw가 결과를 대신 채널에 전달

### WorkClaw 내부 구조
- WorkClaw는 풀스택 단일 봇으로 유지
- 필요 시 내부 서브에이전트로 FE/BE/퍼블리싱 분리 가능 (Phase 2+)
- 현재는 단일 컨텍스트가 더 효율적 (프로젝트 간 지식 공유)

## 2. Anthropic 비용 계획

### 계정 배분
| 계정 | 한도 | 할당 봇 | 예상 사용량 |
|---|---|---|---|
| snsmanager0 (팀공용) | $200/월 | SemiClaw(Opus) + PlanClaw/DesignClaw/GrowthClaw(서브) + ReviewClaw(Opus) | ~$120-160 |
| reus7042 (개인) | $200/월 | ReusClaw(Opus, 별개PC) + WorkClaw(Sonnet) | ~$120-160 |
| baba920630 (Garden) | $100/월 | InfraClaw(Sonnet) | ~$30-50 |

### 비용 최적화
- 실행 봇(WorkClaw, InfraClaw) = Sonnet (저비용, 코드 생성 충분)
- 판단 봇(SemiClaw, ReviewClaw, PlanClaw) = Opus (추론 품질 중요)
- 서브에이전트는 부모 봇 비용에 포함 (별도 인스턴스 비용 없음)

## 3. Slack 채널 구조 — allowBots 적용 범위

### 추천: 채널별 `allowBots` (무한루프 방지)

#### ✅ allowBots: true (봇간 통신 필요)
```
# 프로젝트 채널 — 봇이 기획→구현→리뷰 파이프라인 실행
proj-play-land         # 플레이랜드
proj-game-land         # 게임랜드  
proj-bebecare          # 베베케어
proj-celeb-map         # 셀럽맵
proj-ps                # PS
proj-by-buyer          # 바이바이어
proj-jungchipan        # 정치판 (있다면)

# 코어/인프라 — InfraClaw + WorkClaw 협업
core-backend           # (채널 있다면)
core-infra             # (채널 있다면)

# 봇 오퍼레이션
_reus                  # 현재 봇 테스트/운영 채널
```

#### ❌ allowBots: false (사람 위주 채널)
```
개발사업팀 (C020RQTNPFY)  # 리더 채널 — 봇 루프 위험 + 금액 정보
_협업                       # 사람간 소통
_일정                       # 일정 관리
_외주                       # 외부 소통
```

### 구현 방법
각 봇의 OpenClaw config에서:
```json
{
  "channels": {
    "slack": {
      "allowBots": false,  // 전역 기본값 = 꺼짐
      "channels": {
        "#proj-play-land": { "allowBots": true },
        "#proj-game-land": { "allowBots": true },
        "#proj-bebecare": { "allowBots": true },
        "#_reus": { "allowBots": true }
        // ... 프로젝트 채널만 선택적 활성화
      }
    }
  }
}
```

## 4. 봇별 메모리/작동 원칙

### 디렉토리 구조
```
workspace/
├── bot-team/
│   ├── PLAN.md              ← 이 문서
│   ├── PROTOCOL.md          ← 봇간 통신 프로토콜
│   ├── agents/
│   │   ├── planclaw/
│   │   │   ├── SOUL.md      (PO 페르소나: 유저 중심 사고, 스펙 정밀도)
│   │   │   ├── MEMORY.md    (기획 문서 인덱스, PRD 이력)
│   │   │   └── templates/   (PRD, 유저스토리, 기능명세 템플릿)
│   │   ├── designclaw/
│   │   │   ├── SOUL.md      (디자이너 페르소나: Yeomso 스타일 반영)
│   │   │   └── MEMORY.md    (디자인 시스템, 컴포넌트 라이브러리)
│   │   └── growthclaw/
│   │       ├── SOUL.md      (마케터 페르소나: SEO+퍼포먼스)
│   │       └── MEMORY.md    (SEO 전략, 키워드, 분석 데이터)
│   └── shared/
│       ├── tech-stack.md    (기술 스택 통합 문서)
│       ├── coding-standards.md (코딩 컨벤션)
│       └── project-context/ (프로젝트별 공유 컨텍스트)
│
├── memory/projects/          ← 기존 프로젝트 메모리 (전봇 읽기 가능)
└── MEMORY.md                 ← SemiClaw 전용 (오케스트레이터 메모리)
```

### 각 봇 SOUL.md 핵심 원칙

#### 🦀 SemiClaw (오케스트레이터/PM)
- 직접 코드 작성 X, 태스크 분배 + 진척 관리
- 봇간 워크플로우 조율 (기획→구현→리뷰→배포)
- Reus 보고 + 팀원 소통 담당
- 프로젝트 컨텍스트 Single Source of Truth 관리

#### 📋 PlanClaw (PO/기획) — 서브에이전트
- PRD, 유저스토리, 기능명세 작성
- Reus/Roki 요구사항 → 구체적 스펙으로 변환
- WorkClaw에 넘길 구현 스펙 포맷 표준화
- 우선순위 매트릭스 관리

#### ⚙️ WorkClaw (풀스택 구현)
- FE (Next.js/React) + BE (Spring Boot/Kotlin) + 퍼블리싱
- GitHub 이슈 기반 작업
- PR 생성 → ReviewClaw 리뷰 요청 자동화
- 코드 컨벤션: `bot-team/shared/coding-standards.md` 준수

#### 🏗 InfraClaw (인프라/DevOps)
- K8s/OKE 관리, CI/CD 파이프라인
- GitOps (semi-colon-ops) Kustomize 관리
- DB 마이그레이션 (Flyway)
- 모니터링, 장애 대응
- Garden의 인프라 지식 계승

#### 🔍 ReviewClaw (코드리뷰/QA)
- PR 자동 리뷰 (GitHub webhook 연동)
- 코딩 컨벤션 준수 체크
- 보안/성능 이슈 탐지
- 테스트 커버리지 확인
- 리뷰 통과 시 SemiClaw에 보고 → 머지 승인 플로우

#### 🎨 DesignClaw (디자인/퍼블리싱) — 서브에이전트
- UI/UX 가이드라인 관리
- TailwindCSS 컴포넌트 퍼블리싱
- Yeomso 디자인 시안 → 코드 변환 지원
- 디자인 시스템 문서화

#### 📈 GrowthClaw (SEO/마케팅) — 서브에이전트
- SEO 최적화 (메타태그, 구조화 데이터, sitemap)
- 퍼포먼스 마케팅 전략
- 콘텐츠 전략 (정치판, BebeCare 등)
- 분석 리포트 (트래픽, 전환율)

## 5. 봇간 통신 프로토콜 (PROTOCOL.md)

### 태스크 흐름
```
[Reus/팀원 요청]
    ↓
🦀 SemiClaw — 태스크 분해 + 분배
    ├→ 📋 PlanClaw: 스펙 작성 (서브에이전트)
    │     ↓ 완료 시 SemiClaw에 결과 반환
    ├→ 🎨 DesignClaw: UI 가이드 (서브에이전트)  
    │     ↓ 완료 시 SemiClaw에 결과 반환
    ├→ ⚙️ WorkClaw: 코드 구현 (@멘션)
    │     ↓ PR 생성
    ├→ 🔍 ReviewClaw: PR 리뷰 (webhook 자동)
    │     ↓ 승인/리젝
    └→ 🏗 InfraClaw: 배포 (@멘션)
          ↓ 완료 보고
🦀 SemiClaw — 완료 보고 to Reus
```

### 메시지 형식 (채널 멘션용)
```
@WorkClaw [TASK] 플레이아이돌 콘텐츠/피드 API 구현
[PROJECT] play-land
[SPEC] {PlanClaw 산출물 링크 또는 요약}
[PRIORITY] high
[ISSUE] proj-play-land#145
```

### 무한루프 방지 규칙
1. 봇은 자기 자신 메시지에 응답하지 않음 (OpenClaw 기본)
2. 같은 태스크에 대해 봇간 최대 5회 왕복 후 SemiClaw에 에스컬레이션
3. 서브에이전트는 채널에 직접 글 쓰지 않음 — SemiClaw가 대신 전달
4. `개발사업팀` 채널에서는 봇간 통신 금지 (금액 정보 보호)

## 6. 롤아웃 계획

### Phase 1 — 즉시 (이번 주)
- [x] SemiClaw 오케스트레이터 역할 전환
- [x] allowBots 설정 완료 (전역 → 채널별로 전환 필요)
- [ ] PlanClaw 서브에이전트 구성 (SOUL.md + 템플릿)
- [ ] ReviewClaw 독립 인스턴스 세팅 + GitHub webhook
- [ ] PROTOCOL.md 작성 + 전봇 공유

### Phase 2 — 1주 후
- [ ] WorkClaw 역할 명확화 (SOUL.md 업데이트)
- [ ] InfraClaw 독립 인스턴스 세팅 (Mac Mini, baba 계정)
- [ ] 채널별 allowBots 세분화 적용
- [ ] 첫 End-to-End 파이프라인 테스트 (기획→구현→리뷰→배포)

### Phase 3 — 2주 후
- [ ] DesignClaw 서브에이전트 구성
- [ ] GrowthClaw 서브에이전트 구성
- [ ] 비용 모니터링 + 최적화
- [ ] 봇 팀 운영 회고 + 조정

## 7. 미결 사항 / 추가 확인 필요

1. **Slack 채널 정확한 목록**: `channels:read` scope로 전체 채널 ID 매핑 필요
2. **ReviewClaw GitHub 연동**: `claude-code-review.yml` 기존 워크플로우와 통합 or 분리?
3. **InfraClaw Mac Mini 접근**: Garden 계정 SSH/원격 접근 설정
4. **서브에이전트 한계**: `sessions_spawn`은 채널에 직접 메시지 못 보냄 — SemiClaw가 중계해야 함. 이 지연이 수용 가능한지?
5. **allowBots 전역→채널별 전환**: 현재 전역 true인데, 채널별로 바꾸려면 채널 ID 확보 후 config 업데이트 필요

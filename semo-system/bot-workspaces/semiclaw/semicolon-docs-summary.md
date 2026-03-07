# Semicolon Wiki 문서 전체 정리

**작성일**: 2026-02-10
**분석 대상**: /tmp/semicolon-wiki (41개 파일), /Users/semicolon/Desktop/semicolon/docs/claudedocs (5개 파일)
**분석 범위**: Wiki 전체 + Claude 분석 문서

---

## 📚 1. 문서별 요약

### 🏠 **Home.md** (Wiki 메인)
• AI-Native 개발팀을 위한 통합 문서 시스템
• 5개 카테고리로 구성: 팀 협업, 기술 아키텍처, 개발 컨벤션, AI 규칙 시스템, 자동화 도구
• 역할별 온보딩 경로 제공 (PO, PSM, Engineer, QA)
• 최근 업데이트: 2025-11-20 (문서 구조 개편)
• 레거시 문서 아카이브 완료 (.legacy-backup/)

### 🏗️ **Development-Philosophy.md** (개발 철학)
• 기술적 의사결정 원칙 및 설계 철학
• 4-Layer 아키텍처 핵심: Supabase → Spring Boot → Package → Next.js
• 1-Hop Rule: Browser → Spring Boot 직접 호출 (Next.js API 경유 금지)
• AI 협업 철학: AI 생성 코드도 본인 코드, 품질 저하 이유 될 수 없음
• 핵심 금지 사항: Supabase RPC/Edge Functions (비즈니스 로직), any 타입 남발, console.log

### 🏛️ **Core-Architecture.md** (Core 시스템)
• 3개 Core 레포 구성: core-supabase (DB), core-backend (Spring Boot), core-interface (API 규격)
• 비즈니스 로직 중앙화: Spring Boot에서 처리, Supabase는 인프라만
• Reactive Programming: R2DBC 사용, 비차단 I/O
• 마이그레이션 계획: 2026 상반기까지 Flyway로 완전 통합
• API 규격 표준화: OpenAPI로 TypeScript 타입 자동 생성

### 🌱 **Core-Backend-Guide.md** (백엔드 가이드)
• Spring Boot 3.5.6, Kotlin 1.9.25, Java 21 사용
• DDD 구조: 도메인 우선 → 레이어 구조 (Controller → Service → Repository)
• **중요**: Cloud Supabase는 반드시 Supabase MCP를 통해 쿼리
• API 엔드포인트 설계 원칙: 도메인 독립적 (Flat Structure), 중첩 라우팅 금지
• 예시: ✅ `/api/v1/comments?post-id=3` / ❌ `/api/v1/posts/3/comments`

### 📋 **Core-Interface-Guide.md** (API 규격)
• Kotlin DSL로 API 스펙 작성 → OpenAPI JSON 자동 생성
• TypeScript 타입 자동 생성으로 프론트-백 타입 일치
• Swagger UI로 API 문서 자동 배포 (Vercel)
• Mock 데이터 포함으로 병렬 개발 가능
• 버전별 Release 관리 (Semantic Versioning)

### 🔄 **Core-Migration-Strategy.md** (마이그레이션 전략)
• Supabase → Spring Boot 단계적 전환 (Phase 1-4, 총 12-18주)
• NginX 프록시로 병행 운영: 구현된 API는 Spring Boot, 미구현은 Supabase
• 롤백 계획: 에러율 5% 이상 시 즉시 NginX 설정 롤백 (다운타임 0초)
• 성능 목표: 응답시간 30% 개선, 처리량 2배 증가, 에러율 1% 이하
• 도메인별 마이그레이션 순서: Post → Menu → User → Challenge → Banner → Blocked

### 🤝 **Collaboration-Process.md** (협업 프로세스)
• Epic → Task → 개발 → Dev 검증 → Staging → Production 전체 워크플로우
• AI 기반 자동화: Epic/Bug to Tasks 자동 생성, PR 자동 리뷰
• 매주 토요일 정기 배포: Staging 15:00, Production 13:00
• 이터레이션 단위 작업량 관리 및 보상
• 4개 Phase로 구성: Epic 작성 → Task 생성 → 개발 → 배포

### 👥 **Process-Roles-Guide.md** (역할별 가이드)
• PO (NO-Y-R): Epic 작성, 비즈니스 요구사항 정의, AI Epic 생성 에이전트 사용 권장 (75% 시간 단축)
• PSM (reus-jeon, garden92): Epic 검토, Task 생성, 토요일 병합 리뷰
• Engineer: Task 구현, 테스트 작성 (80%+ 커버리지), AI 리뷰, Dev 검증
• QA: Staging 테스트, 회귀 테스트, 크로스 브라우저/모바일 테스트

### 📝 **Process-Phase-1-Epic-Creation.md** (Epic 작성)
• **방법 1 (권장)**: AI Epic 생성 에이전트 사용 (10-15분 소요)
• **방법 2**: 직접 템플릿 작성 (30-40분 소요)
• 필수 항목: 배경/목적, 사용자 스토리 3개 이상 (체크박스), 완료 조건, 관련 레포지토리
• 자동 설정: Projects #1 추가, Type '에픽', Status '검수대기'
• Bug 리포트 및 긴급 핫픽스 등록 프로세스 포함

### 📦 **Process-Phase-2-Task-Creation.md** (Task 생성)
• Epic to Tasks 3가지 실행 방법: ⭐ 라벨 트리거 (ready-for-tasks), 댓글 트리거 (/generate-tasks), Manual 실행
• AI가 작업 유형 자동 분석하여 10개 템플릿 중 선택
• **중요**: Epic의 Sub-issues로 자동 연결 (Projects 보드에 진행률 표시 3/5)
• Bug to Tasks도 동일한 3가지 방법 지원
• PSM 검수 항목: 완성도, 작업량, 우선순위, 요구사항, Branch 명

### 💻 **Process-Phase-3-Development.md** (개발 프로세스)
• Feature Branch 자동 생성 가능 (ready-for-dev 라벨 추가 시)
• Gitmoji 커밋 규칙: `<이모지> #<이슈번호>: <제목>` (한국어, 50자 이내)
• AI 리뷰 트리거 3가지: Ready for Review 버튼, ready-for-review 라벨, re-review 라벨
• AI 리뷰 항목: 코드 품질, 테스트 커버리지 (80%+), 요구사항 충족, 보안, 코딩 표준
• Dev 검증 완료 후 Status: 진행중 → 리뷰요청

### 🚀 **Process-Phase-4-Deployment.md** (배포)
• 토요일 15:00 Staging 병합 리뷰 (온콜 라이브)
• 리뷰 항목: Dev 검증 결과, 코드 품질, 요구사항 충족, 테스트 커버리지, 배포 리스크
• 승인 시: dev → stg 머지, Status: 테스트중
• QA 테스트 (1 이터레이션): 기능, 회귀, 크로스 브라우저, 모바일, 성능, 보안, 접근성
• 다음 토요일 13:00 프로덕션 배포 및 보수 지급 💰

### 🏛️ **rules-architecture.md** (아키텍처 규칙)
• ARCH-LAYER-001: 1-Hop Rule (Browser → Spring Boot 직접)
• ARCH-LAYER-002: Layer Separation (Pages → Hooks → API Clients → Repositories)
• ARCH-SUPA-001: Supabase 역할 제한 (인프라만)
• ARCH-SUPA-002: No Business Logic in RPC/Edge Functions
• ARCH-API-001: DTO Pattern (Entity 직접 노출 금지)

### 💬 **rules-communication.md** (커뮤니케이션 규칙)
• Personal Mention: 6시간 이내 응답 (근무 시간)
• Urgent [Emergency]: 2시간 이내 응답
• 응답 방법: 확인 시 Emoji (👍, ✅), 답변 시 Thread, 불가 시 대안 제시
• 1일 이상 부재 시 Slack Status 업데이트
• 중요 결정은 GitHub Discussion/Issue에 문서화

### 📐 **Dev-Conventions-Code.md** (코드 컨벤션)
• 네이밍: camelCase (변수/함수), PascalCase (클래스/컴포넌트), UPPER_SNAKE_CASE (상수), kebab-case (CSS/쿼리 파라미터)
• React 필수: 함수형 컴포넌트 + Hooks, TypeScript, 스타일드 컴포넌트는 파일 최하단
• **React 디렉토리 구조**: Atomic Design - 각 컴포넌트는 독립 디렉토리 (Button/, Input/)
• **Path Alias**: `@molecules/...` (O) / `@/molecules/...` (X)
• Java: Google Java Style Guide, 생성자 주입, @RestController/@Service/@Repository, DTO 사용

### 🤝 **guides-team-collaboration-guide.md** (협업 가이드)
• 5대 핵심 원칙: Async-First, Clarity, Accountability, Transparency, Efficiency
• Git 워크플로우: 항상 dev에서 브랜치 생성, Gitmoji 커밋, PR에 이슈 링크
• 코드 품질: console.log 금지, 주석 처리 코드 삭제, Lint 통과 필수
• 일정: 월-금 09:00-18:00, Staging 토 15:00, Production 토 13:00
• 지각 시 24시간 전 팀 공지 필수

### 🔄 **Epic-To-Tasks-Automation.md** (자동화 시스템)
• CORE_SCHEMA_REGISTRY: 공통 스키마, 확장 스키마, metadata 확장 정의
• **3가지 분류**: coreTables (Task 생성 X), coreExtensions (core 레포 Task), metadataExtensions (Planning Task)
• coreTables (posts, comments, users, points): Epic에 Dependency Comment만 추가
• coreExtensions (exchanges, debates): core-supabase + core-backend + cm-* Task 생성
• metadataExtensions (companies, reviews): Planning Task + API + Frontend Task 생성

### 🏗️ **guides-architecture-nextjs-guide.md** (Next.js 아키텍처)
• 4-Layer: Pages → Hooks → API Clients → Repositories
• 1-Hop Rule: Browser → Spring Boot (Next.js API 경유 금지)
• Atomic Design: atoms/ molecules/ organisms/ templates/ pages/
• 각 컴포넌트는 독립 디렉토리 구조 (Button/index.tsx, Button.test.tsx)
• Supabase는 Server-side만 (`createServerSupabaseClient`)

### 📋 **guides-architecture-supabase-interaction.md** (Supabase 가이드)
• **Direct Query 금지**: 반드시 RPC Functions 사용
• Repository Pattern: createServerSupabaseClient → RPC 호출
• Error Handling: PostgresError 타입 활용, 구체적 에러 메시지
• Type Safety: Database 타입 정의 활용, Zod validation
• Performance: 필요한 컬럼만 select, 페이지네이션 필수

### 🔧 **guides-infrastructure-supabase-access.md** (Supabase 접근)
• **Cloud Supabase**: Supabase MCP 통해서만 쿼리 가능
• **On-Premise Supabase**: SSH/Docker로 직접 연결 가능
• SSH 터널링: `ssh -L 54322:localhost:54322 user@remote-host`
• Docker: `docker exec -it supabase-db psql -U postgres`
• MCP 활용: Claude Code에서 직접 쿼리 실행

---

## 🗺️ 2. 전체 구조 맵

### 📂 문서 카테고리 체계

**A. 팀 협업 (Team Collaboration)**
• 핵심: guides-team-collaboration-guide, Collaboration-Process, Process-Roles-Guide
• Phase별 상세: Process-Phase-1-Epic-Creation, Process-Phase-2-Task-Creation, Process-Phase-3-Development, Process-Phase-4-Deployment
• 자동화: Epic-To-Tasks-Automation, Epic-Creation-Agent
• 웹툰: guides-team-collaboration-webtoon (파트타이머용 4컷 만화)

**B. 기술 아키텍처 (Architecture)**
• Core 시스템: Core-Architecture, Core-Backend-Guide, Core-Interface-Guide, Core-Migration-Strategy
• Frontend: guides-architecture-nextjs-guide, guides-architecture-template-ddd, guides-architecture-template-domain-structure
• Supabase: guides-architecture-supabase-interaction, guides-infrastructure-supabase-access
• 개발 철학: Development-Philosophy

**C. 개발 컨벤션 (Conventions)**
• 코드: Dev-Conventions-Code, Dev-Conventions-Testing
• Git: Dev-Workflow-Frontend-Task (Git 규칙 포함)
• 워크플로우: Dev-Workflow-Frontend-Task, Dev-Workflow-Repository

**D. AI 규칙 시스템 (Rules - For AI/LLM)**
• rules-architecture, rules-communication, rules-git, rules-process, rules-schedule, rules-responsibility, rules-violation
• 전체 규칙 인덱스: rules-rules.yaml (346개 규칙 ID)

**E. 자동화 도구 (Automation)**
• Epic-Creation-Agent, Epic-To-Tasks-Automation, Design-Guide

### 🔗 문서 간 관계

**Hub 문서** (다른 문서들을 연결):
• Home.md → 전체 문서 네비게이션
• Development-Philosophy.md → 기술 문서 Hub
• Collaboration-Process.md → 프로세스 문서 Hub

**역할별 학습 경로**:
• PO: guides-team-collaboration-guide → Epic-Creation-Agent → Process-Phase-1-Epic-Creation
• PSM: Collaboration-Process → Process-Phase-2-Task-Creation → Process-Roles-Guide
• Engineer: Development-Philosophy → guides-architecture-nextjs-guide → Dev-Conventions-Code → Process-Phase-3-Development
• QA: Collaboration-Process → Process-Phase-4-Deployment → Dev-Conventions-Testing

**의존 관계**:
• Core-Backend-Guide → Core-Architecture (아키텍처 이해 필요)
• guides-architecture-nextjs-guide → Development-Philosophy (철학 기반)
• Process-Phase-2-Task-Creation → Epic-To-Tasks-Automation (자동화 이해 필요)
• Dev-Conventions-Code → rules-architecture (규칙 참조)

---

## 🔧 3. 개선이 필요한 부분

### ⚠️ 일관성 및 불일치 이슈

**A. 날짜 형식 불일치**
• 일부 문서: `2025-01-06` / 다른 문서: `2025-11-20` / 또 다른 문서: `2025-10-18`
• 개선: 모든 문서에 `YYYY-MM-DD` 형식 통일, "마지막 업데이트" 섹션 필수화

**B. 링크 참조 방식 불일치**
• 일부: `[문서명](파일명)` / 다른 일부: `[문서명](파일명.md)` / 또 다른 일부: `.md` 생략
• 개선: `.md` 확장자 생략으로 통일

**C. 용어 혼용**
• "레포지토리" vs "레포" vs "Repo"
• "Task" vs "태스크" vs "작업"
• "Epic" vs "에픽"
• 개선: 용어집 (Glossary) 작성, 영문 우선 사용 권장

### 📅 오래된 정보

**A. Core-Backend-Guide.md**
• Spring Boot 버전: 3.5.6 (최신 버전 확인 필요)
• Kotlin 버전: 1.9.25 (최신 버전 확인 필요)
• Java 21 → Java 23 업그레이드 검토 필요

**B. Collaboration-Process.md**
• 일정 정보: Week -1, Week 1 상대적 표현 (절대 날짜로 보완 필요)
• 담당자 정보: NO-Y-R, reus-jeon, garden92 (현재 재직 여부 확인 필요)

**C. guides-architecture-nextjs-guide.md**
• Next.js 버전 정보 누락 (Next.js 15 기준인지 명시 필요)
• App Router vs Pages Router 구분 명시 필요

### 🚫 누락된 내용

**A. 테스트 전략 문서**
• Dev-Conventions-Testing.md 존재하지만 상세 내용 부족
• E2E 테스트 전략 누락 (Playwright/Cypress 가이드 없음)
• 성능 테스트, 부하 테스트 가이드 없음

**B. 배포 전략 상세**
• CI/CD 파이프라인 구성도 없음
• 환경별 배포 전략 (dev/staging/production) 상세 설명 부족
• 롤백 절차는 Core-Migration-Strategy.md에만 있음 (일반 배포 롤백 절차 필요)

**C. 보안 가이드 부재**
• 인증/인가 구현 가이드 없음
• 민감정보 관리 규칙 없음 (환경변수, Secret 관리)
• OWASP Top 10 대응 가이드 없음

**D. 모니터링 및 로깅**
• 로그 수집/분석 전략 없음
• 에러 추적 (Sentry 등) 설정 가이드 없음
• 성능 모니터링 (Prometheus, Grafana) 가이드 없음

**E. 온보딩 체크리스트**
• 역할별 가이드는 있지만 실제 온보딩 체크리스트 없음
• 개발 환경 설정 상세 가이드 부족 (macOS, Windows, Linux 별)

### 🔄 개선 우선순위

**🔥 High Priority (즉시 개선)**
1. 날짜/링크/용어 통일 (전체 문서 일관성)
2. 현재 재직 중인 담당자 정보 업데이트
3. 버전 정보 최신화 (Spring Boot, Kotlin, Next.js 등)
4. 보안 가이드 작성 (민감정보 관리, 인증/인가)

**⚡ Medium Priority (단기 개선)**
5. 테스트 전략 문서 확대 (E2E, 성능, 부하)
6. 배포 전략 상세화 (CI/CD, 롤백 절차)
7. 모니터링/로깅 가이드 작성
8. 온보딩 체크리스트 및 환경 설정 가이드

**📋 Low Priority (장기 개선)**
9. 용어집 (Glossary) 작성
10. 트러블슈팅 가이드 (FAQ 형식)
11. 아키텍처 결정 기록 (ADR) 도입

### 🔍 추가 발견 사항

**A. Legacy 문서 정리**
• `.legacy-backup/` 폴더에 백업된 문서 정리 완료 (✅ Good)
• 하지만 일부 문서에서 여전히 레거시 참조 존재 (확인 필요)

**B. 문서 간 순환 참조**
• 일부 문서들이 서로를 무한 참조 (예: A → B → C → A)
• 개선: Hub 문서 중심 구조로 재정리

**C. 다이어그램 부재**
• Mermaid 다이어그램이 일부 문서에만 존재
• 개선: 주요 프로세스 및 아키텍처 문서에 다이어그램 추가

---

## 📊 4. Claude 분석 문서 요약 (claudedocs/)

### 📝 **agent-improvement-proposals.md** (SAX Agent 개선안)
• 24개 Agent 분석 결과 (SAX-Meta 5, SAX-PO 6, SAX-Next 13)
• **공통 문제점**: model 필드 누락 (24/24), PROACTIVELY 패턴 없음 (0/24), 과도한 write 권한, 컨텍스트 과다
• **개선 방향**: model 필드 추가 (opus 2, sonnet 14, haiku 5, inherit 3), PROACTIVELY 패턴 적용, Progressive Disclosure 도입
• **예상 효과**: 비용 30-50% 절감, 응답 속도 40% 향상, 컨텍스트 40-60% 감소
• 우선순위별 실행 계획: Phase 1 (즉시), Phase 2 (단기), Phase 3 (중기)

### 🔍 **anthropic-skills-analysis.md** (Anthropic Skills 학습)
• Anthropic 공식 Skills 레포지토리 분석 결과
• **핵심 원칙**: Progressive Disclosure (3단계 로딩), Conciseness (간결성), 구조화 (scripts/references/assets)
• **SAX 비교**: SAX는 전체 로드 vs Anthropic은 필요한 것만 로드, 설명 중심 vs 예시 중심
• **개선 효과 예상**: Context usage 30-50% 감소, 가독성 향상, 유지보수성 개선
• 실행 계획: Phase 1 (표준화), Phase 2 (핵심 Skills 리팩토링), Phase 3 (검증), Phase 4 (전파)

### 🔧 **sax-skills-phase1-improvement-report.md**
• SAX Skills Phase 1 개선 보고서 (상세 분석)
• 패키지별 Skill 분석 및 개선안 제시
• Progressive Disclosure 패턴 적용 방법
• Description 작성 가이드라인
• **핵심 메시지**: "필요한 것만 로드" 원칙

### 💬 **sax-message-system-analysis.md** (메시지 시스템 분석)
• SAX 메시지 미출력 문제 원인 분석
• **근본 원인**: Claude Code는 정적 Context 로딩, "Agent 전환"은 개념적 가이드일 뿐
• **해결책**: 메시지 출력을 "필수 규칙"으로 문서에 강조, 각 단계별 강제성 부여
• 개선 방안: 루트 CLAUDE.md 수정, SAX-Meta CLAUDE.md 수정, orchestrator.md 수정
• 장기 개선: Hooks 활용, CLAUDE.md 최상단 강조

### 🔬 **sub-agent-optimization-analysis.md**
• Sub-Agent 최적화 분석 (24개 Agent)
• Best Practices 기반 분석
• Model 선택 전략 제시
• 도구 권한 최적화 방안
• Progressive Disclosure 적용 가이드

---

## 🎯 5. 주간 리포트 요약

**📁 reports 폴더**: 존재하지 않음 (확인 결과 디렉토리 없음)

**대안 정보**:
• 문서 최근 업데이트 날짜 기준:
  - 2025-11-20: Home.md (문서 구조 개편, 5개 카테고리 재구성)
  - 2025-11-19: 이중 트랙 시스템 도입 (guides/ + rules/)
  - 2025-10-18: Epic/Bug to Tasks 3가지 트리거 방법 추가
  - 2025-10-16: 초기 협업 프로세스 문서화
  - 2025-01-07: Core 시스템 문서 업데이트
  - 2025-01-06: Phase별 및 역할별 문서 분리

• Claude 분석 문서 날짜:
  - 2025-01-27: agent-improvement-proposals.md, sax-message-system-analysis.md, sub-agent-optimization-analysis.md
  - 2025-01-26: anthropic-skills-analysis.md

---

## ✅ 6. 권장 조치 사항

### 즉시 조치 (This Week)

**A. 일관성 개선**
• [ ] 모든 문서의 "마지막 업데이트" 날짜 형식 통일 (`YYYY-MM-DD`)
• [ ] 링크 참조 방식 통일 (`.md` 확장자 생략)
• [ ] 용어 혼용 정리 (영문 우선 또는 한글 우선 결정)

**B. 정보 업데이트**
• [ ] 담당자 정보 최신화 (재직 여부 확인)
• [ ] 기술 스택 버전 정보 업데이트 (Spring Boot, Kotlin, Next.js 등)
• [ ] 일정 정보 절대 날짜 보완

**C. 문서 누락 보완**
• [ ] 보안 가이드 작성 (민감정보 관리, 인증/인가)
• [ ] 온보딩 체크리스트 작성
• [ ] 개발 환경 설정 가이드 (OS별)

### 단기 조치 (This Month)

**D. 문서 확장**
• [ ] 테스트 전략 문서 확대 (E2E, 성능, 부하)
• [ ] 배포 전략 상세화 (CI/CD, 롤백)
• [ ] 모니터링/로깅 가이드 작성

**E. SAX Agent 개선 적용**
• [ ] model 필드 24개 전체 추가
• [ ] PROACTIVELY 패턴 적용
• [ ] Progressive Disclosure 도입

**F. 문서 구조 개선**
• [ ] Hub 문서 중심 재정리 (순환 참조 제거)
• [ ] 주요 프로세스/아키텍처 다이어그램 추가

### 장기 조치 (This Quarter)

**G. 문서 시스템 고도화**
• [ ] 용어집 (Glossary) 작성
• [ ] 트러블슈팅 가이드 (FAQ)
• [ ] 아키텍처 결정 기록 (ADR) 도입
• [ ] reports/ 디렉토리 구축 및 주간 리포트 작성 프로세스 확립

---

## 📚 7. 참고 자료

**Wiki 문서 위치**:
• `/tmp/semicolon-wiki/` (41개 .md 파일)

**Claude 분석 문서 위치**:
• `/Users/semicolon/Desktop/semicolon/docs/claudedocs/` (5개 .md 파일)

**다이어그램 위치**:
• `/Users/semicolon/Desktop/semicolon/docs/diagrams/` (Excalidraw 파일 5개, 웹툰 이미지 4개)

**레거시 백업**:
• `/tmp/semicolon-wiki/.legacy-backup/` (7개 백업 파일)

---

**분석 완료 시각**: 2026-02-10 05:53 GMT+9
**총 분석 파일 수**: 46개 (Wiki 41 + Claude docs 5)
**분석 소요 시간**: 약 10-15분

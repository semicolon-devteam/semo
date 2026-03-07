# 세미콜론 레포지토리 분석 보고서
**분석일자**: 2026-02-13  
**베이스 경로**: ~/Desktop/semicolon/repos/  
**총 레포 수**: 70+

---

## 📊 요약 통계

### 상태별 분류
- **활성 프로젝트**: 8개 (리즈온, 삼호작업복, KR 시리즈, partners-korea)
- **개발/유지보수**: 15개 (Core 시리즈, MS 시리즈, CM 시리즈)
- **인프라/도구**: 5개 (command-center, docs, k8s-ops-sample, semi-colon-apps, team-selecolon)
- **템플릿/샘플**: 3개 (ms-template, actions-template, template-spring-boot)
- **MVP/POC**: 10개 (포트폴리오/데모용)

---

## 1. 🏥 리즈온 (Leeds Healthcare) 프로젝트

### proj-leeds-on-admin
- **프로젝트명**: 리즈온 관리자 페이지
- **기술스택**: 
  - Spring Boot 2.7.4
  - Java 17
  - MyBatis
  - Thymeleaf
  - Spring Security 5.7.3
  - MySQL
  - Maven
- **상태**: ✅ **활성** (최근 커밋: PR #243 merge)
- **설명**: 리즈헬스케어 건강기능식품 커머스 플랫폼의 백오피스 관리 시스템. Swagger 문서화 지원.
- **특이사항**: README 없음, WAR 패키징 방식

### proj-leeds-on-web
- **프로젝트명**: 리즈온 쇼핑몰 웹
- **기술스택**:
  - Spring Boot 2.7.4
  - Java 17
  - MyBatis
  - Thymeleaf
  - Spring Security 5.7.3
  - MySQL
  - Maven
- **상태**: ✅ **활성** (최근 커밋: PR #381 merge)
- **설명**: 리즈헬스케어 건강기능식품 커머스 플랫폼의 고객용 쇼핑몰 웹사이트.
- **특이사항**: README 없음, WAR 패키징 방식, LeedsOnShopping2로 명명됨

---

## 2. 🧥 삼호작업복 (Samho Work Clothes)

### mvp-samho-work-clothes
- **프로젝트명**: 삼호작업복 다국어 안내 시스템
- **기술스택**:
  - Next.js 16.1.0 (App Router)
  - React 19.2.3
  - TypeScript 5
  - Tailwind CSS 4
  - Supabase (PostgreSQL)
  - Anthropic Claude API (AI 번역)
- **URL**: mvp-samho-work-clothes.vercel.app
- **상태**: ✅ **활성** (최근 커밋: 매장 정책 정보 어드민 수정 기능 추가)
- **설명**: 외국인 근로자를 위한 작업복 매장 10개 언어 다국어 안내 MVP 서비스. 
  - **고객용 기능**: 10개국 언어 지원 (한국어, 베트남어, 네팔어, 우즈베크어, 캄보디아어, 인도네시아어, 태국어, 미얀마어, 중국어, 영어), 네이버 지도 연동, 파파고 번역, 리뷰/메시지 작성
  - **관리자 기능**: 리뷰 관리, AI 자동 번역, 매장 정보 관리
- **특이사항**: 상세한 README 포함, docs/ 폴더에 MVP_SPEC.md 보유

---

## 3. 🚢 조선소 인력관리

### mvp-shipyard-management
- **프로젝트명**: 조선소 인력관리 시스템
- **기술스택**:
  - Next.js (App Router)
  - React 18
  - TypeScript
  - Supabase (Auth, Database)
  - Radix UI
  - Vitest (테스팅)
  - Husky (Git hooks)
- **상태**: 🔧 **개발중** (최근 커밋: 테스트 환경 수정)
- **설명**: 조선소 인력 관리를 위한 웹 애플리케이션. 테스트 코드 포함, Supabase Auth 연동.
- **특이사항**: README 없음, 테스트 인프라 구축됨

---

## 4. 📈 Partners Korea (주식정보 앱)

### partners-korea
- **프로젝트명**: 주식정보 제공 앱
- **기술스택**:
  - React Native
  - TypeScript
  - Firebase (Auth, Database, Functions, Messaging)
  - React Navigation v5
  - Chance (데이터 생성)
  - React Native DateTimePicker
- **상태**: ✅ **활성** (최근 커밋: iOS VIP 등록 탭 제거)
- **설명**: 외주 프로젝트, 포트폴리오용 주식 정보 제공 모바일 앱. Firebase 기반 실시간 데이터 처리.
- **특이사항**: README 없음, iOS/Android 멀티플랫폼

---

## 5. 🚆 리스크제로 (RiskZero) - 국가철도공단 안전관리 솔루션

### kr-back
- **프로젝트명**: RiskZero v3 WAS (백엔드)
- **기술스택**:
  - Spring Boot 2.7.10
  - Java 17 (JDK 1.8 호환)
  - Gradle 7.3.2
  - PostgreSQL
  - JWT
  - Spring Security
  - Spring Boot Actuator
  - Log4j2 JDBC
  - SpotBugs (정적 분석)
- **포트**: 8080
- **상태**: ✅ **활성** (최근 커밋: DB 덤프파일)
- **설명**: 국가철도공단 안전관리 솔루션의 백엔드 API 서버. GH(경기건설) 납품용을 철도청에 맞게 수정 작업 중.
- **특이사항**: 기본 README 포함

### kr-front
- **프로젝트명**: RiskZero Frontend Korail
- **기술스택**:
  - React 18
  - Vite
  - Material-UI (MUI)
  - Zustand (상태관리)
  - TanStack React Query
  - Axios
  - Styled-components
  - dayjs
  - React Router v6
- **포트**: 4000 (외부 접근)
- **상태**: ✅ **활성** (최근 커밋: 센서관제화면 타이틀 설명 수정, 다국어 추가)
- **설명**: 
  - **배경**: GH(경기건설) 건설 현장 안전보건 관리 시스템을 **철도청(KORAIL) 납품용으로 수정** 중
  - **핵심 변경사항**: 건설 → 철도 도메인 용어 변경, 철도 안전 관리 규정 반영, 철도 시설물 관리 체계 적용
  - **주요 기능**: 대시보드, 패키지 시스템 (기본/안전보건/IoT), 실시간 알림, 모바일 반응형
  - **사용자 유형**: MASTER (철도청 본사), SUB (지역본부), USER (현장), CLIENT (발주처)
- **특이사항**: 
  - 매우 상세한 README 포함 (개발 가이드, 철도청 커스터마이징 작업 가이드, 기술 부채 명시)
  - docs/ 폴더에 네비게이션 구조 분석 문서 포함
  - npm run deploy:dev/stg 스크립트 지원

### kr-mobile
- **프로젝트명**: KR Mobile (모바일 웹)
- **기술스택**:
  - React 18
  - Vite
  - Material-UI (MUI)
  - React Router v6
  - Zustand
  - TanStack React Query
  - React Hook Form + Zod
  - Axios
  - React Signature Canvas
  - Styled-components
- **상태**: ✅ **활성** (최근 커밋: 마이페이지 회사이름 sessionData 값으로 수정)
- **설명**: 
  - 기존 네이티브 앱의 TBM(Tool Box Meeting) 참석자 서명 및 작업중지권 관리 기능을 **웹으로 전환**
  - **주요 기능**: TBM 관리 (서명 패드), 작업중지권 관리, 사용자/현장 관리
  - **API 연동**: 모든 요청에 SiteId 헤더 포함
- **특이사항**: 
  - 상세한 README 포함 (프로젝트 구조, 개발 현황, Phase별 진행 상태)
  - docs/ 폴더에 프로젝트 브리프, User Stories 포함

### kr-cctv-dashboard
- **프로젝트명**: SH Dashboard - CCTV 관리 시스템
- **기술스택**:
  - Next.js 15.5.0
  - React 19.1.0
  - TypeScript 5
  - Tailwind CSS 4.1.12
  - Lucide React (아이콘)
  - HLS.js (비디오 스트리밍)
  - React Kakao Maps SDK
- **상태**: ✅ **활성** (최근 커밋: 대용량 파일 제거)
- **설명**: 
  - CCTV 관리 프로토타입 + 대시보드 시스템
  - **주요 기능**: CCTV 목록/등록/수정/삭제, 인라인 편집, 실시간 연결 상태 모니터링
  - **데이터**: 현재 파일 기반 Mock 데이터 사용 (JSON)
  - **API**: RESTful API 설계 (GET, POST, PUT, DELETE)
- **특이사항**: 
  - 매우 상세한 README 포함 (프로젝트 구조, API 명세, UI/UX 가이드, 개발 가이드)
  - 서버 연동 준비 가이드 포함

### kr-stream-server
- **프로젝트명**: KR Stream Server
- **기술스택**:
  - Spring Boot 3.5.5
  - Java 21
  - Spring WebFlux (반응형)
  - Spring Data Elasticsearch
  - JavaCV 1.5.12 (비디오 처리)
  - Logstash Logback Encoder (로깅)
  - Gradle
- **상태**: ✅ **활성** (최근 커밋: SH 대상 2차 데모시연용 베타서비스)
- **설명**: CCTV 스트림 처리 및 Elasticsearch 기반 데이터 저장을 위한 백엔드 서비스. JavaCV로 비디오 처리.
- **특이사항**: README 없음

---

## 6. 🎯 Command Center (팀 계획/의사결정)

### command-center
- **프로젝트명**: Semicolon Community Command Center
- **기술스택**: 
  - GitHub Projects (이슈 관리)
  - GitHub Actions (자동화 워크플로우)
  - GitHub Discussions (회의록, 의사결정 로그)
  - Markdown (문서)
  - Shell Script (자동화)
- **상태**: ✅ **활성** (최근 커밋: 포트폴리오 등록)
- **설명**: 
  - 세미콜론 리더그룹을 위한 컨트롤타워 레포
  - **주요 기능**: 
    - 업무 등록: 긴급 핫픽스, 에픽 작성, 버그 리포트
    - 이슈 관리: 긴급 대응, 에픽/버그 리스트, 인원별/서비스별 현황
    - 자동화: Epic/Bug to Task 자동 생성 (`/generate-tasks` 댓글 명령어)
    - 회의록 및 의사결정 로그 (GitHub Discussions 템플릿)
  - **디렉토리**: business/, docs/, meetings/, semo-system/, webhook-server/
- **특이사항**: 
  - 매우 상세한 README 포함 (배지 기반 빠른 액세스, 자동화 가이드)
  - .docs/ 폴더에 프로세스 가이드 보유
  - 최근 포트폴리오 인덱스 업데이트 활발 (AXOracle, Actions Template, 삼호작업복 등)

---

## 7. 📚 Docs (팀 규칙/컨벤션)

### docs
- **프로젝트명**: Semicolon 팀 문서
- **기술스택**: 
  - GitHub Wiki
  - Markdown
  - YAML (AI 규칙 시스템)
- **상태**: ✅ **활성** (최근 커밋: 주간 리포트 생성 2026-02-07)
- **설명**: 
  - 팀 협업, 기술 아키텍처, 개발 컨벤션, AI 규칙 시스템 등 모든 팀 문서 보관
  - **주요 문서**:
    - 협업 가이드 (필수 숙지)
    - Next.js 아키텍처 (4-Layer, 1-Hop Rule)
    - 개발 철학 (기술 의사결정 원칙)
    - AI 규칙 시스템 (346개 규칙 ID, 머신러닝용 rules.yaml)
    - 자동화 도구 (Epic Creation Agent, Epic to Tasks)
  - **디렉토리**: wiki/ (GitHub Wiki), .legacy-backup/, claudedocs/, diagrams/
- **특이사항**: 
  - Wiki 별도 Git 레포 관리
  - 인간 친화적 가이드(guides/) + AI 최적화 규칙(rules/) 분리
  - 신규 팀원 온보딩 가이드 포함

---

## 8. 🔍 미식별 레포 분석

### k8s-ops-sample
- **프로젝트명**: kol-ops
- **기술스택**: Kubernetes (추정)
- **상태**: 🔧 **초기 단계** (최근 커밋: init project)
- **설명**: Kubernetes 운영 샘플 레포로 추정. 초기화만 된 상태.
- **특이사항**: README 없음, package.json 없음

### semi-colon-apps
- **프로젝트명**: Semi-colon Apps
- **기술스택**: ArgoCD ApplicationSet (추정)
- **상태**: 🔧 **개발중** (최근 커밋: mvp-link-collect ApplicationSet 추가 dev)
- **설명**: ArgoCD 기반 GitOps 배포 관리 레포로 추정. 여러 MVP/프로젝트의 ApplicationSet 관리.
- **특이사항**: README 없음

### cm-plan
- **프로젝트명**: 랜드 커뮤니티 (cm-land 포크로 추정)
- **기술스택**:
  - Next.js 15.1.4
  - React 19
  - TypeScript
  - Tailwind CSS
  - Supabase
  - Redux Toolkit
  - TanStack React Query
  - Styled-components
  - Toast UI Editor
  - Vitest
- **상태**: 🔧 **개발중** (최근 커밋: cm-plan 파이프라인 설정)
- **설명**: 
  - cm-template 기반 Next.js 커뮤니티 웹 서비스
  - JWT 기반 인증, 게시판/댓글 시스템, 관리자 대시보드
  - Spring Boot 백엔드 프록시 연동 지원
  - **Architecture**: Atomic Design, 4-Layer (App Router, Components, Hooks, Services)
- **특이사항**: 
  - 상세한 README 포함 (Quick Start, Architecture, SDD+ADD 워크플로우)
  - CLAUDE.md에 AI 에이전트 가이드 (SAX 시스템)
  - docs/polisher-api.md (이미지/비디오 처리 API)

### ms-template
- **프로젝트명**: Microservice Template
- **기술스택**:
  - Next.js 14
  - TypeScript
  - PostgreSQL
  - Prisma ORM
  - Tailwind CSS
  - Zod (검증)
  - Jest (테스팅)
- **상태**: 🛠️ **템플릿** (최근 커밋: 이슈 템플릿 작업량 평가 섹션 표준화)
- **설명**: Semicolon Community 마이크로서비스 개발을 위한 기본 템플릿. Prisma 기반 DB 마이그레이션 지원.
- **특이사항**: 
  - README 포함
  - Prisma Studio 스크립트 포함
  - MIT 라이선스

### team-selecolon
- **프로젝트명**: Team Selecolon
- **기술스택**: (불명)
- **상태**: 🔧 **개발중** (최근 커밋: Fetch last 200 items 수정)
- **설명**: claudedocs/, docs/ 폴더만 존재. GitHub 이슈 가져오기 관련 스크립트로 추정.
- **특이사항**: README 없음, 소스 코드 없음

---

## 9. 📦 Core 시리즈 (공통 인프라)

### 주요 Core 레포 (분석 제외, 목록만 기록)
- **core-admin**: 관리자 UI
- **core-backend**: Spring Boot 백엔드
- **core-central-db**: 중앙 DB
- **core-com-ops**: 커뮤니티 운영
- **core-community-package**: 커뮤니티 패키지
- **core-compose**: Docker Compose
- **core-design-system**: 디자인 시스템
- **core-e2e-tests**: E2E 테스트
- **core-infra**: 인프라 코드
- **core-interface**: API 인터페이스
- **core-supabase**: Supabase 공통
- **core-terraform**: Terraform IaC
- **core-webhook**: Webhook 서버

---

## 10. 🎮 Microservice(MS) 시리즈

### 주요 MS 레포 (분석 제외, 목록만 기록)
- **ms-allocator**: 리소스 할당
- **ms-batcher**: 배치 처리
- **ms-collector**: 데이터 수집
- **ms-crawler**: 크롤러
- **ms-crontab**: 크론 작업
- **ms-gamer**: 게임화 (Swagger 문서 포함)
- **ms-ledger**: 원장 관리
- **ms-logger**: 로깅
- **ms-media-processor**: 미디어 처리
- **ms-notifier**: 알림 발송
- **ms-observer**: 모니터링
- **ms-scheduler**: 스케줄러

---

## 11. 🏘️ Community(CM) 시리즈

### 주요 CM 레포 (분석 제외, 목록만 기록)
- **cm-cointalk**: 코인토크 커뮤니티
- **cm-introduction**: 소개 페이지
- **cm-introduction-new**: 신규 소개 페이지
- **cm-jungchipan**: 정치판 커뮤니티
- **cm-labor-union**: 노동조합 커뮤니티
- **cm-land**: 랜드 커뮤니티
- **cm-office**: 오피스 커뮤니티
- **cm-template**: 커뮤니티 템플릿
- **cm-plan**: (위에서 분석함)

---

## 12. 💼 프로젝트(Proj) 시리즈

### 주요 Proj 레포 (분석 제외, 목록만 기록)
- **proj-bebecare**: 베베케어
- **proj-celeb-map**: 셀럽 맛집 지도
- **proj-maju**: 마주
- **proj-seoul-tourist**: 서울 관광 앱
- **proj-viral**: 바이럴

---

## 13. 🚀 MVP 시리즈

### 주요 MVP 레포 (분석 제외, 목록만 기록)
- **mvp-car-dealer**: 중고차 딜러
- **mvp-chagok**: 차곡
- **mvp-damju**: 담주
- **mvp-link-collect**: 링크 수집
- **mvp-rapunzel**: 라푼젤
- **mvp-sales-on**: 세일즈온

---

## 14. 🔧 기타 레포

### 주요 기타 레포 (분석 제외, 목록만 기록)
- **actions-archive**: GitHub Actions 아카이브
- **actions-template**: GitHub Actions 템플릿
- **ps**: (프로그래밍 문제 해결로 추정)
- **requirements**: 요구사항 문서
- **semi-colon-ops**: 운영 관련
- **semo**: 세모 프로젝트
- **semo-remote-app**: 세모 원격 앱
- **semo-remote-client**: 세모 원격 클라이언트
- **template-spring-boot-kotlin**: Spring Boot Kotlin 템플릿
- **template-spring-boot-web-mvc**: Spring Boot Web MVC 템플릿

---

## 🎯 핵심 발견사항

### 1. 활성 프로젝트 현황
- **리즈온**: Spring Boot 기반 건강기능식품 커머스, admin/web 분리
- **삼호작업복**: 최신 Next.js 16 + AI 번역, 10개국 언어 지원 MVP
- **KR 시리즈**: GH 건설 → 철도청 도메인 전환 작업 진행 중 (5개 레포)
- **Partners Korea**: React Native 주식앱

### 2. 기술 스택 트렌드
- **Frontend**: Next.js (15.x, 16.x) + React 18/19 + TypeScript 주류
- **Backend**: Spring Boot 2.7~3.5 + Java 17/21
- **Database**: PostgreSQL (Supabase), MySQL
- **상태관리**: Zustand, Redux Toolkit
- **서버 상태**: TanStack React Query
- **스타일링**: Tailwind CSS 4.x
- **AI**: Anthropic Claude API (번역, 자동화)

### 3. 개발 프로세스
- **Git 전략**: GitHub Projects + Epic to Tasks 자동화
- **문서화**: Wiki 기반, AI 규칙 시스템 (346개 규칙)
- **AI 협업**: Spec-Driven Development (SDD) + Agent-Driven Development (ADD)
- **배포**: ArgoCD GitOps (semi-colon-apps), Vercel (MVP)

### 4. 아키텍처 패턴
- **Frontend**: 4-Layer Architecture, 1-Hop Rule, Atomic Design
- **Backend**: DDD, Microservice (MS 시리즈)
- **인프라**: Terraform IaC, Kubernetes, Docker Compose

### 5. 개선 필요 사항
- **README 부재**: proj-leeds-on-*, partners-korea, kr-stream-server 등
- **초기 단계 레포**: k8s-ops-sample, team-selecolon (용도 불명확)
- **레거시 코드**: kr-front (GH 건설 → 철도청 전환 작업 진행 중)

### 6. 포트폴리오 가치
- **command-center**: 최근 포트폴리오 인덱스 활발히 업데이트 중
- **삼호작업복**: 10개국 다국어 + AI 번역 MVP, 상세 문서화
- **KR 시리즈**: 대규모 정부 프로젝트 (철도청), 복잡한 도메인 전환 경험

### 7. 조직 구조
- **Core**: 공통 인프라 (13개 레포)
- **MS**: 마이크로서비스 (12개 레포)
- **CM**: 커뮤니티 플랫폼 (9개 레포)
- **Proj**: 프로젝트 (6개 레포)
- **MVP**: Proof of Concept (10개 레포)

---

## 📋 권장 사항

### 아카이브 대상 검토
- **k8s-ops-sample**: 초기화만 된 상태, 용도 불명
- **team-selecolon**: 소스 코드 없음, 용도 불명

### 문서화 개선 필요
- **proj-leeds-on-admin/web**: README 추가 권장
- **partners-korea**: README 추가 권장
- **kr-stream-server**: README 추가 권장
- **mvp-shipyard-management**: README 추가 권장

### 통합 고려
- **cm-plan vs cm-land**: 중복 가능성 확인 필요
- **cm-introduction vs cm-introduction-new**: 구버전 아카이브 검토

### 강점 유지
- **상세한 문서화**: kr-front, kr-mobile, kr-cctv-dashboard, 삼호작업복, cm-plan
- **자동화 시스템**: command-center (Epic to Tasks)
- **AI 협업**: docs (346개 규칙), CLAUDE.md (SAX 시스템)

---

**분석 완료일**: 2026-02-13  
**분석자**: OpenClaw Subagent  
**다음 단계**: Reus DM으로 핵심 발견사항 전달

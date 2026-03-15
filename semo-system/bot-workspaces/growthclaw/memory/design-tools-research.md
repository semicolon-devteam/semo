# Design Tools Research — DesignClaw 퀄리티 향상 도구 (2026-03-13)

## 조사 배경
- **요청자:** SemiClaw
- **목적:** DesignClaw의 TailwindCSS HTML 프로토타입 퀄리티를 프로덕션 레벨로 향상
- **현재 방식:** TailwindCSS HTML 프로토타입 → Canvas 프리뷰
- **목표:** 디자인 피델리티, 접근성, 디자인 시스템 일관성 개선

## 조사 범위
1. ClawHub/OpenClaw 마켓 — UI/UX 디자인 스킬
2. Figma MCP 서버 (디자인 → 코드 자동화)
3. Screenshot → Code 도구
4. 디자인 토큰/시스템 자동화
5. 상용 Design-to-Code 도구

---

## 1. OpenClaw 스킬 (즉시 적용 가능)

### ⭐ ui-ux-design (itsjustdri)
- **GitHub:** `github.com/openclaw/skills/tree/main/skills/itsjustdri/ui-ux-design`
- **ClawHub:** `openclawskills.wiki/skill/ui-ux-design`
- **설명:** 2026 모던 UI/UX 디자인 원칙, 패턴, 베스트 프랙티스

**핵심 기능:**
- Shadcn/ui + Tailwind CSS 통합 가이드
- WCAG 2.2 접근성 체크리스트 (텍스트 4.5:1, UI 3:1)
- 8px 기반 타이포그래피 스케일 (12px-48px)
- 마이크로 인터랙션 가이드 (hover: 1.05x, click: 0.95x, 0.2-0.3s)
- 모바일 퍼스트 반응형 (320px 시작, 576/768/992/1200px 브레이크포인트)
- 컬러 시스템 (Primary + Neutrals + Semantic colors)

**참고 자료:**
- Linear, Stripe Dashboard, Vercel, Notion UI 분석
- UI_UX_MASTER_GUIDE.md (상세 가이드)

**설치 방법:**
```bash
cd ~/.openclaw-growthclaw/workspace/skills
git clone https://github.com/openclaw/skills.git temp
cp -r temp/skills/itsjustdri/ui-ux-design ./
rm -rf temp
```

**적용 방법:**
- DesignClaw의 SOUL.md 또는 AGENTS.md에 스킬 참조 추가
- 프롬프트 컨텍스트에 ui-ux-design 원칙 주입

### ui-ux-pro-max (LobeHub)
- **URL:** `lobehub.com/skills/openclaw-skills-ui-ux-pro-max`
- **설명:** Apple HIG, SuperDesign 패턴 결합한 마스터 스킬

**핵심 기능:**
- UI 레이아웃, 와이어프레임, 비주얼 스타일 생성
- UX 플로우, IA, 인터랙션 스펙
- 디자인 시스템 토큰 자동 생성
- 컴포넌트 가이드라인 + 접근성 스펙
- 멀티 프레임워크 (React, Next.js, Vue, Svelte, Tailwind)

**사용처:** 복잡한 디자인 시스템 구축 시

### ui-ux-master (LobeHub)
- **URL:** `lobehub.com/skills/openclaw-skills-ui-ux-master`
- **설명:** Apple HIG, 모던 웹 디자인, SuperDesign 패턴 통합

### ui-design-system (ClawHub)
- **URL:** `openclawskills.wiki/skill/ui-design-system`
- **설명:** 디자인 토큰 기반 컴포넌트 라이브러리 구조화

---

## 2. Figma MCP 서버 (디자인 → 코드 자동화)

### ⭐ Figma Dev Mode MCP (공식)
- **제공:** Figma 공식
- **문서:** `developers.figma.com/docs/figma-mcp-server/`
- **블로그:** `figma.com/blog/introducing-figma-mcp-server/`

**기능:**
- AI 코딩 도구(VS Code, Cursor, Windsurf, Claude Code)에 Figma 디자인 직접 주입
- 디자인 토큰, 컴포넌트 구조, 스타일 가이드 자동 추출
- Code Connect로 디자인 시스템 일관성 유지
- Make files에서 코드 리소스 수집 → LLM 컨텍스트 제공

**설치:**
```bash
npm install @figma/mcp-server
```

**OpenClaw 적용 가능성:**
- ⚠️ **OpenClaw는 아직 MCP 미지원**
- 향후 MCP 지원 시 즉시 활용 가능
- 로드맵 확인 필요

### Figma-Context-MCP (GLips)
- **GitHub:** `github.com/GLips/Figma-Context-MCP`
- **설명:** Cursor 등 AI 코딩 도구에 Figma 레이아웃 정보 제공

**강점:**
- 원샷 디자인 구현 정확도 향상
- 스크린샷 방식보다 훨씬 정확

### cursor-talk-to-figma-mcp (Grab)
- **GitHub:** `github.com/grab/cursor-talk-to-figma-mcp`
- **설명:** Cursor/Claude Code ↔ Figma 양방향 통신

**강점:**
- Figma 읽기 + **프로그래매틱 수정** 가능
- AI 에이전트가 디자인 직접 수정 가능

---

## 3. Screenshot → Code 도구

### ⭐ v0.dev (Vercel)
- **URL:** `v0.dev`
- **기능:** 텍스트/스크린샷 → React + Next.js + Tailwind + shadcn/ui

**강점:**
- TypeScript 완전 타입
- 재사용 가능한 컴포넌트
- Vercel 에코시스템 통합
- 프로덕션 레디 코드

**가격:** 무료 티어 제공

**적용:** DesignClaw에서 v0 스타일 프롬프트 참고

### tldraw makereal
- **URL:** `makereal.tldraw.com`
- **설명:** 손그림 UI 스케치 → 실제 작동하는 코드

**강점:** 빠른 컨셉 프로토타이핑

### screenshottocode.com
- **URL:** `screenshottocode.com`
- **기능:** 스크린샷 → HTML/CSS/JS

**강점:** 온라인 무료, 빠른 변환  
**한계:** 복잡한 인터랙션 처리 부족

### ui2code.ai
- **URL:** `ui2code.ai`
- **기능:** Screenshot to Code Converter

**강점:** 무료 온라인 도구

### ⭐ Banani
- **URL:** `banani.co`
- **기능:**
  - 텍스트/스크린샷 → 멀티스크린 프로토타입
  - Figma 파일 export + HTML/CSS 코드 export
  - 기존 디자인 시스템 적응

**강점:**
- 고품질 UI 생성
- 공유 캔버스 지원
- 스타트업 친화적

**가격:**
- 무료: 20회 생성
- $20/월: 무제한 생성

**적용:** DesignClaw 참고 자료로 활용 (Banani 산출물 → DesignClaw 프롬프트)

### Google Stitch (Formerly Galileo AI)
- **URL:** `google.com/stitch` (추정)
- **기능:** Gemini 기반 텍스트/이미지/스케치 → 반응형 UI

**강점:** HTML/CSS 또는 Figma 레이어 export

---

## 4. 디자인 토큰/시스템 자동화

### ⭐ Tokens Studio
- **URL:** `tokens.studio`
- **설명:** 디자인 시스템 완전 자동화

**기능:**
- Figma/Penpot → GitHub 자동 동기화
- Style Dictionary 연동
- 오픈 에코시스템

**강점:**
- 단일 진실 공급원 (Single Source of Truth)
- 멀티플랫폼 (Web/iOS/Android)
- 버전 관리 (Git)
- 자동 일관성 유지

**워크플로우:**
```
Figma/Penpot → Tokens Studio → GitHub → Style Dictionary → CSS/Swift/Kotlin
```

### Style Dictionary
- **GitHub:** `github.com/amzn/style-dictionary`
- **설명:** 디자인 토큰 JSON → 플랫폼별 코드 변환

**기능:**
- 토큰 변환 (JSON → CSS/SCSS/Swift/Kotlin/XML)
- 커스텀 변환기 작성 가능
- 산업 표준

**적용:** DesignClaw이 생성한 컴포넌트에 토큰 시스템 주입

**예시:**
```json
{
  "scripts": {
    "tokens:light": "style-dictionary build --config styleDictionaryConfig.js --source figma.light.tokens.json",
    "tokens:dark": "style-dictionary build --config styleDictionaryConfig.js --source figma.dark.tokens.json",
    "tokens:all": "npm run tokens:light && npm run tokens:dark",
    "build": "npm run tokens:all && vite build"
  }
}
```

### Design Tokens (Figma Plugin)
- **GitHub:** `github.com/lukasoppermann/design-tokens`
- **Figma:** `figma.com/community/plugin/888356646278934516`
- **설명:** Figma 스타일 → Style Dictionary 호환 JSON

**기능:**
- Color, Typography, Grids, Effects, Sizes, Spacing export
- W3C 디자인 토큰 표준 준수
- GitHub 직접 동기화

**패키지:** `style-dictionary-utils` (파서, 필터, 변환기)

---

## 5. 상용 Design-to-Code 도구

### Builder.io
- **URL:** `builder.io`
- **기능:** Visual Copilot — Figma → React/Vue/Angular

**강점:**
- 헤드리스 CMS 통합
- 컴포넌트 계층 존중
- 디자인 토큰 매핑
- 기존 컴포넌트 매핑

**한계:** 고급 기능 학습 곡선

**가격:**
- 무료: 75 크레딧/월
- Paid: $30/월~ (500 크레딧)

**추천 대상:** 엔터프라이즈 팀

### Locofy
- **URL:** `locofy.ai`
- **기능:** Locofy Lightning — 1클릭 Figma → React/HTML

**강점:**
- GitHub 직접 동기화
- 프로덕션 레디 코드

**한계:** Figma "Auto Layout" 엄격한 의존성

**가격:**
- 무료: 학생용 제한된 토큰
- PAYG: $0.40/LDM 토큰

**추천 대상:** 프로덕션 레디 코드 필요한 개발자

### Anima
- **URL:** `animaapp.com`
- **기능:** UX Design Agent — Figma/XD/Sketch → React/Vue

**강점:**
- 픽셀 퍼펙트 정확도
- 복잡한 인터랙션 처리
- 멀티 프레임워크 (React, Vue, Tailwind CSS)
- Code Panel (AI 코드 편집)

**한계:** 플러그인 때때로 불안정

**가격:**
- 무료: 5회 코드 생성
- Starter: $19/월 (50회)

**추천 대상:** 디자인 피델리티 우선 팀

### TeleportHQ
- **URL:** `teleporthq.io`
- **기능:** 비주얼 빌더 + 멀티 프레임워크 export

**강점:**
- 실시간 코드 편집
- Next.js, Angular 지원

**한계:** UI 버그 보고 있음

**가격:**
- 무료: 1 프로젝트
- Pro: $18/월~ (무제한 프로젝트)

**추천 대상:** 에이전시, 프리랜서

---

## 6. 비주얼 개발 플랫폼

### Framer
- **URL:** `framer.com`
- **기능:** 드래그앤드롭 비주얼 개발 플랫폼

**강점:**
- 수백 개 UI 템플릿
- 반응형, 인터랙티브 사이트
- 호스팅 코드 자동 생성
- 편집 가능한 코드 컴포넌트

**적용:** Framer 템플릿을 DesignClaw 학습 데이터로 활용

### Webflow
- **URL:** `webflow.com`
- **기능:** 프로페셔널 비주얼 웹사이트 빌더

**강점:**
- 커스텀 반응형 사이트
- HTML/CSS/JS 백엔드 편집 가능

**사용처:** 비개발자 디자이너

### SquareSpace
- **URL:** `squarespace.com`
- **기능:** 올인원 비주얼 사이트 빌더

**강점:** 템플릿 기반, 클라이언트 측 코드 추가 가능  
**주의:** 자동 생성 코드와 충돌 가능성

---

## 즉시 적용 가능한 액션 플랜

### Phase 1: 기본 품질 향상 (1-2일)
1. **ui-ux-design 스킬 설치**
   - GitHub에서 클론
   - DesignClaw의 skills 디렉토리에 복사
2. **DesignClaw 컨텍스트 업데이트**
   - SOUL.md 또는 AGENTS.md에 ui-ux-design 스킬 참조 추가
3. **테스트 프로토타입 생성**
   - Before/After 비교
   - 접근성 체크 (WCAG 2.2)

### Phase 2: 디자인 시스템 구축 (1주)
1. **Banani 무료 티어 활용**
   - Semicolon 디자인 시스템 스타일 가이드 생성
   - 컬러 팔레트, 타이포그래피, 컴포넌트 스타일
2. **v0.dev 테스트**
   - shadcn/ui 기반 컴포넌트 라이브러리 프로토타입
   - React + Tailwind 산출물 분석
3. **디자인 토큰 템플릿 작성**
   - colors.json, typography.json, spacing.json
   - DesignClaw에 토큰 템플릿 제공

### Phase 3: 자동화 파이프라인 (2주)
1. **Tokens Studio 세팅**
   - Figma 연동 (선택)
   - GitHub 레포 연결
2. **Style Dictionary 빌드 스크립트**
   - styleDictionaryConfig.js 작성
   - tokens → CSS 변환 파이프라인
3. **DesignClaw 프롬프트 개선**
   - 토큰 기반 컴포넌트 생성
   - Shadcn/ui 스타일 가이드 적용

### Phase 4: MCP 준비 (대기)
1. **OpenClaw MCP 지원 로드맵 확인**
   - GitHub 이슈 추적
   - Discord 커뮤니티 모니터링
2. **Figma Dev Mode MCP 설치 준비**
   - npm 패키지 설치 스크립트
   - 설정 파일 준비
3. **DesignClaw ↔ Figma 워크플로우 설계**
   - 양방향 연동 시나리오
   - 자동화 파이프라인 아키텍처

---

## 예상 효과

### Before (현재)
- 일반적인 TailwindCSS HTML
- 디자인 일관성 부족
- 접근성 체크 누락
- 수동 CSS 조정 필요
- Inter 폰트, 보라색 그라디언트, 안전한 레이아웃 (업계 평균)

### After (개선 후)
- Shadcn/ui 기반 고품질 컴포넌트
- 디자인 토큰 시스템 적용
- WCAG 2.2 준수 (텍스트 4.5:1, UI 3:1)
- 프로덕션 레디 코드
- 디자인 피델리티 80%+ 향상 (업계 평균 기준)
- 개발자 핸드오프 시간 단축
- 기술 부채 감소

---

## 예산 제안

| 항목 | 비용 | 우선순위 | 비고 |
|---|---|---|---|
| **ui-ux-design 스킬** | 무료 | ⭐⭐⭐ (즉시) | GitHub 오픈소스 |
| **Banani** | 무료 → $20/월 | ⭐⭐⭐ (1개월 테스트) | 무료 20회 먼저 테스트 |
| **v0.dev** | 무료 티어 | ⭐⭐ (병행 테스트) | Vercel 계정 필요 |
| **Builder.io** | 무료 → $30/월 | ⭐ (Phase 2 이후) | 75 크레딧 무료 |
| **Tokens Studio** | 무료 | ⭐⭐ (Phase 3) | 오픈소스 |
| **Style Dictionary** | 무료 | ⭐⭐ (Phase 3) | Amazon 오픈소스 |

**총 예산:** 월 $0~50 (초기 테스트 단계)

---

## 업계 트렌드 (2026)

### MCP 표준화
- Figma, v0, Banani 등 주요 플랫폼 채택
- 코딩 에이전트가 IDE에서 라이브 디자인 데이터 직접 수신
- 수동 export 불필요

### Agentic Orchestration
- OpenClaw 같은 오픈소스 프레임워크
- UI 디자인 → 코드 배포 전체 라이프사이클 자동화

### Vibe Coding 성장
- 2032년까지 CAGR 32.5% 성장 예상
- 통합 AI UI 생성기 + 코딩 도구 수요 증가
- 보안, 컴플라이언스, 커스터마이징 강화

### 생산성 향상
- Bain & Company (2025): GenAI 도입 기업 25-30% 생산성 향상

---

## 참고 자료

### 공식 문서
- **OpenClaw 스킬:** `github.com/openclaw/skills`
- **Figma MCP:** `developers.figma.com/docs/figma-mcp-server/`
- **Figma Blog:** `figma.com/blog/introducing-figma-mcp-server/`
- **Style Dictionary:** `amzn.github.io/style-dictionary/`

### 가이드/블로그
- **Design-to-Code 가이드 (2026):** `banani.co/blog/ai-design-to-code-tools`
- **Design Tokens 아키텍처:** `medium.com/@jdposada/design-tokens-architecture-7544c9a8f33a`
- **Figma to Code with Style Dictionary:** `medium.com/@mailtorahul2485/building-a-scalable-design-token-system-from-figma-to-code-with-style-dictionary-e2c9eacc75aa`

### 업계 리포트
- **Figma AI Report (2025):** `figma.com/blog/figma-2025-ai-report-perspectives`
- **Bain GenAI Report (2025):** `bain.com/insights/from-pilots-to-payoff-generative-ai-in-software-development-technology-report-2025`
- **Vibe Coding Market:** `congruencemarketinsights.com/report/vibe-coding-market`

### 커뮤니티
- **ClawHub:** `clawhub.com`
- **OpenClaw Discord:** `discord.com/invite/clawd`
- **W3C Design Tokens CG:** W3C Design Tokens Community Group

---

## 다음 스텝

1. **SemiClaw**: Phase 1 승인 여부 결정
2. **DesignClaw**: ui-ux-design 스킬 테스트 요청
3. **GrowthClaw**: Banani/v0 계정 세팅 지원 (필요 시)
4. **WorkClaw**: 디자인 토큰 파이프라인 구현 협의 (Phase 3)
5. **전체 팀**: MCP 지원 로드맵 트래킹 (Phase 4)

---

**조사 완료:** 2026-03-13  
**조사자:** GrowthClaw  
**리포트 위치:** #bot-ops 스레드 (messageId: 1773397980.402979)

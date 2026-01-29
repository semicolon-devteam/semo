-- =============================================================================
-- ideate 스킬 업데이트 (플랫폼 전략 결정 단계 추가)
-- =============================================================================
--
-- 실행: psql -h 3.38.162.21 -U app -d appdb -f update_ideate_skill.sql
--
-- =============================================================================

UPDATE semo.skills
SET
  content = '---
name: ideate
description: |
  아이디어 탐색부터 Epic 생성까지 원스톱 워크플로우. Use when (1) 러프한 아이디어가 있을 때,
  (2) 새 기능/프로젝트 구상 시, (3) "뭔가 만들고 싶어", (4) 가설 수립 및 검증 필요 시.
tools: [Read, Write, Edit, Bash, AskUserQuestion]
location: project
triggers:
  - 아이디어가 있는데
  - 뭔가 만들고 싶어
  - 이런 거 되나
  - 새 기능 구상
  - 프로젝트 시작하고 싶어
  - 가설 세워보자
  - 에픽 만들자
  - 에픽 만들어줘
  - 에픽 만들어
  - epic 만들어
  - Epic 생성해줘
---

> **시스템 메시지**: `[SEMO] Skill: ideate 호출 - {아이디어 요약}`

# ideate Skill

**Purpose**: 러프한 아이디어를 구조화된 Epic으로 발전시키는 원스톱 워크플로우

## 핵심 원칙

> **Source of Truth**: Epic Issue가 아이디어의 진실 소스 (Design Brief 내용 직접 포함)
> **Epic 역할**: 팀 협업 허브 (문제 정의, 목표, 사용자 시나리오, 성공 지표)
> **개발자 체크리스트**: Task Issue로 위임 (Epic에 포함하지 않음)

## Workflow Overview

```text
[러프 아이디어]
      ↓
Phase 1: Brainstorming (4단계)
  - Step 1: 아이디어 이해
  - Step 2: 접근 방식 탐색
  - Step 3: 플랫폼 전략 결정 ★
  - Step 4: 디자인 합의
      ↓
Phase 2: 기술 검증 (선택)
  - spike 필요 여부 판단
  - explore-approach 연계
      ↓
Phase 3: Epic Issue 직접 생성
  - dev-checklist 검증
  - Epic Issue 생성
      ↓
[Speckit으로 진행] → skill:generate-spec
```

## Phase 1: Brainstorming

### Step 1: 아이디어 이해

**단일 질문 원칙**으로 핵심 파악:

```markdown
💡 한 가지만 여쭤볼게요:
이 기능으로 사용자가 어떤 문제를 해결하게 되나요?
```

**집중 영역**:

| 영역 | 질문 |
|------|------|
| Purpose | 왜 이 기능이 필요한가? |
| Constraints | 어떤 제한이 있는가? |
| Success | 어떻게 성공을 측정하는가? |

### Step 2: 접근 방식 탐색

2-3가지 옵션을 **객관식**으로 제시:

```markdown
🔍 접근 방식 옵션

**A) 최소 구현 (MVP)**
- 장점: 빠른 검증, 낮은 리스크
- 단점: 기능 제한
- 추천: 아이디어 검증 필요 시

**B) 표준 구현** (권장)
- 장점: 균형잡힌 기능성
- 단점: 중간 복잡도
- 추천: 명확한 요구사항 존재 시

**C) 확장 구현**
- 장점: 완전한 기능 세트
- 단점: 높은 복잡도
- 추천: 장기 로드맵 확정 시

어떤 방향으로 진행할까요? (A/B/C)
```

### Step 3: 플랫폼 전략 결정 ★

타겟 플랫폼에 따라 **기술 스택과 배포 전략**이 결정됩니다:

```markdown
📱 어떤 플랫폼을 지원할 예정인가요?

**A) 데스크탑 웹 전용**
- 가장 단순, 빠른 출시
- 모바일 미지원
- 스택: Next.js + Vercel

**B) 반응형 웹 (PWA)** ← 권장
- 데스크탑 + 모바일 반응형
- 홈 화면 설치, 오프라인 지원
- 스택: Next.js + PWA + Vercel

**C) 웹 + 네이티브 앱**
- 웹: Next.js / 앱: Expo (React Native)
- 앱스토어 배포 필요
- 스택: Next.js + Expo + Vercel + EAS

**D) 네이티브 앱 전용**
- iOS/Android 앱만 (웹 미지원)
- 스택: Expo + EAS Build

어떤 플랫폼으로 진행할까요? (A/B/C/D)
```

**플랫폼별 기술 스택 매핑**:

| 선택 | Frontend | Backend | 배포 | 추가 설정 |
|------|----------|---------|------|----------|
| A) 웹 전용 | Next.js 14+ | Supabase | Vercel | - |
| B) PWA | Next.js 14+ | Supabase | Vercel | next-pwa, manifest.json |
| C) 웹+앱 | Next.js + Expo | Supabase | Vercel + EAS | 공유 타입/로직 패키지 |
| D) 앱 전용 | Expo | Supabase | EAS Build | - |

**PWA vs 네이티브 트레이드오프**:

| 기능 | PWA | 네이티브 (Expo) |
|------|-----|-----------------|
| 푸시 알림 | iOS 제한적 | 완전 지원 |
| 카메라 커스텀 | 제한적 | 완전 지원 |
| 오프라인 | Service Worker | 완전 지원 |
| 앱스토어 배포 | 불필요 | 필요 (심사 대기) |
| 설치 허들 | 낮음 | 높음 |
| 업데이트 | 즉시 | 스토어 심사 필요 |

> **💡 추천**: 대부분의 B2C 서비스는 **B) PWA**로 시작 후, 사용자 피드백에 따라 네이티브 확장

### Step 4: 디자인 합의

> **📌 Design Brief는 별도 파일로 저장하지 않고, Epic 본문에 직접 포함됩니다.**

Brainstorming 결과를 바탕으로 다음 정보를 수집:

| 섹션 | 수집 내용 |
|------|----------|
| Problem Statement | 현재 상황, 문제점, 영향 |
| Goals | Primary/Secondary 목표, Non-goals |
| User Scenarios | 사용자 행동 → 시스템 응답 → 결과 |
| Constraints | 기술적/비즈니스/사용자 제약 |
| Success Metrics | 측정 가능한 지표 |

## Phase 2: 기술 검증 (선택)

### spike 필요 여부 판단

**자동 감지 패턴**:

| 패턴 | 예시 |
|------|------|
| 가능성 불확실 | "이게 가능한지 모르겠어" |
| 성능 우려 | "성능이 괜찮을지..." |
| 라이브러리 선택 | "어떤 라이브러리가 좋을지" |
| 복수 옵션 | 구현 방식 간 선택 기준 부재 |

**spike 필요 시**: skill:explore-approach 호출 제안

## Phase 3: Epic Issue 직접 생성

### dev-checklist 검증 (Task 위임용)

개발자 관점 체크리스트를 검증하고 결과를 내부적으로 기록:

| 카테고리 | 검증 항목 |
|----------|----------|
| 데이터 흐름 | 충돌 해결 정책, 멀티플랫폼 동기화, 삭제 정책 |
| 시간/계산 | 집계 기준, 일할 계산, 타임존 |
| 플랫폼 제약 | PWA/웹/네이티브 제약 및 대안 |
| 도메인 지식 | 업계 표준, 엣지 케이스 |

### Epic 본문 생성

Design Brief 내용이 Epic 본문에 직접 포함됩니다.

## Related Skills

- explore-approach - 기술 불확실성 탐색 (spike)
- create-epic - Epic 생성 헬퍼 (GitHub API 로직)
- generate-spec - Speckit 통합 워크플로우',
  version = '2.1.0',
  updated_at = now()
WHERE name = 'ideate';

-- 결과 확인
SELECT name, version, substring(content, 1, 200) as content_preview
FROM semo.skills
WHERE name = 'ideate';

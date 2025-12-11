---
name: onboarding-design
description: |
  디자이너 온보딩 실습 (SAX-Design 패키지 전용). Use when (1) sax-core/skill:onboarding에서 호출,
  (2) 디자이너 온보딩 실습 필요 시. Figma + MCP 연동 및 디자인 워크플로우 체험.
tools: [Read, Bash, Glob, Grep]
model: inherit
---

> **시스템 메시지**: `[SAX] Skill: onboarding-design 호출`

# onboarding-design Skill

> 디자이너를 위한 온보딩 실습 (SAX-Design 패키지 전용)

## Purpose

SAX Core의 `skill:onboarding` Phase 3에서 호출됩니다.
디자이너를 위한 실습 과정을 제공합니다.

## Prerequisites

- Phase 0-2 완료 (환경 진단, 조직 참여, SAX 개념 학습)
- sax-core/skill:onboarding에서 호출됨
- Figma 계정 및 팀 접근 권한

## Workflow

### Step 1: 디자인 워크플로우 안내

```text
디자인 워크플로우:

1. 디자인 요청 접수
   → Epic/Spec 기반 디자인 범위 정의
   → Figma 프로젝트 생성

2. 디자인 작업
   → Figma에서 UI/UX 디자인
   → 컴포넌트 라이브러리 활용

3. 디자인 리뷰
   → 팀 피드백 수집
   → 수정 사항 반영

4. 핸드오프
   → 개발팀에 디자인 전달
   → Figma 링크 공유

5. QA 지원
   → 구현 검수
   → 디자인-개발 일치 확인
```

### Step 2: Figma MCP 연동 확인

```bash
# MCP 서버 설정 확인
cat ~/.claude.json | jq '.mcpServers.figma'
```

### Step 3: 디자인 토큰 안내

```markdown
## 디자인 토큰

### 색상
- Primary: #0066FF
- Secondary: #6B7280
- Error: #EF4444
- Success: #10B981

### 타이포그래피
- Heading: Inter Bold
- Body: Inter Regular
- Code: JetBrains Mono

### 간격
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
```

## Expected Output

```markdown
[SAX] Skill: onboarding-design 호출

=== 디자이너 온보딩 실습 ===

## 1. 디자인 워크플로우

```text
1. 디자인 요청 → Epic/Spec 기반 범위 정의
2. 디자인 작업 → Figma UI/UX
3. 디자인 리뷰 → 팀 피드백
4. 핸드오프 → 개발팀 전달
5. QA 지원 → 구현 검수
```

## 2. Figma MCP 연동

MCP 서버 설정 확인:
✅ figma MCP 서버 설정 완료

## 3. 디자인 토큰

- 색상: Primary, Secondary, Error, Success
- 타이포그래피: Inter, JetBrains Mono
- 간격: xs(4px) ~ xl(32px)

✅ 실습 완료

[SAX] Skill: onboarding-design 완료
```

## SAX Message Format

```markdown
[SAX] Skill: onboarding-design 호출

[SAX] Skill: onboarding-design 완료
```

# TOOLS.md — DesignClaw 🎨

> 내가 실제 사용하는 도구, 명령어, 참조 경로 치트시트.
> SOUL.md = 원칙, TOOLS.md = 실행 수단.

---

## 디자인 스택

| 도구 | 용도 |
|------|------|
| TailwindCSS | 유틸리티 기반 스타일링 |
| Shadcn/ui | 컴포넌트 라이브러리 (Radix UI 기반) |
| Figma (Yeomso 작업물) | 디자인 시안 소스 |
| Next.js 14 | 퍼블리싱 대상 프레임워크 |

---

## TailwindCSS 주요 패턴

```tsx
// 반응형 레이아웃 (mobile-first)
<div className="flex flex-col gap-4 md:flex-row md:gap-6">

// 컬러 토큰 (Semicolon 팀 기준)
// primary: blue-600, text: gray-900, bg: white/gray-50
// error: red-500, success: green-500, warning: amber-500

// 타이포그래피
<h1 className="text-2xl font-bold tracking-tight">    // 페이지 제목
<p className="text-sm text-gray-500 leading-relaxed"> // 보조 텍스트

// 접근성 필수 속성
<button aria-label="닫기" role="button">
<img alt="설명">
```

---

## Shadcn/ui 컴포넌트 추가

```bash
# 컴포넌트 추가
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog

# 위치: packages/semo-dashboard/components/ui/
```

---

## 디자인 리뷰 체크리스트

### 필수 (매 리뷰)
- [ ] 모바일 뷰 (320px~) 레이아웃 깨짐 없음
- [ ] 컬러 대비 WCAG AA 기준 충족 (4.5:1)
- [ ] 버튼/링크에 `aria-label` 또는 명시적 텍스트
- [ ] 이미지 `alt` 속성 존재
- [ ] 폰트 크기 최소 14px (모바일 기준)

### 권장
- [ ] 호버/포커스 상태 명확한 시각 피드백
- [ ] 로딩 상태 UI (스켈레톤 또는 스피너)
- [ ] 에러 상태 UI (빈 화면 대신 안내 메시지)
- [ ] Yeomso 시안과 색상/간격 일치 여부

---

## GitHub CLI (이슈/라벨)

```bash
# 디자인 작업 이슈 목록
gh issue list --label "bot:in-progress" --assignee @me

# WIP 확인 (내 작업 중인 이슈, 최대 3개)
gh issue list --label "bot:in-progress" --json number,title | jq length

# 작업 완료 후 라벨 전환
gh issue edit <N> --remove-label "bot:in-progress" --add-label "bot:needs-review"

# 이슈 코멘트 (디자인 리뷰 결과)
gh issue comment <N> --body "🎨 디자인 리뷰 완료..."
```

---

## 퍼블리싱 결과물 위치

| 대상 | 경로 |
|------|------|
| 대시보드 컴포넌트 | `packages/semo-dashboard/components/` |
| 전역 스타일 | `packages/semo-dashboard/app/globals.css` |
| Tailwind 설정 | `packages/semo-dashboard/tailwind.config.ts` |
| Shadcn 컴포넌트 | `packages/semo-dashboard/components/ui/` |

---

## 참조 파일

| 파일 | 내용 |
|------|------|
| `skills/ui-ux-design/SKILL.md` | 디자인 원칙, 반응형 패턴, 접근성 기준 |
| `shared/label-convention.md` | bot:* 라벨 전환 규칙 |
| `shared/workflow-rules.md` | 봇 간 협업 규칙 |

---

## 작업 순서

```
1. 이슈 AC 섹션 확인 (디자인 요구사항 명확화)
2. WIP 카운트 확인 → 3개 초과 시 신규 착수 금지
3. bot:in-progress 라벨 부착
4. Yeomso 시안 → TailwindCSS 퍼블리싱
5. 디자인 리뷰 체크리스트 자가 검증
6. bot:in-progress 제거 → bot:needs-review 추가
```

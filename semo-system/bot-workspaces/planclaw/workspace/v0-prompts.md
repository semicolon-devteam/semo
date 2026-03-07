# v0.dev 프롬프트 - 오피스캐시 시스템

v0.dev (https://v0.app)에서 아래 프롬프트를 순서대로 입력하세요.

---

## 프롬프트 1: 오피스캐시 충전 페이지

```
Create a Korean office cash charging page with these requirements:

Layout:
- Mobile-first responsive design
- Clean, modern UI with rounded corners

Components:
1. Balance card (gradient purple background)
   - Label: "보유 오피스캐시"
   - Amount: Large text "250,000 캐시"
   - Info: "1 캐시 = 1원"

2. Charging options grid (4 columns on desktop, 2 on mobile)
   - Options: 50,000원, 100,000원, 200,000원, 500,000원
   - Show both KRW and cash amount
   - Selectable with hover effect
   - Selected state with purple border

3. Custom amount input
   - Placeholder: "직접 입력 (최소 10,000원)"
   - Full width

4. Primary button
   - Text: "충전하기"
   - Purple background (#667eea)
   - Full width

Use Shadcn UI components and Tailwind CSS.
```

---

## 프롬프트 2: 오피스 홍보 등록 페이지

```
Create a Korean office promotion registration page:

Layout:
- Page title: "오피스 홍보하기"
- Subtitle: "랜딩페이지에 내 오피스를 홍보하세요"

Components:
1. Info banner (light blue background)
   - Icon: 💡
   - Title: "홍보 안내"
   - List items:
     • 홍보 비용: 50,000 오피스캐시 (30일)
     • 랜딩페이지 상단에 노출됩니다
     • 만료 3일 전 알림을 보내드립니다
     • 잔액이 충분하면 자동으로 연장됩니다

2. Office selection card (selected state)
   - Office name: "강남 코워킹 스페이스"
   - Address: "서울 강남구 테헤란로 123"
   - "선택됨" badge on the right
   - Purple border when selected

3. Payment summary bar
   - Left: "결제 금액"
   - Right: "50,000 캐시" (large, bold)
   - Gray background

4. Submit button
   - Text: "홍보 시작하기"
   - Purple, full width

Use Shadcn UI Card, Badge, and Button components.
```

---

## 프롬프트 3: 홍보 관리 페이지

```
Create a Korean promotion management page with cards:

Page header:
- Title: "내 홍보 관리"
- Subtitle: "진행 중인 홍보를 관리하세요"

Promotion card 1 (active):
- Office name: "강남 코워킹 스페이스"
- Status badge: "진행중" (green)
- Date range: "2026-03-01 ~ 2026-03-31"
- Days left: "23일 남음" with calendar/clock icons
- Progress bar: 23% filled (purple)
- Action buttons: "연장하기" (primary), "종료하기" (outline)

Promotion card 2 (ending soon):
- Office name: "홍대 공유오피스"
- Status badge: "곧 만료" (yellow/orange)
- Date range: "2026-02-05 ~ 2026-03-07"
- Days left: "2일 남음"
- Progress bar: 93% filled
- Warning banner: "⚠️ 잔액이 부족하여 자동 연장이 불가능합니다"
- Action button: "캐시 충전 후 연장"

Use Shadcn UI Card, Badge, Progress, and Alert components.
Responsive grid layout.
```

---

## 프롬프트 4: 랜딩페이지 홍보 노출

```
Create a Korean landing page section showing promoted offices:

Layout:
- Section title banner with dashed border
  - Label: "🌟 PROMOTED OFFICES"
  - Purple accent color

- Office grid (3 columns desktop, 1 column mobile)

Office card structure:
1. Image placeholder (gradient purple background)
2. "💎 홍보중" tag (gold background) - only for promoted offices
3. Office name (bold)
4. Short description

Cards:
- Card 1 (promoted): "강남 코워킹 스페이스" - "강남역 도보 3분, 쾌적한 업무 환경 제공"
- Card 2 (promoted): "홍대 공유오피스" - "창의적인 공간, 다양한 네트워킹 기회"
- Card 3 (normal): "판교 테크 오피스" - "IT 기업 특화, 최신 시설 완비"

Use Shadcn UI Card with hover effects.
Promoted cards should stand out visually.
```

---

## 사용 방법

1. https://v0.app 접속
2. 각 프롬프트를 순서대로 입력
3. 생성된 컴포넌트 코드를 복사
4. 필요시 커스터마이징 (색상, 텍스트 등)
5. 스크린샷을 캡처하여 기획서에 첨부

## 참고사항

- v0.dev는 React + Shadcn UI + Tailwind CSS 기반
- 생성된 코드는 바로 프로젝트에 사용 가능
- 각 컴포넌트는 독립적으로 생성되므로 순서 무관
- 프롬프트 수정으로 디테일 조정 가능

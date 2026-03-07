# 포인트 환전소 UI 디자인 스펙 (ms-point-exchanger)

> 작성: DesignClaw | 2026-02-18 | 기준: PlanClaw 기획서 요약

---

## 서비스별 테마 토큰

| 서비스 | primary | accent | badge |
|---|---|---|---|
| 게임랜드 | `indigo-600` | `blue-400` | 🎮 |
| 플레이랜드 | `purple-600` | `violet-400` | 🎡 |
| 오피스랜드 | `gray-400` (disabled) | `gray-300` | 🏢 |

```ts
// theme.ts (각 서비스 프로젝트에서 주입)
export const serviceTheme = {
  gameland: { primary: 'indigo-600', accent: 'blue-400' },
  playland: { primary: 'purple-600', accent: 'violet-400' },
  officeland: { primary: 'gray-400', accent: 'gray-300', disabled: true },
}
```

---

## 공통 컴포넌트 구조

```
ExchangeWidget (공통 wrapper)
  props: service, disabled?, comingSoon?
  ├── 환전 신청 탭 → ExchangeForm
  └── 환전 내역 탭 → ExchangeHistory
```

---

## 화면 1: 환전 신청 화면 (ExchangeForm)

### 레이아웃 (모바일 퍼스트, max-w-md 기준)

```
┌─────────────────────────────────┐
│  [ServiceBadge A] → [ServiceBadge B]   ← ServiceSelector  │
│           (swap button ⇄)              │
├─────────────────────────────────┤
│  현재 보유: 1,234 P            ← BalanceDisplay     │
├─────────────────────────────────┤
│  환전 수량 입력                ← AmountInput        │
│  [ ___________P ]                       │
├─────────────────────────────────┤
│  수령 예정 포인트              ← ExchangePreview    │
│  ≈ 1,234 P (게임랜드 기준)              │
├─────────────────────────────────┤
│  [ 환전 신청하기 ]             ← SubmitButton       │
└─────────────────────────────────┘
```

### 컴포넌트 상세

#### ServiceSelector
- 두 서비스 배지 사이 `⇄` 버튼으로 방향 전환
- 각 배지: 서비스 아이콘 + 이름 + 테마 색
- 방향 전환 시 잔액 표시도 갱신

#### BalanceDisplay
- API 로딩 중: skeleton UI
- 실패 시: "잔액 조회 실패" + 재시도 버튼

#### AmountInput
- `type="number"` + `min="1"` + 정수만 허용
- 잔액 초과 시: 인라인 에러 ("보유 포인트를 초과했습니다")
- 0 또는 음수 입력 방지

#### ExchangePreview
- 환율 계산: `입력값 × 환율 = 수령 예정`
- 기본 1:1, 소수점 없이 표시
- 작은 텍스트로 환율 명시 (예: "환율: 1:1")

#### SubmitButton
- 기본: `bg-{primary}` 버튼
- 입력 유효성 실패 시: `disabled` + `opacity-50`
- 제출 중: 스피너 + "처리 중..." 텍스트

#### 실패 UX
- Toast (상단 또는 하단, 서비스 UX 컨벤션 따름)
- 에러 메시지: "환전에 실패했습니다. 다시 시도해주세요."
- 성공 UX: "환전 신청이 완료되었습니다! 🎉" + 내역 탭으로 이동

---

## 화면 2: 환전 내역 조회 화면 (ExchangeHistory)

### 레이아웃

```
┌─────────────────────────────────┐
│  환전 내역                                     │
├─────────────────────────────────┤
│  2026-02-18 14:30     게임랜드 → 플레이랜드    │
│  -500 P               +500 P                   │
├─────────────────────────────────┤
│  2026-02-17 09:12     플레이랜드 → 게임랜드    │
│  -200 P               +200 P                   │
└─────────────────────────────────┘
```

### 컴포넌트 상세

#### HistoryItem
```
[날짜/시간]           [방향: ServiceBadge → ServiceBadge]
[-N P (차감, red)]    [+N P (지급, green)]
```
- 차감: `text-red-500` / 지급: `text-green-500`
- 방향 배지: 양쪽 서비스 색상 그라디언트 또는 각 테마 색 배지

#### 빈 상태
- 일러스트 + "아직 환전 내역이 없어요" 문구
- CTA: "첫 환전 하러 가기 →"

#### 페이지네이션
- MVP: 단순 스크롤 or 더보기 버튼 (무한 스크롤 X, 과부하 방지)

---

## 화면 3: 계정 미연동 안내 화면 (UnlinkedAccountScreen)

### 레이아웃

```
┌─────────────────────────────────┐
│         [🔗 일러스트/아이콘]           │
│                                 │
│    계정 연동이 필요합니다        │
│  환전 서비스 이용을 위해         │
│  계정 연동을 먼저 진행해주세요.  │
│                                 │
│  [ 계정 연동하러 가기 → ]        │
└─────────────────────────────────┘
```

- 중앙 정렬, 아이콘 + 타이틀 + 설명 + CTA 버튼
- CTA: 계정 연동 페이지로 라우팅

---

## 오피스랜드 Coming Soon 처리

```tsx
// ExchangeWidget에서 처리
{comingSoon && (
  <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl z-10">
    <div className="text-center">
      <span className="inline-block bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1 rounded-full mb-2">
        Coming Soon
      </span>
      <p className="text-sm text-gray-500">오피스랜드 포인트 기능 준비 중</p>
    </div>
  </div>
)}
<div className={comingSoon ? 'pointer-events-none opacity-40' : ''}>
  {/* 실제 컴포넌트 */}
</div>
```

---

## 반응형 전략

- 모바일 퍼스트 (`max-w-md mx-auto`)
- 태블릿/데스크탑: 카드 형태 중앙 배치 (`max-w-lg` or `max-w-xl`)
- 웹뷰 기반 앱이면 그대로 적용 가능
- React Native 앱이면 별도 스펙 필요 (확인 필요)

---

## 개방 질문 (WorkClaw 인계 전 확인 필요)

- [ ] 게임랜드/플레이랜드 기존 포인트 UI 컴포넌트 존재 여부
- [ ] Toast 라이브러리 (react-hot-toast? shadcn toast?)
- [ ] 앱/웹뷰 여부 (모바일 대응 방식 결정)
- [ ] 방향 선택 시 기본값 (현재 서비스 → 타 서비스 auto-select?)

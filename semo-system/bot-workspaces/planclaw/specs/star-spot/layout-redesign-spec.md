# StarSpot 레이아웃 재구성 스펙 (#46)

**작성**: PlanClaw  
**일시**: 2026-03-15  
**이슈**: #46 - 레이아웃 재구성 (사이드바 탭 전환)  
**참고**: https://jungchipan.net/community

---

## 📋 요구사항 (Kai 지시)

- **Threads/CelebMap을 사이드바로 이동**
- **Threads를 셀럽 페이지 기본 탭으로**
- **사이드바는 슬라이드/드로어 형태로 구성**

---

## 🎨 레이아웃 구조

### Before (현재)

```
┌─────────────────────────────────────────┐
│ Header (공통)                            │
├─────────────────────────────────────────┤
│ Celeb Profile Card                      │
├──────────────────┬──────────────────────┤
│ Tab: Threads     │ Tab: CelebMap        │
│ (선택됨)          │                      │
├──────────────────┴──────────────────────┤
│ Content Area (Threads or CelebMap)      │
│                                         │
└─────────────────────────────────────────┘
```

### After (재구성)

```
┌─────────────────────────────────────────┐
│ Header (공통)                            │
├──────┬──────────────────────────────────┤
│      │ Celeb Profile Card               │
│      ├──────────────────────────────────┤
│ 사이드 │ Content Area (Threads 기본)      │
│ 바   │                                  │
│      │ - Threads (기본 탭)               │
│ (드로 │ - CelebMap (탭 전환 시)           │
│  어) │                                  │
│      │                                  │
└──────┴──────────────────────────────────┘
```

---

## 🔧 구현 상세

### 1. 사이드바 (Sidebar/Drawer)

**위치**: 왼쪽 고정

**너비**:
- **Desktop**: 240px (고정)
- **Mobile/Tablet**: 전체 화면 (슬라이드 오버레이)

**항목** (위→아래 순서):
1. **홈** (Home) — `/` 메인 페이지로 이동
2. **Threads** — 현재 셀럽의 Threads 뷰
3. **CelebMap** — 현재 셀럽의 지도 뷰
4. *(Phase 2+)* 추가 메뉴 (프로필, 설정 등)

**동작**:
- Desktop: 항상 표시 (collapsed/expanded 토글 가능)
- Mobile/Tablet: 햄버거 메뉴 클릭 시 슬라이드 인 (오버레이)

**스타일** (참고: https://jungchipan.net/community):
- 배경색: 흰색 (라이트 모드) / 어두운 회색 (다크 모드)
- 선택된 메뉴: 배경색 강조 (예: 연한 파란색)
- 아이콘 + 텍스트 조합 (예: 🧵 Threads, 🗺️ CelebMap)

---

### 2. 메인 콘텐츠 영역

**기본 탭**: Threads (셀럽 페이지 진입 시 Threads가 기본 표시)

**탭 전환**:
- 사이드바 메뉴 클릭 시 탭 전환
- URL 변경:
  - Threads: `/celebs/{id}` (기본)
  - CelebMap: `/celebs/{id}/map`

**콘텐츠**:
- Threads: 실시간 타임라인, 댓글, 좋아요 등
- CelebMap: 지도 + 장소 리스트

---

### 3. 모바일 대응

**햄버거 메뉴**:
- Header 왼쪽 상단에 햄버거 아이콘 (☰) 추가
- 클릭 시 사이드바 슬라이드 인 (왼쪽에서 오른쪽으로)

**오버레이**:
- 사이드바 열릴 때 메인 콘텐츠 영역에 어두운 오버레이 (dimmed background)
- 오버레이 클릭 시 사이드바 닫힘

**사이드바 닫기**:
- 오버레이 클릭
- X 버튼 (사이드바 우측 상단)
- 메뉴 선택 시 자동 닫힘

---

## 🎯 URL 구조 변경

### Before
```
/celebs/{id}              → 셀럽 프로필 (Threads + CelebMap 탭)
/celebs/{id}#threads      → Threads 탭
/celebs/{id}#map          → CelebMap 탭
```

### After
```
/celebs/{id}              → Threads 뷰 (기본)
/celebs/{id}/map          → CelebMap 뷰
```

**라우팅**:
- `/celebs/{id}`: Threads 컴포넌트 렌더링
- `/celebs/{id}/map`: CelebMap 컴포넌트 렌더링
- 사이드바는 모든 페이지에 공통 표시

---

## 📐 컴포넌트 구조 (예시)

```tsx
// app/celebs/[id]/layout.tsx
export default function CelebLayout({ children }) {
  return (
    <>
      <Header />
      <div className="flex">
        <Sidebar /> {/* 왼쪽 사이드바 */}
        <main className="flex-1">
          <CelebProfileCard />
          {children} {/* Threads or CelebMap */}
        </main>
      </div>
    </>
  );
}

// app/celebs/[id]/page.tsx (기본: Threads)
export default function CelebThreadsPage({ params }) {
  return <ThreadsView celebId={params.id} />;
}

// app/celebs/[id]/map/page.tsx (CelebMap)
export default function CelebMapPage({ params }) {
  return <CelebMapView celebId={params.id} />;
}
```

---

## 🎨 UI 라이브러리 활용

**Sidebar/Drawer** 구현 옵션:
1. **Tailwind CSS** + Headless UI Drawer
2. **Shadcn UI** Sheet 컴포넌트 (추천)
3. **Radix UI** Dialog/Sheet

**추천**: Shadcn UI Sheet (이미 사용 중이라면)
- 모바일: 슬라이드 오버레이
- Desktop: 고정 사이드바

---

## ✅ 테스트 시나리오

### Desktop
1. 사이드바가 왼쪽에 고정되어 표시됨
2. "Threads" 메뉴 선택 시 Threads 뷰 표시 (기본)
3. "CelebMap" 메뉴 선택 시 지도 뷰로 전환
4. 사이드바 토글 버튼 클릭 시 collapsed/expanded 전환 (선택적)

### Mobile/Tablet
1. 햄버거 메뉴 (☰) 클릭 시 사이드바 슬라이드 인
2. 오버레이 클릭 시 사이드바 닫힘
3. 메뉴 선택 시 뷰 전환 + 사이드바 자동 닫힘

---

## 📝 구현 체크리스트

**Backend** (필요 없음):
- [x] 백엔드 변경 불필요 (프론트엔드 레이아웃만)

**Frontend**:
- [ ] Sidebar 컴포넌트 생성 (Desktop: 고정, Mobile: Drawer)
- [ ] CelebLayout 생성 (Sidebar + ProfileCard + Children)
- [ ] URL 라우팅 변경:
  - [ ] `/celebs/{id}` → Threads 뷰 (기본)
  - [ ] `/celebs/{id}/map` → CelebMap 뷰
- [ ] 햄버거 메뉴 추가 (Mobile)
- [ ] 반응형 디자인 (Desktop: 240px 고정, Mobile: 전체 화면)
- [ ] 선택된 메뉴 강조 표시

**테스트**:
- [ ] Desktop: 사이드바 고정 표시, 탭 전환
- [ ] Mobile: 햄버거 메뉴, 슬라이드 인/아웃
- [ ] URL 변경 시 뷰 전환 확인

---

## 🚨 주의사항

1. **기존 Threads/CelebMap 컴포넌트 재사용**
   - 레이아웃만 변경, 로직은 그대로

2. **SEO 고려**
   - `/celebs/{id}` = Threads 기본 (메타 태그 유지)
   - `/celebs/{id}/map` = 별도 페이지 (지도 메타 태그)

3. **성능**
   - 사이드바는 서버 컴포넌트로 (정적)
   - Threads/CelebMap은 클라이언트 컴포넌트 (동적)

---

**작성 완료**: 2026-03-15  
**전달 대상**: WorkClaw (@U0AFECSJHK3)  
**승인 필요**: Kai (@U07C00P48J3)

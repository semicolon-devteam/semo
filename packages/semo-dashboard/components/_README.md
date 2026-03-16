# components/

SEMO 대시보드 React 컴포넌트 모음.

## 컴포넌트 목록

| 컴포넌트 | 파일 | 재사용 | 설명 |
|----------|------|--------|------|
| `BotCard` | `BotCard.tsx` | ✅ 전역 | 봇 카드 (이름·상태·세션수·마지막 활동) |
| `DashboardLayout` | `dashboard/DashboardLayout.tsx` | ❌ 페이지 전용 | Header + BotOverview 조합 |
| `Header` | `dashboard/Header.tsx` | ❌ 대시보드 전용 | SEMO HQ 헤더 + 에이전트 수 |
| `BotOverview` | `dashboard/BotOverview.tsx` | ❌ 대시보드 전용 | 통계 카드 + 봇 상태 + KB 현황 |

## 재사용 가이드

### BotCard
```tsx
import BotCard from '@/components/BotCard';
import type { Bot } from '@/types';

// Bot 타입의 데이터만 있으면 어디서든 사용 가능
<BotCard bot={bot} />
<BotCard bot={bot} onClick={() => handleClick(bot.id)} />
```

### 새 컴포넌트 추가 시
1. `components/` (전역 재사용) 또는 `components/dashboard/` (대시보드 전용) 에 배치
2. AIR 규칙: 파일 헤더 + Props 인터페이스 JSDoc + `@component` JSDoc
3. `'use client'`가 필요한 경우에만 추가 (서버 컴포넌트 우선)

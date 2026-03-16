# types/

SEMO 대시보드 공통 TypeScript 타입 정의. API 응답과 컴포넌트가 공유하는 인터페이스.

## 타입 구조

```
types/index.ts
├── Bot              - 봇 기본 정보 (목록/카드용)
├── BotDetail        - 봇 상세 (config·files·memory·activity)
├── BotFile          - 워크스페이스 파일/디렉토리 항목
├── DailyLog         - 일일 로그 항목
├── Session          - OpenClaw 대화 세션
├── CronJob          - OpenClaw 예약 작업
├── KBItem           - Knowledge Base 항목 (types/index.ts 버전, @/types 기준)
├── KBSearchResult   - KB 검색 결과 (similarity 필수)
└── KBEntry          - KB DB 스키마 항목 (레거시)
```

## 주의: KBItem 이중 정의

프로젝트에는 `KBItem` 인터페이스가 두 곳에 정의되어 있다:

| 위치 | 필드 | 용도 |
|------|------|------|
| `@/types` (`types/index.ts`) | `domain, key, value, ownerBot, createdAt, updatedAt` | 공용 타입 |
| `lib/kb.ts` | `kb_id, domain, key, content, metadata, created_by, updated_at` | DB 행 직접 매핑 |

API Routes는 `lib/kb.ts KBItem`을 반환하고, `@/types KBItem`은 온톨로지/시맨틱 모델용이다.
컴포넌트에서 KB API 응답을 다룰 때는 `lib/kb.ts`의 형태를 로컬 인터페이스로 정의한다.

## 타입 확장 방법

```typescript
// Bot 타입 확장 예시 (syncedAt 추가)
interface BotInfo extends Bot {
  syncedAt: string;
}

// 새 공용 타입 추가 시 types/index.ts에 인터페이스 + JSDoc 작성
```

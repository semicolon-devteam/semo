# PR #25 Review — [Feature] Threads (실시간 대화) #8

## 전체 평가
✅ **P0 기능 구현 완료** — Supabase 스키마, API, UI 모두 잘 작성됨
⚠️ **MUST FIX 2건** — Realtime 구독 stale closure 이슈

---

## 🔴 MUST FIX

### 1. ThreadTimeline.tsx: stale closure — `threads` dependency 누락
**위치**: `src/components/threads/ThreadTimeline.tsx:19-76`

**문제**:
- `useEffect`의 `INSERT` 이벤트 핸들러에서 `threads.find((t) => t.id === newThread.id)`로 중복 체크
- dependency array에 `threads`가 없어서 **초기 빈 배열만 계속 참조** (stale closure)
- 결과: 새 스레드가 중복으로 추가될 수 있음

**수정 제안**:
```tsx
// Before
useEffect(() => {
  // ... Realtime 구독
  async (payload) => {
    const res = await fetch(`/api/celebs/${celebId}/threads`);
    if (res.ok) {
      const data = await res.json();
      const newThread = data.find((t: ThreadWithProfile) => t.id === payload.new.id);
      if (newThread && !threads.find((t) => t.id === newThread.id)) {  // ❌ stale closure
        setThreads((prev) => [newThread, ...prev]);
      }
    }
  }
  // ...
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [celebId]);

// After
useEffect(() => {
  // ... Realtime 구독
  async (payload) => {
    const res = await fetch(`/api/celebs/${celebId}/threads`);
    if (res.ok) {
      const data = await res.json();
      const newThread = data.find((t: ThreadWithProfile) => t.id === payload.new.id);
      if (newThread) {
        setThreads((prev) => {
          // ✅ prev를 사용해서 중복 체크
          if (prev.find((t) => t.id === newThread.id)) return prev;
          return [newThread, ...prev];
        });
      }
    }
  }
  // ...
}, [celebId]);  // threads dependency 추가 불필요 (prev 패턴 사용)
```

---

### 2. CommentList.tsx: stale closure + 카운트 오차 — `comments` dependency 누락
**위치**: `src/components/threads/CommentList.tsx:82-96`

**문제**:
- `handleCommentCreated`에서 `onCommentCountChanged(comments.length + 1)` 사용
- `comments`가 클로저로 캡처되어 **항상 초기값만 참조** (stale closure)
- 결과: 댓글 카운트가 항상 `1`로 표시될 수 있음

**수정 제안**:
```tsx
// Before
function handleCommentCreated(newComment: ThreadCommentWithProfile) {
  if (newComment.parent_comment_id) {
    setComments((prev) =>
      prev.map((c) =>
        c.id === newComment.parent_comment_id
          ? { ...c, replies: [...(c.replies || []), newComment] }
          : c
      )
    );
  } else {
    setComments((prev) => [...prev, newComment]);
  }
  onCommentCountChanged(comments.length + 1);  // ❌ stale closure
}

// After
function handleCommentCreated(newComment: ThreadCommentWithProfile) {
  setComments((prev) => {
    let updated;
    if (newComment.parent_comment_id) {
      updated = prev.map((c) =>
        c.id === newComment.parent_comment_id
          ? { ...c, replies: [...(c.replies || []), newComment] }
          : c
      );
    } else {
      updated = [...prev, newComment];
    }
    
    // ✅ 업데이트된 상태 길이로 카운트 계산
    onCommentCountChanged(updated.length);
    return updated;
  });
}
```

---

## 🟡 SHOULD FIX

### 3. XSS 방어 — content sanitize 권장
**위치**: 
- `src/app/api/celebs/[celebId]/threads/route.ts:97` (POST)
- `src/app/api/threads/[threadId]/comments/route.ts:111` (POST)

**문제**:
- `content` 입력값을 그대로 DB에 저장
- `<script>` 태그 등 악의적 스크립트 삽입 가능
- 현재는 React가 자동 escape하므로 실제 XSS는 안 일어나지만, **명시적 방어가 더 안전**

**수정 제안**:
```bash
npm install sanitize-html
```

```tsx
import sanitizeHtml from 'sanitize-html';

// ...
const body = await request.json();
const { content, image_urls } = body;

// Sanitize content
const sanitizedContent = sanitizeHtml(content, {
  allowedTags: [],  // 모든 HTML 태그 제거
  allowedAttributes: {},
});

// Validation
if (!sanitizedContent || sanitizedContent.length < 1 || sanitizedContent.length > 1000) {
  return NextResponse.json(
    { error: "Content must be between 1 and 1000 characters" },
    { status: 400 }
  );
}

// Insert thread
const { data: thread, error: insertError } = await supabase
  .from("threads")
  .insert({
    celeb_id: celebId,
    user_id: user.id,
    content: sanitizedContent,  // ✅ sanitized content 사용
    image_urls: image_urls || [],
  })
  // ...
```

---

## 🟢 CONSIDER (향후 개선)

### 4. Supabase 트리거: race condition 가능성
**위치**: `supabase/migrations/20260309_create_threads.sql:120-159`

**문제**:
- `like_count`, `comment_count` 트리거 함수에서 `UPDATE SET count = count + 1` 사용
- PostgreSQL의 기본 트랜잭션 격리 수준(READ COMMITTED)에서 동시 업데이트 시 카운트 오차 발생 가능

**현재 상태**: 소규모 앱에서는 큰 문제 아님. Production scale에서 재고려

**향후 개선안**:
- SELECT COUNT(*) 서브쿼리 사용
- 또는 애플리케이션 레벨에서 캐싱 후 정기 동기화

---

### 5. N+1 쿼리 최적화
**위치**: 
- `src/app/api/celebs/[celebId]/threads/route.ts:29-60`
- `src/app/api/threads/[threadId]/comments/route.ts:29-60`

**문제**:
- 1차 쿼리: threads/comments 조회
- 2차 쿼리: thread_likes 조회 (N+1)

**현재 상태**: limit 50이고 초기 단계라서 큰 문제 아님

**향후 개선안**:
- Supabase nested select 또는 JOIN 활용
- 또는 좋아요 정보를 별도 캐시로 관리

---

## ✅ PRAISE

1. **2레벨 nesting 제한 검증** (`comments/route.ts:121-131`) — 무한 중첩 방지 👍
2. **Realtime cleanup** — 메모리 누수 방지 (`removeChannel`) 잘 구현됨
3. **트리 구조 변환 로직** (`comments/route.ts:50-73`) — 깔끔하고 효율적
4. **RLS 정책** — Public read, Authenticated write 적절함

---

## 리뷰 완료 액션
- [x] 전체 파일 컨텍스트 확인 (diff + 전체 파일 읽기)
- [x] 보안/성능/에러 핸들링 체크
- [x] Realtime 구독 메모리 누수 체크
- [ ] ~~컴파일 체크 (`npm run build`)~~ — 로컬 빌드는 PR 작성자가 수행
- [ ] **MUST FIX 2건 수정 필요** → request-changes

---

## 최종 판정
**🟡 Request Changes** — MUST FIX 2건 수정 후 재리뷰 요청

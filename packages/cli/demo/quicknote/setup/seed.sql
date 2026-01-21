-- QuickNote Demo Seed Data
-- SEMO Greenfield 워크플로우 시연용 샘플 데이터

-- ============================================================================
-- 샘플 노트 3개
-- ============================================================================

INSERT INTO notes (title, content, created_at, updated_at) VALUES
(
  '프로젝트 킥오프 미팅',
  '# 프로젝트 킥오프

## 참석자
- PM: 김철수
- 개발: 이영희, 박민수
- 디자인: 최유진

## 논의 사항
1. 프로젝트 범위 확정
2. 일정 논의 (3주)
3. 기술 스택 결정

## Action Items
- [ ] PRD 초안 작성 (PM)
- [ ] 와이어프레임 작성 (디자인)
- [ ] 개발환경 세팅 (개발)

## 다음 미팅
- 일시: 다음 주 월요일 10:00
- 안건: PRD 리뷰',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '1 day'
),
(
  'API 설계 노트',
  '# REST API 설계

## 엔드포인트

### Notes
- GET /api/notes - 노트 목록
- GET /api/notes/:id - 노트 상세
- POST /api/notes - 노트 생성
- PUT /api/notes/:id - 노트 수정
- DELETE /api/notes/:id - 노트 삭제

## 응답 형식

```json
{
  "id": "uuid",
  "title": "string",
  "content": "string",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

## 에러 처리
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '12 hours'
),
(
  '오늘 할 일',
  '## Today''s Tasks

- [x] 아침 스탠드업 참석
- [x] 코드 리뷰 (PR #123)
- [ ] 노트 기능 구현
- [ ] 테스트 작성
- [ ] 문서 업데이트

## 메모
점심 후 집중 시간 확보하기
카페인 섭취 줄이기!',
  NOW() - INTERVAL '6 hours',
  NOW()
);

-- ============================================================================
-- 삽입 확인
-- ============================================================================

-- 삽입된 데이터 확인
SELECT id, title, LENGTH(content) as content_length, created_at, updated_at
FROM notes
ORDER BY updated_at DESC;

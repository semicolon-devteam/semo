# Check Process Reference

## 상세 프로세스

### 1. Epic 분석

```bash
# Epic 내용에서 백엔드 작업 키워드 추출
# 예: "채팅방 삭제 기능" → domain: chat, action: delete, entity: room
```

### 2. core-backend 도메인 확인

```bash
# core-backend의 domain/ 디렉토리 확인
gh api repos/semicolon-devteam/core-backend/contents/src/main/kotlin/com/semicolon/corebackend/domain \
  --jq '.[] | select(.type == "dir") | .name'
```

### 3. Service 클래스 검색

해당 도메인이 존재하면:

```bash
# 예: chat 도메인의 Service 파일 목록
gh api repos/semicolon-devteam/core-backend/contents/src/main/kotlin/com/semicolon/corebackend/domain/chat/service \
  --jq '.[] | select(.name | endswith(".kt")) | .name'

# Service 파일 내용 확인
gh api repos/semicolon-devteam/core-backend/contents/src/main/kotlin/com/semicolon/corebackend/domain/chat/service/ChatRoomService.kt \
  --jq '.content' | base64 -d
```

### 4. 중복 여부 판단

**중복 조건**:
- 같은 도메인 존재 ✅
- Service에 유사 함수명 존재 ✅ (예: `deleteRoom()`, `removeRoom()`)

**중복 아님 조건**:
- 도메인 없음
- 도메인 있지만 Service에 해당 기능 없음

## Notes

- **검색 대상**: Service 클래스의 public 함수만 확인
- **유사 함수 판단**: 함수명 유사도 분석 (Levenshtein distance < 3)
- **컨텍스트 고려**: Epic의 User Stories와 Service 함수 기능 매칭

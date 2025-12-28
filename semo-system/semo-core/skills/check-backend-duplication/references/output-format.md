# Output Format Reference

## 중복 발견 시

```json
{
  "is_duplicated": true,
  "domain": "chat",
  "service_class": "ChatRoomService",
  "existing_function": "deleteRoom(roomId: Long)",
  "file_path": "src/main/kotlin/com/semicolon/corebackend/domain/chat/service/ChatRoomService.kt",
  "recommendation": "core-backend Task 생성 스킵. Epic에 중복 정보 코멘트 추가"
}
```

## 중복 없음

```json
{
  "is_duplicated": false,
  "domain": "chat",
  "reason": "Service에 해당 기능 미구현",
  "recommendation": "core-backend에 Draft Task 생성 진행"
}
```

## 도메인 없음

```json
{
  "is_duplicated": false,
  "domain": null,
  "reason": "core-backend에 해당 도메인 미존재",
  "recommendation": "core-backend에 Draft Task 생성 진행 (신규 도메인)"
}
```

## Epic 코멘트 예시 (중복 발견 시)

```markdown
### ⚠️ core-backend 중복 확인

**도메인**: chat
**기존 구현**: `ChatRoomService.deleteRoom(roomId: Long)`
**파일**: `src/main/kotlin/com/semicolon/corebackend/domain/chat/service/ChatRoomService.kt`

**권장 사항**:
- core-backend Task는 생성하지 않습니다.
- 프론트엔드에서 기존 API 활용
- 필요 시 API 수정/개선은 별도 Issue로 관리
```

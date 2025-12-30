# 프로젝트별 Slack 채널 동적 조회

> 프로젝트/레포지토리별 Slack 알림 채널을 동적으로 조회합니다.

## 🔴 동적 채널 조회 (기본 방식)

> **하드코딩된 매핑 테이블 대신 Slack API를 통해 채널을 동적으로 조회합니다.**

### 채널 매칭 로직

```text
레포지토리명: {repo}
    ↓
1차 시도: #{repo} (레포명 그대로)
    예: cm-labor-union → #cm-labor-union
    ↓
2차 시도: #_{repo} (언더스코어 접두사)
    예: cm-labor-union → #_cm-labor-union
    ↓
3차 시도: 부분 일치 검색
    예: semo → #_semo-dev (부분 매칭)
    ↓
Fallback: #_협업 (채널 없을 경우)
```

## 🔴 MCP 도구 사용 (권장)

### slack_find_channel - 채널 동적 조회

가장 권장하는 방법입니다. 채널을 찾고 없으면 자동으로 Fallback 채널을 반환합니다.

```typescript
// 채널 찾기 (자동 Fallback 포함)
mcp__semo-integrations__slack_find_channel({
  name: "semo",           // 찾을 채널명
  fallback: "#_협업"      // Fallback 채널 (기본값)
})

// 반환 예시 1: 채널 찾음
// [SEMO] 채널 찾음
// 채널: #_semo
// ID: C123456789
// 상태: 사용 가능

// 반환 예시 2: Fallback 사용
// [SEMO] 채널 'semo' 없음 → Fallback 사용
// 채널: #_협업
// ID: C09KNL91QBZ
// 원래 요청: semo
```

### slack_list_channels - 채널 목록 조회

채널 목록을 조회하거나 검색할 때 사용합니다.

```typescript
// 전체 채널 목록
mcp__semo-integrations__slack_list_channels({
  limit: 100
})

// 키워드 검색
mcp__semo-integrations__slack_list_channels({
  search: "cm-",
  limit: 20
})
```

### slack_send_message - 메시지 전송

```typescript
// 채널에 메시지 전송
mcp__semo-integrations__slack_send_message({
  channel: "#_협업",      // 채널명 또는 ID
  text: "메시지 내용"
})
```

## 권장 워크플로우

```typescript
// 1단계: 채널 찾기
const channelResult = await mcp__semo-integrations__slack_find_channel({
  name: "semo"
});

// 2단계: 결과에서 채널 추출 (항상 유효한 채널 반환)
// - 찾음: #semo 또는 #_semo
// - 못찾음: #_협업 (Fallback)

// 3단계: 메시지 전송
await mcp__semo-integrations__slack_send_message({
  channel: extractedChannel,  // slack_find_channel 결과에서 추출
  text: "알림 메시지"
});
```

## 기본 채널

```yaml
default_channel: "#_협업"
default_channel_id: "C09KNL91QBZ"
```

## 채널 Fallback 규칙

```text
프로젝트 채널 전송 시도
    │
    ├─ slack_find_channel 호출
    │   ├─ #{repo} 시도
    │   │   ├─ 성공 → 해당 채널 반환
    │   │   └─ 실패 → 다음 시도
    │   │
    │   ├─ #_{repo} 시도
    │   │   ├─ 성공 → 해당 채널 반환
    │   │   └─ 실패 → 다음 시도
    │   │
    │   ├─ 부분 일치 시도
    │   │   ├─ 성공 → 해당 채널 반환
    │   │   └─ 실패 → Fallback
    │   │
    │   └─ Fallback 채널 (#_협업) 반환
    │
    └─ 반환된 채널로 slack_send_message 호출
```

## 참고: 알려진 프로젝트 채널

> 아래는 참고용 목록입니다. 실제 전송 시에는 동적 조회를 사용합니다.

| 프로젝트 | 레포지토리 | 예상 채널 | 비고 |
|---------|-----------|----------|------|
| MVP Link Collect | mvp-link-collect | #mvp-link-collect | - |
| CM Land | cm-land | #cm-land | 커뮤니티 랜드 |
| CM Office | cm-office | #cm-office | 커뮤니티 오피스 |
| CM Labor Union | cm-labor-union | #cm-labor-union | 노조 프로젝트 |
| Core Backend | core-backend | #_협업 (Fallback) | 전용 채널 없음 |
| SEMO | semo | #_협업 (Fallback) | 전용 채널 없음 |

## 새 프로젝트 채널 생성 시

1. Slack에서 `#{repo}` 형식으로 채널 생성
2. Slack 앱(SEMO Bot)을 해당 채널에 초대
3. 자동으로 동적 조회됨 (별도 설정 불필요)

## Related

- [Slack 설정](slack-config.md) - Bot Token, 권한
- [팀원 매핑](team-members.md) - GitHub ↔ Slack 사용자 매핑
- [notify-slack Skill](../../semo-skills/notify-slack/SKILL.md)
- [request-test Skill](../skills/request-test/SKILL.md)

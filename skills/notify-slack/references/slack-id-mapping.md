# Slack ID Mapping

> GitHub ID ↔ Slack ID 매핑 테이블
>
> **관리자**: 새 멤버 추가 시 이 파일 업데이트 필요

## 매핑 테이블

| GitHub ID | Slack User ID | 이름 | 역할 | 직책 |
|-----------|---------------|------|------|------|
| Roki-Noh | Roki | 노영록 |  PO | Operation Lead |
| reus-jeon | Reus | 전준영 | PSM | Infra Lead |
| garden92 | Garden | 서정원 | PSM | Front Lead |
| kyago | kyago | 강용준 | BE Dev | BE Lead |
| Brightbong92 | bon | 장현봉 | FE Dev | Part Timer |
| gtod8010 | dwight.k | 강동현 | FE Dev | Part Timer |
| yeomsoyam | Yeomso | 염현준 | Designer | Part Timer |

## Slack User ID 조회 방법

### 방법 1: Slack 프로필에서 확인

1. Slack에서 해당 멤버의 프로필 클릭
2. 더보기(⋮) → "멤버 ID 복사"

### 방법 2: API로 조회

```bash
# 모든 멤버 목록 조회
curl -X GET "https://slack.com/api/users.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" | jq '.members[] | {id, name, real_name}'
```

### 방법 3: 이메일로 조회

```bash
# 이메일로 사용자 조회
curl -X GET "https://slack.com/api/users.lookupByEmail?email=user@example.com" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" | jq '.user.id'
```

## 매핑 추가 절차

1. 새 멤버의 GitHub ID 확인
2. Slack User ID 조회 (위 방법 중 선택)
3. 이 파일의 매핑 테이블에 추가
4. 커밋 및 푸시

## 멘션 형식

Slack 메시지에서 멘션할 때:

```
<@U0XXXXXXX>  # User ID로 멘션
```

## 주의사항

- Slack User ID는 `U`로 시작하는 대문자 영숫자 문자열
- Bot Token에 `users:read` 권한이 있어야 조회 가능
- 매핑이 없는 경우 멘션 없이 GitHub ID만 표시

# Semicolon 팀원 정보

> SEMO 패키지에서 공통으로 참조하는 팀원 정보 (GitHub ↔ Slack 매핑)

## 팀원 매핑 테이블

> 🔴 **Slack ID는 참조용입니다.** 실제 멘션 시에는 반드시 Slack API를 통해 동적으로 조회하세요.
>
> 마지막 동기화: 2025-12-25

| 이름 | GitHub ID | Slack Display Name | Slack ID | 역할 |
|------|-----------|-------------------|----------|------|
| 전준영 | reus-jeon | Reus | URSQYUNQJ | 프론트/리더 |
| 서정원 | garden92 | Garden | URU4UBX9R | 인프라/리더 |
| 고권희 | kokkh | Goni | U09NRR79YCW | QA |
| 강용준 | kyago | kyago | U02G8542V9U | 백엔드/리더 |
| 노영록 | Roki-Noh | Roki | U08P11ZQY04 | PO/리더 |
| 장현봉 | Brightbong92 | bon | U09LF7ZS5GR | 프론트 |
| 강동현 | gtod8010 | dwight.k | U01KNHM6PK3 | 프론트 |
| 염현준 | Yeomsoyam | Yeomso | U01KH8V6ZHP | 디자인/리더 |

## 사용 방법

### GitHub ID → Slack 멘션

```bash
# 1. GitHub ID로 Slack Display Name 조회 (이 문서 참조)
GITHUB_ID="reus-jeon"
# → Slack Display Name: "Reus"

# 2. MCP 도구로 Slack 사용자 ID 조회
mcp__semo-integrations__slack_lookup_user(name: "Reus")

# 3. 멘션 형식으로 변환
MENTION="<@$SLACK_ID>"
```

### 빠른 조회 함수

```javascript
// GitHub ID → Slack Display Name 변환
const GITHUB_TO_SLACK = {
  "reus-jeon": "Reus",
  "garden92": "Garden",
  "kokkh": "Goni",
  "kyago": "kyago",
  "Roki-Noh": "Roki",
  "Brightbong92": "bon",
  "gtod8010": "dwight.k",
  "Yeomsoyam": "Yeomso"
};

function getSlackName(githubId) {
  return GITHUB_TO_SLACK[githubId] || githubId;
}
```

> **🔴 중요**: Slack ID는 하드코딩하지 마세요! 반드시 `slack_lookup_user` MCP 도구를 통해 동적으로 조회해야 합니다.

## 역할별 담당자

| 역할 | 담당자 | GitHub ID | 알림 대상 |
|------|--------|-----------|----------|
| QA | Goni (고권희) | kokkh | 테스트 요청, 버그 리포트 |
| PO | Roki (노영록) | Roki-Noh | Epic 생성, 요구사항 확인 |
| FE Lead | Reus (전준영) | reus-jeon | 프론트엔드 코드 리뷰 |
| BE Lead | kyago (강용준) | kyago | 백엔드 코드 리뷰 |
| Infra Lead | Garden (서정원) | garden92 | 인프라/배포 관련 |
| Design Lead | Yeomso (염현준) | Yeomsoyam | 디자인 리뷰 |

## 팀원 추가/변경 시

1. 이 파일의 매핑 테이블 업데이트
2. semo-core 버저닝 (PATCH)

## Related

- [notify-slack Skill](../../semo-skills/notify-slack/SKILL.md)

# 프로젝트 맵 & GitHub Projects 설정

> 마지막 업데이트: 2026-03-15

---

## GitHub Projects 설정

| 프로젝트 | 번호 | Project ID | 용도 |
|---------|------|------------|------|
| **이슈관리** | **#1** | `PVT_kwDOC01-Rc4AtDz2` | 메인 태스크 관리 (기본값) |
| 사업관리 | #6 | - | 사업 기획 관리 |

### 이슈관리(#1) Status 옵션

| Status | Option ID | 설명 |
|--------|-----------|------|
| 검수대기 | 동적조회 | 기본값 |
| 작업중 | 동적조회 | 개발 진행 중 |
| **리뷰요청** | `9b58620e` | 코드 리뷰 대기 |
| **테스트중** | `13a75176` | QA 단계 |
| 병합됨 | 동적조회 | PR 병합 완료 |
| 버려짐 | 동적조회 | 작업 취소 |

### GitHub Issue Type

| Type | ID | 용도 |
|------|----|------|
| Task | `IT_kwDOC01-Rc4BdOub` | 일반 태스크 |
| Bug | `IT_kwDOC01-Rc4BdOuc` | 버그 리포트 |
| Feature | `IT_kwDOC01-Rc4BdOud` | 기능 요청 |
| Epic | `IT_kwDOC01-Rc4BvVz5` | 에픽 |

---

## 세미콜론 팀 활성 프로젝트

| 프로젝트 | 레포 | Slack 채널 | 담당 봇 |
|---------|------|------------|---------|
| SEMO | semicolon-devteam/semo | - | WorkClaw |
| Land Platform | semicolon-devteam/cm-land | #proj-play-land | WorkClaw |
| BebeCare | semicolon-devteam/bebecare | #proj-bebecare | WorkClaw |
| 정치판 | semicolon-devteam/cm-jungchipan | #cm-jungchipan | WorkClaw |
| core-backend | semicolon-devteam/core-backend | #backend | WorkClaw |

### 환경 URL

| 서비스 | dev | stg | prd |
|--------|-----|-----|-----|
| SEMO Dashboard | - | - | https://semo.semi-colon.space |
| cm-land | https://dev.cm-land.com | https://stg.cm-land.com | https://cm-land.com |

---

## 배포 절차

### DEV 배포
```bash
git checkout dev && git push origin dev  # 자동 배포
```

### STG 배포
1. GitHub Milestone 생성/선택
2. 관련 이슈/PR을 Milestone에 연결
3. Milestone Close → STG 자동 배포

### PRD 배포
1. STG 검증 완료 Milestone 선택
2. `source-tag` 라벨 추가
3. Milestone Close → Git 태그 → PRD 배포

---

## GraphQL 조회 기본 쿼리

```bash
# 이슈관리 프로젝트 (#1) 조회
gh api graphql -f query='
query {
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      id title
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          id
          options { id name }
        }
      }
    }
  }
}'
```

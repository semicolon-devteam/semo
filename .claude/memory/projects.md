# 프로젝트 별칭 매핑

> 외부 프로젝트 배포 시 별칭으로 빠르게 접근
> SEMO의 deployer 스킬이 이 파일을 참조합니다.

---

## GitHub Projects 설정 (필수)

> **⚠️ Management 패키지는 반드시 이 설정을 참조해야 합니다.**
> **⚠️ 프로젝트 조회 시 반드시 `projectV2(number: 1)` 사용!**

### 기본 프로젝트

| 프로젝트 | 번호 | Project ID | 용도 |
|---------|------|------------|------|
| **이슈관리** | **#1** | `PVT_kwDOC01-Rc4AtDz2` | **메인 태스크 관리 (기본값)** |
| 사업관리 | #6 | - | 사업 기획 관리 |

### 이슈관리(#1) Status 옵션

| Status | Option ID | 설명 |
|--------|-----------|------|
| 검수대기 | 동적조회 | Epic 생성 시 기본값 |
| 검수완료 | 동적조회 | 검수 통과 |
| 작업중 | 동적조회 | 개발 진행 중 |
| 확인요청 | 동적조회 | 확인 필요 |
| 수정요청 | 동적조회 | 수정 필요 |
| **리뷰요청** | `9b58620e` | 코드 리뷰 대기 |
| **테스트중** | `13a75176` | QA 테스트 단계 |
| 병합됨 | 동적조회 | PR 병합 완료 |
| 버려짐 | 동적조회 | 작업 취소 |

### 🔴 상태값 Alias (한글 ↔ 영문)

> **SEMO는 아래 키워드를 자동으로 Status 필드값으로 매핑합니다.**

| 사용자 입력 | → Status 값 | 비고 |
|------------|-------------|------|
| 리뷰요청, 리뷰 요청, review | 리뷰요청 | 코드 리뷰 대기 |
| 테스트중, 테스트 중, testing, qa | 테스트중 | QA 단계 |
| 작업중, 작업 중, 진행중, in progress, wip | 작업중 | 개발 중 |
| 완료, done, closed | 병합됨 | 완료 처리 |
| 검수대기, 대기, pending, backlog | 검수대기 | 초기 상태 |
| 검수완료, 검수 완료, approved | 검수완료 | 검수 통과 |
| 확인요청, 확인 요청, needs review | 확인요청 | 확인 필요 |
| 수정요청, 수정 요청, changes requested | 수정요청 | 수정 필요 |
| 버려짐, 취소, cancelled, dropped | 버려짐 | 작업 취소 |

**예시:**
```
"리뷰요청 이슈들 테스트중으로 바꿔줘"
→ Status == "리뷰요청" 인 항목들을 Status = "테스트중" 으로 변경
```

### 필드 ID 참조

| 필드명 | 필드 ID |
|--------|---------|
| Status | 동적조회 필요 |
| 우선순위 | `PVTSSF_lADOC01-Rc4AtDz2zg0YPyI` |
| 작업량 | `PVTF_lADOC01-Rc4AtDz2zg0bhf0` |

### GitHub Issue Type (이슈 유형)

> **Projects 커스텀 필드 '타입' 대신 GitHub Issue Type을 사용합니다.**

| Issue Type | ID | 용도 |
|------------|-----|------|
| Task | `IT_kwDOC01-Rc4BdOub` | 일반 태스크 |
| Bug | `IT_kwDOC01-Rc4BdOuc` | 버그 리포트 |
| Feature | `IT_kwDOC01-Rc4BdOud` | 기능 요청 |
| Epic | `IT_kwDOC01-Rc4BvVz5` | 에픽 |

**Issue Type 설정 방법:**
```bash
# 이슈 node_id 조회
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/semo/issues/{NUMBER} --jq '.node_id')

# Issue Type 설정 (예: Bug)
gh api graphql -f query='
  mutation {
    updateIssue(input: {
      id: "'"$ISSUE_NODE_ID"'"
      issueTypeId: "IT_kwDOC01-Rc4BdOuc"
    }) {
      issue { id title }
    }
  }
'
```

### GraphQL 조회 기본 쿼리

```bash
# 이슈관리 프로젝트 (#1) 조회 - 항상 number: 1 사용
gh api graphql -f query='
query {
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      id
      title
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

---

## 커뮤니티 프로젝트

| 별칭 | 레포지토리 | 환경 | 배포 방법 |
|------|-----------|------|----------|
| 랜드, land, cm-land | semicolon-devteam/cm-land | dev | `dev` 브랜치 push |
| 랜드, land, cm-land | semicolon-devteam/cm-land | stg | Milestone close |
| 랜드, land, cm-land | semicolon-devteam/cm-land | prd | Milestone close + `source-tag` 라벨 |
| 오피스, office, cm-office | semicolon-devteam/cm-office | dev | `dev` 브랜치 push |
| 오피스, office, cm-office | semicolon-devteam/cm-office | stg | Milestone close |
| 오피스, office, cm-office | semicolon-devteam/cm-office | prd | Milestone close + `source-tag` 라벨 |

---

## 환경 정보 (테스트 요청 시 자동 첨부)

> **⚠️ 테스트 요청 시 이 정보가 자동으로 메시지에 첨부됩니다.**

### cm-land (커뮤니티 랜드)

| 환경 | URL | 비고 |
|------|-----|------|
| dev | https://dev.cm-land.com | 개발 테스트 |
| stg | https://stg.cm-land.com | QA 테스트 **(기본값)** |
| prd | https://cm-land.com | 운영 |

### cm-office (커뮤니티 오피스)

| 환경 | URL | 비고 |
|------|-----|------|
| dev | https://dev.cm-office.com | 개발 테스트 |
| stg | https://stg.cm-office.com | QA 테스트 **(기본값)** |
| prd | https://cm-office.com | 운영 |

### 환경 선택 규칙

| Issue Status | 권장 환경 | 이유 |
|--------------|----------|------|
| 리뷰요청 | stg | 코드 리뷰 후 STG 배포 예정 |
| 테스트중 | stg | QA 테스트 진행 |
| 작업중 | dev | 개발 중 확인 |

### 테스트 요청 메시지 템플릿

```
@{tester} [{issue_title}] 테스트 요청드립니다 🙏

📍 테스트 환경: {env}
🔗 URL: {env_url}
📋 이슈: {issue_url}
```

---

## 배포 절차

### DEV 배포
```bash
# dev 브랜치에 push하면 자동 배포
git checkout dev
git merge feature/xxx
git push origin dev
```

### STG 배포
1. GitHub에서 Milestone 생성/선택
2. 관련 이슈/PR을 Milestone에 연결
3. **Milestone Close** → 자동으로 STG 배포

### PRD 배포
1. STG에서 검증 완료된 Milestone 선택
2. Milestone에 `source-tag` 라벨 추가
3. **Milestone Close** → Git 태그 생성 → PRD 배포

---

## 배포 명령 예시

```
"랜드 stg 배포해줘"
→ cm-land 레포의 열린 Milestone 목록 조회
→ 사용자가 Milestone 선택
→ Milestone Close API 호출
→ STG 배포 자동 트리거

"오피스 prd 배포해줘"
→ cm-office 레포의 열린 Milestone 조회
→ source-tag 라벨 추가
→ Milestone Close
→ PRD 배포 트리거
```

---

*마지막 업데이트: 2025-12-16*

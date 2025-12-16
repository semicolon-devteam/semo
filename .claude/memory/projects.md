# 프로젝트 별칭 매핑

> 외부 프로젝트 배포 시 별칭으로 빠르게 접근
> SEMO의 deployer 스킬이 이 파일을 참조합니다.

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

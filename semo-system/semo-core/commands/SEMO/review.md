# /SEMO:review

PR/코드 리뷰를 수행합니다.

## 사용법

```
/SEMO:review              # 현재 브랜치 PR 리뷰
/SEMO:review #123         # 특정 이슈 기반 리뷰
/SEMO:review --pr 456     # 특정 PR 리뷰
```

## 동작

`review` 스킬을 호출하여 코드 리뷰를 수행하고 PR에 리뷰 코멘트를 등록합니다.

## 플랫폼별 리뷰

프로젝트 타입을 자동 감지하여 적절한 플랫폼별 리뷰를 수행합니다:

| 감지 파일 | 플랫폼 | 리뷰 스킬 |
|-----------|--------|----------|
| `next.config.*` | nextjs | eng/nextjs/review |
| `build.gradle.kts` | spring | eng/spring/review |
| `docker-compose.yml` + `/services/` | ms | eng/ms/review |
| `docker-compose.yml` + `nginx` | infra | eng/infra/review |

## 워크플로우

1. **플랫폼 감지**
   - 프로젝트 설정 파일 기반 자동 감지

2. **PR 탐색**
   - 현재 브랜치의 연결된 PR 조회
   - 또는 지정된 이슈/PR 번호로 조회

3. **리뷰 수행**
   - 플랫폼별 검증 Phase 실행
   - 코드 품질, 아키텍처, 테스트 검증

4. **리뷰 등록**
   - `gh pr review` 명령으로 PR에 리뷰 코멘트 등록
   - APPROVE / COMMENT / REQUEST_CHANGES 자동 판정

## 예시

```
User: /SEMO:review

[SEMO] Skill: review 호출

📋 플랫폼 감지: Next.js (next.config.ts 발견)
🔍 PR 탐색: #456 "메타태그 기능 구현"

=== 리뷰 진행 중... ===

## 최종 결과: ✅ APPROVE

PR #456에 리뷰 코멘트를 등록합니다...
✅ 리뷰 등록 완료
```

## 참조 스킬

- `review` - 통합 리뷰 스킬 (semo-skills)

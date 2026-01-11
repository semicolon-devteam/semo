# GitHub 프로젝트 보드 설정 (DEPRECATED)

> **⚠️ DEPRECATED (v2.0.0)**: 이 파일은 더 이상 사용되지 않습니다.
>
> GitHub Projects 기반 Issue/Status 관리가 **Supabase DB 기반**으로 전환되었습니다.

---

## 마이그레이션 안내

### 데이터 소스 변경

| 기능 | v1.x (기존) | v2.0 (신규) |
|------|------------|-------------|
| Issue 관리 | GitHub Issues | Supabase `issues` 테이블 |
| 상태 관리 | GitHub Projects | Supabase `issues.status` 컬럼 |
| 상태 이력 | 없음 | Supabase `issue_status_history` 테이블 |
| Discussion | GitHub Discussions | Supabase `discussions` 테이블 |

### 상태 매핑

| 기존 GitHub 상태 | Supabase status |
|-----------------|-----------------|
| 검수대기 | backlog |
| 검수완료 | todo |
| 작업중 | in_progress |
| 확인요청 | in_progress (별도 플래그) |
| 수정요청 | in_progress (별도 플래그) |
| 리뷰요청 | review |
| 테스트중 | testing |
| 병합됨 | done |
| 버려짐 | closed |

### 영향받는 스킬

다음 스킬들은 이미 Supabase 기반으로 업데이트되었습니다:

- `project-status` - 상태 변경
- `assign-task` - 업무 할당
- `start-task` - 작업 시작
- `task-progress` - 진행도 추적
- `list-bugs` - 버그 조회
- `check-feedback` - 피드백 확인
- `create-feedback-issue` - 피드백 이슈 생성

---

## 레거시 참조 (읽기 전용)

> 기존 시스템과의 호환성을 위해 ID 정보를 유지합니다.
> **새로운 개발에서는 사용하지 마세요.**

### 이슈관리 (Project #1)

| 항목 | 값 |
|------|-----|
| **Owner** | semicolon-devteam |
| **Project Number** | 1 |
| **Project ID** | PVT_kwDOC01-Rc4AtDz2 |
| **Status Field ID** | PVTSSF_lADOC01-Rc4AtDz2zgj4dzs |

### 상태 옵션 ID (레거시)

| 상태 | Option ID |
|------|-----------|
| 검수대기 | b63c7b23 |
| 검수완료 | 9bff347d |
| 작업중 | 47fc9ee4 |
| 확인요청 | 7fea2c68 |
| 수정요청 | bc7e7884 |
| 리뷰요청 | 9b58620e |
| 테스트중 | 13a75176 |
| 병합됨 | 98236657 |
| 버려짐 | ff05bc88 |

---

## References

- [Supabase issues 마이그레이션](../../../semo-repository/supabase/migrations/20260113003_issues_discussions.sql)
- [project-status 스킬](../../semo-skills/project-status/SKILL.md)

# QA Assignee Configuration

> QA 담당자 자동 할당 설정

## 기본 QA 담당자

| 구분 | 담당자 | GitHub ID |
|------|--------|-----------|
| 기본 | 국경훈 | @kokkh |

## 자동 할당 규칙

### 현재 구현

```yaml
# 모든 이슈에 대해 기본 QA 담당자 할당
default_qa: kokkh

# 할당 방식: 기존 담당자 유지 + QA 추가
assignment_mode: add  # (add | replace)
```

### 향후 확장 (미구현)

```yaml
# 레포지토리별 QA 담당자 설정
repository_qa:
  cm-office: kokkh
  core-backend: kokkh
  core-supabase: kokkh

# 라벨별 QA 담당자 설정
label_qa:
  urgent: kokkh  # 긴급 건은 특정 QA에게
  security: senior-qa  # 보안 관련은 시니어 QA에게
```

## 할당 명령어

```bash
# 기존 담당자 유지하면서 QA 추가
gh issue edit {number} --repo semicolon-devteam/{repo} --add-assignee kokkh

# 담당자 교체 (사용 안 함)
# gh issue edit {number} --repo semicolon-devteam/{repo} --assignee kokkh
```

## 중복 할당 방지

GitHub API는 이미 할당된 사용자를 다시 할당해도 에러가 발생하지 않습니다.
따라서 별도의 중복 체크 로직이 필요하지 않습니다.

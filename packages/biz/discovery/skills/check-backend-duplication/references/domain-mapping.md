# Domain Mapping

> Epic 키워드 → core-backend 도메인 매핑 테이블

## 🔴 키워드 기반 기능 매핑 (Issue #14 대응)

> **문제**: 제목 기반 단순 중복 체크만 수행하여 의미론적 중복 감지 불가
>
> **해결**: 키워드 → 도메인 매핑으로 기존 기능 활용 가능성 확인

## Keyword → Domain Mapping Table

| 키워드 그룹 | 관련 도메인 | 기존 기능 | 확인 포인트 |
|------------|------------|----------|-------------|
| 인증, 로그인, 권한, JWT, 토큰 | `user` | User 도메인, JWT 인증 | 인증 시스템 활용 가능 여부 |
| 게시글, 게시판, 포스트 | `boards` | Boards 도메인 | 게시판 기능 활용 가능 여부 |
| 댓글, 대댓글, 코멘트 | `comments` | Comments 도메인 | 댓글 기능 활용 가능 여부 |
| 공지, 알림, 알림함 | `boards`, `notification` | Boards 공지 기능 | 공지 기능 활용 가능 여부 |
| 파일, 업로드, 다운로드, 이미지 | `file` | 파일 업로드 시스템 | 파일 업로드 기능 활용 가능 여부 |
| 회원, 프로필, 사용자 정보 | `user` | User 도메인 | 회원 관리 기능 활용 가능 여부 |
| 검색, 필터, 조회 | (공통) | 각 도메인 조회 API | 기존 검색 API 활용 가능 여부 |

## Domain Details

### user 도메인

```yaml
domain: user
path: src/main/kotlin/com/semicolon/corebackend/domain/user
features:
  - 회원가입/로그인
  - JWT 토큰 발급/갱신
  - 권한 관리 (Role-based)
  - 프로필 조회/수정
related_issues: []
```

### boards 도메인

```yaml
domain: boards
path: src/main/kotlin/com/semicolon/corebackend/domain/boards
features:
  - 게시글 CRUD
  - 카테고리 관리
  - 공지사항
  - 조회수 카운팅
related_issues: []
```

### comments 도메인

```yaml
domain: comments
path: src/main/kotlin/com/semicolon/corebackend/domain/comments
features:
  - 댓글 CRUD
  - 대댓글 (nested)
  - 좋아요/싫어요
related_issues:
  - "#48 - Comments 도메인 구현"
```

### file 도메인

```yaml
domain: file
path: src/main/kotlin/com/semicolon/corebackend/domain/file
features:
  - 파일 업로드 (S3)
  - 이미지 리사이징
  - 다운로드 URL 생성
related_issues: []
```

## 키워드 감지 로직

```bash
# Epic 본문에서 키워드 추출
detect_keywords() {
  local epic_body="$1"
  local keywords=""

  # 인증 관련
  if echo "$epic_body" | grep -iE "(인증|로그인|권한|JWT|토큰|auth)" > /dev/null; then
    keywords="$keywords user"
  fi

  # 게시판 관련
  if echo "$epic_body" | grep -iE "(게시글|게시판|포스트|board)" > /dev/null; then
    keywords="$keywords boards"
  fi

  # 댓글 관련
  if echo "$epic_body" | grep -iE "(댓글|대댓글|코멘트|comment)" > /dev/null; then
    keywords="$keywords comments"
  fi

  # 공지 관련
  if echo "$epic_body" | grep -iE "(공지|알림|notification)" > /dev/null; then
    keywords="$keywords boards notification"
  fi

  # 파일 관련
  if echo "$epic_body" | grep -iE "(파일|업로드|다운로드|이미지|file|upload)" > /dev/null; then
    keywords="$keywords file"
  fi

  echo "$keywords" | tr ' ' '\n' | sort -u | tr '\n' ' '
}
```

## 대화형 확인 프로세스

기존 기능 활용 가능성 발견 시:

```markdown
⚠️ **기존 기능 활용 가능성 발견**

| Epic 기능 | 기존 도메인 | 기존 기능 | 활용 가능 여부 |
|-----------|------------|----------|---------------|
| 인증 | user | JWT 인증 시스템 | 🔍 확인 필요 |
| 게시판 | boards | Boards 도메인 | 🔍 확인 필요 |

**선택해주세요**:
1. **기존 기능 활용** → Backend Task 생성 안함, Frontend만 생성
2. **확장 필요** → 기존 기능 확장 Task로 생성
3. **새로 구현 필요** → 신규 Backend Task 생성
```

## 출력 예시

### 중복/활용 가능 발견 시

```markdown
[SEMO] Skill: check-backend-duplication 호출 - Epic #63

## 🔍 core-backend 중복/활용 가능성 검사

### 감지된 키워드
- 인증, 로그인 → `user` 도메인
- 게시판 → `boards` 도메인

### 기존 기능 분석

| 기능 요청 | 기존 도메인 | 기존 구현 | 권장 |
|-----------|------------|----------|------|
| 인증 및 권한 관리 | user | JWT 인증 시스템 존재 | ⚠️ 기존 활용 검토 |
| 게시판 및 소통 | boards | Boards 도메인 존재 | ⚠️ 기존 활용 검토 |

### 권장 조치

**선택 필요**:
1. 기존 기능으로 충분 → Backend Task 스킵
2. 확장 필요 → 확장 Task 생성
3. 새로 구현 필요 → 신규 Task 생성

어떻게 진행할까요?
```

### 중복 없음 (신규 구현 필요)

```markdown
[SEMO] Skill: check-backend-duplication 호출 - Epic #65

## 🔍 core-backend 중복/활용 가능성 검사

### 감지된 키워드
- 익명 문의 → 해당 도메인 없음

### 검사 결과

✅ **중복 또는 활용 가능한 기존 기능이 없습니다.**

→ 신규 Backend Task 생성을 진행합니다.
```

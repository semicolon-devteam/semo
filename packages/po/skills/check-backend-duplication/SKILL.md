---
name: check-backend-duplication
description: |
  Check for duplicate backend implementation in core-backend. Use when:
  (1) Epic analysis detects backend work (API, server, database keywords),
  (2) draft-task-creator creates backend tasks,
  (3) need to verify if similar functionality exists in core-backend domain services.
  **Issue #14 강화**: 키워드 기반 기능 매핑으로 기존 기능 활용 가능성 확인.
tools: [Bash, Read, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: check-backend-duplication 호출 - {Epic 번호}` 시스템 메시지를 첫 줄에 출력하세요.

# check-backend-duplication Skill

> core-backend 중복 구현 및 **기존 기능 활용 가능성** 체크

## Purpose

Epic에서 백엔드 작업이 감지되었을 때:
1. core-backend에 이미 유사 기능이 구현되어 있는지 확인
2. **🔴 (NEW) 키워드 기반으로 기존 기능 활용 가능성 검사** (Issue #14)

## Triggers

- Epic 내용에 백엔드 작업 키워드 감지
- "API", "서버", "데이터베이스", "RPC", "엔드포인트" 등
- **draft-task-creator에서 필수 호출** (스킵 금지)

## 🔴 Check Scope (Issue #14 강화)

### 1단계: 키워드 → 도메인 매핑

> 📖 **상세 매핑 테이블**: [domain-mapping.md](references/domain-mapping.md)

| 키워드 그룹 | 관련 도메인 | 기존 기능 |
|------------|------------|----------|
| 인증, 로그인, 권한 | `user` | JWT 인증 시스템 |
| 게시글, 게시판 | `boards` | Boards 도메인 |
| 댓글, 대댓글 | `comments` | Comments 도메인 |
| 공지, 알림 | `boards`, `notification` | 공지 기능 |
| 파일, 업로드 | `file` | 파일 업로드 시스템 |

### 2단계: 도메인 + Service 레벨 중복 체크

1. **도메인 레벨**: Epic 분석 → 관련 도메인 파악
2. **Service 레벨**: 해당 도메인의 Service 클래스에서 유사 기능 검색

## Quick Commands

```bash
# core-backend 도메인 목록 확인
gh api repos/semicolon-devteam/core-backend/contents/src/main/kotlin/com/semicolon/corebackend/domain \
  --jq '.[] | select(.type == "dir") | .name'

# Service 클래스 목록
gh api repos/semicolon-devteam/core-backend/contents/src/main/kotlin/com/semicolon/corebackend/domain/{domain}/service \
  --jq '.[] | select(.name | endswith(".kt")) | .name'
```

## 🔴 대화형 확인 프로세스 (Issue #14 NEW)

기존 기능 활용 가능성 발견 시 **사용자에게 선택 요청**:

```markdown
⚠️ **기존 기능 활용 가능성 발견**

| Epic 기능 | 기존 도메인 | 기존 기능 | 상태 |
|-----------|------------|----------|------|
| 인증 | user | JWT 인증 시스템 | 🔍 확인 필요 |

**선택해주세요**:
1. **기존 기능 활용** → Backend Task 생성 안함
2. **확장 필요** → 기존 기능 확장 Task 생성
3. **새로 구현 필요** → 신규 Backend Task 생성
```

## SAX Message

```markdown
[SAX] Skill: check-backend-duplication 호출 - Epic #{number}
[SAX] 키워드 감지: {keywords} → 도메인: {domains}
[SAX] Reference: core-backend/domain/{domain}/service 참조
```

## Related

- [draft-task-creator Agent](../../agents/draft-task-creator.md)
- [Epic Template](../../templates/epic-template.md)

## References

| 문서 | 용도 |
|------|------|
| [domain-mapping.md](references/domain-mapping.md) | 🔴 키워드 → 도메인 매핑 테이블 (NEW) |
| [check-process.md](references/check-process.md) | 상세 프로세스, 검색 로직 |
| [output-format.md](references/output-format.md) | 중복 발견/없음 JSON, Epic 코멘트 예시 |

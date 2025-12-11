# SEMO Integration: GitHub

> GitHub 연동 (Issues, PR, Actions)

**위치**: `semo-integrations/github/`
**Layer**: Layer 2 (External Connections)

---

## 개요

GitHub API 및 `gh` CLI를 활용한 GitHub 연동 기능을 제공합니다.

---

## 하위 모듈

| 모듈 | 역할 | 주요 기능 |
|------|------|----------|
| **issues** | Issue 관리 | 생성, 조회, 업데이트, 라벨링 |
| **pr** | PR 관리 | 생성, 리뷰 요청, 머지 |
| **actions** | GitHub Actions | 워크플로우 트리거, 상태 확인 |

---

## 사용 예시

### Issue 생성

```
사용자: GitHub 이슈 만들어줘

[SEMO] Integration: github/issues 호출

gh issue create --title "..." --body "..."
```

### PR 생성

```
사용자: PR 만들어줘

[SEMO] Integration: github/pr 호출

gh pr create --title "..." --body "..."
```

---

## 필요 도구

| 도구 | 용도 | 설치 |
|------|------|------|
| `gh` | GitHub CLI | `brew install gh` |

---

## 환경 변수

| 변수 | 용도 | 필수 |
|------|------|------|
| `GITHUB_TOKEN` | GitHub API 인증 | ✅ |

---

## 매핑 정보 (SAX → SEMO)

| 기존 패키지 | 기존 스킬 | 새 위치 |
|-------------|----------|---------|
| sax-next | create-issues | github/issues |
| sax-next | git-workflow | github/pr |
| sax-core | feedback (GitHub 부분) | github/issues |

---

## 참조

- [SEMO Principles](../../semo-core/principles/PRINCIPLES.md)
- [GitHub CLI 문서](https://cli.github.com/)

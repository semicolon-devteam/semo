# GitHub Commands

core-interface / core-backend 정보 조회 명령어

## core-interface (API 스펙)

### 최신 릴리즈 정보

```bash
# 최신 릴리즈 태그
gh api repos/semicolon-devteam/core-interface/releases/latest --jq '.tag_name'

# 최신 릴리즈 상세
gh api repos/semicolon-devteam/core-interface/releases/latest
```

### OpenAPI 스펙 다운로드

```bash
# 최신 스펙 다운로드 URL
gh api repos/semicolon-devteam/core-interface/releases/latest \
  --jq '.assets[] | select(.name == "core.backend.spec.json") | .browser_download_url'

# 스펙 직접 다운로드
LATEST=$(gh api repos/semicolon-devteam/core-interface/releases/latest --jq '.tag_name')
curl -sLO "https://github.com/semicolon-devteam/core-interface/releases/download/${LATEST}/core.backend.spec.json"
```

### 특정 버전 스펙

```bash
# 특정 버전 다운로드
VERSION="v2025.12.2"
curl -sLO "https://github.com/semicolon-devteam/core-interface/releases/download/${VERSION}/core.backend.spec.json"
```

### 릴리즈 목록

```bash
# 최근 릴리즈 목록
gh api repos/semicolon-devteam/core-interface/releases --jq '.[].tag_name'

# 최근 5개 릴리즈
gh api repos/semicolon-devteam/core-interface/releases --jq '.[:5] | .[].tag_name'
```

## core-backend (Spring 구현 패턴)

### 에이전트 문서 목록

```bash
# agent_docs 폴더 내용
gh api repos/semicolon-devteam/core-backend/contents/agent_docs --jq '.[].name'
```

### ApiResponse 패턴

```bash
# API 응답 패턴 조회
gh api repos/semicolon-devteam/core-backend/contents/agent_docs/api-patterns.md \
  --jq '.content' | base64 -d
```

### Exception 패턴

```bash
# 예외 처리 패턴 조회
gh api repos/semicolon-devteam/core-backend/contents/agent_docs/exception-handling.md \
  --jq '.content' | base64 -d
```

### Reactive 패턴

```bash
# Reactive 코드 규칙 조회
gh api repos/semicolon-devteam/core-backend/contents/agent_docs/reactive-patterns.md \
  --jq '.content' | base64 -d
```

### Security 패턴

```bash
# 보안 설정 조회
gh api repos/semicolon-devteam/core-backend/contents/agent_docs/security.md \
  --jq '.content' | base64 -d
```

### Enum 패턴

```bash
# Enum/상수 패턴 조회
gh api repos/semicolon-devteam/core-backend/contents/agent_docs/enum-patterns.md \
  --jq '.content' | base64 -d
```

### CLAUDE.md (프로젝트 설정)

```bash
# core-backend 프로젝트 설정 조회
gh api repos/semicolon-devteam/core-backend/contents/CLAUDE.md \
  --jq '.content' | base64 -d
```

## 도메인별 구현 예시 조회

### 도메인 구조 확인

```bash
# domain 폴더 목록
gh api repos/semicolon-devteam/core-backend/contents/src/main/kotlin/dev/semicolon/corebackend/domain \
  --jq '.[].name'
```

### 특정 도메인 파일 목록

```bash
# posts 도메인 파일 목록
gh api repos/semicolon-devteam/core-backend/contents/src/main/kotlin/dev/semicolon/corebackend/domain/posts \
  --jq '.[].name'
```

## 자주 사용하는 조합

### Spring 연동 시작 시 필요한 정보 한번에 조회

```bash
#!/bin/bash
echo "=== 1. 최신 API 스펙 버전 ==="
gh api repos/semicolon-devteam/core-interface/releases/latest --jq '.tag_name'

echo -e "\n=== 2. ApiResponse 패턴 ==="
gh api repos/semicolon-devteam/core-backend/contents/agent_docs/api-patterns.md \
  --jq '.content' | base64 -d | head -50

echo -e "\n=== 3. Exception 패턴 ==="
gh api repos/semicolon-devteam/core-backend/contents/agent_docs/exception-handling.md \
  --jq '.content' | base64 -d | head -50
```

### Swagger UI 열기

```bash
open https://core-interface-ashen.vercel.app/
```

## 에러 대응

### 권한 에러

```bash
# GitHub CLI 로그인 확인
gh auth status

# 재로그인
gh auth login
```

### 파일 없음 에러

```bash
# 파일 존재 여부 확인
gh api repos/semicolon-devteam/core-backend/contents/agent_docs \
  --jq '.[].name' 2>/dev/null || echo "파일을 찾을 수 없습니다"
```

### Rate Limit

```bash
# API 호출 제한 확인
gh api rate_limit --jq '.rate'

# 남은 호출 횟수
gh api rate_limit --jq '.rate.remaining'
```

## 유용한 alias 설정

```bash
# ~/.zshrc 또는 ~/.bashrc에 추가

# core-interface 최신 스펙 URL
alias ci-spec='gh api repos/semicolon-devteam/core-interface/releases/latest --jq ".assets[] | select(.name == \"core.backend.spec.json\") | .browser_download_url"'

# core-backend 문서 조회
alias cb-api='gh api repos/semicolon-devteam/core-backend/contents/agent_docs/api-patterns.md --jq ".content" | base64 -d'
alias cb-error='gh api repos/semicolon-devteam/core-backend/contents/agent_docs/exception-handling.md --jq ".content" | base64 -d'

# Swagger UI 열기
alias swagger='open https://core-interface-ashen.vercel.app/'
```

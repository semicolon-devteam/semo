# Check Items

## 1. 필수 도구 설치

```yaml
gh_cli:
  command: "gh --version"
  required: true
  error: "GitHub CLI 미설치. `brew install gh` 실행 필요"

git:
  command: "git --version"
  required: true
  error: "Git 미설치. `brew install git` 실행 필요"

node:
  command: "node --version"
  required: true
  min_version: "v18.0.0"
  error: "Node.js 미설치 또는 v18 미만. `brew install node` 실행 필요"

pnpm:
  command: "pnpm --version"
  required: true
  error: "pnpm 미설치. `npm install -g pnpm` 실행 필요"

supabase:
  command: "supabase --version"
  required: true
  error: "Supabase CLI 미설치. `brew install supabase/tap/supabase` 실행 필요"
  note: "프론트엔드 개발자도 필수 (GraphQL/RPC 직접 연결)"

postgresql:
  command: "psql --version"
  required: false
  warn: "PostgreSQL 클라이언트 미설치 (선택). 유사시 디버깅에 필요"
```

## 2. 인증 및 권한

```yaml
github_auth:
  command: "gh auth status"
  required: true
  error: "GitHub 인증 필요. `gh auth login` 실행"

github_org:
  command: "gh api user/orgs --jq '.[].login' | grep semicolon-devteam"
  required: true
  error: "semicolon-devteam Organization 멤버십 없음. 관리자에게 초대 요청"

docs_access:
  command: "gh api repos/semicolon-devteam/docs/contents/README.md"
  required: true
  error: "docs 레포 접근 불가. Organization 멤버십 확인 필요"

core_supabase_access:
  command: "gh api repos/semicolon-devteam/core-supabase/contents/README.md"
  required: true
  error: "core-supabase 레포 접근 불가. Private repo 권한 확인 필요"
```

## 3. Slack 참여 (수동 확인)

```yaml
slack_workspace:
  method: "manual"
  question: "Slack 워크스페이스에 참여하셨나요? (y/n)"
  channels:
    - "#_공지"
    - "#_일반"
    - "#_협업"
    - "할당받은 프로젝트 채널 (#cm-*, #alarm-*, etc.)"
```

## 4. Claude Code Global Config 확인

```yaml
claude_json_check:
  file: "~/.claude.json"
  platform_paths:
    macOS: "~/.claude.json"
    Linux: "~/.claude.json"
    Windows: "~/.claude.json (WSL2 Linux filesystem)"
  checks:
    - file_exists: "~/.claude.json 파일 존재 여부"
    - sax_metadata: "SAX 메타데이터 존재 여부"
    - required_fields:
        - "SAX.role" (fulltime, parttimer, contractor)
        - "SAX.position" (developer, po, designer)
        - "SAX.boarded" (true/false)
        - "SAX.healthCheckPassed" (true/false)
    - optional_fields:
        - "SAX.lastHealthCheck" (ISO 8601 timestamp)
        - "SAX.participantProjects" (array)
        - "SAX.currentTask" (object: repo, issue, branch)
```

## 검증 로직

```bash
# 1. 파일 존재 확인
if [ -f ~/.claude.json ]; then
  echo "✅ ~/.claude.json 파일 존재"
else
  echo "⚠️  ~/.claude.json 파일 없음 (첫 실행 시 자동 생성됨)"
fi

# 2. SAX 메타데이터 확인 (jq 사용)
if jq -e '.SAX' ~/.claude.json > /dev/null 2>&1; then
  echo "✅ SAX 메타데이터 존재"

  # 필수 필드 확인
  ROLE=$(jq -r '.SAX.role // "missing"' ~/.claude.json)
  POSITION=$(jq -r '.SAX.position // "missing"' ~/.claude.json)
  BOARDED=$(jq -r '.SAX.boarded // "missing"' ~/.claude.json)

  echo "  - role: $ROLE"
  echo "  - position: $POSITION"
  echo "  - boarded: $BOARDED"
else
  echo "⚠️  SAX 메타데이터 없음 (온보딩 필요)"
fi
```

# Workflow and Re-validation Policy

## 동작 흐름

```text
1. 명령어 트리거 (/SAX:health-check)
   ↓
2. 순차적 검증 실행
   - 도구 설치 확인
   - 인증 상태 확인
   - Slack 참여 확인 (수동)
   - SAX 패키지 설치 확인
   - MCP 서버 설정 확인
   ↓
3. 결과 집계
   - 필수 항목 통과/실패 카운트
   - 선택 항목 경고 카운트
   ↓
4. 출력 생성
   - 성공 시: 간결한 요약 + 다음 단계 안내
   - 실패 시: 상세 해결 방법 제공
   ↓
5. SAX 메타데이터 저장 (~/.claude.json)
   - healthCheckPassed: true/false
   - lastHealthCheck: timestamp
```

## 재검증 정책

- **온보딩 시**: 필수 실행
- **업무 시작 시**: orchestrator가 자동 실행 (30일 경과 시)
- **수동 요청 시**: `/SAX:health-check` 명령어

### 자동 실행 조건

Orchestrator가 다음 조건에서 health-check를 자동으로 트리거합니다:

1. **첫 SAX 사용**: `~/.claude.json`에 SAX 메타데이터 없음
2. **30일 경과**: `SAX.lastHealthCheck`가 30일 이상 지남
3. **healthCheckPassed: false**: 이전 검증에서 실패

### 수동 실행

언제든지 다음 명령어로 수동 실행 가능:

```bash
/SAX:health-check
```

## 검증 항목 우선순위

### 🔴 Critical (필수)

- GitHub CLI
- Git
- Node.js (v18+)
- pnpm
- Supabase CLI
- GitHub 인증
- Organization 멤버십
- docs 레포 접근
- core-supabase 레포 접근
- SAX 패키지 설치 (.claude/sax-core, .claude/sax-po)
- 심링크 연결 (CLAUDE.md, agents, skills, commands/SAX)
- MCP 서버 설정 (context7, github)

### 🟡 Warning (선택)

- PostgreSQL 클라이언트
- Slack 참여 (수동 확인)
- MCP: sequential-thinking

### 🟢 Info (참고)

- SAX 메타데이터 (첫 실행 시 자동 생성)
- GitHub MCP 토큰 설정

## 트러블슈팅

### GitHub 인증 실패

```bash
# 인증 상태 확인
gh auth status

# 재인증
gh auth login

# 토큰 권한 확인 (repo, read:org 필요)
gh auth refresh -h github.com -s repo,read:org
```

### Organization 멤버십 없음

```bash
# 멤버십 확인
gh api user/orgs --jq '.[].login'

# semicolon-devteam 없으면 관리자에게 초대 요청
```

### Supabase CLI 설치 실패

```bash
# macOS
brew tap supabase/tap
brew install supabase

# Linux
brew install supabase/tap/supabase

# Windows (WSL2)
brew install supabase/tap/supabase
```

### Node.js 버전 낮음

```bash
# 현재 버전 확인
node --version

# v18+ 설치 필요
brew install node@18

# 또는 최신 버전
brew install node
```

### MCP 서버 설정 문제

```bash
# 1. settings.local.json 존재 확인
ls -la .claude/settings.local.json

# 2. 패키지 템플릿에서 복사
cp .claude/sax-po/settings.local.json .claude/settings.local.json

# 3. GitHub 토큰 설정 필요
# settings.local.json 내 GITHUB_PERSONAL_ACCESS_TOKEN 값을 실제 토큰으로 변경

# GitHub 토큰 생성:
# 1. https://github.com/settings/tokens 접속
# 2. "Generate new token (classic)" 선택
# 3. 필요 권한: repo, read:org
# 4. 생성된 토큰을 settings.local.json에 입력
```

### SAX 패키지/심링크 문제

```bash
# 심링크 상태 확인
ls -la .claude/

# 예상 결과:
# CLAUDE.md -> sax-po/CLAUDE.md
# agents -> sax-po/agents
# skills -> sax-po/skills
# commands/SAX -> ../sax-po/commands

# 심링크 재설정
# "SAX 업데이트해줘" 명령어로 자동 재설정
```

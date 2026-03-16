# SEMO FAQ (자주 묻는 질문)

> SEMO 사용 중 자주 발생하는 질문과 답변

---

## 목차

1. [설치 관련](#1-설치-관련)
2. [사용법 관련](#2-사용법-관련)
3. [패키지 관련](#3-패키지-관련)
4. [MCP/연동 관련](#4-mcp연동-관련)
5. [문제 해결](#5-문제-해결)
6. [기타](#6-기타)

---

## 1. 설치 관련

### Q: SEMO를 설치하려면 무엇이 필요한가요?

**A**: 다음이 필요합니다:
- Claude Code CLI 설치
- Git 설치
- GitHub CLI (`gh`) 설치 및 인증

```bash
# 확인 명령어
claude --version
git --version
gh auth status
```

---

### Q: 설치 명령어가 뭔가요?

**A**: 두 가지 방법이 있습니다:

```bash
# 방법 1: CLI (권장)
npx @team-semicolon/semo-cli init

# 방법 2: 스크립트
bash <(curl -fsSL https://raw.githubusercontent.com/semicolon-devteam/semo-meta/main/scripts/install-semo.sh)
```

---

### Q: 설치 후 무엇이 생기나요?

**A**: 프로젝트에 `.claude/` 디렉토리가 생성됩니다:

```
.claude/
├── CLAUDE.md           # Claude Code 진입점
├── settings.json       # MCP 서버 설정
├── memory/             # Context Mesh
├── agents/             # 에이전트 (심볼릭 링크)
├── skills/             # 스킬 (심볼릭 링크)
├── commands/           # 커맨드
└── semo-system/        # SEMO 코어 (서브모듈)
```

---

### Q: 기존 프로젝트에 설치해도 되나요?

**A**: 네, 기존 프로젝트에 설치할 수 있습니다. `.claude/` 디렉토리가 추가되며 기존 코드에는 영향을 주지 않습니다.

---

### Q: 설치를 제거하려면 어떻게 하나요?

**A**: `.claude/` 디렉토리를 삭제하면 됩니다:

```bash
rm -rf .claude/
```

---

## 2. 사용법 관련

### Q: SEMO가 설치되었는지 어떻게 확인하나요?

**A**:
```bash
# 방법 1: 디렉토리 확인
ls -la .claude/

# 방법 2: 환경 검증 커맨드
/SEMO:health
```

---

### Q: 특별한 명령어를 알아야 하나요?

**A**: 아니요, 자연어로 요청하면 됩니다:

```
"로그인 페이지 만들어줘"
"테스트 코드 작성해줘"
"PR 만들어줘"
```

슬래시 커맨드는 선택 사항입니다.

---

### Q: [SEMO] 메시지가 뭔가요?

**A**: SEMO가 어떤 동작을 하는지 투명하게 보여주는 메시지입니다:

```
[SEMO] Orchestrator: 의도 분석 완료
[SEMO] Skill: implement 호출
[SEMO] Reference: ddd-patterns 참조
```

이를 통해 AI가 무엇을 하는지 항상 알 수 있습니다.

---

### Q: 여러 파일을 한 번에 수정할 수 있나요?

**A**: 네, SEMO는 관련된 여러 파일을 함께 수정합니다. 예를 들어 "User 도메인 만들어줘"라고 하면:
- Entity 파일
- Repository 파일
- Service 파일
- Controller 파일
- Test 파일

등을 한 번에 생성합니다.

---

### Q: 이전 대화를 기억하나요?

**A**: 네, Context Mesh를 통해 세션 간 컨텍스트를 유지합니다:
- 아키텍처 결정 사항
- 팀 선호도
- 프로젝트 맥락

`.claude/memory/` 디렉토리에 저장됩니다.

---

## 3. 패키지 관련

### Q: 어떤 패키지를 선택해야 하나요?

**A**: 역할에 따라 선택하세요:

| 역할 | 패키지 |
|------|--------|
| 프론트엔드 개발자 | semo-next |
| 백엔드 개발자 | semo-backend |
| PO/기획자 | semo-po |
| 디자이너 | semo-design |
| QA | semo-qa |
| PM | semo-pm |
| 인프라 | semo-infra |
| MSA 개발자 | semo-ms |

---

### Q: 여러 패키지를 동시에 설치할 수 있나요?

**A**: 네, 여러 역할을 수행하는 경우 복수 패키지를 설치할 수 있습니다:

```bash
# 설치 시 여러 패키지 선택 가능
npx @team-semicolon/semo-cli init
```

---

### Q: 패키지를 추가/제거하려면?

**A**:
```bash
# 재설치 (패키지 선택 화면 표시)
npx @team-semicolon/semo-cli init
```

---

### Q: semo-core와 semo-skills는 뭔가요?

**A**: 모든 SEMO 설치에 포함되는 **Standard 패키지**입니다:
- **semo-core**: 핵심 원칙, 오케스트레이터
- **semo-skills**: 13개 공통 스킬

Extensions(semo-next, semo-backend 등)는 선택 사항입니다.

---

## 4. MCP/연동 관련

### Q: MCP가 뭔가요?

**A**: Model Context Protocol의 약자로, Claude Code가 외부 시스템과 연동하는 방식입니다. SEMO는 MCP를 통해 Slack, GitHub, Supabase 등과 연동합니다.

---

### Q: Slack 연동은 어떻게 하나요?

**A**:
1. Slack Bot Token 발급
2. 환경변수 설정:
   ```bash
   export SLACK_BOT_TOKEN="xoxb-..."
   ```
3. 사용:
   ```
   /SEMO:slack #채널 메시지
   ```

---

### Q: GitHub 연동은 자동인가요?

**A**: `gh auth`가 완료되어 있으면 자동으로 연동됩니다:

```bash
gh auth status
```

---

### Q: MCP 없이도 SEMO를 사용할 수 있나요?

**A**: 네, 코드 생성/수정 등 대부분의 기능은 MCP 없이도 동작합니다. Slack, Supabase 등 외부 연동만 MCP가 필요합니다.

---

## 5. 문제 해결

### Q: SEMO 메시지가 출력되지 않아요

**A**:
1. `.claude/CLAUDE.md` 파일 존재 확인:
   ```bash
   cat .claude/CLAUDE.md | head -20
   ```

2. 심볼릭 링크 확인:
   ```bash
   ls -la .claude/semo-system/
   ```

3. 재설치:
   ```bash
   npx @team-semicolon/semo-cli init --force
   ```

---

### Q: "skill not found" 에러가 나요

**A**:
1. 해당 스킬이 설치된 패키지에 포함되어 있는지 확인
2. `/SEMO:health`로 스킬 로드 상태 확인
3. 재설치 시도

---

### Q: MCP 연결이 실패해요

**A**:
1. 환경변수 확인:
   ```bash
   echo $SLACK_BOT_TOKEN
   echo $SUPABASE_URL
   ```

2. settings.json 확인:
   ```bash
   cat .claude/settings.json | jq '.mcpServers'
   ```

3. 네트워크 연결 확인

---

### Q: 결과가 예상과 다르게 나와요

**A**:
1. 더 구체적으로 요청해보세요
2. 관련 파일/이슈 번호를 함께 제공하세요
3. 단계별로 나누어 요청해보세요
4. 피드백을 주세요: "이 부분은 다르게 해줘: ..."

---

### Q: Claude Code가 느려요

**A**:
1. 큰 파일 참조를 피하세요
2. 불필요한 디렉토리는 `.gitignore`에 추가
3. Context Mesh 캐시 정리:
   ```bash
   rm -rf .claude/memory/cache/
   ```

---

## 6. 기타

### Q: SEMO는 오픈소스인가요?

**A**: SEMO는 Semicolon DevTeam 내부용으로 개발되었습니다. GitHub Organization 멤버만 접근 가능합니다.

---

### Q: 버그를 발견하면 어떻게 하나요?

**A**:
1. `/SEMO:feedback` 커맨드로 제출
2. GitHub Issues에 등록
3. Slack `#_협업` 채널에 공유

---

### Q: 새 기능을 제안하려면?

**A**: `/SEMO:feedback` 커맨드로 제안을 제출하세요. 또는 GitHub Issues에 Feature Request를 등록하세요.

---

### Q: 업데이트는 어떻게 하나요?

**A**:
```
/SEMO:update
```

또는:
```bash
cd .claude/semo-system && git pull
```

---

### Q: 팀에서 같은 설정을 공유하려면?

**A**: `.claude/` 디렉토리를 Git에 커밋하면 팀 전체가 같은 SEMO 설정을 공유할 수 있습니다.

단, `.claude/settings.local.json`과 민감 정보는 `.gitignore`에 추가하세요.

---

### Q: 오프라인에서도 동작하나요?

**A**: 대부분의 기능은 오프라인에서도 동작합니다. 단, Slack, GitHub 연동 등 외부 서비스가 필요한 기능은 온라인이어야 합니다.

---

### Q: 다른 AI 도구와 함께 사용할 수 있나요?

**A**: 네, SEMO는 Claude Code 위에서 동작하므로 다른 도구와 충돌하지 않습니다. 단, 같은 파일을 동시에 수정하면 충돌이 발생할 수 있습니다.

---

## 더 궁금한 점이 있으신가요?

- `/SEMO:help` - 도움말
- `/SEMO:feedback` - 피드백 제출
- Slack `#_협업` - 팀 채널에서 질문
- [USER_GUIDE.md](./USER_GUIDE.md) - 상세 사용법
- [PACKAGES.md](./PACKAGES.md) - 패키지별 안내

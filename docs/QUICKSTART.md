# SEMO 빠른 시작 가이드

> 5분 만에 SEMO를 설치하고 첫 번째 작업을 완료합니다.

---

## 사전 요구사항

- **Claude Code** CLI 설치 완료
- **Git** 설치
- **GitHub CLI** (`gh`) 설치 및 인증 완료

```bash
# GitHub CLI 인증 확인
gh auth status
```

---

## Step 1: SEMO 설치 (1분)

### 방법 A: CLI 설치 (권장)

```bash
# 프로젝트 디렉토리에서 실행
npx @team-semicolon/semo-cli init
```

### 방법 B: 스크립트 설치

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/semicolon-devteam/semo-meta/main/scripts/install-semo.sh)
```

### 설치 완료 확인

```bash
# .claude 디렉토리 확인
ls -la .claude/

# 예상 출력:
# .claude/
# ├── CLAUDE.md
# ├── settings.json
# ├── memory/
# ├── agents -> semo-system/semo-core/agents
# ├── skills -> semo-system/semo-skills
# └── semo-system/
```

---

## Step 2: 역할 선택 (1분)

설치 중 역할을 선택합니다. 자신의 역할에 맞는 패키지를 선택하세요:

| 역할 | 패키지 | 설명 |
|------|--------|------|
| 프론트엔드 개발자 | `semo-next` | Next.js, React 개발 |
| 백엔드 개발자 | `semo-backend` | Spring WebFlux, Kotlin |
| PO/기획자 | `semo-po` | Epic, Task 관리 |
| 디자이너 | `semo-design` | 목업, 핸드오프 |
| QA | `semo-qa` | 테스트, 버그 리포트 |
| PM | `semo-pm` | 스프린트, 진행도 |
| 인프라 | `semo-infra` | Docker, 배포 |
| MSA 개발자 | `semo-ms` | 마이크로서비스 |

---

## Step 3: 환경 검증 (1분)

Claude Code를 실행하고 환경을 검증합니다:

```bash
# Claude Code 실행
claude

# 환경 검증 커맨드
/SEMO:health
```

**정상 출력 예시**:

```
[SEMO] Skill: health-check 호출

=== SEMO Health Check ===

✅ semo-core: v2.0.1
✅ semo-skills: 13개 스킬 로드
✅ Extension: semo-next v0.45.0
✅ MCP 서버: 정상
✅ GitHub CLI: 인증됨
✅ memory/: 초기화됨

환경 검증 완료!
```

---

## Step 4: 첫 번째 작업 (2분)

이제 자연어로 요청해보세요!

### 예시 1: 코드 구현 요청 (프론트엔드)

```
로그인 페이지 만들어줘
```

**SEMO 응답**:

```
[SEMO] Orchestrator: 의도 분석 완료 → 코드 구현 요청

[SEMO] Skill: implement 호출 (platform: nextjs)

[SEMO] Reference: ddd-patterns 참조

## 구현을 시작합니다

1. 도메인 분석...
2. 컴포넌트 생성...
3. API 연동...
```

### 예시 2: Epic 생성 (PO)

```
댓글 기능 Epic 만들어줘
```

### 예시 3: 테스트 실행 (QA)

```
로그인 기능 테스트 케이스 검증해줘
```

---

## Step 5: 주요 커맨드 익히기

| 커맨드 | 설명 | 예시 |
|--------|------|------|
| `/SEMO:help` | 도움말 | `/SEMO:help` |
| `/SEMO:health` | 환경 검증 | `/SEMO:health` |
| `/SEMO:slack` | Slack 전송 | `/SEMO:slack #_협업 작업 완료!` |
| `/SEMO:feedback` | 피드백 제출 | `/SEMO:feedback 버그: ...` |
| `/SEMO:update` | 업데이트 | `/SEMO:update` |

---

## 다음 단계

### 자연어로 요청하기

SEMO는 자연어 요청을 이해합니다. 특별한 명령어 없이도:

```
"이 코드 리팩토링해줘"
"테스트 코드 작성해줘"
"PR 만들어줘"
"이슈 정리해줘"
```

### 패키지별 기능 확인

자신의 역할에 맞는 패키지 문서를 확인하세요:

- [PACKAGES.md](./PACKAGES.md) - 전체 패키지 카탈로그
- [USER_GUIDE.md](./USER_GUIDE.md) - 상세 사용자 가이드

### Context Mesh 활용

SEMO는 세션 간 컨텍스트를 유지합니다:

```
.claude/memory/
├── context.md      # 프로젝트 상태
├── decisions.md    # 아키텍처 결정 기록
└── rules/          # 프로젝트별 규칙
```

---

## 문제 해결

### "SEMO 메시지가 출력되지 않아요"

```bash
# CLAUDE.md 확인
cat .claude/CLAUDE.md | head -20

# semo-system 심볼릭 링크 확인
ls -la .claude/semo-system/
```

### "패키지가 로드되지 않아요"

```bash
# 재설치
npx @team-semicolon/semo-cli init --force
```

### "MCP 서버 연결 실패"

```bash
# settings.json 확인
cat .claude/settings.json | jq '.mcpServers'

# 환경변수 확인
echo $SLACK_BOT_TOKEN
```

---

## 도움 요청

- **Slack**: `#_협업` 채널에서 질문
- **GitHub Issues**: [semo-meta](https://github.com/semicolon-devteam/semo-meta/issues)
- **피드백**: `/SEMO:feedback` 커맨드 사용

---

**축하합니다!** SEMO 설정이 완료되었습니다. 이제 자연어로 요청하면 SEMO가 도와줍니다.

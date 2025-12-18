<!-- SEMO Framework -->
> **SEMO** = "Semicolon Orchestrate" - AI 에이전트 오케스트레이션 프레임워크
> (이전 명칭: SEMO - Semicolon AI Transformation)

# SEMO-Meta Package Configuration

> SEMO 패키지 자체 관리 및 개발을 위한 메타 패키지

## Package Info

- **Package**: SEMO-Meta
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Audience**: SEMO 개발자, SEMO 패키지 관리자

---

## 🔴 Orchestrator-First (최우선 규칙)

> **⚠️ 이 규칙은 예외 없이 적용됩니다. 직접 처리 절대 금지.**

### 접두사 감지 시 필수 출력 (MUST)

입력이 다음 접두사로 시작하면 **반드시** SEMO 메시지를 출력해야 합니다:

| 접두사 | 트리거 |
|--------|--------|
| `[meta]` | semo-meta 패키지 작업 |
| `[po]` | semo-po 패키지 작업 |
| `[next]` | semo-next 패키지 작업 |
| `[qa]` | semo-qa 패키지 작업 |
| `[core]` | semo-core 패키지 작업 |
| `[ms]` | semo-ms 패키지 작업 |
| `[mvp]` | semo-mvp 패키지 작업 |
| `[all]` | 모든 패키지 작업 |

**접두사 감지 시 첫 출력**:

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → {intent_category}

[SEMO] Agent 위임: {agent_name} (사유: {reason})
```

> 🔴 이 메시지 없이 작업 진행 금지

**Quick Routing Table**: [agents/orchestrator/orchestrator.md](agents/orchestrator/orchestrator.md) 참조

---

## 🔴 작업 완료 후 자동 배포 (NON-NEGOTIABLE)

> **⚠️ Meta 환경에서 작업 완료 시 반드시 전체 배포 플로우를 실행합니다.**
> **사용자가 별도로 요청하지 않아도 자동으로 진행합니다.**

### 🔴 분리 버전 정책 (Separate Version Policy)

> **SEMO는 각 패키지별로 독립적인 버전을 관리합니다.**

```
semo-cli (npm)           → package.json (독립)
semo-core/VERSION        → 독립 버전
semo-skills/VERSION      → 독립 버전
packages/*/VERSION       → 각 Extension 독립 버전
```

**이유**:
1. CLI 변경 없이 스킬/패키지만 업데이트 가능
2. 필요한 패키지만 선택적 업데이트 (`semo update --only semo-skills`)
3. 각 구성요소의 변경 이력 독립 관리

### 🔴 배포 대상 감지

| 변경 파일 | 배포 대상 | 버전 파일 |
|----------|----------|----------|
| `packages/cli/**` | @team-semicolon/semo-cli (npm) | `packages/cli/package.json` |
| `packages/mcp-server/**` | @team-semicolon/semo-mcp (npm) | `packages/mcp-server/package.json` |
| `semo-core/**` | semo-core | `semo-core/VERSION` |
| `semo-skills/**` | semo-skills | `semo-skills/VERSION` |
| `packages/{biz,eng,ops}/**` | 각 Extension | `packages/*/VERSION` |

### 🔴 필수 동작 순서 (패키지별)

**CLI 변경 시**:
```text
1. 작업 완료
   ↓
2. CLI 버전 범프 (package.json + index.ts)
   ↓
3. 빌드 (npm run build)
   ↓
4. 커밋 + 푸시
   ↓
5. npm publish
```

**semo-core/semo-skills/Extension 변경 시**:
```text
1. 작업 완료
   ↓
2. 해당 패키지 VERSION 파일 범프
   ↓
3. 커밋 + 푸시
```

> **참고**: semo-system 패키지는 npm이 아닌 GitHub에서 직접 다운로드되므로,
> VERSION 파일만 올리면 사용자가 `semo update`로 최신화할 수 있습니다.

---

## 🔴 버저닝 규칙

### 버전 타입

| 변경 유형 | 버전 타입 |
|----------|----------|
| Agent/Skill/Command 추가/수정/삭제 | MINOR |
| 버그/오타 수정 | PATCH |
| Breaking Change | MAJOR |

### TodoWrite 자동 추가

- Agent/Skill/Command 파일 수정 감지 시 TodoWrite에 "버저닝 처리" 항목 **자동 추가**
- 해당 항목 완료 전까지 작업 완료로 간주하지 않음

---

## 🔴 새 세션 시작 시 초기화 (NON-NEGOTIABLE)

> **⚠️ 새 세션에서 사용자 요청 처리 전, 반드시 아래 2단계를 순서대로 실행합니다.**

### 트리거 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SEMO가 설치된 프로젝트 (semo-system/ 존재)

### Step 1: 버전 체크 (각 패키지별)

```bash
# 설치된 패키지 확인
ls semo-system/

# 각 패키지 로컬 vs 원격 VERSION 비교
# semo-core
LOCAL_CORE=$(cat semo-system/semo-core/VERSION 2>/dev/null)
REMOTE_CORE=$(gh api repos/semicolon-devteam/semo/contents/semo-core/VERSION --jq '.content' | base64 -d 2>/dev/null)

# semo-skills
LOCAL_SKILLS=$(cat semo-system/semo-skills/VERSION 2>/dev/null)
REMOTE_SKILLS=$(gh api repos/semicolon-devteam/semo/contents/semo-skills/VERSION --jq '.content' | base64 -d 2>/dev/null)

# 설치된 Extension 패키지도 동일하게 체크
# 예: biz/management
LOCAL_EXT=$(cat semo-system/biz/management/VERSION 2>/dev/null)
REMOTE_EXT=$(gh api repos/semicolon-devteam/semo/contents/packages/biz/management/VERSION --jq '.content' | base64 -d 2>/dev/null)
```

**업데이트 필요 시**:
```
[SEMO] 버전 체크 완료

📦 업데이트 가능:
  - semo-core: 1.0.0 → 1.0.1
  - semo-skills: 1.0.0 → 1.0.2

💡 "semo update" 또는 "SEMO 업데이트해줘"로 업데이트하세요.
   특정 패키지만: semo update --only semo-skills
```

### Step 2: 구조 검증 (필수)

> **⚠️ Step 1 완료 후 반드시 실행**

**스킬 호출** (폴백 체인):

1. `.claude/skills/semo-architecture-checker/SKILL.md` 존재 → 실행
2. 없으면 → `semo-system/semo-skills/semo-architecture-checker/SKILL.md` 실행

**검증 항목**:

- CLAUDE.md 심링크 유효성
- agents/, skills/, commands/SEMO/ 병합 상태
- 깨진 심링크 탐지 및 자동 복구

### 초기화 완료 출력

```markdown
[SEMO] 세션 초기화 완료
- semo-core: 1.0.0 ✅
- semo-skills: 1.0.0 ✅
- biz/management: 1.0.0 ✅
- 구조: 정상 ✅
```

---

## 🔴 SEMO Core 필수 참조

> **모든 작업 전 semo-core 문서 및 공통 컴포넌트를 참조합니다.**

| 파일 | 용도 |
|------|------|
| `semo-core/PRINCIPLES.md` | SEMO 핵심 원칙 |
| `semo-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 |

### 공통 컴포넌트 (semo-core)

| 컴포넌트 | 유형 | 역할 |
|----------|------|------|
| `compliance-checker` | Agent | 작업 완료 후 규칙 준수 검증 |
| `version-updater` | Skill | 세션 시작 시 버전 체크 및 업데이트 |
| `notify-slack` | Skill | Slack 알림 전송 |
| `feedback` | Skill | 피드백 수집 및 GitHub 이슈 생성 |
| `semo-help` | Skill | SEMO 도움말 및 팀 컨텍스트 응답 |

### 공통 커맨드

> **SEMO 커맨드 권장**: `/SEMO:*` 사용을 권장합니다. `/SEMO:*`는 병행 기간 동안 유지됩니다.

| SEMO 커맨드 | SEMO 커맨드 (레거시) | 설명 | 호출 스킬 |
|-------------|-------------------|------|-----------|
| `/SEMO:help` | `/SEMO:help` | 도움말 | semo-help |
| `/SEMO:slack` | `/SEMO:slack` | Slack 메시지 전송 | notify-slack |
| `/SEMO:update` | `/SEMO:update` | 패키지 업데이트 | version-updater |
| `/SEMO:feedback` | `/SEMO:feedback` | 피드백 제출 | feedback |
| `/SEMO:audit` | `/SEMO:audit` | 패키지 품질 감사 | audit-semo |
| `/SEMO:health` | `/SEMO:health` | 환경/구조 검증 | - |

---

## 필수 원칙

### 1. 세션 컨텍스트 비의존

> **SEMO는 세션 컨텍스트에 의지하지 않는다.**

모든 필수 정보는 **Reference Chain**을 통해 접근 가능해야 함:

```text
Agent/Skill → references/ → semo-core/ → docs 레포 문서
```

### 2. 패키지 접두사 명령

| 접두사 | 대상 |
|--------|------|
| `[po]` | semo-po만 |
| `[next]` | semo-next만 |
| `[qa]` | semo-qa만 |
| `[core]` | semo-core만 |
| `[meta]` | semo-meta만 |
| `[ms]` | semo-ms만 |
| `[mvp]` | semo-mvp만 |
| `[po \| next]` | 복수 패키지 |
| `[ms \| next]` | 복수 패키지 |
| `[all]` / (없음) | 모든 패키지 |

> **접두사는 "작업 대상"을 지정할 뿐, 라우팅은 항상 로컬 `.claude/` 매니저를 통합니다.**

### 3. 서브모듈 수정 시 로컬 동기화

> **semo-meta 수정 후 반드시 `.claude/semo-meta/` 동기화**

```bash
cd semo-meta && git push origin main && cd ../.claude/semo-meta && git pull origin main
```

### 4. 🔴 신규 패키지 추가 시 필수 동기화

> **새로운 SEMO 패키지 생성 시 반드시 아래 3가지를 함께 업데이트합니다.**

#### 체크리스트

| 항목 | 파일 | 내용 |
|------|------|------|
| ✅ 접두사 라우팅 | `CLAUDE.md` | 접두사 테이블에 `[{name}]` 추가 |
| ✅ 버저닝 대상 | `CLAUDE.md` | 버저닝 필수 대상에 `sax-{name}` 추가 |
| ✅ 설치 스크립트 | `scripts/install-sax.sh` | 3곳 수정 (show_usage, select_package, parse_args) |

#### install-sax.sh 수정 위치

```bash
# 1. show_usage() - 패키지 설명 추가
echo "  {name}    - SEMO-{Name} ({대상}용)"

# 2. select_package() - 메뉴 옵션 추가
echo "  N) sax-{name}  - {대상}용"
echo "                   {설명}"
# case 문에 추가
N) PACKAGE="{name}" ;;

# 3. parse_args() - CLI 인자 패턴에 추가
po|next|qa|meta|pm|backend|infra|design|ms|{name})
```

> **참조**: [semo-architect Agent](agents/semo-architect/semo-architect.md) - 신규 패키지 추가 상세 가이드

---

## References

- [Orchestrator](agents/orchestrator/orchestrator.md) - 라우팅 규칙 및 Agent/Skill 목록
- [SEMO Core - Principles](https://github.com/semicolon-devteam/semo-core/blob/main/PRINCIPLES.md)
- [SEMO Core - Message Rules](https://github.com/semicolon-devteam/semo-core/blob/main/MESSAGE_RULES.md)
- [SEMO → SEMO 마이그레이션 가이드](../docs/SAX_TO_SEMO_MIGRATION.md) - 리브랜딩 전환 가이드
- [SEMO 네이밍 규칙](../docs/SEMO_NAMING_CONVENTION.md) - SEMO → SEMO 용어 매핑

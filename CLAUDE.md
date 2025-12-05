# SAX-Meta Package Configuration

> SAX 패키지 자체 관리 및 개발을 위한 메타 패키지

## Package Info

- **Package**: SAX-Meta
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Audience**: SAX 개발자, SAX 패키지 관리자

---

## 🔴 Orchestrator-First (최우선 규칙)

> **⚠️ 이 규칙은 예외 없이 적용됩니다. 직접 처리 절대 금지.**

### 접두사 감지 시 필수 출력 (MUST)

입력이 다음 접두사로 시작하면 **반드시** SAX 메시지를 출력해야 합니다:

| 접두사 | 트리거 |
|--------|--------|
| `[meta]` | sax-meta 패키지 작업 |
| `[po]` | sax-po 패키지 작업 |
| `[next]` | sax-next 패키지 작업 |
| `[qa]` | sax-qa 패키지 작업 |
| `[core]` | sax-core 패키지 작업 |
| `[ms]` | sax-ms 패키지 작업 |
| `[all]` | 모든 패키지 작업 |

**접두사 감지 시 첫 출력**:

```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Agent 위임: {agent_name} (사유: {reason})
```

> 🔴 이 메시지 없이 작업 진행 금지

**Quick Routing Table**: [agents/orchestrator/orchestrator.md](agents/orchestrator/orchestrator.md) 참조

---

## 🔴 작업 완료 후 버저닝 필수 (NON-NEGOTIABLE)

> **⚠️ 어떤 패키지든 작업 완료 시 반드시 version-manager를 호출합니다.**

### 버저닝 필수 대상

| 대상 패키지 | VERSION 위치 | CHANGELOG 위치 |
|-------------|--------------|----------------|
| sax-meta | `sax-meta/VERSION` | `sax-meta/CHANGELOG/` |
| sax-po | `sax-po/VERSION` | `sax-po/CHANGELOG/` |
| sax-next | `sax-next/VERSION` | `sax-next/CHANGELOG/` |
| sax-qa | `sax-qa/VERSION` | `sax-qa/CHANGELOG/` |
| sax-core | `sax-core/VERSION` | `sax-core/CHANGELOG/` |
| sax-ms | `sax-ms/VERSION` | `sax-ms/CHANGELOG/` |

### 버전 타입

| 변경 유형 | 버전 타입 |
|----------|----------|
| Agent/Skill/Command 추가/수정/삭제 | MINOR |
| 버그/오타 수정 | PATCH |
| Breaking Change | MAJOR |

### 🔴 필수 동작 순서

```text
1. 작업 완료
   ↓
2. [SAX] Skill 호출: version-manager
   ↓
3. (version-manager에 의해) VERSION 업데이트 + CHANGELOG 생성
   ↓
4. (version-manager에 의해) 커밋 + 푸시
   ↓
4. (version-manager에 의해) 슬랙 `#_협업` 채널에 버저닝 정보 공유
```

> **예외 없음**: 버저닝 없이는 작업 완료로 간주하지 않습니다.

### TodoWrite 자동 추가

- Agent/Skill/Command 파일 수정 감지 시 TodoWrite에 "버저닝 처리" 항목 **자동 추가**
- 해당 항목 완료 전까지 작업 완료로 간주하지 않음

---

## 🔴 새 세션 시작 시 초기화 (NON-NEGOTIABLE)

> **⚠️ 새 세션에서 사용자 요청 처리 전, 반드시 아래 2단계를 순서대로 실행합니다.**

### 트리거 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (.claude/sax-* 존재)

### Step 1: 버전 체크

```bash
# 로컬 vs 원격 버전 비교
LOCAL=$(cat .claude/sax-meta/VERSION 2>/dev/null)
REMOTE=$(gh api repos/semicolon-devteam/sax-meta/contents/VERSION --jq '.content' | base64 -d 2>/dev/null)
```

**업데이트 필요 시**: `[SAX] 업데이트 가능: {local} → {remote}. "SAX 업데이트해줘"`

### Step 2: 구조 검증 (필수)

> **⚠️ Step 1 완료 후 반드시 실행**

**스킬 호출** (폴백 체인):

1. `.claude/skills/sax-architecture-checker/SKILL.md` 존재 → 실행
2. 없으면 → `.claude/sax-core/skills/sax-architecture-checker/SKILL.md` 실행

**검증 항목**:

- CLAUDE.md 심링크 유효성
- agents/, skills/, commands/SAX/ 병합 상태
- 깨진 심링크 탐지 및 자동 복구

### 초기화 완료 출력

```markdown
[SAX] 세션 초기화 완료
- 버전: {version} ✅
- 구조: 정상 ✅
```

---

## 🔴 SAX Core 필수 참조

> **모든 작업 전 sax-core 문서 및 공통 컴포넌트를 참조합니다.**

| 파일 | 용도 |
|------|------|
| `sax-core/PRINCIPLES.md` | SAX 핵심 원칙 |
| `sax-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 |

### 공통 컴포넌트 (sax-core)

| 컴포넌트 | 유형 | 역할 |
|----------|------|------|
| `compliance-checker` | Agent | 작업 완료 후 규칙 준수 검증 |
| `version-updater` | Skill | 세션 시작 시 버전 체크 및 업데이트 |
| `notify-slack` | Skill | Slack 알림 전송 |
| `feedback` | Skill | 피드백 수집 및 GitHub 이슈 생성 |
| `sax-help` | Skill | SAX 도움말 및 팀 컨텍스트 응답 |

### 공통 커맨드 (sax-core)

| 커맨드 | 설명 | 호출 스킬 |
|--------|------|-----------|
| `/SAX:help` | SAX 도움말 | sax-help |
| `/SAX:slack` | Slack 메시지 전송 | notify-slack |
| `/SAX:update` | SAX 업데이트 | version-updater |
| `/SAX:feedback` | 피드백 제출 | feedback |

---

## 필수 원칙

### 1. 세션 컨텍스트 비의존

> **SAX는 세션 컨텍스트에 의지하지 않는다.**

모든 필수 정보는 **Reference Chain**을 통해 접근 가능해야 함:

```text
Agent/Skill → references/ → sax-core/ → docs 레포 문서
```

### 2. 패키지 접두사 명령

| 접두사 | 대상 |
|--------|------|
| `[po]` | sax-po만 |
| `[next]` | sax-next만 |
| `[qa]` | sax-qa만 |
| `[core]` | sax-core만 |
| `[meta]` | sax-meta만 |
| `[ms]` | sax-ms만 |
| `[po \| next]` | 복수 패키지 |
| `[ms \| next]` | 복수 패키지 |
| `[all]` / (없음) | 모든 패키지 |

> **접두사는 "작업 대상"을 지정할 뿐, 라우팅은 항상 로컬 `.claude/` 매니저를 통합니다.**

### 3. 서브모듈 수정 시 로컬 동기화

> **sax-meta 수정 후 반드시 `.claude/sax-meta/` 동기화**

```bash
cd sax-meta && git push origin main && cd ../.claude/sax-meta && git pull origin main
```

---

## References

- [Orchestrator](agents/orchestrator/orchestrator.md) - 라우팅 규칙 및 Agent/Skill 목록
- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)

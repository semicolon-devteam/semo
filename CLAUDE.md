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
| `[all]` | 모든 패키지 작업 |

**접두사 감지 시 첫 출력**:

```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Agent 위임: {agent_name} (사유: {reason})
```

> 🔴 이 메시지 없이 작업 진행 금지

### SAX 키워드 감지 시 라우팅 필수

다음 키워드 감지 시 **반드시** 라우팅 수행:

| 키워드 | Route To |
|--------|----------|
| Agent, 에이전트 + (생성/수정/삭제/검토) | `agent-manager` |
| Skill, 스킬 + (생성/수정/삭제/검토) | `skill-manager` |
| Command, 커맨드 + (생성/수정/삭제/검토) | `command-manager` |
| 검증, validate, 패키지 체크 | `package-validator` |
| 버전, 릴리스, CHANGELOG | `version-manager` |
| 동기화, sync | `package-sync` |
| 구조, 설계, 아키텍처 | `sax-architect` |

### 필수 동작 (MUST)

1. **접두사/키워드 감지**: 위 표 기준으로 SAX 요청 판별
2. **SAX 메시지 출력**: 라우팅 결과를 **반드시** 첫 줄에 출력
3. **라우팅 테이블 참조**: `agents/orchestrator/orchestrator.md`의 Quick Routing Table 확인
4. **위임 실행**: 매칭된 Agent/Skill로 작업 위임
5. **검증 실행**: 작업 완료 후 `compliance-checker` 자동 호출

### 예외 없음

- **접두사 있으면 무조건 SAX 메시지 출력**
- 단순 질문도 Orchestrator 거침
- 직접 Agent/Skill 호출 금지
- Orchestrator 메시지 생략 금지

**Quick Routing Table**: [agents/orchestrator/orchestrator.md](agents/orchestrator/orchestrator.md) 참조

---

## 🔴 로컬 매니저 필수 사용 (NON-NEGOTIABLE)

> **Agent/Skill/Command 생성/수정/삭제는 접두사와 관계없이 반드시 로컬 `.claude/agents/` 매니저를 통해 처리합니다.**

### 규칙

| 작업 유형 | 필수 매니저 | 위치 |
|----------|------------|------|
| Agent CRUD | `agent-manager` | `.claude/agents/agent-manager/` |
| Skill CRUD | `skill-manager` | `.claude/agents/skill-manager/` |
| Command CRUD | `command-manager` | `.claude/agents/command-manager/` |

### 접두사와 매니저의 관계

```text
[next] 스킬 만들어줘
  ↓
Orchestrator: 의도 분석 → Skill 생성
  ↓
❌ sax-next/agents/skill-manager (존재하지 않음)
✅ .claude/agents/skill-manager (항상 이 매니저 사용)
  ↓
skill-manager가 sax-next/skills/ 에 Skill 생성
```

### 이유

1. **매니저 중앙화**: 모든 패키지의 Agent/Skill/Command는 sax-meta의 매니저가 관리
2. **품질 일관성**: 동일한 검증 기준 적용 (Progressive Disclosure, Frontmatter 등)
3. **표준 준수**: Anthropic Skills 표준을 중앙에서 적용

### 위반 감지

접두사가 있고 CRUD 키워드가 감지되었는데 로컬 매니저를 거치지 않으면:

```markdown
[SAX] Compliance Warning: 로컬 매니저 우회 감지

⚠️ {작업 유형} 작업이 매니저 없이 수행되었습니다.

**예상 흐름**: Orchestrator → skill-manager → Skill 생성
**실제 흐름**: Orchestrator → 직접 Skill 생성

**조치 필요**:
1. 생성된 파일을 skill-manager로 감사
2. 표준 준수 여부 확인
```

---

## 🔴 새 세션 시작 시 버전 체크 (NON-NEGOTIABLE)

> **새 세션에서 첫 작업 전, SAX 패키지 버전을 확인하고 업데이트를 제안합니다.**

### 트리거 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (.claude/sax-* 존재)

### 체크 워크플로우

```bash
# 1. 로컬 버전 확인
LOCAL_VERSION=$(cat .claude/sax-meta/VERSION 2>/dev/null)

# 2. 원격 버전 확인
REMOTE_VERSION=$(gh api repos/semicolon-devteam/sax-meta/contents/VERSION --jq '.content' | base64 -d 2>/dev/null)

# 3. 비교
if [ "$LOCAL_VERSION" != "$REMOTE_VERSION" ]; then
  echo "UPDATE_AVAILABLE"
fi
```

### 업데이트 가능 시 출력

```markdown
[SAX] version-updater: 업데이트 가능

📦 **SAX 업데이트 알림**

현재 버전: {local_version}
최신 버전: {remote_version}

업데이트하려면: "SAX 업데이트해줘"
```

### 최신 상태 시 출력 (선택)

```markdown
[SAX] version-updater: 최신 버전 확인 ✅

SAX {version}이 설치되어 있습니다.
```

---

## 🔴 SAX Core 필수 참조

> **모든 작업 전 sax-core 문서 및 공통 컴포넌트를 참조합니다.**

### 문서

| 파일 | 용도 |
|------|------|
| `sax-core/PRINCIPLES.md` | SAX 핵심 원칙 |
| `sax-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 |

### 공통 컴포넌트 (sax-core)

> 설치 시 자동으로 병합되는 공통 Agent/Skill

| 컴포넌트 | 유형 | 역할 |
|----------|------|------|
| `compliance-checker` | Agent | 작업 완료 후 규칙 준수 검증 |
| `version-updater` | Skill | 세션 시작 시 버전 체크 및 업데이트 |

**병합 규칙**: 패키지에 동일 이름 컴포넌트가 있으면 패키지 것 우선

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
| `[po \| next]` | 복수 패키지 |
| `[all]` / (없음) | 모든 패키지 |

> **🔴 CRITICAL: 접두사는 "작업 대상"을 지정할 뿐, 라우팅은 항상 로컬 매니저를 통합니다.**

#### 접두사 ≠ 라우팅 대상

```text
[next] 스킬 만들어줘
  │
  ├─ 접두사 [next]: 작업 대상 = sax-next/skills/
  │
  └─ 라우팅: 현재 설치된 로컬 매니저 사용
             .claude/agents/skill-manager/ (sax-meta)
```

| 구분 | 의미 |
|------|------|
| **접두사** | 어느 패키지 디렉토리에 파일을 생성/수정할지 |
| **라우팅** | 어느 Agent/Skill을 호출할지 (항상 로컬 `.claude/`) |

**예시**:

- `[next] 스킬 만들어줘` → `.claude/agents/skill-manager/`가 `sax-next/skills/`에 생성
- `[po] 에이전트 검토해줘` → `.claude/agents/agent-manager/`가 `sax-po/agents/`를 검토
- `[all] 패키지 검증해줘` → `.claude/skills/package-validator/`가 모든 패키지 검증

### 3. 서브모듈 수정 시 로컬 동기화

> **sax-meta 수정 후 반드시 `.claude/sax-meta/` 동기화**

```bash
cd sax-meta && git push origin main && cd ../.claude/sax-meta && git pull origin main
```

### 4. 작업 완료 후 버저닝

> **🔴 "작업 완료" = 버저닝까지 포함. 버저닝 없이는 작업 완료로 간주하지 않음.**

| 변경 유형 | 버전 타입 |
|----------|----------|
| Agent/Skill/Command 추가/수정/삭제 | MINOR |
| 버그/오타 수정 | PATCH |
| Breaking Change | MAJOR |

#### 버저닝 자동화 규칙

**TodoWrite 자동 추가**:

- Agent/Skill/Command 파일 수정 감지 시 TodoWrite에 "버저닝 처리" 항목 **자동 추가**
- 해당 항목 완료 전까지 작업 완료로 간주하지 않음

**커밋 전 검증**:

- Agent/Skill/Command 변경 커밋 시 다음 확인 필수:
  - VERSION 파일 업데이트 여부
  - CHANGELOG/{version}.md 생성 여부
- 버저닝 미완료 상태에서 커밋 시도 시 경고 출력

#### 세션 복원 시 규칙 재로드

> **이전 세션 이어서 작업 시 CLAUDE.md 필수 규칙 섹션 자동 참조**

세션 복원/컨텍스트 손실 후 작업 재개 시:

1. CLAUDE.md의 "작업 완료 후 버저닝" 섹션 재확인
2. 이전 작업의 버저닝 완료 여부 점검
3. 미완료 버저닝 발견 시 우선 처리

### 5. 규칙 준수 검증

> **모든 작업 완료 후 compliance-checker가 자동 실행됩니다.**

검증 항목:

- sax-core 규칙 준수
- 적절한 Agent/Skill 사용 여부
- 문서 중복 여부 (SoT 원칙)

**상세**: [compliance-checker Agent](agents/compliance-checker/compliance-checker.md) 참조

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
- [Orchestrator](agents/orchestrator/orchestrator.md) - 라우팅 규칙 및 Agent/Skill 목록

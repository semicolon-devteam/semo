# SAX-Meta Package Configuration

> SAX 패키지 자체 관리 및 개발을 위한 메타 패키지

## Package Info

- **Package**: SAX-Meta
- **Version**: 📌 [sax/VERSION](https://github.com/semicolon-devteam/docs/blob/main/sax/VERSION) 참조
- **Target**: docs repository (SAX Source of Truth)
- **Audience**: SAX 개발자, SAX 패키지 관리자
- **Extends**: SAX-Core

## SAX Core 상속

이 패키지는 SAX Core의 기본 원칙을 상속합니다.

@sax-core/PRINCIPLES.md
@sax-core/MESSAGE_RULES.md

> 📖 Core 문서는 `.claude/sax-core/` 디렉토리에서 자동 로드됩니다.

## 🔴 SAX 개발 필수 원칙

### 1. 세션 컨텍스트 비의존 원칙

> **SAX는 세션 컨텍스트에 의지하지 않는다.**

- 꼭 필요한 원칙과 규칙은 **sax-core**, **docs 레포지토리 내 문서**를 통해 참조되어야 함
- Agent, Skill의 **Reference Chain** 안에서 모든 필수 정보가 접근 가능해야 함
- 세션이 종료되거나 컨텍스트가 손실되어도 동일한 결과를 보장

**Reference Chain 구조**:

```text
Agent/Skill → references/ → sax-core/ → docs 레포 문서
```

### 2. 중복 체크 필수 원칙

> **어떤 문서를 생성하거나 수정하든, 반드시 중복 체크를 먼저 수행한다.**

**체크 범위**:

- `.claude/sax-core/` - Core 규칙 문서 (로컬 설치 경로)
- `agents/` - Agent 정의
- `skills/` - Skill 정의
- `docs/` 레포지토리 내 관련 문서 (wiki 포함)

**체크 항목**:

- 동일/유사 규칙이 이미 존재하는가?
- 기존 문서를 수정하는 것이 더 적절한가?
- SoT(Source of Truth) 원칙을 위반하는 중복이 발생하는가?

**중복 발견 시**:

1. 기존 문서 수정 우선
2. 새 문서 생성 시 기존 문서 참조(@import)
3. 절대로 동일 내용을 복사하지 않음

### 3. 작업 완료 후 버저닝 체크 필수 원칙

> **모든 SAX 작업 완료 후 버저닝 필요 여부를 반드시 체크한다.**

**버저닝이 필요한 변경**:

| 변경 유형 | 버전 타입 | 예시 |
|----------|----------|------|
| Agent/Skill/Command 추가 | MINOR | 새 Agent 생성 |
| Agent/Skill/Command 수정 | MINOR | Agent 역할 변경 |
| Agent/Skill/Command 삭제 | MINOR | 사용 중단 Agent 제거 |
| CLAUDE.md 섹션 추가/변경 | MINOR | 새 규칙 추가 |
| 버그/오타 수정 | PATCH | 문서 오타 수정 |
| Breaking Change | MAJOR | 워크플로우 근본 변경 |

**작업 완료 후 필수 출력**:

```markdown
[SAX] 작업 완료: {component} {action}

⚠️ 버저닝 필요: {version_type}

버저닝을 진행하려면: "버저닝 해줘" 또는 "릴리스해줘"
```

**버저닝 미실행 시 경고**:

- 세션 종료 전 버저닝하지 않으면 다음 세션에서 버저닝 누락 가능
- 반드시 작업 세션 내에서 버저닝까지 완료할 것

---

## Package Purpose

SAX-Meta는 SAX 패키지 자체를 관리하고 개발하기 위한 **메타 패키지**입니다.

### 대상 사용자

- **SAX 개발자**: SAX 프레임워크를 개선하고 확장하는 개발자
- **패키지 관리자**: SAX 패키지 구조, 버저닝, 배포를 담당하는 관리자

### 비대상 사용자

- ❌ **PO/기획자**: SAX-PO 패키지 사용
- ❌ **Next.js 개발자**: SAX-Next 패키지 사용
- ❌ **Spring 개발자**: SAX-Spring 패키지 사용

## 설치 대상

이 패키지는 `semicolon-devteam/docs` 레포지토리의 `.claude/` 디렉토리에 플랫 구조로 설치됩니다.

### docs 레포 한정 동기화 규칙

> ⚠️ **중요**: docs 레포지토리에서 SAX 패키지 개선 작업 시, 다음 위치들을 **동시에** 업데이트해야 합니다:

| 위치 | 역할 |
|------|------|
| `.claude/` | SAX-Meta 실제 사용 (설치된 상태, 플랫 구조) |
| `.claude/sax-core/` | SAX Core 실제 사용 (설치된 상태) |
| `sax/core/` | SAX Core 패키지 소스 |
| `sax/packages/sax-meta/` | SAX-Meta 패키지 소스 (배포용) |

**동기화 명령**:

```bash
# Core 동기화 (필수)
rsync -av --delete sax/core/ .claude/sax-core/

# SAX-Meta 동기화 (플랫 구조)
rsync -av --delete \
  --exclude='sax-core' \
  --exclude='settings.local.json' \
  sax/packages/sax-meta/ .claude/
```

> 📝 **참고**: SAX-PO, SAX-Next는 각각 별도 레포지토리에 배포됩니다. docs 레포에는 소스(`sax/packages/`)만 관리합니다.

## Package Components

### Agents

| Agent | 역할 | 파일 |
|-------|------|------|
| orchestrator | 요청 라우팅 | `agents/orchestrator.md` |
| agent-manager | Agent 라이프사이클 관리 | `agents/agent-manager/` |
| skill-manager | Skill 라이프사이클 관리 | `agents/skill-manager/` |
| command-manager | Command 라이프사이클 관리 | `agents/command-manager/` |
| sax-architect | SAX 패키지 설계 | `agents/sax-architect.md` |

### Skills

| Skill | 역할 | 파일 |
|-------|------|------|
| package-validator | SAX 패키지 구조 검증 | `skills/package-validator/` |
| version-manager | SAX 버저닝 자동화 | `skills/version-manager/` |
| package-sync | 패키지 소스 → .claude 동기화 | `skills/package-sync/` |
| package-deploy | 외부 프로젝트 SAX 배포 | `skills/package-deploy/` |

### Scripts

| Script | 역할 | 파일 |
|--------|------|------|
| sync_packages.sh | 패키지 동기화 자동화 | `scripts/sync_packages.sh` |

### Templates

| Template | 역할 | 파일 |
|----------|------|------|
| agent-template | Agent 파일 템플릿 | `templates/agent-template.md` |
| skill-template | Skill 디렉토리 템플릿 | `templates/skill-template/` |
| package-template | 패키지 구조 템플릿 | `templates/package-template/` |

## Installation & Usage

### SAX-Meta 사용 방법

SAX-Meta는 별도 설치가 필요 없습니다. docs 레포지토리에서 직접 사용합니다.

docs 레포지토리에서 SAX 관련 작업 요청 시 자동으로 SAX-Meta 컨텍스트가 활성화됩니다.

```bash
# 예시 요청
"새 Agent 추가해줘"
"버전 릴리스해줘"
"Skill 구조 개선해줘"
```

### 다른 패키지와의 관계

```text
SAX-Meta (메타 관리)
    ↓ 관리
SAX-Core (공통 규칙)
    ↓ 상속
SAX-PO, SAX-Next, SAX-Spring (도메인 패키지)
```

- SAX-Meta는 다른 모든 SAX 패키지를 관리
- SAX-PO/Next/Spring은 SAX-Meta를 직접 사용하지 않음
- 최종 사용자(PO/개발자)는 SAX-Meta를 인지할 필요 없음

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/docs/blob/main/sax/core/PRINCIPLES.md)
- [SAX Core - Packaging](https://github.com/semicolon-devteam/docs/blob/main/sax/core/PACKAGING.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/docs/blob/main/sax/core/MESSAGE_RULES.md)
- [SAX Core - Team Rules](https://github.com/semicolon-devteam/docs/blob/main/sax/core/TEAM_RULES.md)
- [SAX Changelog Index](https://github.com/semicolon-devteam/docs/blob/main/sax/CHANGELOG/INDEX.md)

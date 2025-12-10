---
name: sax-help
description: |
  SAX 도움말 및 Semicolon 팀 컨텍스트 응답 (공통 Skill). Use when (1) /SAX:help 커맨드,
  (2) "도움말", "SAX란", "어떻게 해" 키워드, (3) SAX 사용법 질문.
tools: [Read, Bash, WebFetch]
model: inherit
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: sax-help 호출 - {질문 카테고리}` 시스템 메시지를 첫 줄에 출력하세요.

# sax-help Skill

> SAX 사용법 및 Semicolon 팀 컨텍스트 응답 (SAX 공통 Skill)

## Purpose

모든 SAX 패키지에서 공통으로 사용하는 도움말 Skill입니다.

### 지원 질문 카테고리

| 카테고리 | 예시 질문 | 참조 소스 |
|----------|-----------|-----------|
| **SAX 기본** | "SAX란?", "SAX 어떻게 사용해?" | sax-core/PRINCIPLES.md |
| **패키지 정보** | "설치된 패키지 뭐야?", "버전 확인" | .claude/sax-*/VERSION |
| **명령어 안내** | "/SAX:* 명령어 뭐있어?" | sax-core/commands/ |
| **팀 컨텍스트** | "Semicolon 팀 규칙", "docs 위키" | docs 레포, TEAM_RULES.md |

## Reference Chain

```text
sax-help
├── sax-core/PRINCIPLES.md (SAX 핵심 원칙)
├── sax-core/MESSAGE_RULES.md (메시지 포맷 규칙)
├── sax-core/TEAM_RULES.md (Semicolon 팀 규칙)
├── .claude/sax-*/VERSION (설치된 패키지 버전)
├── .claude/sax-*/CLAUDE.md (패키지별 설명)
└── docs 레포 Wiki (팀 문서)
```

## Workflow

### Step 1: 질문 분류

사용자 질문을 카테고리로 분류합니다:

```text
질문 분석
├─ SAX 사용법 → sax-core 문서 참조
├─ 패키지 정보 → .claude/ 디렉토리 스캔
├─ 명령어 안내 → commands/ 디렉토리 분석
└─ 팀 컨텍스트 → TEAM_RULES.md, docs 레포
```

### Step 2: 정보 수집

**SAX 문서 조회**:

```bash
# SAX 핵심 원칙
cat sax-core/PRINCIPLES.md

# 메시지 규칙
cat sax-core/MESSAGE_RULES.md

# 팀 규칙
cat sax-core/TEAM_RULES.md
```

**패키지 정보 조회**:

```bash
# 설치된 패키지 목록 및 버전
for dir in .claude/sax-*/; do
  name=$(basename "$dir")
  version=$(cat "$dir/VERSION" 2>/dev/null || echo "unknown")
  echo "$name: $version"
done
```

**docs 레포 Wiki 조회**:

```bash
# docs 레포 위키 접근
gh api repos/semicolon-devteam/docs/contents/wiki
```

### Step 3: 응답 제공

```markdown
[SAX] Skill: sax-help 응답

## {질문 카테고리}

{관련 정보 및 안내}

---
📚 상세 정보: [관련 문서 링크]
```

## Quick Reference

### 공통 명령어 (/SAX:*)

| 명령어 | 설명 | 호출 스킬 |
|--------|------|-----------|
| `/SAX:help` | 도움말 (현재) | sax-help |
| `/SAX:slack` | Slack 메시지 전송 | notify-slack |
| `/SAX:update` | SAX 업데이트 | version-updater |
| `/SAX:feedback` | 피드백 제출 | feedback |

### 패키지별 특화 기능

| 패키지 | 설명 | 주요 Agent/Skill |
|--------|------|------------------|
| sax-core | 공통 컴포넌트 | compliance-checker, notify-slack |
| sax-meta | SAX 개발/관리 | sax-architect, version-manager |
| sax-pm | PM 워크플로우 | pm-agent, assign-task |
| sax-po | PO 워크플로우 | issue-planner, complexity-scorer |
| sax-next | Next.js 개발 | next-guide, next-refactorer |
| sax-qa | QA 워크플로우 | qa-agent, test-creator |

## Expected Output

### SAX 소개 질문

```markdown
[SAX] Skill: sax-help 응답

## SAX (Semicolon AI Transformation)

SAX는 Semicolon 팀의 Claude Code 확장 프레임워크입니다.

### 핵심 기능
- **Agent**: 복잡한 워크플로우 자동화
- **Skill**: 재사용 가능한 기능 모듈
- **Command**: 빠른 실행을 위한 슬래시 명령어

### 공통 명령어
| 명령어 | 설명 |
|--------|------|
| `/SAX:help` | 도움말 (현재) |
| `/SAX:slack` | Slack 메시지 전송 |
| `/SAX:update` | SAX 업데이트 |
| `/SAX:feedback` | 피드백 제출 |

---
📚 상세 정보: sax-core/PRINCIPLES.md
```

### 패키지 정보 질문

```markdown
[SAX] Skill: sax-help 응답

## 설치된 SAX 패키지

| 패키지 | 버전 | 설명 |
|--------|------|------|
| sax-core | 0.10.0 | 공통 컴포넌트 |
| sax-meta | 0.35.0 | SAX 패키지 관리 |

### 사용 가능한 Agent/Skill
- Agents: orchestrator, sax-architect, ...
- Skills: notify-slack, version-updater, ...

---
📚 상세 정보: 각 패키지 CLAUDE.md 참조
```

### 팀 규칙 질문

```markdown
[SAX] Skill: sax-help 응답

## Semicolon 팀 규칙

### 기본 설정
- **응답 언어**: 한글
- **기본 Organization**: semicolon-devteam
- **이슈 템플릿**: .github/ISSUE_TEMPLATE 기반

### 참고 문서
- docs 위키: https://github.com/semicolon-devteam/docs/wiki
- 팀 규칙: sax-core/TEAM_RULES.md

---
📚 상세 정보: TEAM_RULES.md
```

## SAX Message Format

```markdown
[SAX] Skill: sax-help 호출 - {질문 카테고리}

[SAX] Skill: sax-help 응답
```

## References

- [docs-integration](references/docs-integration.md) - docs 레포 연동 가이드
- [package-info](references/package-info.md) - 패키지 정보 조회
- [team-context](references/team-context.md) - 팀 컨텍스트 설정

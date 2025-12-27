---
name: version-updater
description: |
  버전 체크 및 업데이트 알림. Use when (1) "버전 체크해줘",
  (2) "업데이트 확인", (3) SEMO 버전 확인.
tools: [Bash, Read]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: version-updater` 시스템 메시지를 첫 줄에 출력하세요.

# version-updater Skill

> 버전 체크 및 업데이트 알림

## 🔴 분리 버전 정책

> **SEMO는 각 패키지별로 독립적인 버전을 관리합니다.**

```
semo-cli (npm)           → 독립 버전 (npm view로 확인)
semo-core/VERSION        → 독립 버전
semo-skills/VERSION      → 독립 버전
packages/*/VERSION       → 각 Extension 독립 버전
```

**이유**:
1. CLI 변경 없이 스킬만 업데이트 가능
2. 필요한 패키지만 선택적 업데이트
3. 버전 불일치로 인한 혼란 방지

## 체크 명령

### CLI 버전 체크

```bash
# 현재 CLI 버전
semo --version

# npm 최신 CLI 버전
npm view @team-semicolon/semo-cli version
```

### semo-system 버전 체크

```bash
# 로컬 버전 (설치된 환경에서)
cat semo-system/semo-core/VERSION
cat semo-system/semo-skills/VERSION

# 원격 최신 버전 (GitHub에서)
gh api repos/semicolon-devteam/semo/contents/semo-core/VERSION --jq '.content' | base64 -d
gh api repos/semicolon-devteam/semo/contents/semo-skills/VERSION --jq '.content' | base64 -d
```

## 🔴 세션 시작 시 자동 버전 체크 (CLAUDE.md 규칙)

새 Claude Code 세션 시작 시 다음 순서로 버전을 체크합니다:

```bash
# 1. 설치된 패키지 목록 확인
ls semo-system/

# 2. 각 패키지 로컬 VERSION vs 원격 VERSION 비교
# 예: semo-core
LOCAL=$(cat semo-system/semo-core/VERSION 2>/dev/null)
REMOTE=$(gh api repos/semicolon-devteam/semo/contents/semo-core/VERSION --jq '.content' | base64 -d 2>/dev/null)

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "업데이트 가능: semo-core ($LOCAL → $REMOTE)"
fi
```

### 출력 포맷

**업데이트 필요 시**:
```
[SEMO] 버전 체크 완료

📦 업데이트 가능:
  - semo-core: 1.0.0 → 1.0.1
  - semo-skills: 1.0.0 → 1.0.2

💡 "semo update" 또는 "SEMO 업데이트해줘"로 업데이트하세요.
```

**최신 상태 시**:
```
[SEMO] 버전 체크 완료 ✅

모든 패키지가 최신 버전입니다.
  - semo-cli: 3.0.12
  - semo-core: 1.0.0
  - semo-skills: 1.0.0
```

## 업데이트 명령

```bash
# 전체 업데이트
semo update

# 특정 패키지만 업데이트
semo update --only semo-core
semo update --only semo-skills
semo update --only biz/management

# CLI만 업데이트 (npm)
semo update --self
```

## Extension 패키지 버전 체크

설치된 Extension 패키지도 동일한 방식으로 체크:

```bash
# 예: biz/management
LOCAL=$(cat semo-system/biz/management/VERSION 2>/dev/null)
REMOTE=$(gh api repos/semicolon-devteam/semo/contents/packages/biz/management/VERSION --jq '.content' | base64 -d 2>/dev/null)
```

## 참조

- [meta CLAUDE.md](../../packages/meta/CLAUDE.md) - 버저닝 규칙
- [semo update 명령어](../../packages/cli/src/index.ts) - CLI 구현

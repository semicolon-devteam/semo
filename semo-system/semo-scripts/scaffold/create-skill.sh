#!/bin/bash
# SEMO Skill Scaffold Script
# 새 스킬 템플릿을 생성합니다.

set -e

SKILL_NAME="$1"
TARGET_DIR="${2:-./skills}"

if [ -z "$SKILL_NAME" ]; then
    echo "Usage: create-skill.sh <skill-name> [target-dir]"
    echo ""
    echo "Example:"
    echo "  create-skill.sh my-skill"
    echo "  create-skill.sh my-skill ./semo-system/semo-skills"
    exit 1
fi

SKILL_DIR="$TARGET_DIR/$SKILL_NAME"

echo "🛠️  SEMO Skill Scaffold"
echo "======================"
echo "Skill:  $SKILL_NAME"
echo "Target: $SKILL_DIR"
echo ""

# 이미 존재하는지 확인
if [ -d "$SKILL_DIR" ]; then
    echo "❌ Skill already exists: $SKILL_DIR"
    exit 1
fi

# 디렉토리 생성
mkdir -p "$SKILL_DIR"
mkdir -p "$SKILL_DIR/references"

# SKILL.md 생성
cat > "$SKILL_DIR/SKILL.md" << EOF
---
name: $SKILL_NAME
description: |
  [스킬 설명을 작성하세요]
  Use when (1) ..., (2) ..., (3) ...
tools: [Read, Write, Edit, Bash, Glob, Grep]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 \`[SEMO] Skill: $SKILL_NAME 호출\` 시스템 메시지를 첫 줄에 출력하세요.

# $SKILL_NAME Skill

> [스킬 한 줄 설명]

## Purpose

[스킬의 목적을 설명하세요]

## Trigger

- [트리거 조건 1]
- [트리거 조건 2]

## Workflow

### 1. [단계 1]

\`\`\`text
[워크플로우 설명]
\`\`\`

### 2. [단계 2]

\`\`\`text
[워크플로우 설명]
\`\`\`

## Output Format

### 성공 시

\`\`\`markdown
[SEMO] Skill: $SKILL_NAME 호출

## 결과

[성공 출력 예시]
\`\`\`

### 실패 시

\`\`\`markdown
[SEMO] Skill: $SKILL_NAME 호출

❌ [실패 메시지]

[실패 원인 및 해결 방법]
\`\`\`

## References

- [Reference File](references/example.md)
EOF

# references/README.md 생성
cat > "$SKILL_DIR/references/README.md" << EOF
# $SKILL_NAME References

이 디렉토리에는 스킬에서 참조하는 상세 문서를 저장합니다.

## 파일 목록

- (아직 없음)

## 용도

- 스킬 내부에서 참조하는 상세 워크플로우
- 예시 코드, 템플릿
- 외부 문서 링크 정리
EOF

echo "✅ Skill created successfully!"
echo ""
echo "📁 Structure:"
echo "   $SKILL_DIR/"
echo "   ├── SKILL.md"
echo "   └── references/"
echo "       └── README.md"
echo ""
echo "📝 Next steps:"
echo "   1. Edit $SKILL_DIR/SKILL.md"
echo "   2. Add references if needed"
echo "   3. Register in orchestrator routing table"

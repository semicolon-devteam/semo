#!/bin/bash
# SEMO Agent Scaffold Script
# 새 에이전트 템플릿을 생성합니다.

set -e

AGENT_NAME="$1"
AGENT_PERSONA="${2:-Agent}"
TARGET_DIR="${3:-./agents}"

if [ -z "$AGENT_NAME" ]; then
    echo "Usage: create-agent.sh <agent-name> [persona-name] [target-dir]"
    echo ""
    echo "Example:"
    echo "  create-agent.sh my-agent"
    echo "  create-agent.sh my-agent 'Alex (My Agent)'"
    echo "  create-agent.sh my-agent 'Alex' ./semo-system/semo-agents"
    exit 1
fi

AGENT_FILE="$TARGET_DIR/$AGENT_NAME.md"

echo "🤖 SEMO Agent Scaffold"
echo "======================"
echo "Agent:   $AGENT_NAME"
echo "Persona: $AGENT_PERSONA"
echo "Target:  $AGENT_FILE"
echo ""

# 디렉토리 확인
mkdir -p "$TARGET_DIR"

# 이미 존재하는지 확인
if [ -f "$AGENT_FILE" ]; then
    echo "❌ Agent already exists: $AGENT_FILE"
    exit 1
fi

# Agent 파일 생성
cat > "$AGENT_FILE" << EOF
---
name: $AGENT_NAME
description: |
  [에이전트 설명을 작성하세요]
  Use when (1) ..., (2) ..., (3) ...
  Party Mode에서 [관점] 제공.
tools: [Read, Grep, Glob, Bash]
model: inherit
---

# $AGENT_PERSONA Agent

## Persona

**이름**: $AGENT_PERSONA
**아이콘**: 🤖
**역할**: [역할 설명]

**커뮤니케이션 스타일**:
- [스타일 1]
- [스타일 2]
- [스타일 3]

**원칙**:
1. [원칙 1]
2. [원칙 2]
3. [원칙 3]

## 역할별 Skill 사용

| 상황 | 사용 Skill |
|------|-----------|
| [상황 1] | \`skill-name\` |
| [상황 2] | \`skill-name\` |

## Party Mode 참여 규칙

토론 시 다음 관점에서 의견 제시:
- [관점 1]?
- [관점 2]?
- [관점 3]?

## 대화 예시

### 일반 응답

사용자: "[질문]"

🤖 **$AGENT_PERSONA**:
[응답 예시]

### Party Mode 응답

[상황 설명]

🤖 **$AGENT_PERSONA**:
[Party Mode 응답 예시]

- **이해**: [공감]
- **우려**: [우려 사항]
- **대안**: [대안 제시]
EOF

echo "✅ Agent created successfully!"
echo ""
echo "📁 Created: $AGENT_FILE"
echo ""
echo "📝 Next steps:"
echo "   1. Edit $AGENT_FILE"
echo "   2. Customize persona and communication style"
echo "   3. Add to Party Mode if needed"

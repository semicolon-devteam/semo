#!/bin/bash
# SEMO Structure Validation Script
# .claude 디렉토리 구조를 검증합니다.

set -e

CLAUDE_DIR="${CLAUDE_DIR:-.claude}"
EXIT_CODE=0

echo "🔍 SEMO Structure Validation"
echo "============================"

# 필수 디렉토리 체크
check_dir() {
    local dir="$1"
    local desc="$2"
    if [ -d "$CLAUDE_DIR/$dir" ]; then
        echo "  ✅ $desc ($dir)"
    else
        echo "  ❌ $desc ($dir) - MISSING"
        EXIT_CODE=1
    fi
}

# 심링크 체크
check_symlink() {
    local link="$1"
    local desc="$2"
    if [ -L "$CLAUDE_DIR/$link" ]; then
        local target=$(readlink "$CLAUDE_DIR/$link")
        if [ -e "$CLAUDE_DIR/$link" ]; then
            echo "  ✅ $desc → $target"
        else
            echo "  ⚠️  $desc → $target (BROKEN)"
            EXIT_CODE=1
        fi
    elif [ -e "$CLAUDE_DIR/$link" ]; then
        echo "  ⚠️  $desc (not a symlink)"
    else
        echo "  ❌ $desc - MISSING"
        EXIT_CODE=1
    fi
}

echo ""
echo "📁 Directory Structure:"
check_dir "semo-core" "semo-core"
check_dir "memory" "Context Mesh"

echo ""
echo "🔗 Symlinks:"
check_symlink "CLAUDE.md" "CLAUDE.md"
check_symlink "agents" "agents"
check_symlink "skills" "skills"
check_symlink "commands" "commands"

echo ""
echo "📄 Files:"
if [ -f "$CLAUDE_DIR/settings.json" ]; then
    echo "  ✅ settings.json"
else
    echo "  ⚠️  settings.json - OPTIONAL"
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Structure Valid"
else
    echo "❌ Validation Failed (exit code: $EXIT_CODE)"
fi

exit $EXIT_CODE

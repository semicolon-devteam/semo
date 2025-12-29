#!/bin/bash
# SEMO Submodule Sync Script
# 서브모듈을 최신 상태로 동기화합니다.

set -e

SEMO_ROOT="${SEMO_ROOT:-$(pwd)}"
SEMO_SYSTEM_DIR="$SEMO_ROOT/semo-system"

echo "🔄 SEMO Submodule Sync"
echo "======================"

# Git 저장소인지 확인
if [ ! -d "$SEMO_ROOT/.git" ]; then
    echo "❌ Error: Not a git repository"
    exit 1
fi

# 서브모듈 존재 확인
if [ ! -f "$SEMO_ROOT/.gitmodules" ]; then
    echo "ℹ️  No submodules found"
    exit 0
fi

echo ""
echo "📦 Initializing submodules..."
git submodule init

echo ""
echo "📥 Updating submodules..."
git submodule update --remote --merge

echo ""
echo "📋 Submodule Status:"
git submodule status

echo ""
echo "✅ Sync Complete!"

#!/bin/bash
# SEMO Version Check Script
# 설치된 패키지의 버전을 확인합니다.

set -e

SEMO_ROOT="${SEMO_ROOT:-$(pwd)}"
SEMO_SYSTEM_DIR="$SEMO_ROOT/semo-system"

echo "📦 SEMO Version Check"
echo "====================="

# 버전 파일 읽기
read_version() {
    local path="$1"
    if [ -f "$path/VERSION" ]; then
        cat "$path/VERSION" | tr -d '\n'
    else
        echo "-"
    fi
}

# 패키지별 버전 출력
echo ""
printf "%-20s %s\n" "Package" "Version"
printf "%-20s %s\n" "-------" "-------"

# Standard packages
printf "%-20s %s\n" "semo-core" "$(read_version "$SEMO_SYSTEM_DIR/semo-core")"
printf "%-20s %s\n" "semo-skills" "$(read_version "$SEMO_SYSTEM_DIR/semo-skills")"
printf "%-20s %s\n" "semo-agents" "$(read_version "$SEMO_SYSTEM_DIR/semo-agents")"
printf "%-20s %s\n" "semo-scripts" "$(read_version "$SEMO_SYSTEM_DIR/semo-scripts")"
printf "%-20s %s\n" "semo-hooks" "$(read_version "$SEMO_SYSTEM_DIR/semo-hooks")"
printf "%-20s %s\n" "semo-remote" "$(read_version "$SEMO_SYSTEM_DIR/semo-remote")"

# Meta package
if [ -d "$SEMO_SYSTEM_DIR/meta" ]; then
    printf "%-20s %s\n" "meta" "$(read_version "$SEMO_SYSTEM_DIR/meta")"
fi

echo ""

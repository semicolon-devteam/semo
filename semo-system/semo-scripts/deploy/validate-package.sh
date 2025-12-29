#!/bin/bash
# SEMO Package Validation Script
# 패키지의 필수 파일과 구조를 검증합니다.

set -e

PACKAGE_DIR="${1:-.}"
EXIT_CODE=0

echo "🔍 SEMO Package Validation"
echo "=========================="
echo "Package: $PACKAGE_DIR"
echo ""

# 필수 파일 체크
check_file() {
    local file="$1"
    local desc="$2"
    local required="${3:-true}"

    if [ -f "$PACKAGE_DIR/$file" ]; then
        echo "  ✅ $desc"
    elif [ "$required" = "true" ]; then
        echo "  ❌ $desc - REQUIRED"
        EXIT_CODE=1
    else
        echo "  ⚠️  $desc - optional"
    fi
}

# 디렉토리 체크
check_dir() {
    local dir="$1"
    local desc="$2"
    local required="${3:-true}"

    if [ -d "$PACKAGE_DIR/$dir" ]; then
        local count=$(find "$PACKAGE_DIR/$dir" -maxdepth 1 -type d | wc -l)
        echo "  ✅ $desc ($((count-1)) items)"
    elif [ "$required" = "true" ]; then
        echo "  ❌ $desc - REQUIRED"
        EXIT_CODE=1
    else
        echo "  ⚠️  $desc - optional"
    fi
}

echo "📄 Required Files:"
check_file "VERSION" "VERSION file"
check_file "CLAUDE.md" "CLAUDE.md" "false"

echo ""
echo "📁 Directory Structure:"
check_dir "skills" "Skills directory" "false"
check_dir "agents" "Agents directory" "false"
check_dir "commands" "Commands directory" "false"
check_dir "CHANGELOG" "Changelog directory"

echo ""
echo "📋 VERSION Content:"
if [ -f "$PACKAGE_DIR/VERSION" ]; then
    version=$(cat "$PACKAGE_DIR/VERSION" | tr -d '\n')
    if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "  ✅ Valid semver: $version"
    else
        echo "  ❌ Invalid version format: $version"
        EXIT_CODE=1
    fi
fi

echo ""
echo "📚 CHANGELOG Check:"
if [ -d "$PACKAGE_DIR/CHANGELOG" ]; then
    changelog_count=$(find "$PACKAGE_DIR/CHANGELOG" -name "*.md" | wc -l)
    echo "  ✅ $changelog_count changelog entries"

    # 현재 버전 changelog 존재 확인
    if [ -f "$PACKAGE_DIR/VERSION" ]; then
        version=$(cat "$PACKAGE_DIR/VERSION" | tr -d '\n')
        if [ -f "$PACKAGE_DIR/CHANGELOG/$version.md" ]; then
            echo "  ✅ Current version changelog exists"
        else
            echo "  ⚠️  Missing changelog for v$version"
        fi
    fi
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Package Valid"
else
    echo "❌ Validation Failed"
fi

exit $EXIT_CODE

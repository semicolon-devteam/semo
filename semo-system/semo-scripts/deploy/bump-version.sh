#!/bin/bash
# SEMO Version Bump Script
# 패키지 버전을 자동으로 증가시킵니다.

set -e

PACKAGE_DIR="${1:-.}"
BUMP_TYPE="${2:-patch}"  # major, minor, patch

echo "🔢 SEMO Version Bump"
echo "===================="

# VERSION 파일 확인
if [ ! -f "$PACKAGE_DIR/VERSION" ]; then
    echo "❌ VERSION file not found in $PACKAGE_DIR"
    exit 1
fi

# 현재 버전 읽기
CURRENT_VERSION=$(cat "$PACKAGE_DIR/VERSION" | tr -d '\n')
echo "Current: $CURRENT_VERSION"

# 버전 파싱
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# 버전 증가
case "$BUMP_TYPE" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
    *)
        echo "❌ Invalid bump type: $BUMP_TYPE"
        echo "   Use: major, minor, or patch"
        exit 1
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "New:     $NEW_VERSION ($BUMP_TYPE)"

# 버전 파일 업데이트
echo "$NEW_VERSION" > "$PACKAGE_DIR/VERSION"

# CHANGELOG 디렉토리 생성
mkdir -p "$PACKAGE_DIR/CHANGELOG"

# CHANGELOG 템플릿 생성
CHANGELOG_FILE="$PACKAGE_DIR/CHANGELOG/$NEW_VERSION.md"
if [ ! -f "$CHANGELOG_FILE" ]; then
    cat > "$CHANGELOG_FILE" << EOF
# $NEW_VERSION ($(date +%Y-%m-%d))

## Added

-

## Changed

-

## Fixed

-

## Notes

-
EOF
    echo ""
    echo "📝 Created: $CHANGELOG_FILE"
    echo "   Please update the changelog with your changes."
fi

echo ""
echo "✅ Version bumped: $CURRENT_VERSION → $NEW_VERSION"

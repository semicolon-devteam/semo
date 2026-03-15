#!/bin/bash

# ═══════════════════════════════════════
# AI Readability 표준 프로젝트 적용 스크립트
# ═══════════════════════════════════════

set -e

PROJECT_PATH=$1
PROJECT_TYPE=$2  # react, rn, java

if [ -z "$PROJECT_PATH" ] || [ -z "$PROJECT_TYPE" ]; then
  echo "Usage: ./apply-to-project.sh <PROJECT_PATH> <PROJECT_TYPE>"
  echo "PROJECT_TYPE: react | rn | java"
  exit 1
fi

echo "🚀 Applying AI Readability standards to $PROJECT_PATH ($PROJECT_TYPE)"

cd "$PROJECT_PATH"

# ═══════════════════════════════════════
# 1. ESLint/Checkstyle 설정
# ═══════════════════════════════════════

if [ "$PROJECT_TYPE" = "react" ]; then
  echo "📋 Copying React ESLint config..."
  cp ~/workspace/standards/templates/.eslintrc.react.json .eslintrc.json
  
elif [ "$PROJECT_TYPE" = "rn" ]; then
  echo "📋 Copying React Native ESLint config..."
  
  # 기존 설정 백업
  if [ -f .eslintrc.json ]; then
    cp .eslintrc.json .eslintrc.json.backup
    echo "  ✅ Existing config backed up to .eslintrc.json.backup"
  fi
  
  cp ~/workspace/standards/templates/.eslintrc.rn.json .eslintrc.json
  
elif [ "$PROJECT_TYPE" = "java" ]; then
  echo "📋 Copying Java Checkstyle config..."
  cp ~/workspace/standards/templates/checkstyle.xml .
  
  echo "  ⚠️  Don't forget to update pom.xml or build.gradle!"
fi

# ═══════════════════════════════════════
# 2. VSCode 설정
# ═══════════════════════════════════════

echo "📋 Setting up VSCode config..."
mkdir -p .vscode
cp ~/workspace/standards/templates/.vscode-settings.json .vscode/settings.json

# ═══════════════════════════════════════
# 3. Husky + lint-staged (JavaScript 프로젝트만)
# ═══════════════════════════════════════

if [ "$PROJECT_TYPE" != "java" ]; then
  echo "📋 Setting up Husky pre-commit hook..."
  
  # Husky 설치
  npm install --save-dev husky lint-staged
  
  # Husky 초기화
  npx husky install
  
  # Pre-commit hook 추가
  mkdir -p .husky
  cp ~/workspace/standards/templates/pre-commit.sh .husky/pre-commit
  chmod +x .husky/pre-commit
  
  # package.json에 lint-staged 설정 추가
  echo "  ⚠️  Don't forget to add lint-staged config to package.json!"
  echo '
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --max-warnings 0",
      "prettier --write"
    ]
  }
}'
fi

# ═══════════════════════════════════════
# 4. GitHub Actions
# ═══════════════════════════════════════

echo "📋 Setting up GitHub Actions..."
mkdir -p .github/workflows
cp ~/workspace/standards/templates/ai-readability-check.yml .github/workflows/

# ═══════════════════════════════════════
# 5. Scripts 디렉토리
# ═══════════════════════════════════════

echo "📋 Copying scripts..."
mkdir -p scripts
cp ~/workspace/standards/scripts/analyze-violations.js scripts/

# ═══════════════════════════════════════
# 완료
# ═══════════════════════════════════════

echo ""
echo "✅ AI Readability standards applied successfully!"
echo ""
echo "Next steps:"
echo "  1. Update package.json scripts:"
echo "     - \"lint\": \"eslint . --ext .ts,.tsx --max-warnings 0\""
echo "     - \"type-check\": \"tsc --noEmit\""
echo "  2. Test ESLint: npm run lint"
echo "  3. Test pre-commit: git add . && git commit -m 'test'"
echo "  4. Push to trigger CI check"
echo ""

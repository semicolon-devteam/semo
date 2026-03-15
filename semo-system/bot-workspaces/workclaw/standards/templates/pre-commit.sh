#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# ═══════════════════════════════════════
# AI Readability Pre-commit Hook
# ═══════════════════════════════════════

echo "🔍 AI Readability 검증 중..."

# lint-staged 실행
npx lint-staged

# TypeScript 타입 체크
echo "📘 TypeScript 타입 체크..."
npm run type-check

echo "✅ Pre-commit 검증 완료"

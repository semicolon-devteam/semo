#!/bin/bash

# ═══════════════════════════════════════
# AI Readability 표준 - 전체 프로젝트 자동 적용
# ═══════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STANDARDS_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 AI Readability 표준 - 전체 프로젝트 적용 시작"
echo ""

# ═══════════════════════════════════════
# 프로젝트 목록
# ═══════════════════════════════════════

declare -A PROJECTS=(
  ["/Users/reus/Desktop/Sources/semicolon/projects/land/proj-play-land"]="react"
  ["/Users/reus/Desktop/Sources/semicolon/projects/land/core-backend"]="java"
  ["/Users/reus/Desktop/Sources/semicolon/projects/jungchipan"]="react"
  ["/Users/reus/Desktop/Sources/semicolon/projects/star-spot"]="react"
)

# PS 프로젝트는 별도 처리 (기존 파일 예외 필요)
PS_PROJECT="/Users/reus/Desktop/Sources/semicolon/projects/ps-mobile"

# ═══════════════════════════════════════
# 각 프로젝트에 적용
# ═══════════════════════════════════════

for PROJECT_PATH in "${!PROJECTS[@]}"; do
  PROJECT_TYPE="${PROJECTS[$PROJECT_PATH]}"
  
  echo "───────────────────────────────────────"
  echo "📦 Processing: $(basename "$PROJECT_PATH") ($PROJECT_TYPE)"
  echo "───────────────────────────────────────"
  
  if [ ! -d "$PROJECT_PATH" ]; then
    echo "⚠️  Project not found: $PROJECT_PATH"
    echo "   Skipping..."
    echo ""
    continue
  fi
  
  # apply-to-project.sh 실행
  bash "$SCRIPT_DIR/apply-to-project.sh" "$PROJECT_PATH" "$PROJECT_TYPE"
  
  echo "✅ $(basename "$PROJECT_PATH") completed"
  echo ""
done

# ═══════════════════════════════════════
# PS 프로젝트 특별 처리
# ═══════════════════════════════════════

echo "───────────────────────────────────────"
echo "📦 Processing: PS (React Native) - Special handling"
echo "───────────────────────────────────────"

if [ -d "$PS_PROJECT" ]; then
  cd "$PS_PROJECT"
  
  # 기존 설정 백업
  if [ -f .eslintrc.json ]; then
    cp .eslintrc.json .eslintrc.json.backup.$(date +%Y%m%d)
    echo "  ✅ Existing config backed up"
  fi
  
  # 새 설정 적용
  cp "$STANDARDS_DIR/templates/.eslintrc.rn.json" .eslintrc.json
  
  # 기존 위반 파일 스캔
  echo "  🔍 Scanning existing violations..."
  node "$STANDARDS_DIR/scripts/analyze-violations.js" > violations-report.txt || true
  
  echo "  📋 Violations report saved to violations-report.txt"
  
  # 기존 파일 예외 처리 설정 추가
  echo '
{
  "overrides": [
    {
      "files": ["src/**/*.{ts,tsx}"],
      "excludedFiles": [
        "src/features/call/screens/VideoCallScreen.tsx",
        "src/features/club/screens/ClubDashboardScreen.tsx",
        "src/features/club/screens/ClubHouseScreen.tsx",
        "src/features/gamification/screens/LeagueScreen.tsx"
      ],
      "rules": {
        "max-lines": ["error", { "max": 600 }]
      }
    },
    {
      "files": [
        "src/features/call/screens/VideoCallScreen.tsx",
        "src/features/club/screens/ClubDashboardScreen.tsx",
        "src/features/club/screens/ClubHouseScreen.tsx",
        "src/features/gamification/screens/LeagueScreen.tsx"
      ],
      "rules": {
        "max-lines": ["warn", { "max": 600 }]
      }
    }
  ]
}
' > .eslintrc.overrides.json
  
  echo "  ✅ PS project overrides configured"
  echo ""
else
  echo "⚠️  PS project not found: $PS_PROJECT"
  echo "   Skipping..."
  echo ""
fi

# ═══════════════════════════════════════
# 완료 요약
# ═══════════════════════════════════════

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ 전체 프로젝트 적용 완료"
echo "═══════════════════════════════════════"
echo ""
echo "적용된 프로젝트:"
for PROJECT_PATH in "${!PROJECTS[@]}"; do
  if [ -d "$PROJECT_PATH" ]; then
    echo "  ✅ $(basename "$PROJECT_PATH")"
  fi
done

if [ -d "$PS_PROJECT" ]; then
  echo "  ✅ PS (with overrides)"
fi

echo ""
echo "Next steps:"
echo "  1. 각 프로젝트에서 package.json scripts 업데이트"
echo "  2. npm run lint 테스트"
echo "  3. Git commit으로 pre-commit hook 테스트"
echo "  4. GitHub에 push하여 CI 테스트"
echo "  5. Branch protection rule 설정 (GitHub UI)"
echo ""
echo "자세한 사항은 standards/ENFORCEMENT-PLAN.md 참고"
echo ""

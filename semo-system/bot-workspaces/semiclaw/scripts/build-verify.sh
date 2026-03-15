#!/bin/bash
# build-verify.sh — PR 머지 전 빌드/타입/린트 검증
#
# 용도: WorkClaw가 PR 생성 전, ReviewClaw가 리뷰 시 호출
#       TypeScript + ESLint + Next.js 빌드를 순서대로 실행
#
# 사용법:
#   build-verify.sh [패키지_경로]
#   build-verify.sh                          # 전체 (루트 기준)
#   build-verify.sh packages/semo-dashboard  # 특정 패키지
#
# 출력: PASS or FAIL + 실패 원인

set -uo pipefail

TARGET="${1:-}"
PASS=0
FAIL_REASONS=()

log() { echo "[$(date '+%H:%M:%S')] build-verify: $*"; }

run_check() {
  local name="$1"
  shift
  log "$name 시작..."
  if "$@" 2>&1; then
    log "$name ✅ PASS"
    PASS=$((PASS + 1))
  else
    log "$name ❌ FAIL"
    FAIL_REASONS+=("$name")
  fi
}

# 경로 설정
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [ -n "$TARGET" ]; then
  WORK_DIR="$REPO_ROOT/$TARGET"
else
  WORK_DIR="$REPO_ROOT"
fi

cd "$WORK_DIR"

log "검증 시작 (경로: $WORK_DIR)"

# 1. TypeScript 타입 체크
if [ -f "tsconfig.json" ]; then
  run_check "TypeScript" npx tsc --noEmit
fi

# 2. ESLint
if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ] || [ -f "eslint.config.js" ] || [ -f "eslint.config.mjs" ]; then
  run_check "ESLint" npx eslint . --ext .ts,.tsx --max-warnings 0
fi

# 3. 빌드
if [ -f "package.json" ] && grep -q '"build"' package.json; then
  run_check "Build" npm run build
fi

# 결과 출력
echo ""
if [ ${#FAIL_REASONS[@]} -eq 0 ]; then
  echo "✅ build-verify PASS ($PASS 체크 통과)"
  exit 0
else
  echo "❌ build-verify FAIL"
  echo "실패 항목: ${FAIL_REASONS[*]}"
  exit 1
fi

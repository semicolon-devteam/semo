#!/bin/bash
#
# SEMO Promptfoo 품질 평가 실행 스크립트
#
# Usage:
#   ./run-eval.sh              # 전체 평가 실행
#   ./run-eval.sh --quick      # 빠른 평가 (Haiku만)
#   ./run-eval.sh --view       # 최근 결과 보기
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 색상
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# 결과 디렉토리 생성
mkdir -p results

case "$1" in
  --quick)
    log_info "빠른 평가 실행 (Haiku 모델만)..."
    npx promptfoo eval \
      --config promptfooconfig.yaml \
      --providers anthropic:claude-3-5-haiku-20241022 \
      --repeat 3 \
      -o results/quick-$(date +%Y%m%d-%H%M%S).json
    ;;

  --view)
    log_info "최근 결과 보기..."
    npx promptfoo view results/latest.json
    ;;

  --ci)
    log_info "CI 모드 실행 (실패 시 exit 1)..."
    npx promptfoo eval \
      --config promptfooconfig.yaml \
      --repeat 3 \
      --grader anthropic:claude-3-5-haiku-20241022 \
      -o results/ci-$(date +%Y%m%d-%H%M%S).json \
      --exit-code
    ;;

  *)
    log_info "전체 평가 실행..."
    npx promptfoo eval \
      --config promptfooconfig.yaml \
      --repeat 5 \
      -o results/latest.json

    log_success "평가 완료! 결과: results/latest.json"
    echo ""
    echo "결과 보기: ./run-eval.sh --view"
    ;;
esac

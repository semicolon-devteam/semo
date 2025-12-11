#!/bin/bash
#
# Promptfoo 최소 테스트 실행
#
# 사전 조건:
#   - Node.js 18+
#   - ANTHROPIC_API_KEY 환경변수 설정
#
# 사용법:
#   ./run-minimal.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 색상
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Promptfoo 최소 테스트${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 환경 확인
echo -e "${YELLOW}[1/4] 환경 확인...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js가 설치되어 있지 않습니다.${NC}"
    exit 1
fi
echo "  Node.js: $(node --version)"

if ! command -v npx &> /dev/null; then
    echo -e "${RED}[ERROR] npx가 설치되어 있지 않습니다.${NC}"
    exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}[ERROR] ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.${NC}"
    echo ""
    echo "설정 방법:"
    echo "  export ANTHROPIC_API_KEY=sk-ant-xxxxx"
    exit 1
fi
echo "  ANTHROPIC_API_KEY: 설정됨 ✓"
echo ""

# 2. 결과 디렉토리 생성
echo -e "${YELLOW}[2/4] 결과 디렉토리 생성...${NC}"
mkdir -p results
echo "  results/ ✓"
echo ""

# 3. Promptfoo 실행
echo -e "${YELLOW}[3/4] Promptfoo 실행 중...${NC}"
echo "  설정: minimal-test.yaml"
echo "  모델: claude-3-5-haiku-20241022"
echo "  테스트: 3개"
echo ""

npx promptfoo eval \
  --config minimal-test.yaml \
  --output results/minimal-test.json \
  --no-cache

echo ""

# 4. 결과 요약
echo -e "${YELLOW}[4/4] 결과 요약${NC}"
echo ""

if [ -f "results/minimal-test.json" ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  테스트 완료!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "결과 파일: results/minimal-test.json"
    echo ""
    echo "결과 보기 (웹 UI):"
    echo "  npx promptfoo view results/minimal-test.json"
    echo ""
    echo "또는 JSON 직접 확인:"
    echo "  cat results/minimal-test.json | jq '.results.stats'"
else
    echo -e "${RED}[ERROR] 결과 파일이 생성되지 않았습니다.${NC}"
    exit 1
fi

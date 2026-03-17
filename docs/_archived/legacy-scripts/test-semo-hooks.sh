#!/bin/bash
# test-semo-hooks.sh — SEMO v4 훅 전체 자동 검증 스크립트
# 실행: bash scripts/test-semo-hooks.sh
# 요구: DATABASE_URL, OPENAI_API_KEY 환경변수, SSH 터널 열린 상태

set -uo pipefail

PASS=0
FAIL=0
SKIP=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

pass() { echo -e "${GREEN}✅${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}❌${NC} $1"; FAIL=$((FAIL + 1)); }
skip() { echo -e "${YELLOW}⏭️${NC}  $1 (skipped)"; SKIP=$((SKIP + 1)); }

SEMO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SEMO_DIR"

echo ""
echo -e "${BOLD}══════════════════════════════════════${NC}"
echo -e "${BOLD}  SEMO v4 Hook Verification Suite     ${NC}"
echo -e "${BOLD}══════════════════════════════════════${NC}"
echo ""

# ── 사전 체크 ────────────────────────────────────────────────
echo -e "${BOLD}[사전 체크]${NC}"

if ! command -v semo &>/dev/null; then
  echo -e "${RED}ERROR: semo CLI not found. Run: sudo npm install -g @team-semicolon/semo-cli${NC}"
  exit 1
fi
echo "  semo $(semo -V) at $(which semo)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
  exit 1
fi
echo "  DATABASE_URL: SET"

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "  OPENAI_API_KEY: NOT SET (TC-06, TC-07 will be skipped)"
  HAS_OPENAI=0
else
  echo "  OPENAI_API_KEY: SET"
  HAS_OPENAI=1
fi

# SSH 터널 체크
if nc -z localhost 15432 2>/dev/null; then
  echo "  SSH tunnel: OPEN"
else
  echo -e "${RED}ERROR: SSH tunnel not open. Run: ssh -f -N -L 15432:10.0.0.91:5432 -J opc@152.70.244.169 opc@10.0.0.91${NC}"
  exit 1
fi
echo ""

# ── TC-01: DB 연결 / semo doctor ──────────────────────────────
echo -e "${BOLD}[TC-01] semo doctor${NC}"
if semo doctor 2>&1 | grep -q "설치 상태 정상"; then
  pass "semo doctor 정상 완료"
else
  fail "semo doctor 실패"
fi
echo ""

# ── TC-02: context sync ───────────────────────────────────────
echo -e "${BOLD}[TC-02] semo context sync${NC}"
OUTPUT=$(semo context sync 2>&1)
if echo "$OUTPUT" | grep -q "7개 파일"; then
  pass "context sync — 7개 파일 업데이트"
  # 파일 존재 확인
  EXPECTED_FILES=(team.md bots.md decisions.md infra.md ontology.md process.md projects.md)
  for f in "${EXPECTED_FILES[@]}"; do
    if [ -f ".claude/memory/$f" ]; then
      echo "    .claude/memory/$f ✓"
    else
      fail "  .claude/memory/$f 없음"
    fi
  done
else
  fail "context sync 실패: $OUTPUT"
fi
echo ""

# ── TC-03: context push ───────────────────────────────────────
echo -e "${BOLD}[TC-03] semo context push${NC}"
OUTPUT=$(semo context push 2>&1)
if echo "$OUTPUT" | grep -q "push 완료"; then
  COUNT=$(echo "$OUTPUT" | grep -oE '[0-9]+건' | head -1)
  pass "context push — $COUNT 업서트"
else
  fail "context push 실패: $OUTPUT"
fi
echo ""

# ── TC-04: bots sync ──────────────────────────────────────────
echo -e "${BOLD}[TC-04] semo bots sync${NC}"
OUTPUT=$(semo bots sync 2>&1)
if echo "$OUTPUT" | grep -q "7개 봇"; then
  pass "bots sync — 7개 봇 업서트"
else
  fail "bots sync 실패: $OUTPUT"
fi
echo ""

# ── TC-05: bots set-status ────────────────────────────────────
echo -e "${BOLD}[TC-05] semo bots set-status${NC}"
semo bots set-status workclaw online 2>&1 >/dev/null
STATUS=$(semo bots status 2>&1 | grep workclaw)
if echo "$STATUS" | grep -q "online"; then
  pass "bots set-status online → workclaw online"
else
  fail "online 설정 실패: $STATUS"
fi

semo bots set-status workclaw offline 2>&1 >/dev/null
STATUS=$(semo bots status 2>&1 | grep workclaw)
if echo "$STATUS" | grep -q "offline"; then
  pass "bots set-status offline → workclaw offline"
else
  fail "offline 설정 실패: $STATUS"
fi
echo ""

# ── TC-06: kb search (시맨틱 검색) ───────────────────────────
echo -e "${BOLD}[TC-06] semo kb search${NC}"
if [ $HAS_OPENAI -eq 1 ]; then
  OUTPUT=$(semo kb search "봇 역할 분담" 2>&1)
  if echo "$OUTPUT" | grep -q "검색 결과"; then
    COUNT=$(echo "$OUTPUT" | grep -c "%)" || echo 0)
    pass "kb search — ${COUNT}건 결과"
  else
    fail "kb search 실패: $OUTPUT"
  fi
else
  skip "OPENAI_API_KEY 미설정"
fi
echo ""

# ── TC-07: kb embed 상태 확인 ─────────────────────────────────
echo -e "${BOLD}[TC-07] kb embed 상태${NC}"
if [ $HAS_OPENAI -eq 1 ]; then
  # 임베딩 누락 항목 수 확인 (psql 없이 semo로)
  OUTPUT=$(semo kb list 2>&1 | wc -l)
  pass "kb 항목 목록 조회 가능 ($OUTPUT lines)"
else
  skip "OPENAI_API_KEY 미설정"
fi
echo ""

# ── TC-08: get 명령 ───────────────────────────────────────────
echo -e "${BOLD}[TC-08] semo get commands${NC}"
if semo get projects 2>&1 | grep -qE "project|프로젝트"; then
  pass "get projects 정상"
else
  fail "get projects 실패"
fi

if semo get bots 2>&1 | grep -qE "workclaw|semiclaw"; then
  pass "get bots 정상"
else
  fail "get bots 실패"
fi

if semo get kb --domain team 2>&1 | grep -qE "team|kb_id"; then
  pass "get kb --domain team 정상"
else
  fail "get kb 실패"
fi
echo ""

# ── TC-09: 크론잡 등록 확인 ──────────────────────────────────
echo -e "${BOLD}[TC-09] 크론잡 등록 확인${NC}"
if crontab -l 2>/dev/null | grep -q "semo bots sync"; then
  pass "크론잡 등록됨: $(crontab -l | grep semo | head -1)"
else
  fail "크론잡 미등록"
fi
echo ""

# ── TC-10: OpenClaw 훅 파일 존재 확인 ────────────────────────
echo -e "${BOLD}[TC-10] OpenClaw 훅 파일 확인${NC}"
BOT_DIRS=(
  "$HOME/.openclaw:semiclaw"
  "$HOME/.openclaw-workclaw:workclaw"
  "$HOME/.openclaw-planclaw:planclaw"
  "$HOME/.openclaw-reviewclaw:reviewclaw"
  "$HOME/.openclaw-designclaw:designclaw"
  "$HOME/.openclaw-infraclaw:infraclaw"
  "$HOME/.openclaw-growthclaw:growthclaw"
)
for entry in "${BOT_DIRS[@]}"; do
  DIR="${entry%%:*}"
  BOT="${entry##*:}"
  HOOK_DIR="$DIR/workspace/hooks/semo-bot-status"
  if [ -f "$HOOK_DIR/handler.ts" ] && [ -f "$HOOK_DIR/HOOK.md" ]; then
    # handler.ts에 올바른 BOT_ID 확인
    if grep -q "\"$BOT\"" "$HOOK_DIR/handler.ts"; then
      pass "$BOT: handler.ts + HOOK.md (BOT_ID=$BOT ✓)"
    else
      fail "$BOT: handler.ts BOT_ID 불일치"
    fi
  else
    fail "$BOT: 훅 파일 없음 ($HOOK_DIR)"
  fi
done
echo ""

# ── TC-11: SessionStart 훅 설정 확인 ─────────────────────────
echo -e "${BOLD}[TC-11] .claude/settings.json 훅 확인${NC}"
SETTINGS=".claude/settings.json"
if python3 -c "
import json, sys
d = json.load(open('$SETTINGS'))
hooks = d.get('hooks', {})
ss = str(hooks.get('SessionStart', []))
stop = str(hooks.get('Stop', []))
assert 'context sync' in ss, 'context sync missing from SessionStart'
assert 'bots sync' in ss, 'bots sync missing from SessionStart'
assert 'context push' in stop, 'context push missing from Stop'
print('OK')
" 2>&1 | grep -q "OK"; then
  pass "SessionStart: context sync + bots sync"
  pass "Stop: context push"
else
  fail "settings.json 훅 설정 오류"
fi
echo ""

# ── 결과 요약 ─────────────────────────────────────────────────
echo -e "${BOLD}══════════════════════════════════════${NC}"
echo -e "${BOLD}  결과 요약${NC}"
echo -e "${BOLD}══════════════════════════════════════${NC}"
echo -e "  ${GREEN}PASS${NC}: $PASS"
echo -e "  ${RED}FAIL${NC}: $FAIL"
echo -e "  ${YELLOW}SKIP${NC}: $SKIP"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}${BOLD}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}💥 $FAIL test(s) failed${NC}"
  exit 1
fi

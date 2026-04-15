#!/usr/bin/env bash
# test-plan-review-skill.sh — Comprehensive test suite for plan-review SKILL.md
# Tests: structural compliance, content completeness, reference integrity,
#        path correctness, and global cache sync.
set -euo pipefail

################################################################################
# Config
################################################################################
SOURCE_DIR="$HOME/.openclaw-planclaw/workspace/skills/plan-review"
SOURCE_SKILL="$SOURCE_DIR/SKILL.md"
SOURCE_REFS="$SOURCE_DIR/references"
CACHE_DIR="$HOME/.claude/skills/plan-review"
CACHE_SKILL="$CACHE_DIR/SKILL.md"
CACHE_REFS="$CACHE_DIR/references"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

################################################################################
# Helpers
################################################################################
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo -e "  ${GREEN}PASS${RESET} $1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo -e "  ${RED}FAIL${RESET} $1"
  [ -n "${2:-}" ] && echo -e "       ${RED}→ $2${RESET}"
}

skip() {
  SKIP_COUNT=$((SKIP_COUNT + 1))
  echo -e "  ${YELLOW}SKIP${RESET} $1"
}

section() {
  echo ""
  echo -e "${CYAN}${BOLD}[$1]${RESET} $2"
  echo -e "${CYAN}$(printf '%.0s─' {1..60})${RESET}"
}

################################################################################
# Pre-flight
################################################################################
section "PRE" "Checking source files exist"

if [ ! -f "$SOURCE_SKILL" ]; then
  fail "Source SKILL.md exists" "Not found: $SOURCE_SKILL"
  echo -e "\n${RED}Cannot continue without source SKILL.md. Aborting.${RESET}"
  exit 1
else
  pass "Source SKILL.md exists"
fi

if [ ! -d "$SOURCE_REFS" ]; then
  fail "Source references/ directory exists" "Not found: $SOURCE_REFS"
  echo -e "\n${RED}Cannot continue without references directory. Aborting.${RESET}"
  exit 1
else
  pass "Source references/ directory exists"
fi

################################################################################
# 1. Structural Compliance — Frontmatter
################################################################################
section "1" "Structural Compliance — Frontmatter"

# Extract frontmatter (between first two --- lines)
FRONTMATTER=$(sed -n '/^---$/,/^---$/p' "$SOURCE_SKILL" | head -20)

# 1a. Frontmatter exists
if echo "$FRONTMATTER" | grep -q '^---$'; then
  pass "Frontmatter delimiters present"
else
  fail "Frontmatter delimiters present" "No --- delimiters found"
fi

# 1b. name field exists and is kebab-case
NAME_LINE=$(echo "$FRONTMATTER" | grep '^name:' || true)
if [ -n "$NAME_LINE" ]; then
  NAME_VALUE=$(echo "$NAME_LINE" | sed 's/^name: *//')
  if echo "$NAME_VALUE" | grep -qE '^[a-z][a-z0-9-]*$'; then
    pass "name is kebab-case: '$NAME_VALUE'"
  else
    fail "name is kebab-case" "Got: '$NAME_VALUE'"
  fi

  NAME_LEN=${#NAME_VALUE}
  if [ "$NAME_LEN" -le 64 ]; then
    pass "name <= 64 chars ($NAME_LEN chars)"
  else
    fail "name <= 64 chars" "Got $NAME_LEN chars"
  fi
else
  fail "name field exists in frontmatter" "Not found"
fi

# 1c. description field exists
DESC_BLOCK=$(sed -n '/^---$/,/^---$/p' "$SOURCE_SKILL")
if echo "$DESC_BLOCK" | grep -q '^description:'; then
  pass "description field exists"
else
  fail "description field exists" "Not found in frontmatter"
fi

# 1d. description contains trigger phrases
if echo "$DESC_BLOCK" | grep -qi '기획 검토\|plan review\|PRD 리뷰\|기획서'; then
  pass "description contains trigger phrases"
else
  fail "description contains trigger phrases" "No Korean/English trigger phrases found"
fi

# 1e. description contains Agents: annotation
if echo "$DESC_BLOCK" | grep -q 'Agents:'; then
  pass "description contains Agents: annotation"
else
  fail "description contains Agents: annotation" "Missing 'Agents:' line"
fi

# 1f. Only name and description in frontmatter (no extra keys)
YAML_KEYS=$(echo "$FRONTMATTER" | grep -E '^[a-z_-]+:' | sed 's/:.*//' | sort)
EXTRA_KEYS=$(echo "$YAML_KEYS" | grep -v -E '^(name|description)$' || true)
if [ -z "$EXTRA_KEYS" ]; then
  pass "Frontmatter has only name + description (no extra YAML keys)"
else
  fail "Frontmatter has only name + description" "Extra keys: $EXTRA_KEYS"
fi

################################################################################
# 2. Structural Compliance — Body
################################################################################
section "2" "Structural Compliance — Body"

# 2a. Body line count <= 500
TOTAL_LINES=$(wc -l < "$SOURCE_SKILL" | tr -d ' ')
if [ "$TOTAL_LINES" -le 500 ]; then
  pass "Body <= 500 lines ($TOTAL_LINES lines)"
else
  fail "Body <= 500 lines" "Got $TOTAL_LINES lines"
fi

# 2b. Steps use ### Step N: heading format
STEP_HEADINGS=$(grep -c '^## Step [0-9]' "$SOURCE_SKILL" || true)
if [ "$STEP_HEADINGS" -ge 1 ]; then
  pass "Step headings found ($STEP_HEADINGS steps)"
else
  fail "Step headings found" "No '## Step N:' headings"
fi

# Verify all 6 steps are present
for i in 1 2 3 4 5 6; do
  if grep -q "^## Step $i:" "$SOURCE_SKILL"; then
    pass "Step $i heading present"
  else
    fail "Step $i heading present" "Missing '## Step $i:' heading"
  fi
done

# 2c. No forbidden files in skill directory
for FORBIDDEN in README.md CHANGELOG.md INSTALL.md LICENSE LICENSE.md; do
  if [ -f "$SOURCE_DIR/$FORBIDDEN" ]; then
    fail "No forbidden file: $FORBIDDEN" "Found: $SOURCE_DIR/$FORBIDDEN"
  else
    pass "No forbidden file: $FORBIDDEN"
  fi
done

################################################################################
# 3. Reference Integrity
################################################################################
section "3" "Reference Integrity"

# 3a. All 3 reference files exist
for REF in review-criteria.md output-formats.md dashboard-integration.md; do
  if [ -f "$SOURCE_REFS/$REF" ]; then
    pass "Reference exists: $REF"
  else
    fail "Reference exists: $REF" "Not found: $SOURCE_REFS/$REF"
  fi
done

# 3b. No extra unexpected files in references/
EXPECTED_REFS="dashboard-integration.md output-formats.md review-criteria.md"
ACTUAL_REFS=$(ls "$SOURCE_REFS" 2>/dev/null | sort | tr '\n' ' ' | sed 's/ *$//')
if [ "$ACTUAL_REFS" = "$EXPECTED_REFS" ]; then
  pass "References contains exactly 3 expected files"
else
  fail "References contains exactly 3 expected files" "Found: $ACTUAL_REFS"
fi

# 3c. SKILL.md references to reference files are valid
MENTIONED_REFS=$(grep -oE 'references/[a-z-]+\.md' "$SOURCE_SKILL" | sort -u)
for REF_PATH in $MENTIONED_REFS; do
  if [ -f "$SOURCE_DIR/$REF_PATH" ]; then
    pass "Referenced file exists: $REF_PATH"
  else
    fail "Referenced file exists: $REF_PATH" "Mentioned in SKILL.md but missing"
  fi
done

# 3d. References are 1-depth only (no reference -> reference chains)
for REF in "$SOURCE_REFS"/*.md; do
  REF_NAME=$(basename "$REF")
  CHAIN=$(grep -c 'references/' "$REF" 2>/dev/null || true)
  if [ "$CHAIN" -eq 0 ]; then
    pass "No reference chain in $REF_NAME"
  else
    fail "No reference chain in $REF_NAME" "Found $CHAIN references to other reference files"
  fi
done

################################################################################
# 4. Content Completeness — Input Types
################################################################################
section "4" "Content Completeness — Input Types"

# All 5 input types documented (A-E)
for TYPE_LABEL in "A. Plan" "B. 인라인" "C. 대시보드" "D. 문서" "E. 대화"; do
  # Match the type letter at minimum
  TYPE_LETTER=$(echo "$TYPE_LABEL" | head -c 1)
  if grep -q "\\*\\*${TYPE_LETTER}\." "$SOURCE_SKILL"; then
    pass "Input type $TYPE_LABEL documented"
  else
    fail "Input type $TYPE_LABEL documented" "Not found in SKILL.md"
  fi
done

################################################################################
# 5. Content Completeness — Review Dimensions
################################################################################
section "5" "Content Completeness — Review Dimensions"

CRITERIA_FILE="$SOURCE_REFS/review-criteria.md"

declare -a DIM_PAIRS=("Completeness:완성도" "Clarity:명확성" "Consistency:일관성" "Feasibility:실현가능성" "AC Quality:AC 품질")
for PAIR in "${DIM_PAIRS[@]}"; do
  DIM_EN="${PAIR%%:*}"
  DIM_KR="${PAIR##*:}"
  if grep -q "$DIM_EN" "$SOURCE_SKILL" && grep -q "$DIM_KR" "$SOURCE_SKILL"; then
    pass "Review dimension in SKILL.md: $DIM_EN ($DIM_KR)"
  else
    fail "Review dimension in SKILL.md: $DIM_EN ($DIM_KR)" "Not found"
  fi
done

# Also check in review-criteria.md
for DIM_KR in "목표 정의" "사용자 정의" "성공 기준" "스코프 경계" "리스크" "타임라인"; do
  if grep -q "$DIM_KR" "$CRITERIA_FILE"; then
    pass "Criteria section present: $DIM_KR"
  else
    fail "Criteria section present: $DIM_KR" "Not found in review-criteria.md"
  fi
done

################################################################################
# 6. Content Completeness — Scoring Weights
################################################################################
section "6" "Scoring Weights Sum to 100%"

# Extract the weight table rows between ### 가중치 and ### 판정 기준
# Table format: | 차원 | AC 존재 시 | AC 없을 때 |
# Column 3 = AC present, Column 4 = AC absent
WEIGHT_TABLE=$(awk '/^### 가중치/,/^### 판정/' "$SOURCE_SKILL" | grep '|' | grep -v '차원\|---')

# AC present mode: column 3 (20 + 20 + 20 + 15 + 25 = 100)
AC_PRESENT_WEIGHTS=$(echo "$WEIGHT_TABLE" | awk -F'|' '{gsub(/[^0-9]/,"",$3); if($3!="") print $3}')
if [ -n "$AC_PRESENT_WEIGHTS" ]; then
  AC_SUM=0
  for W in $AC_PRESENT_WEIGHTS; do
    AC_SUM=$((AC_SUM + W))
  done
  if [ "$AC_SUM" -eq 100 ]; then
    pass "AC-present weights sum to 100% (got $AC_SUM)"
  else
    fail "AC-present weights sum to 100%" "Got $AC_SUM%"
  fi
else
  fail "AC-present weights sum to 100%" "Could not extract weights"
fi

# AC absent mode: column 4 (28 + 28 + 22 + 22 = 100, AC row is N/A)
AC_ABSENT_WEIGHTS=$(echo "$WEIGHT_TABLE" | awk -F'|' '{gsub(/[^0-9]/,"",$4); if($4!="") print $4}')
if [ -n "$AC_ABSENT_WEIGHTS" ]; then
  NO_AC_SUM=0
  for W in $AC_ABSENT_WEIGHTS; do
    NO_AC_SUM=$((NO_AC_SUM + W))
  done
  if [ "$NO_AC_SUM" -eq 100 ]; then
    pass "AC-absent weights sum to 100% (got $NO_AC_SUM)"
  else
    fail "AC-absent weights sum to 100%" "Got $NO_AC_SUM%"
  fi
else
  fail "AC-absent weights sum to 100%" "Could not extract AC-absent weights"
fi

################################################################################
# 7. Content Completeness — Verdict Thresholds
################################################################################
section "7" "Verdict Thresholds Consistency"

# ready >= 7
if grep -q 'ready' "$SOURCE_SKILL" && grep -q '>= 7' "$SOURCE_SKILL"; then
  pass "ready threshold: all dimensions >= 7"
else
  fail "ready threshold: all dimensions >= 7" "Pattern not found"
fi

# needs-work 4~6
if grep -q 'needs-work' "$SOURCE_SKILL" && grep -qE '4~6|4.*6' "$SOURCE_SKILL"; then
  pass "needs-work threshold: dimensions 4-6"
else
  fail "needs-work threshold: dimensions 4-6" "Pattern not found"
fi

# not-ready < 4
if grep -qE 'not-ready.*< *4' "$SOURCE_SKILL"; then
  pass "not-ready threshold: dimension < 4"
else
  fail "not-ready threshold: dimension < 4" "Pattern not found"
fi

# CRITICAL count thresholds
if grep -q 'CRITICAL 0건' "$SOURCE_SKILL" && grep -q 'CRITICAL 1건' "$SOURCE_SKILL" && grep -qE 'CRITICAL 2건' "$SOURCE_SKILL"; then
  pass "CRITICAL count thresholds defined (0, 1, 2+)"
else
  fail "CRITICAL count thresholds defined" "Missing one or more CRITICAL count conditions"
fi

################################################################################
# 8. Content Completeness — Output Formats
################################################################################
section "8" "Output Format Variants"

OUTPUT_FILE="$SOURCE_REFS/output-formats.md"

# Terminal format
if grep -qi 'Terminal' "$OUTPUT_FILE"; then
  pass "Terminal output format defined"
else
  fail "Terminal output format defined" "Not found in output-formats.md"
fi

# Slack format
if grep -qi 'Slack' "$OUTPUT_FILE"; then
  pass "Slack output format defined"
else
  fail "Slack output format defined" "Not found in output-formats.md"
fi

# Slack 1500 char limit mentioned
if grep -q '1500' "$OUTPUT_FILE"; then
  pass "Slack 1500-char limit mentioned"
else
  fail "Slack 1500-char limit mentioned" "Not found"
fi

# Verdict emoji mapping
for VERDICT in ready needs-work not-ready; do
  if grep -q "$VERDICT" "$OUTPUT_FILE"; then
    pass "Verdict emoji mapping: $VERDICT"
  else
    fail "Verdict emoji mapping: $VERDICT" "Not found"
  fi
done

################################################################################
# 9. Dashboard Integration — Safe PATCH
################################################################################
section "9" "Dashboard Integration Safety"

DASH_FILE="$SOURCE_REFS/dashboard-integration.md"

# Uses pending-review (not rejected)
if grep -q '"pending-review"' "$DASH_FILE"; then
  pass "Dashboard write-back uses status: pending-review"
else
  fail "Dashboard write-back uses status: pending-review" "Not found"
fi

# Explicitly documents that rejected triggers dispatchRegeneration
if grep -q 'dispatchRegeneration' "$DASH_FILE"; then
  pass "Documents dispatchRegeneration safety concern"
else
  fail "Documents dispatchRegeneration safety concern" "No mention of dispatchRegeneration"
fi

# Does NOT set status to rejected
REJECTED_COUNT=$(grep -c '"rejected"' "$DASH_FILE" 2>/dev/null || true)
REJECTED_IN_PATCH=$(awk '/PATCH/,/}/' "$DASH_FILE" | grep -c '"rejected"' || true)
if [ "$REJECTED_IN_PATCH" -eq 0 ]; then
  pass "PATCH request does not use status: rejected"
else
  fail "PATCH request does not use status: rejected" "Found 'rejected' in a PATCH block"
fi

# SEMO_DASHBOARD_URL env var reference
if grep -q 'SEMO_DASHBOARD_URL' "$DASH_FILE"; then
  pass "References SEMO_DASHBOARD_URL env var"
else
  fail "References SEMO_DASHBOARD_URL env var" "Not found"
fi

################################################################################
# 10. Path Correctness — No Deprecated Paths
################################################################################
section "10" "Path Correctness — No Deprecated Paths"

ALL_SOURCE_FILES=$(find "$SOURCE_DIR" -name '*.md' -type f)

# 10a. No ~/.semo-bot-sessions/ (deprecated, should be ~/.semo/sessions/)
for FILE in $ALL_SOURCE_FILES; do
  FNAME=$(basename "$FILE")
  if grep -q 'semo-bot-sessions' "$FILE" 2>/dev/null; then
    fail "No deprecated ~/.semo-bot-sessions/ in $FNAME" "Should be ~/.semo/sessions/"
  else
    pass "No deprecated ~/.semo-bot-sessions/ in source $FNAME"
  fi
done

# 10b. No hardcoded ~/.openclaw-shared/ (should be ~/.semo/shared/)
for FILE in $ALL_SOURCE_FILES; do
  FNAME=$(basename "$FILE")
  if grep -q 'openclaw-shared' "$FILE" 2>/dev/null; then
    fail "No deprecated ~/.openclaw-shared/ in $FNAME" "Should be ~/.semo/shared/"
  else
    pass "No deprecated ~/.openclaw-shared/ in source $FNAME"
  fi
done

# 10c. ~/.claude/semo/.env path is correct for env sourcing
if grep -q '\~/.claude/semo/.env\|HOME/.claude/semo/.env' "$SOURCE_SKILL"; then
  pass "Env sourcing path: ~/.claude/semo/.env"
else
  # Also check in dashboard-integration.md where it's actually used
  if grep -q '\~/.claude/semo/.env\|HOME/.claude/semo/.env' "$DASH_FILE"; then
    pass "Env sourcing path: ~/.claude/semo/.env (in dashboard-integration.md)"
  else
    fail "Env sourcing path correct" "~/.claude/semo/.env not found in source files"
  fi
fi

# 10d. ~/.claude/plans/ path for plan files
if grep -q '\~/.claude/plans/' "$SOURCE_SKILL"; then
  pass "Plan files path: ~/.claude/plans/"
else
  fail "Plan files path: ~/.claude/plans/" "Not found in SKILL.md"
fi

# 10e. ~/.semo/sessions/ is the correct new path (not semo-bot-sessions)
if grep -q '\~/.semo/sessions/' "$SOURCE_SKILL"; then
  pass "Session path uses ~/.semo/sessions/ (new path)"
else
  fail "Session path uses ~/.semo/sessions/" "Not found — may still use deprecated path"
fi

################################################################################
# 11. Global Cache Sync
################################################################################
section "11" "Global Cache Sync"

# 11a. Cache SKILL.md exists
if [ -f "$CACHE_SKILL" ]; then
  pass "Cache SKILL.md exists"
else
  fail "Cache SKILL.md exists" "Not found: $CACHE_SKILL"
fi

# 11b. Cache SKILL.md matches source (context sync injects extra Agents: line — allowed)
if [ -f "$CACHE_SKILL" ]; then
  DIFF_OUTPUT=$(diff "$SOURCE_SKILL" "$CACHE_SKILL" 2>&1 || true)
  if [ -z "$DIFF_OUTPUT" ]; then
    pass "Cache SKILL.md matches source (identical)"
  else
    # context sync injects 'Agents:' annotation into frontmatter — filter it out
    SIGNIFICANT_DIFF=$(echo "$DIFF_OUTPUT" | grep '^[<>]' | grep -v 'Agents:' || true)
    if [ -z "$SIGNIFICANT_DIFF" ]; then
      pass "Cache SKILL.md matches source (Agents: injection only — expected)"
    else
      DIFF_LINES=$(echo "$SIGNIFICANT_DIFF" | wc -l | tr -d ' ')
      fail "Cache SKILL.md matches source" "$DIFF_LINES significant line(s) differ"
    fi
  fi
fi

# 11c. Cache references/ directory exists
if [ -d "$CACHE_REFS" ]; then
  pass "Cache references/ directory exists"
else
  fail "Cache references/ directory exists" "Not found: $CACHE_REFS"
fi

# 11d. Cache contains all 3 reference files
for REF in review-criteria.md output-formats.md dashboard-integration.md; do
  if [ -f "$CACHE_REFS/$REF" ]; then
    pass "Cache has reference: $REF"
  else
    fail "Cache has reference: $REF" "Not found: $CACHE_REFS/$REF"
  fi
done

# 11e. Each cached reference matches source
for REF in review-criteria.md output-formats.md dashboard-integration.md; do
  if [ -f "$CACHE_REFS/$REF" ] && [ -f "$SOURCE_REFS/$REF" ]; then
    REF_DIFF=$(diff "$SOURCE_REFS/$REF" "$CACHE_REFS/$REF" 2>&1 || true)
    if [ -z "$REF_DIFF" ]; then
      pass "Cache reference matches source: $REF"
    else
      REF_DIFF_LINES=$(echo "$REF_DIFF" | grep -c '^[<>]' || true)
      fail "Cache reference matches source: $REF" "$REF_DIFF_LINES line(s) differ"
    fi
  elif [ ! -f "$CACHE_REFS/$REF" ]; then
    skip "Cache reference diff: $REF (cache file missing)"
  fi
done

# 11f. No deprecated paths in cache files
CACHE_ALL_FILES=$(find "$CACHE_DIR" -name '*.md' -type f 2>/dev/null || true)
if [ -n "$CACHE_ALL_FILES" ]; then
  CACHE_DEPRECATED=0
  for FILE in $CACHE_ALL_FILES; do
    FNAME=$(basename "$FILE")
    if grep -q 'semo-bot-sessions' "$FILE" 2>/dev/null; then
      fail "No deprecated path in cache $FNAME" "Contains ~/.semo-bot-sessions/"
      CACHE_DEPRECATED=$((CACHE_DEPRECATED + 1))
    fi
    if grep -q 'openclaw-shared' "$FILE" 2>/dev/null; then
      fail "No deprecated path in cache $FNAME" "Contains ~/.openclaw-shared/"
      CACHE_DEPRECATED=$((CACHE_DEPRECATED + 1))
    fi
  done
  if [ "$CACHE_DEPRECATED" -eq 0 ]; then
    pass "No deprecated paths in any cache files"
  fi
fi

################################################################################
# 12. Content — Phase Coverage in Criteria
################################################################################
section "12" "Phase Coverage in review-criteria.md"

# Phases may be combined (e.g., "Phase 4-5"). Check each phase number is mentioned.
for PHASE_NUM in 0 1 2 3 4 5 6 7; do
  # Match "Phase N" or "Phase M-N" where N is in the range
  if grep -qE "Phase ${PHASE_NUM}[^0-9]|Phase [0-9]-${PHASE_NUM}" "$CRITERIA_FILE"; then
    pass "Phase criteria defined: Phase $PHASE_NUM"
  else
    fail "Phase criteria defined: Phase $PHASE_NUM" "Not found in review-criteria.md"
  fi
done

# Section structure: 4 sections
for SEC in "Section 1" "Section 2" "Section 3" "Section 4"; do
  if grep -q "$SEC" "$CRITERIA_FILE"; then
    pass "Criteria section: $SEC"
  else
    fail "Criteria section: $SEC" "Not found"
  fi
done

# INVEST framework
if grep -q 'INVEST' "$CRITERIA_FILE"; then
  pass "INVEST framework documented"
else
  fail "INVEST framework documented" "Not found in review-criteria.md"
fi

################################################################################
# 13. Content — Severity Levels
################################################################################
section "13" "Issue Severity Levels"

for SEV in CRITICAL WARNING INFO; do
  if grep -q "$SEV" "$SOURCE_SKILL"; then
    pass "Severity level defined: $SEV"
  else
    fail "Severity level defined: $SEV" "Not found in SKILL.md"
  fi
done

################################################################################
# Summary
################################################################################
echo ""
echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════${RESET}"
TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))
echo -e "${BOLD}  RESULTS: ${GREEN}$PASS_COUNT passed${RESET}, ${RED}$FAIL_COUNT failed${RESET}, ${YELLOW}$SKIP_COUNT skipped${RESET} / $TOTAL total"
echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════${RESET}"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo ""
  echo -e "${RED}${BOLD}  Some tests failed. See details above.${RESET}"
  exit 1
else
  echo ""
  echo -e "${GREEN}${BOLD}  All tests passed.${RESET}"
  exit 0
fi

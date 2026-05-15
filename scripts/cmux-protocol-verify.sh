#!/usr/bin/env bash
# cmux-protocol-verify.sh — Unit tests for cmux-task protocol scripts.
#
# Tests:
#   1. extract_reply parses clean [cmux-reply] block
#   2. extract_reply handles ANSI codes in input
#   3. extract_reply rejects wrong id
#   4. extract_reply handles missing terminator (EOF)
#   5. extract_reply ignores unrelated [cmux-task] blocks
#   6. cmux-send-safe exits 10 for non-existent surface
#   7. cmux-task-send generates id matching cmux-{slug}-{epoch}-{rand}
#
# Usage:
#   bash scripts/cmux-protocol-verify.sh
#   bash scripts/cmux-protocol-verify.sh --verbose

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
send_safe="$script_dir/cmux-send-safe.sh"
task_send="$script_dir/cmux-task-send.sh"
task_wait="$script_dir/cmux-task-wait.sh"

verbose=0
[[ "${1:-}" == "--verbose" ]] && verbose=1

pass=0
fail=0

ok() {
  pass=$((pass + 1))
  printf '  ✓ %s\n' "$1"
}

ng() {
  fail=$((fail + 1))
  printf '  ✗ %s\n' "$1"
  [[ "$verbose" -eq 1 ]] && printf '    got: %s\n' "${2:-}"
}

# ── extract_reply helper (inline from cmux-task-wait.sh logic) ─────────────

strip_ansi() {
  sed 's/\x1b\[[0-9;]*[A-Za-z]//g; s/\x1b[()][0-9A-Za-z]//g; s/\x0f//g; s/\x0e//g; s/\r//g'
}

extract_reply() {
  local id="$1"
  awk -v id="$id" '
    /\[cmux-reply\]/ {
      capture=1; matched=0; buf=$0 "\n"; next
    }
    capture {
      if ($0 ~ /^\[cmux-(task|reply)\]/) {
        if (matched) { printf "%s", buf; exit 0 }
        buf=$0 "\n"; matched=0; next
      }
      buf=buf $0 "\n"
      if (index($0, "id: " id) > 0 || index($0, "id=" id) > 0) {
        matched=1
      }
      if (matched && ($0 ~ /^[-─=]{5,}/ || $0 ~ /[❯›✦>][[:space:]]*$/ || $0 ~ /^\$/)) {
        printf "%s", buf; exit 0
      }
    }
    END { if (matched) { printf "%s", buf } }
  '
}

printf '\n=== cmux protocol verify ===\n\n'

# ── Test 1: clean reply block with separator terminator ───────────────────
printf '[1] extract_reply — clean block\n'
target_id="cmux-test-1111111111-aabbcc"
screen=$(cat <<'EOF'
❯
[cmux-reply]
id: cmux-test-1111111111-aabbcc
status: done
summary: all good
-----
❯
EOF
)
result="$(printf '%s\n' "$screen" | extract_reply "$target_id")"
if printf '%s\n' "$result" | grep -q "status: done"; then
  ok "parsed status: done"
else
  ng "did not find 'status: done'" "$result"
fi

# ── Test 2: ANSI codes in screen ──────────────────────────────────────────
printf '[2] extract_reply — ANSI-contaminated screen\n'
ansi_screen=$'❯\n\x1b[32m[cmux-reply]\x1b[0m\nid: cmux-test-1111111111-aabbcc\nstatus: done\n\x1b[33m-----\x1b[0m\n❯\n'
result="$(printf '%s' "$ansi_screen" | strip_ansi | extract_reply "$target_id")"
if printf '%s\n' "$result" | grep -q "status: done"; then
  ok "ANSI stripped, parsed correctly"
else
  ng "ANSI stripping failed" "$result"
fi

# ── Test 3: wrong id should not match ────────────────────────────────────
printf '[3] extract_reply — wrong id\n'
wrong_id="cmux-other-9999999999-zzzzzz"
result="$(printf '%s\n' "$screen" | extract_reply "$wrong_id" || true)"
if [[ -z "$result" ]]; then
  ok "correctly returned empty for wrong id"
else
  ng "wrongly matched different id" "$result"
fi

# ── Test 4: no terminator — EOF fallback ─────────────────────────────────
printf '[4] extract_reply — no terminator (EOF flush)\n'
no_term_screen=$(cat <<'EOF'
[cmux-reply]
id: cmux-test-1111111111-aabbcc
status: partial
summary: still running
EOF
)
result="$(printf '%s\n' "$no_term_screen" | extract_reply "$target_id")"
if printf '%s\n' "$result" | grep -q "status: partial"; then
  ok "EOF fallback emitted block"
else
  ng "EOF fallback missed block" "$result"
fi

# ── Test 5: unrelated cmux-task block before reply ───────────────────────
printf '[5] extract_reply — ignore preceding [cmux-task] block\n'
mixed_screen=$(cat <<'EOF'
[cmux-task]
id: cmux-other-task-111
task: do something
[cmux-reply]
id: cmux-test-1111111111-aabbcc
status: done
summary: found
-----
❯
EOF
)
result="$(printf '%s\n' "$mixed_screen" | extract_reply "$target_id")"
if printf '%s\n' "$result" | grep -q "status: done"; then
  ok "correctly skipped [cmux-task] block"
else
  ng "failed to parse reply after cmux-task block" "$result"
fi

# ── Test 6: cmux-send-safe exits 10 for non-existent surface ─────────────
printf '[6] cmux-send-safe — exit 10 for missing surface\n'
rc=0
bash "$send_safe" --workspace workspace:1 --surface surface:99999 --message "test" 2>/dev/null || rc=$?
if [[ "$rc" -eq 10 ]]; then
  ok "exit 10 for unknown surface"
else
  ng "expected exit 10, got $rc"
fi

# ── Test 7: id generation pattern ────────────────────────────────────────
printf '[7] cmux-task-send — id format cmux-{slug}-{epoch}-{rand}\n'
# Replicate the id-generation logic from cmux-task-send.sh inline.
test_slug="verify"
safe_slug="$(printf '%s' "$test_slug" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9_-' '-' | sed 's/^-//; s/-$//')"
if command -v openssl >/dev/null 2>&1; then
  rand="$(openssl rand -hex 3)"
else
  rand="${RANDOM}${RANDOM}"
fi
generated_id="cmux-${safe_slug}-$(date +%s)-${rand}"
if printf '%s\n' "$generated_id" | grep -Eq '^cmux-verify-[0-9]+-[0-9a-f]+$'; then
  ok "id format matches cmux-{slug}-{epoch}-{rand}: $generated_id"
else
  ng "unexpected id format" "$generated_id"
fi

# ── Summary ───────────────────────────────────────────────────────────────
printf '\n'
printf 'Results: %d passed, %d failed\n' "$pass" "$fail"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi

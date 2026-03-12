#!/bin/bash
# bot-infra-health: Comprehensive bot infrastructure health check
# Checks auth, config, errors, token usage, cron health across all bots
# Output: JSON report to stdout

set -euo pipefail

BOTS="semiclaw workclaw planclaw reviewclaw designclaw growthclaw infraclaw"
NOW_EPOCH=$(date +%s)
REPORT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Lookback window for error scanning (default 24h)
LOOKBACK_HOURS="${1:-24}"
LOOKBACK_SEC=$((LOOKBACK_HOURS * 3600))

get_dir() {
  local bot="$1"
  if [ "$bot" = "semiclaw" ]; then
    echo "$HOME/.openclaw"
  else
    echo "$HOME/.openclaw-$bot"
  fi
}

check_bot() {
  local bot="$1"
  local dir
  dir=$(get_dir "$bot")
  local config="$dir/openclaw.json"
  local auth="$dir/agents/main/agent/auth-profiles.json"
  local errlog="$dir/logs/gateway.err.log"
  local gwlog="$dir/logs/gateway.log"
  local cronjobs="$dir/cron/jobs.json"

  # Process status
  local port
  port=$(python3 -c "import json; d=json.load(open('$config')); print(d.get('gateway',{}).get('port','0'))" 2>/dev/null || echo "0")
  local pid
  pid=$(lsof -ti :"$port" 2>/dev/null | head -1 || true)
  local process_up="false"
  [ -n "$pid" ] && process_up="true"

  # Launchd status
  local launchd_pid
  launchd_pid=$(launchctl list 2>/dev/null | grep "ai.openclaw.$bot" | awk '{print $1}' || true)
  [ "$launchd_pid" = "-" ] && launchd_pid=""

  # Auth check
  local auth_ok="false"
  local auth_issues=""
  if [ -f "$auth" ]; then
    auth_issues=$(python3 -c "
import json, sys
with open('$auth') as f:
    d = json.load(f)
issues = []
profiles = d.get('profiles', {})
if not profiles:
    issues.append('no_profiles')
for name, prof in profiles.items():
    if prof.get('type') != 'token':
        issues.append(f'bad_type:{name}={prof.get(\"type\",\"missing\")}')
    if not prof.get('token'):
        issues.append(f'no_token:{name}')
    if 'autoRefresh' not in prof:
        issues.append(f'no_autoRefresh:{name}')
# Check cooldown/errors
for name, stats in d.get('usageStats', {}).items():
    if stats.get('errorCount', 0) > 0:
        issues.append(f'errors:{name}={stats[\"errorCount\"]}')
    if 'cooldownUntil' in stats:
        issues.append(f'cooldown:{name}')
print('|'.join(issues) if issues else 'OK')
" 2>/dev/null || echo "read_error")
    [ "$auth_issues" = "OK" ] && auth_ok="true"
  else
    auth_issues="file_missing"
  fi

  # Config validation (check for known bad keys)
  local config_issues=""
  config_issues=$(python3 -c "
import json
with open('$config') as f:
    d = json.load(f)
issues = []
KNOWN_BAD_KEYS = ['heartbeat']  # should be under agents.defaults
for k in KNOWN_BAD_KEYS:
    if k in d:
        issues.append(f'invalid_toplevel_key:{k}')
print('|'.join(issues) if issues else 'OK')
" 2>/dev/null || echo "read_error")

  # Error log scan (last N hours)
  local err_401=0 err_nokey=0 err_channel=0 err_other=0
  if [ -f "$errlog" ]; then
    err_401=$(tail -500 "$errlog" | grep -c "401 authentication_error" || true)
    err_nokey=$(tail -500 "$errlog" | grep -c "No API key found" || true)
    err_channel=$(tail -500 "$errlog" | grep -c "channel_not_found" || true)
  fi

  # Agent run count (from gateway.log)
  local run_count=0
  if [ -f "$gwlog" ]; then
    run_count=$(grep -c "res ✓ agent" "$gwlog" 2>/dev/null || true)
  fi

  # Cron health
  local cron_enabled=0 cron_errored=0 cron_details=""
  if [ -f "$cronjobs" ]; then
    cron_details=$(python3 -c "
import json
with open('$cronjobs') as f:
    d = json.load(f)
enabled = 0
errored = 0
for j in d.get('jobs', []):
    if j.get('enabled', True):
        enabled += 1
        state = j.get('state', {})
        if state.get('consecutiveErrors', 0) > 0:
            errored += 1
print(f'{enabled}|{errored}')
" 2>/dev/null || echo "0|0")
    cron_enabled=$(echo "$cron_details" | cut -d'|' -f1)
    cron_errored=$(echo "$cron_details" | cut -d'|' -f2)
  fi

  # Heartbeat config
  local hb_interval=""
  hb_interval=$(python3 -c "
import json
with open('$config') as f:
    d = json.load(f)
hb = d.get('agents',{}).get('defaults',{}).get('heartbeat',{})
print(hb.get('every', 'default(5m)'))
" 2>/dev/null || echo "unknown")

  # Version
  local version=""
  version=$(grep -o "current v[0-9.]*" "$gwlog" 2>/dev/null | tail -1 | sed 's/current //' || echo "unknown")

  # Delivery queue backlog
  local delivery_backlog=0
  if [ -d "$dir/delivery-queue" ]; then
    delivery_backlog=$(ls "$dir/delivery-queue/" 2>/dev/null | wc -l | tr -d ' ')
  fi

  # Output JSON object
  cat <<BOTJSON
  {
    "bot": "$bot",
    "process": { "up": $process_up, "pid": "${pid:-null}", "launchd_pid": "${launchd_pid:-null}", "port": $port },
    "auth": { "ok": $auth_ok, "issues": "$auth_issues" },
    "config": { "issues": "$config_issues", "heartbeat": "$hb_interval", "version": "$version" },
    "errors": { "401_auth": $err_401, "no_api_key": $err_nokey, "channel_not_found": $err_channel },
    "activity": { "agent_runs": $run_count },
    "cron": { "enabled": $cron_enabled, "errored": $cron_errored },
    "delivery_backlog": $delivery_backlog
  }
BOTJSON
}

# Generate report
echo "{"
echo "  \"reportTime\": \"$REPORT_TIME\","
echo "  \"lookbackHours\": $LOOKBACK_HOURS,"
echo "  \"bots\": ["

first=true
for bot in $BOTS; do
  if [ "$first" = true ]; then first=false; else echo ","; fi
  check_bot "$bot"
done

echo "  ]"
echo "}"

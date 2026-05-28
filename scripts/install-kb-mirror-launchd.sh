#!/usr/bin/env bash
# P3-D (2026-05-28): kb-mirror launchctl 자동 install/uninstall.
#
# 사용:
#   ./scripts/install-kb-mirror-launchd.sh install   --vault <path> [--bidirectional]
#   ./scripts/install-kb-mirror-launchd.sh uninstall
#   ./scripts/install-kb-mirror-launchd.sh status
#
# 동작: scripts/com.semicolon.semo-kb-mirror.plist 를 사용자 환경에 맞게 패치 후
#       ~/Library/LaunchAgents/ 로 복사 + launchctl load.
#
# 환경:
#   DATABASE_URL 은 ~/.claude/semo/.env 에서 자동 source (LaunchAgent wrapper 가 처리).

set -euo pipefail

ACTION="${1:-}"
shift || true

LABEL="com.semicolon.semo-kb-mirror"
PLIST_SRC="$(dirname "$0")/com.semicolon.semo-kb-mirror.plist"
PLIST_DST="$HOME/Library/LaunchAgents/${LABEL}.plist"
WRAPPER="$HOME/.semo/bin/kb-mirror-wrapper.sh"

ensure_wrapper() {
  mkdir -p "$(dirname "$WRAPPER")"
  cat > "$WRAPPER" <<'WRAP'
#!/usr/bin/env bash
# kb-mirror wrapper — .env source 후 semo kb-mirror start 호출.
set -euo pipefail
ENV_FILE="${SEMO_ENV_FILE:-$HOME/.claude/semo/.env}"
[[ -f "$ENV_FILE" ]] && set -a && source "$ENV_FILE" && set +a
exec /Users/reus/.local/bin/semo kb-mirror start "$@"
WRAP
  chmod +x "$WRAPPER"
  echo "  wrapper: $WRAPPER"
}

usage() {
  echo "사용: $0 {install --vault <path> [--bidirectional]|uninstall|status}" >&2
  exit 2
}

case "$ACTION" in
  install)
    VAULT=""
    BIDIR=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --vault) VAULT="$2"; shift 2;;
        --bidirectional) BIDIR="--bidirectional"; shift;;
        *) echo "unknown: $1" >&2; usage;;
      esac
    done
    [[ -z "$VAULT" ]] && { echo "✗ --vault 필요" >&2; usage; }

    echo "── kb-mirror launchd install ──"
    ensure_wrapper

    mkdir -p "$HOME/Library/LaunchAgents"
    mkdir -p "$HOME/.semo/logs"

    # plist 동적 생성 (vault/bidirectional 반영)
    cat > "$PLIST_DST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${WRAPPER}</string>
    <string>--source</string><string>obsidian</string>
    <string>--source-vault</string><string>${VAULT}</string>
    <string>--target</string><string>postgres</string>
$( [[ -n "$BIDIR" ]] && echo "    <string>${BIDIR}</string>" )
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>SEMO_ENV_FILE</key><string>${HOME}/.claude/semo/.env</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key><false/>
    <key>Crashed</key><true/>
  </dict>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>${HOME}/.semo/logs/kb-mirror.log</string>
  <key>StandardErrorPath</key><string>${HOME}/.semo/logs/kb-mirror.err.log</string>
  <key>WorkingDirectory</key><string>${HOME}/.semo</string>
</dict>
</plist>
PLIST

    echo "  plist: $PLIST_DST"
    launchctl unload -w "$PLIST_DST" 2>/dev/null || true
    launchctl load -w "$PLIST_DST"
    echo "  ✓ load 완료. log: ~/.semo/logs/kb-mirror.log"
    ;;
  uninstall)
    if [[ -f "$PLIST_DST" ]]; then
      launchctl unload -w "$PLIST_DST" 2>/dev/null || true
      rm -f "$PLIST_DST"
      echo "  ✓ uninstall 완료"
    else
      echo "  ⚠ ${PLIST_DST} 없음 (이미 uninstall 상태)"
    fi
    ;;
  status)
    if launchctl list "$LABEL" 2>/dev/null; then
      echo
      echo "  log: ~/.semo/logs/kb-mirror.log"
    else
      echo "  (등록되지 않음)"
    fi
    ;;
  *)
    usage
    ;;
esac

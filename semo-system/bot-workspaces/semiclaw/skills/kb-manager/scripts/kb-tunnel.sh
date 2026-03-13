#!/bin/bash
# KB DB SSH 터널 관리
# 사용: kb-tunnel.sh start|stop|status

PORT=15432

case "$1" in
  start)
    # 이미 열려 있는지 확인
    if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
      echo "Tunnel already active on port $PORT"
      exit 0
    fi
    ssh -f -N -L $PORT:10.0.0.91:5432 semi-vpn -o ConnectTimeout=10 -o ServerAliveInterval=60
    if [ $? -eq 0 ]; then
      echo "Tunnel started on port $PORT"
    else
      echo "Failed to start tunnel"
      exit 1
    fi
    ;;
  stop)
    PID=$(lsof -t -i :$PORT -sTCP:LISTEN 2>/dev/null)
    if [ -n "$PID" ]; then
      kill $PID
      echo "Tunnel stopped (pid $PID)"
    else
      echo "No tunnel running"
    fi
    ;;
  status)
    if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
      echo "active"
    else
      echo "inactive"
    fi
    ;;
  *)
    echo "Usage: kb-tunnel.sh start|stop|status"
    exit 1
    ;;
esac

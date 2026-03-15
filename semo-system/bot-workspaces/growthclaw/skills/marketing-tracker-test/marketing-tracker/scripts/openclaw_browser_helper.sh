#!/bin/bash
# OpenClaw Browser Helper — browser tool로 HTML 가져오기

URL="$1"

if [ -z "$URL" ]; then
    echo "Usage: $0 <url>" >&2
    exit 1
fi

# OpenClaw browser tool로 스냅샷 가져오기
openclaw tool browser --action snapshot --targetUrl "$URL" --snapshotFormat aria 2>/dev/null || {
    echo "Browser snapshot failed" >&2
    exit 1
}

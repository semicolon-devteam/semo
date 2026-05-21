#!/usr/bin/env python3
"""Submit an audio/video file to semo-meeting and poll until complete.

- Handles transient connection failures (ConnectionRefusedError/URLError)
- Retries with bounded exponential backoff
- Preserves auth policy: Authorization header + exact "Bearer ..." format
- Keeps output stable for shell scripting
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def _load_json(url: str, headers: Dict[str, str], timeout: int) -> Dict[str, Any]:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _post_file(
    base_url: str,
    token: str,
    file_path: str,
    timeout: int = 60,
) -> str:
    url = f"{base_url.rstrip('/')}/transcribe"
    import shutil
    import subprocess

    token_header = f"Authorization: Bearer {token}"
    curl = shutil.which("curl") or "curl"
    cmd = [
        curl,
        "-sS",
        "-X",
        "POST",
        url,
        "-H",
        token_header,
        "-F",
        f"file=@{file_path}",
    ]

    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(f"curl failed ({proc.returncode}): {proc.stderr.strip() or proc.stdout.strip()}")
    resp = proc.stdout.strip()
    try:
        data = json.loads(resp)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"upload response parse failed: {e}; raw={resp}")
    job_id = data.get("id")
    if not job_id:
        raise RuntimeError(f"missing job id in response: {data}")
    return job_id


def _poll_status(
    base_url: str,
    token: str,
    job_id: str,
    interval: int = 30,
    attempts: int = 180,
    request_timeout: int = 30,
) -> Dict[str, Any]:
    next_interval = interval
    for i in range(1, attempts + 1):
        url = f"{base_url.rstrip('/')}/status/{job_id}"
        headers = {"Authorization": f"Bearer {token}"}
        try:
            data = _load_json(url, headers, request_timeout)
            status = data.get("status")
            print(f"{_now()} attempt={i:03d} status={status}")

            if status in {"completed", "failed"}:
                return data

            # keep requested cadence unless transient errors happened
            next_interval = interval
        except urllib.error.HTTPError as e:
            if e.code == 404:
                detail = ""
                try:
                    detail = e.read().decode("utf-8")
                except Exception:
                    pass
                raise RuntimeError(f"job not found (expired or wrong id). http=404 detail={detail}")
            print(f"{_now()} attempt={i:03d} http_error={e.code}")
        except urllib.error.URLError as e:
            # Most common during service restart / port race
            print(f"{_now()} attempt={i:03d} connect_error={e}")
            next_interval = min(60, next_interval * 2)
        except Exception as e:
            print(f"{_now()} attempt={i:03d} unexpected_error={type(e).__name__}:{e}")

        if i >= attempts:
            break

        time.sleep(next_interval)

    raise TimeoutError("poll timeout")


def _parse() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Upload and poll semo-meeting job")
    p.add_argument("file", help="Absolute or relative path of audio/video file")
    p.add_argument("--base-url", default=os.getenv("SEMO_STT_URL", "http://localhost:8910"))
    p.add_argument("--token", default=os.getenv("STT_API_KEY", "semo-stt-local-key"))
    p.add_argument("--interval", type=int, default=30)
    p.add_argument("--attempts", type=int, default=180)
    p.add_argument("--request-timeout", type=int, default=30)
    return p.parse_args()


def main() -> int:
    ns = _parse()
    if not os.path.isfile(ns.file):
        print(f"file not found: {ns.file}", file=sys.stderr)
        return 2

    try:
        job_id = _post_file(
            ns.base_url,
            ns.token,
            ns.file,
            timeout=60,
        )
    except Exception as e:
        print(f"upload_failed: {e}", file=sys.stderr)
        return 3

    print(f"job_id={job_id}")

    try:
        result = _poll_status(
            ns.base_url,
            ns.token,
            job_id,
            interval=ns.interval,
            attempts=ns.attempts,
            request_timeout=ns.request_timeout,
        )
    except Exception as e:
        print(f"poll_failed: {e}", file=sys.stderr)
        return 4

    status = result.get("status")
    if status == "completed":
        utts = result.get("utterances", [])
        print(f"completed utterances={len(utts)}")
        print(json.dumps(result, ensure_ascii=False))
        return 0

    print(f"failed: {result}", file=sys.stderr)
    return 5


if __name__ == "__main__":
    raise SystemExit(main())

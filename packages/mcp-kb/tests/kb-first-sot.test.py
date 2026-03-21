#!/usr/bin/env python3
"""
KB-First SoT 행동 규칙 검증 테스트

각 SoT 도메인(team/project/decision/process/infra/kpi)별로
봇에게 힌트 없는 자연어 질문을 보내고, 답변이 KB 기반인지 검증합니다.

사용법:
  python3 packages/mcp-kb/tests/kb-first-sot.test.py [bot_id...]
  예: python3 packages/mcp-kb/tests/kb-first-sot.test.py semiclaw workclaw
  인자 없으면 게이트웨이가 살아있는 봇 전부 테스트

판정 기준:
  PASS    — 답변에 KB 출처 언급 포함 (KB, kb_id, kb-cli, knowledge_base 등)
  FAIL    — KB 출처 없이 로컬 파일(memory/) 또는 자체 지식만으로 답변
  TIMEOUT — 응답 시간 초과
  SKIP    — 게이트웨이 오프라인
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────

TIMEOUT_SEC = 300

BOT_PORTS = {
    "semiclaw": 18789,
    "workclaw": 18869,
    "reviewclaw": 18829,
    "planclaw": 18809,
}

# Natural language questions per SoT domain — NO KB hints
TEST_QUESTIONS = {
    "team": "Bae 담당 업무가 뭐야? 답변 근거도 알려줘.",
    "project": "AcaIV 프로젝트가 뭐야? 답변 근거도 알려줘.",
    "decision": "인증 기능 관련해서 어떤 결정 내렸었지? 답변 근거도 알려줘.",
    "process": "봇끼리 정보 공유는 어떻게 해? 답변 근거도 알려줘.",
    "infra": "우리 봇 팀 아키텍처가 어떻게 돼? 답변 근거도 알려줘.",
    "kpi": "게임랜드 KPI 현황 알려줘. 답변 근거도 알려줘.",
}

DOMAINS = ["team", "project", "decision", "process", "infra", "kpi"]

# Regex patterns indicating KB was used
KB_INDICATORS = re.compile(
    r"KB|kb_id|kb-cli|knowledge_base|semo\.knowledge|벡터.?검색|"
    r"domain.*(?:team|project|decision|process|infra|kpi)|"
    r"KB에.{0,5}없|KB에서.{0,5}조회|KB.{0,5}검색|KB.{0,5}기록|"
    r"KB.{0,5}조회|KB.{0,5}결과",
    re.IGNORECASE,
)

# Patterns indicating local-only source (not KB)
LOCAL_ONLY_INDICATORS = re.compile(
    r"memory/team\.md|memory/decisions\.md|memory/process\.md|"
    r"로컬 메모리만|세션 기억만으로|내 메모리에서",
    re.IGNORECASE,
)

# ── Colors ──────────────────────────────────────────────────────────────────

GREEN = "\033[0;32m"
RED = "\033[0;31m"
YELLOW = "\033[1;33m"
CYAN = "\033[0;36m"
NC = "\033[0m"

# ── Helpers ─────────────────────────────────────────────────────────────────

def get_token(bot_id: str) -> str:
    config_path = Path.home() / f".openclaw-{bot_id}" / "openclaw.json"
    if not config_path.exists():
        return ""
    try:
        data = json.loads(config_path.read_text())
        return data.get("gateway", {}).get("auth", {}).get("token", "")
    except Exception:
        return ""


def check_gateway(port: int) -> bool:
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/health")
        urllib.request.urlopen(req, timeout=2)
        return True
    except Exception:
        return False


def get_session_transcript_path(bot_id: str, session_key: str) -> str:
    """Find transcript path for a session via sessions_list."""
    port = BOT_PORTS[bot_id]
    token = get_token(bot_id)
    if not token:
        return ""

    url = f"http://127.0.0.1:{port}/tools/invoke"
    payload = json.dumps({
        "tool": "sessions_list",
        "action": "json",
        "args": {},
    }).encode()

    req = urllib.request.Request(
        url, data=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        resp = urllib.request.urlopen(req, timeout=15)
        body = json.loads(resp.read())
        text = body["result"]["content"][0]["text"]
        sessions = json.loads(text)["sessions"]
        for s in sessions:
            if s.get("key") == session_key:
                sid = s.get("sessionId", "")
                # Construct transcript path
                home = str(Path.home())
                return os.path.join(
                    home, f".openclaw-{bot_id}", "agents", "main", "sessions", f"{sid}.jsonl"
                )
    except Exception:
        pass
    return ""


def check_transcript_for_kb(transcript_path: str, question_substr: str) -> str:
    """Check transcript for KB usage after a specific question was asked."""
    if not transcript_path or not os.path.exists(transcript_path):
        return ""

    # Find the question in transcript, then look at subsequent tool calls/responses
    lines = open(transcript_path).readlines()
    found_question = False
    reply_parts = []

    for line in reversed(lines):
        try:
            entry = json.loads(line.strip())
        except Exception:
            continue

        msg = entry.get("message", {})
        role = msg.get("role", "")

        if role == "user":
            content = msg.get("content", [])
            if isinstance(content, list):
                text = " ".join(c.get("text", "") for c in content if isinstance(c, dict))
            else:
                text = str(content)
            if question_substr[:30] in text:
                found_question = True
                break

        if role == "assistant":
            content = msg.get("content", [])
            if isinstance(content, list):
                for c in content:
                    if isinstance(c, dict) and c.get("type") == "text":
                        reply_parts.append(c.get("text", ""))

        if role == "toolResult":
            content = msg.get("content", [])
            if isinstance(content, list):
                for c in content:
                    if isinstance(c, dict) and c.get("type") == "text":
                        reply_parts.append(c.get("text", ""))

    if found_question and reply_parts:
        return "\n".join(reversed(reply_parts))
    return ""


def send_message(bot_id: str, question: str, session_key: str) -> tuple[str, str]:
    """Send message to bot, return (status, reply)."""
    port = BOT_PORTS[bot_id]
    token = get_token(bot_id)
    if not token:
        return "SKIP", ""

    url = f"http://127.0.0.1:{port}/tools/invoke"
    payload = json.dumps({
        "tool": "sessions_send",
        "action": "json",
        "timeoutMs": 120000,
        "args": {"message": question, "sessionKey": session_key, "timeoutMs": 120000},
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        resp = urllib.request.urlopen(req, timeout=TIMEOUT_SEC)
        body = json.loads(resp.read())
    except Exception:
        return "TIMEOUT", ""

    details = body.get("result", {}).get("details", {})
    status = details.get("status", "unknown")
    reply = details.get("reply", "")

    if status == "timeout" or not reply:
        # Gateway timed out, but the bot may still be processing.
        # Wait a bit then check the transcript for the answer.
        import time
        time.sleep(45)
        transcript = get_session_transcript_path(bot_id, session_key)
        transcript_reply = check_transcript_for_kb(transcript, question)
        if transcript_reply:
            return "ok_late", transcript_reply
        return "TIMEOUT", ""

    return "ok", reply


def evaluate(reply: str) -> str:
    """Evaluate if the reply is KB-based."""
    if not reply:
        return "TIMEOUT"

    # Also count KB tool errors as KB usage (the bot tried to use KB)
    kb_tool_attempted = bool(re.search(
        r"kb-cli|kb-manager|kb_search|kb_upsert|exec.*kb|knowledge_base.*error|semo\.knowledge",
        reply, re.IGNORECASE
    ))
    has_kb = bool(KB_INDICATORS.search(reply)) or kb_tool_attempted
    has_local_only = bool(LOCAL_ONLY_INDICATORS.search(reply))

    if has_kb and not has_local_only:
        return "PASS"
    elif has_kb and has_local_only:
        return "PARTIAL"
    else:
        return "FAIL"


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    # --main flag: use existing main session instead of new webchat sessions
    use_main_session = "--main" in sys.argv
    if use_main_session:
        sys.argv.remove("--main")

    print(f"{CYAN}{'=' * 72}{NC}")
    print(f"{CYAN}  KB-First SoT 행동 규칙 검증 테스트{NC}")
    print(f"{CYAN}  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{NC}")
    print(f"{CYAN}{'=' * 72}{NC}")
    print()

    # Determine bots to test
    if len(sys.argv) > 1:
        bots = [b for b in sys.argv[1:] if b in BOT_PORTS]
    else:
        bots = [b for b, p in BOT_PORTS.items() if check_gateway(p)]

    if not bots:
        print(f"{RED}게이트웨이가 살아있는 봇이 없습니다.{NC}")
        sys.exit(1)

    print(f"테스트 대상: {CYAN}{', '.join(bots)}{NC}")
    print(f"도메인: {', '.join(DOMAINS)}")
    print()

    # Header
    header = f"{'Bot':<12}"
    for d in DOMAINS:
        header += f"{d:<12}"
    print(header)
    print("─" * 84)

    # Results
    results = []
    total = passed = failed = timeouts = 0

    for bot_id in bots:
        row = f"{bot_id:<12}"

        for domain in DOMAINS:
            question = TEST_QUESTIONS[domain]
            if use_main_session:
                session_key = "agent:main:main"
            else:
                session_key = f"agent:main:webchat:kb-sot-audit-{domain}"

            print(f"\r  {bot_id}/{domain} 테스트 중...", end="", flush=True)
            status, reply = send_message(bot_id, question, session_key)

            if status == "SKIP":
                verdict = "SKIP"
            elif status == "TIMEOUT":
                verdict = "TIMEOUT"
                timeouts += 1
            elif status == "ok_late":
                verdict = evaluate(reply)
                if verdict == "PASS":
                    verdict = "PASS(late)"
            else:
                verdict = evaluate(reply)

            total += 1
            if verdict in ("PASS", "PASS(late)", "PARTIAL"):
                passed += 1

            if verdict == "FAIL":
                failed += 1

            # Save reply for review
            out_path = f"/tmp/kb-sot-{bot_id}-{domain}.txt"
            Path(out_path).write_text(reply or "(no reply)")

            results.append({
                "bot": bot_id,
                "domain": domain,
                "verdict": verdict,
                "reply_preview": (reply or "")[:200],
            })

            color = {
                "PASS": GREEN,
                "PASS(late)": GREEN,
                "PARTIAL": YELLOW,
                "FAIL": RED,
                "TIMEOUT": YELLOW,
                "SKIP": YELLOW,
            }.get(verdict, NC)
            row += f"{color}{verdict:<12}{NC}"

        print(f"\r{row}")

    # Summary
    print()
    print("─" * 84)
    print(
        f"총 {total}건: "
        f"{GREEN}PASS {passed}{NC} | "
        f"{RED}FAIL {failed}{NC} | "
        f"{YELLOW}TIMEOUT {timeouts}{NC}"
    )
    print()
    print("상세 답변: /tmp/kb-sot-{bot}-{domain}.txt")

    # Save JSON results
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    json_path = f"/tmp/kb-first-sot-test-{ts}.json"
    Path(json_path).write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"JSON 결과: {json_path}")
    print()

    if failed > 0:
        print(f"{RED}일부 테스트 실패. 상세 답변을 확인하세요.{NC}")
        sys.exit(1)
    elif passed == 0:
        print(f"{YELLOW}통과한 테스트가 없습니다 (타임아웃/스킵).{NC}")
        sys.exit(2)
    else:
        print(f"{GREEN}KB-First SoT 규칙 검증 통과!{NC}")
        sys.exit(0)


if __name__ == "__main__":
    main()

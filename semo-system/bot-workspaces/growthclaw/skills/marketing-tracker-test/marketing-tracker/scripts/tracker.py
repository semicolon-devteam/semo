#!/usr/bin/env python3
"""
Marketing Tracker — 커뮤니티 홍보글 성과 추적 통합 스크립트.

Commands:
    add <url1> [url2] ...   — URL 등록 (배치 지원)
    check                   — 성과 체크 (스케줄 기반)
    check --force           — 스케줄 무시하고 즉시 체크
    report [--days N]       — 성과 리포트 생성 (기본 7일)
    status                  — 현재 추적 상태 요약
    remove <url>            — URL 추적 중단

Data is stored in DATA_DIR (env: MARKETING_TRACKER_DATA, default: ./data/marketing-tracker)
"""

import sys
import json
import os
import re
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

KST = timezone(timedelta(hours=9))

# --- Data directory ---
DATA_DIR = Path(os.environ.get("MARKETING_TRACKER_DATA", Path(__file__).parent.parent / "data"))
TRACKING_FILE = DATA_DIR / "tracking.json"
HISTORY_DIR = DATA_DIR / "history"
DELETED_DIR = DATA_DIR / "deleted"

for d in [DATA_DIR, HISTORY_DIR, DELETED_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# --- Community detection ---
COMMUNITY_MAP = {
    "cafe.naver.com": "naver_cafe",
    "m.cafe.naver.com": "naver_cafe",
    "fmkorea.com": "fmkorea",
    "www.fmkorea.com": "fmkorea",
    "gall.dcinside.com": "dcinside",
    "m.dcinside.com": "dcinside",
    "clien.net": "clien",
    "www.clien.net": "clien",
    "reddit.com": "reddit",
    "www.reddit.com": "reddit",
    "old.reddit.com": "reddit",
    "bobaedream.co.kr": "bobaedream",
    "www.bobaedream.co.kr": "bobaedream",
    "mlbpark.donga.com": "mlbpark",
    "ppomppu.co.kr": "ppomppu",
    "www.ppomppu.co.kr": "ppomppu",
    "ygosu.com": "ygosu",
    "www.ygosu.com": "ygosu",
    "ruliweb.com": "ruliweb",
    "bbs.ruliweb.com": "ruliweb",
    "ilbe.com": "ilbe",
    "www.ilbe.com": "ilbe",
    "fomos.kr": "fomos",
    "www.fomos.kr": "fomos",
}

# JS 렌더링 필요 사이트 (브라우저 자동화 사용)
BROWSER_REQUIRED = {
    "bobaedream", "ppomppu", "ygosu", "fomos", "mlbpark", "ruliweb", "ilbe"
}

USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

# Browser helper import (optional)
try:
    from browser_helper import fetch_with_browser
    BROWSER_AVAILABLE = True
except ImportError:
    BROWSER_AVAILABLE = False


def detect_community(url: str) -> str:
    netloc = urlparse(url).netloc.lower()
    for domain, community in COMMUNITY_MAP.items():
        if netloc == domain or netloc.endswith("." + domain):
            return community
    return "unknown"


def normalize_url(url: str, community: str) -> str:
    """Convert to mobile/accessible URL where possible."""
    if community == "naver_cafe":
        # Mobile URL is more accessible (no iframe)
        url = url.replace("cafe.naver.com", "m.cafe.naver.com")
    elif community == "reddit":
        # Use old.reddit for simpler HTML
        url = re.sub(r"(www\.|)reddit\.com", "old.reddit.com", url)
        # Append .json for API access
        if not url.endswith(".json"):
            url = url.rstrip("/") + ".json"
    return url


# --- Data I/O ---
def load_tracking() -> dict:
    if TRACKING_FILE.exists():
        return json.loads(TRACKING_FILE.read_text("utf-8"))
    return {"tracked_urls": []}


def save_tracking(data: dict):
    TRACKING_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")


# --- Fetch with error classification ---
class FetchResult:
    def __init__(self, content=None, status=None, error=None, is_network_error=False):
        self.content = content
        self.status = status
        self.error = error
        self.is_network_error = is_network_error

    @property
    def is_deleted(self):
        return self.status in (404, 410, 451)

    @property
    def ok(self):
        return self.content is not None and not self.is_deleted


def fetch_url(url: str, community: str = None) -> FetchResult:
    """Fetch URL with network error vs deletion distinction. Uses browser for JS-heavy sites."""
    
    # 브라우저 렌더링 필요 사이트
    if community and community in BROWSER_REQUIRED and BROWSER_AVAILABLE:
        try:
            html, status = fetch_with_browser(url)
            if html:
                return FetchResult(content=html, status=status or 200)
            else:
                return FetchResult(error="Browser fetch failed", is_network_error=True)
        except Exception as e:
            # Fallback to urllib if browser fails
            print(f"⚠️  Browser fetch failed for {community}, falling back to urllib: {e}", file=sys.stderr)
    
    # 기본 urllib 방식
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode("utf-8", errors="replace")
            return FetchResult(content=content, status=resp.status)
    except urllib.error.HTTPError as e:
        return FetchResult(status=e.code, error=str(e))
    except (urllib.error.URLError, OSError, TimeoutError) as e:
        return FetchResult(error=str(e), is_network_error=True)


# --- Parsers (best-effort) ---
def _extract_number(text: str) -> int:
    m = re.search(r"[\d,]+", text or "")
    return int(m.group().replace(",", "")) if m else 0


def parse_naver_cafe(html: str) -> dict | None:
    """Parse Naver Cafe mobile page."""
    if not html:
        return None
    deleted_markers = ["삭제된 게시글", "존재하지 않는 게시글", "권한이 없습니다", "게시판이 존재하지 않습니다"]
    if any(m in html for m in deleted_markers):
        return {"exists": False}

    views = 0
    likes = 0
    comments = 0
    comment_texts = []

    # Mobile views: "조회 1,234"
    m = re.search(r"조회\s*([\d,]+)", html)
    if m:
        views = int(m.group(1).replace(",", ""))

    # Likes: "좋아요 숫자" or data attribute
    m = re.search(r"(?:좋아요|공감)\s*([\d,]+)", html)
    if m:
        likes = int(m.group(1).replace(",", ""))

    # Comment count
    m = re.search(r"댓글\s*([\d,]+)", html)
    if m:
        comments = int(m.group(1).replace(",", ""))

    # Comment texts (mobile format)
    comment_texts = re.findall(r'<span[^>]*class="[^"]*comment_text[^"]*"[^>]*>(.*?)</span>', html, re.S)
    comment_texts = [re.sub(r"<[^>]+>", "", t).strip() for t in comment_texts[:30]]

    return {"exists": True, "views": views, "likes": likes, "comments": comments, "comment_texts": comment_texts}


def parse_fmkorea(html: str) -> dict | None:
    if not html:
        return None
    deleted_markers = ["삭제된 글", "존재하지 않는 게시물", "페이지를 찾을 수 없습니다"]
    if any(m in html for m in deleted_markers):
        return {"exists": False}

    views = likes = comments = 0
    comment_texts = []

    m = re.search(r"조회[^\d]*([\d,]+)", html)
    if m:
        views = int(m.group(1).replace(",", ""))
    m = re.search(r"추천[^\d]*([\d,]+)", html)
    if m:
        likes = int(m.group(1).replace(",", ""))
    m = re.search(r"댓글[^\d]*([\d,]+)", html)
    if m:
        comments = int(m.group(1).replace(",", ""))

    comment_texts = re.findall(r'<div[^>]*class="[^"]*comment_content[^"]*"[^>]*>(.*?)</div>', html, re.S)
    comment_texts = [re.sub(r"<[^>]+>", "", t).strip() for t in comment_texts[:30]]

    return {"exists": True, "views": views, "likes": likes, "comments": comments, "comment_texts": comment_texts}


def parse_dcinside(html: str) -> dict | None:
    if not html:
        return None
    deleted_markers = ["삭제된 글", "이 갤러리에 해당 글이 없습니다", "해당 갤러리는 존재하지 않습니다"]
    if any(m in html for m in deleted_markers):
        return {"exists": False}

    views = likes = comments = 0
    comment_texts = []

    m = re.search(r"조회[^\d]*([\d,]+)", html)
    if m:
        views = int(m.group(1).replace(",", ""))
    m = re.search(r"추천[^\d]*([\d,]+)", html)
    if m:
        likes = int(m.group(1).replace(",", ""))
    m = re.search(r"댓글[^\d]*([\d,]+)", html)
    if m:
        comments = int(m.group(1).replace(",", ""))

    comment_texts = re.findall(r'<p[^>]*class="[^"]*usertxt[^"]*"[^>]*>(.*?)</p>', html, re.S)
    comment_texts = [re.sub(r"<[^>]+>", "", t).strip() for t in comment_texts[:30]]

    return {"exists": True, "views": views, "likes": likes, "comments": comments, "comment_texts": comment_texts}


def parse_clien(html: str) -> dict | None:
    if not html:
        return None
    deleted_markers = ["삭제된 게시물", "없는 게시물", "찾을 수 없습니다"]
    if any(m in html for m in deleted_markers):
        return {"exists": False}

    views = likes = comments = 0
    comment_texts = []

    m = re.search(r"조회[^\d]*([\d,]+)", html)
    if m:
        views = int(m.group(1).replace(",", ""))
    m = re.search(r"공감[^\d]*([\d,]+)", html)
    if m:
        likes = int(m.group(1).replace(",", ""))
    m = re.search(r"댓글[^\d]*([\d,]+)", html)
    if m:
        comments = int(m.group(1).replace(",", ""))

    comment_texts = re.findall(r'<div[^>]*class="[^"]*comment_content[^"]*"[^>]*>(.*?)</div>', html, re.S)
    comment_texts = [re.sub(r"<[^>]+>", "", t).strip() for t in comment_texts[:30]]

    return {"exists": True, "views": views, "likes": likes, "comments": comments, "comment_texts": comment_texts}


def parse_reddit_json(json_text: str) -> dict | None:
    """Parse Reddit .json API response."""
    try:
        data = json.loads(json_text)
        if isinstance(data, list) and len(data) > 0:
            post = data[0]["data"]["children"][0]["data"]
        elif isinstance(data, dict):
            post = data.get("data", {}).get("children", [{}])[0].get("data", {})
        else:
            return None

        if post.get("removed_by_category") or post.get("removed"):
            return {"exists": False}

        comment_texts = []
        if isinstance(data, list) and len(data) > 1:
            for child in data[1].get("data", {}).get("children", [])[:30]:
                body = child.get("data", {}).get("body", "")
                if body:
                    comment_texts.append(body)

        return {
            "exists": True,
            "views": post.get("view_count") or 0,
            "likes": post.get("ups", 0),
            "comments": post.get("num_comments", 0),
            "comment_texts": comment_texts,
        }
    except (json.JSONDecodeError, KeyError, IndexError):
        return None


def parse_bobaedream(html: str) -> dict | None:
    """Parse Bobaedream community post."""
    if not html:
        return None
    deleted_markers = ["삭제된 글", "찾을 수 없습니다", "게시물이 존재하지 않습니다"]
    if any(m in html for m in deleted_markers):
        return {"exists": False}

    views = likes = comments = 0
    comment_texts = []

    # Views: 조회 <em class="txtType">127</em> (다중 라인 고려)
    m = re.search(r'조회[^>]*<em[^>]*class="txtType"[^>]*>([\d,]+)</em>', html, re.S)
    if not m:
        m = re.search(r'조회[^\d]*([\d,]+)', html)
    if m:
        views = int(m.group(1).replace(",", ""))

    # Likes: 추천 <em class="txtType">7</em>
    m = re.search(r'추천[^>]*<em[^>]*class="txtType"[^>]*>([\d,]+)</em>', html, re.S)
    if not m:
        m = re.search(r'추천[^\d]*([\d,]+)', html)
    if m:
        likes = int(m.group(1).replace(",", ""))

    # Comments: 댓글 수 추출
    m = re.search(r'댓글[^\d]*([\d,]+)', html)
    if m:
        comments = int(m.group(1).replace(",", ""))

    return {"exists": True, "views": views, "likes": likes, "comments": comments, "comment_texts": comment_texts}


def parse_mlbpark(html: str) -> dict | None:
    """Parse MLB Park post."""
    if not html:
        return None
    deleted_markers = ["삭제된 글", "존재하지 않는", "찾을 수 없습니다"]
    if any(m in html for m in deleted_markers):
        return {"exists": False}

    views = likes = comments = 0
    comment_texts = []

    m = re.search(r'조회[^\d]*([\d,]+)', html)
    if m:
        views = int(m.group(1).replace(",", ""))
    m = re.search(r'추천[^\d]*([\d,]+)', html)
    if m:
        likes = int(m.group(1).replace(",", ""))
    m = re.search(r'댓글[^\d]*([\d,]+)', html)
    if m:
        comments = int(m.group(1).replace(",", ""))

    return {"exists": True, "views": views, "likes": likes, "comments": comments, "comment_texts": comment_texts}


def parse_ppomppu(html: str) -> dict | None:
    """Parse Ppomppu community post."""
    if not html:
        return None
    deleted_markers = ["삭제된 글", "존재하지 않는 게시물", "찾을 수 없습니다"]
    if any(m in html for m in deleted_markers):
        return {"exists": False}

    views = likes = comments = 0
    comment_texts = []

    m = re.search(r'조회[^\d]*([\d,]+)', html)
    if m:
        views = int(m.group(1).replace(",", ""))
    m = re.search(r'추천[^\d]*([\d,]+)', html)
    if m:
        likes = int(m.group(1).replace(",", ""))
    m = re.search(r'댓글[^\d]*([\d,]+)', html)
    if m:
        comments = int(m.group(1).replace(",", ""))

    return {"exists": True, "views": views, "likes": likes, "comments": comments, "comment_texts": comment_texts}


def parse_ygosu(html: str) -> dict | None:
    """Parse Ygosu community post."""
    if not html:
        return None
    deleted_markers = ["삭제된 글", "존재하지 않는 게시물", "찾을 수 없습니다"]
    if any(m in html for m in deleted_markers):
        return {"exists": False}

    views = likes = comments = 0
    comment_texts = []

    m = re.search(r'조회[^\d]*([\d,]+)', html)
    if m:
        views = int(m.group(1).replace(",", ""))
    m = re.search(r'추천[^\d]*([\d,]+)', html)
    if m:
        likes = int(m.group(1).replace(",", ""))
    m = re.search(r'댓글[^\d]*([\d,]+)', html)
    if m:
        comments = int(m.group(1).replace(",", ""))

    return {"exists": True, "views": views, "likes": likes, "comments": comments, "comment_texts": comment_texts}


def parse_ruliweb(html: str) -> dict | None:
    """Parse Ruliweb community post."""
    if not html:
        return None
    deleted_markers = ["삭제된 글", "존재하지 않는 게시물", "찾을 수 없습니다"]
    if any(m in html for m in deleted_markers):
        return {"exists": False}

    views = likes = comments = 0
    comment_texts = []

    m = re.search(r'조회[^\d]*([\d,]+)', html)
    if m:
        views = int(m.group(1).replace(",", ""))
    m = re.search(r'추천[^\d]*([\d,]+)', html)
    if m:
        likes = int(m.group(1).replace(",", ""))
    m = re.search(r'댓글[^\d]*([\d,]+)', html)
    if m:
        comments = int(m.group(1).replace(",", ""))

    return {"exists": True, "views": views, "likes": likes, "comments": comments, "comment_texts": comment_texts}


def parse_ilbe(html: str) -> dict | None:
    """Parse Ilbe community post."""
    if not html:
        return None
    deleted_markers = ["삭제된 글", "존재하지 않는 게시물", "찾을 수 없습니다"]
    if any(m in html for m in deleted_markers):
        return {"exists": False}

    views = likes = comments = 0
    comment_texts = []

    # 조회수
    m = re.search(r'조회[^\d]*([\d,]+)', html)
    if m:
        views = int(m.group(1).replace(",", ""))
    
    # 일베 특수 추천 패턴: "일베로<em>10</em>"
    m = re.search(r'일베로[^>]*<em[^>]*>([\d,]+)</em>', html, re.S)
    if m:
        likes = int(m.group(1).replace(",", ""))
    else:
        # 일반 추천 패턴
        m = re.search(r'추천[^\d]*([\d,]+)', html)
        if m:
            likes = int(m.group(1).replace(",", ""))
    
    # 댓글
    m = re.search(r'댓글[^\d]*([\d,]+)', html)
    if m:
        comments = int(m.group(1).replace(",", ""))

    return {"exists": True, "views": views, "likes": likes, "comments": comments, "comment_texts": comment_texts}


def parse_fomos(html: str) -> dict | None:
    """Parse Fomos community post."""
    if not html:
        return None
    deleted_markers = ["삭제된 글", "존재하지 않는 게시물", "찾을 수 없습니다"]
    if any(m in html for m in deleted_markers):
        return {"exists": False}

    views = likes = comments = 0
    comment_texts = []

    m = re.search(r'조회[^\d]*([\d,]+)', html)
    if m:
        views = int(m.group(1).replace(",", ""))
    m = re.search(r'추천[^\d]*([\d,]+)', html)
    if m:
        likes = int(m.group(1).replace(",", ""))
    m = re.search(r'댓글[^\d]*([\d,]+)', html)
    if m:
        comments = int(m.group(1).replace(",", ""))

    return {"exists": True, "views": views, "likes": likes, "comments": comments, "comment_texts": comment_texts}


PARSERS = {
    "naver_cafe": parse_naver_cafe,
    "fmkorea": parse_fmkorea,
    "dcinside": parse_dcinside,
    "clien": parse_clien,
    "reddit": parse_reddit_json,
    "bobaedream": parse_bobaedream,
    "mlbpark": parse_mlbpark,
    "ppomppu": parse_ppomppu,
    "ygosu": parse_ygosu,
    "ruliweb": parse_ruliweb,
    "ilbe": parse_ilbe,
    "fomos": parse_fomos,
}


# --- Check logic ---
def now_kst() -> datetime:
    return datetime.now(KST)


def should_check(entry: dict, now: datetime) -> tuple[bool, str]:
    added = datetime.fromisoformat(entry["added_at"])
    hours = (now - added).total_seconds() / 3600

    if hours > 7 * 24:
        return False, "expired"

    if entry["status"] != "active":
        return False, "inactive"

    last = entry.get("last_checked")
    last_dt = datetime.fromisoformat(last) if last else None

    # Day 1: 1.5h 간격 3회
    if hours < 24:
        if entry.get("day1_checks", 0) >= 3:
            return False, "day1_done"
        if last_dt is None:
            return True, "day1_first"
        if (now - last_dt).total_seconds() >= 5400:  # 1.5h
            return True, "day1"
        return False, "day1_wait"

    # Day 2-7: 하루 1회 (최소 20시간 간격)
    if last_dt and (now - last_dt).total_seconds() < 20 * 3600:
        return False, "daily_wait"
    return True, "daily"


def check_entry(entry: dict, force: bool = False) -> dict | None:
    """Check a single entry. Returns event dict if notable (deletion, etc)."""
    now = now_kst()

    if not force:
        ok, reason = should_check(entry, now)
        if not ok:
            return None

    url = entry["url"]
    community = entry["community"]
    fetch_url_str = normalize_url(url, community)
    result = fetch_url(fetch_url_str, community=community)

    # Network error → skip, don't mark deleted
    if result.is_network_error:
        entry.setdefault("consecutive_errors", 0)
        entry["consecutive_errors"] += 1
        print(f"  ⚠️  네트워크 오류 ({entry['consecutive_errors']}회 연속): {result.error}")
        # Only consider deletion after 3 consecutive network errors
        if entry["consecutive_errors"] >= 3:
            print(f"  🔶 3회 연속 실패 — 다음 체크 시 삭제 여부 재확인 필요")
        return None

    entry["consecutive_errors"] = 0

    # HTTP 404/410 → deleted
    if result.is_deleted:
        return _handle_deletion(entry, now, f"HTTP {result.status}")

    # Parse
    parser = PARSERS.get(entry["community"])
    if not parser:
        print(f"  ⚠️  파서 없음: {entry['community']}")
        return None

    parsed = parser(result.content)
    if parsed is None:
        # Parse failure ≠ deletion
        print(f"  ⚠️  파싱 실패 (삭제로 처리하지 않음)")
        return None

    if not parsed.get("exists", True):
        return _handle_deletion(entry, now, "삭제 마커 감지")

    # Update metrics
    entry["last_checked"] = now.isoformat()
    hours_since = (now - datetime.fromisoformat(entry["added_at"])).total_seconds() / 3600
    if hours_since < 24:
        entry["day1_checks"] = entry.get("day1_checks", 0) + 1

    metrics = {
        "views": parsed.get("views", 0),
        "likes": parsed.get("likes", 0),
        "comments": parsed.get("comments", 0),
    }

    if entry.get("initial_metrics") is None:
        entry["initial_metrics"] = dict(metrics)

    entry["current_metrics"] = metrics
    entry["comment_texts"] = parsed.get("comment_texts", [])

    _save_snapshot(entry, now)

    v, l, c = metrics["views"], metrics["likes"], metrics["comments"]
    print(f"  ✅ 조회 {v} | 좋아요 {l} | 댓글 {c}")
    return None


def _handle_deletion(entry: dict, now: datetime, reason: str) -> dict:
    added = datetime.fromisoformat(entry["added_at"])
    lifetime_h = round((now - added).total_seconds() / 3600, 1)

    entry["status"] = "deleted"
    entry["deleted_at"] = now.isoformat()
    entry["lifetime_hours"] = lifetime_h
    entry["deletion_reason"] = reason

    # Save archive
    fname = f"{now.strftime('%Y%m%d_%H%M%S')}_{entry['community']}.json"
    (DELETED_DIR / fname).write_text(json.dumps(entry, ensure_ascii=False, indent=2), "utf-8")

    print(f"  🗑️  삭제 감지 ({reason}) — 생존: {lifetime_h}시간")

    return {
        "type": "deletion",
        "url": entry["url"],
        "community": entry["community"],
        "lifetime_hours": lifetime_h,
        "reason": reason,
    }


def _save_snapshot(entry: dict, now: datetime):
    today = now.strftime("%Y-%m-%d")
    fpath = HISTORY_DIR / f"{today}.json"
    history = json.loads(fpath.read_text("utf-8")) if fpath.exists() else {"snapshots": []}
    history["snapshots"].append({
        "timestamp": now.isoformat(),
        "url": entry["url"],
        "community": entry["community"],
        "metrics": entry["current_metrics"],
    })
    fpath.write_text(json.dumps(history, ensure_ascii=False, indent=2), "utf-8")


# --- Commands ---
def cmd_add(urls: list[str]):
    data = load_tracking()
    existing = {e["url"] for e in data["tracked_urls"]}
    now = now_kst()
    added = 0

    for url in urls:
        url = url.strip()
        if not url.startswith("http"):
            print(f"⚠️  잘못된 URL 건너뜀: {url}")
            continue
        if url in existing:
            print(f"⚠️  이미 추적 중: {url}")
            continue

        community = detect_community(url)
        track_until = (now + timedelta(days=7)).isoformat()

        data["tracked_urls"].append({
            "url": url,
            "status": "active",
            "added_at": now.isoformat(),
            "track_until": track_until,
            "community": community,
            "day1_checks": 0,
            "last_checked": None,
            "consecutive_errors": 0,
            "initial_metrics": None,
            "current_metrics": None,
            "comment_texts": [],
        })

        print(f"✅ 추적 시작: {community}")
        print(f"   URL: {url}")
        print(f"   추적 기간: 7일 ({track_until[:10]}까지)")
        print(f"   Day 1: 1.5시간 간격 3회 | Day 2-7: 일일 1회")
        print()
        added += 1

    save_tracking(data)
    print(f"📊 {added}/{len(urls)} URL 추가 완료")


def cmd_check(force: bool = False):
    data = load_tracking()
    now = now_kst()
    print(f"🔍 성과 체크 — {now.strftime('%Y-%m-%d %H:%M')}")

    events = []
    checked = 0

    for entry in data["tracked_urls"]:
        if entry["status"] != "active":
            continue

        # Auto-archive expired
        added = datetime.fromisoformat(entry["added_at"])
        if (now - added).total_seconds() > 7 * 24 * 3600:
            entry["status"] = "archived"
            entry["archived_at"] = now.isoformat()
            print(f"⏱️  추적 종료 (7일): {entry['url']}")
            continue

        print(f"\n🔗 {entry['community']}: {entry['url']}")
        event = check_entry(entry, force=force)
        if event:
            events.append(event)
        checked += 1

    save_tracking(data)
    print(f"\n✅ {checked}개 URL 체크 완료")

    # Return events for caller (deletion alerts etc.)
    return events


def cmd_report(days: int = 7):
    data = load_tracking()
    now = now_kst()
    cutoff = now - timedelta(days=days)

    active = [e for e in data["tracked_urls"] if e["status"] == "active"]
    deleted = [e for e in data["tracked_urls"] if e["status"] == "deleted"]
    archived = [e for e in data["tracked_urls"] if e["status"] == "archived"]

    # Filter to recent
    def is_recent(e):
        return datetime.fromisoformat(e["added_at"]) >= cutoff

    recent = [e for e in data["tracked_urls"] if is_recent(e)]
    recent_deleted = [e for e in deleted if is_recent(e)]

    print(f"# 📊 마케팅 성과 리포트 ({days}일)")
    print(f"기간: {cutoff.strftime('%Y-%m-%d')} ~ {now.strftime('%Y-%m-%d')}\n")

    print(f"## 요약")
    print(f"- 활성: {len(active)}개")
    print(f"- 삭제됨: {len(recent_deleted)}개")
    print(f"- 만료 아카이브: {len(archived)}개")
    print(f"- 전체 (기간 내): {len(recent)}개\n")

    # Community breakdown
    by_community = {}
    for e in recent:
        c = e["community"]
        by_community.setdefault(c, []).append(e)

    if by_community:
        print(f"## 커뮤니티별 성과")
        for comm, entries in by_community.items():
            print(f"\n### {comm}")
            for e in entries:
                m = e.get("current_metrics") or {}
                status_icon = "🟢" if e["status"] == "active" else "🗑️" if e["status"] == "deleted" else "⏹️"
                print(f"  {status_icon} {e['url']}")
                if m:
                    print(f"     조회 {m.get('views', 0)} | 좋아요 {m.get('likes', 0)} | 댓글 {m.get('comments', 0)}")
                if e["status"] == "deleted":
                    print(f"     생존: {e.get('lifetime_hours', '?')}시간")

    # Top performers
    scored = [(e, (e.get("current_metrics") or {}).get("views", 0)) for e in recent if e.get("current_metrics")]
    scored.sort(key=lambda x: x[1], reverse=True)
    if scored:
        print(f"\n## 🏆 Top 5")
        for e, views in scored[:5]:
            m = e.get("current_metrics", {})
            print(f"  - [{e['community']}] 조회 {views} | 좋아요 {m.get('likes', 0)} — {e['url']}")

    # Deletion analysis
    if recent_deleted:
        print(f"\n## 🗑️ 삭제 분석")
        lifetimes = [e.get("lifetime_hours", 0) for e in recent_deleted]
        avg_life = sum(lifetimes) / len(lifetimes) if lifetimes else 0
        print(f"  평균 생존 시간: {avg_life:.1f}시간")
        for e in recent_deleted:
            print(f"  - [{e['community']}] {e.get('lifetime_hours', '?')}시간 생존 — {e['url']}")

    print()


def cmd_status():
    data = load_tracking()
    active = [e for e in data["tracked_urls"] if e["status"] == "active"]
    print(f"📋 추적 현황: {len(active)}개 활성\n")
    now = now_kst()
    for e in active:
        added = datetime.fromisoformat(e["added_at"])
        day = min(7, int((now - added).total_seconds() / 86400) + 1)
        m = e.get("current_metrics") or {}
        checks = e.get("day1_checks", 0)
        print(f"  [{e['community']}] Day {day} (체크 {checks}회)")
        print(f"    {e['url']}")
        if m:
            print(f"    조회 {m.get('views', 0)} | 좋아요 {m.get('likes', 0)} | 댓글 {m.get('comments', 0)}")
        print()


def cmd_remove(url: str):
    data = load_tracking()
    for e in data["tracked_urls"]:
        if e["url"] == url and e["status"] == "active":
            e["status"] = "archived"
            e["archived_at"] = now_kst().isoformat()
            save_tracking(data)
            print(f"✅ 추적 중단: {url}")
            return
    print(f"❌ 활성 추적 URL을 찾을 수 없음: {url}")


# --- CLI ---
def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "add":
        if len(sys.argv) < 3:
            print("Usage: tracker.py add <url1> [url2] ...")
            sys.exit(1)
        cmd_add(sys.argv[2:])
    elif cmd == "check":
        force = "--force" in sys.argv
        events = cmd_check(force=force)
        if events:
            print("\n⚠️  이벤트 발생:")
            for ev in events:
                print(f"  - {ev['type']}: [{ev['community']}] {ev['url']} (생존 {ev.get('lifetime_hours', '?')}h)")
    elif cmd == "report":
        days = 7
        for i, arg in enumerate(sys.argv[2:], 2):
            if arg == "--days" and i + 1 < len(sys.argv):
                days = int(sys.argv[i + 1])
        cmd_report(days)
    elif cmd == "status":
        cmd_status()
    elif cmd == "remove":
        if len(sys.argv) < 3:
            print("Usage: tracker.py remove <url>")
            sys.exit(1)
        cmd_remove(sys.argv[2])
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()

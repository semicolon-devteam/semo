#!/usr/bin/env python3
"""
Browser Helper — requests-html로 JS 렌더링 사이트 크롤링.
"""

import sys
from pathlib import Path

# 동적 import (requests-html 없으면 graceful fallback)
try:
    from requests_html import HTMLSession
    BROWSER_AVAILABLE = True
except ImportError:
    BROWSER_AVAILABLE = False
    print("⚠️  requests-html not installed. Install with: pip3 install --user requests-html", file=sys.stderr)


def fetch_with_browser(url: str, timeout: int = 15) -> tuple[str | None, int | None]:
    """
    requests-html로 URL을 렌더링하고 HTML을 반환.
    
    Returns:
        (html_content, status_code) or (None, None) on error
    """
    if not BROWSER_AVAILABLE:
        return None, None
    
    try:
        session = HTMLSession()
        response = session.get(url, timeout=timeout, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8"
        })
        
        # JS 렌더링 (필요 시)
        try:
            response.html.render(timeout=10, sleep=1)
        except Exception as e:
            # 렌더링 실패해도 기본 HTML 사용
            print(f"⚠️  JS render skipped: {e}", file=sys.stderr)
        
        html = response.html.html
        status = response.status_code
        
        session.close()
        return html, status
            
    except Exception as e:
        print(f"⚠️  Browser fetch error: {e}", file=sys.stderr)
        return None, None


if __name__ == "__main__":
    # 테스트
    if len(sys.argv) > 1:
        url = sys.argv[1]
        html, status = fetch_with_browser(url)
        if html:
            print(f"Status: {status}")
            print(f"Content length: {len(html)}")
            print(f"\nFirst 500 chars:\n{html[:500]}")
        else:
            print("Failed to fetch")

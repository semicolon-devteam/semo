#!/usr/bin/env python3
"""
Google Calendar Event Creator

Creates calendar events with attendee prefixes in the title.
Automatically refreshes OAuth token before API calls.
"""

import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path

def load_credentials():
    """Load credentials from gcal-tokens.json"""
    # Try multiple possible locations
    possible_paths = [
        Path(__file__).parent.parent.parent / "scripts" / "gcal-tokens.json",  # workspace/scripts
        Path.home() / ".openclaw" / "workspace" / "scripts" / "gcal-tokens.json",  # absolute workspace path
    ]
    
    for cred_path in possible_paths:
        if cred_path.exists():
            with open(cred_path) as f:
                return json.load(f)
    
    print(f"Error: Credentials not found. Tried:", file=sys.stderr)
    for p in possible_paths:
        print(f"  {p}", file=sys.stderr)
    sys.exit(1)

def refresh_token(creds):
    """Refresh OAuth access token"""
    data = urllib.parse.urlencode({
        "client_id": creds["client_id"],
        "client_secret": creds["client_secret"],
        "refresh_token": creds["refresh_token"],
        "grant_type": "refresh_token"
    }).encode('utf-8')
    
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        method='POST'
    )
    
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result["access_token"]

def format_attendee_prefix(attendees):
    """Format attendee list as @Name @Name prefix"""
    if not attendees:
        return ""
    return " ".join(f"@{name}" for name in attendees) + " "

def create_event(title, start_time, end_time=None, attendees=None, description="", calendar_id=None, access_token=None):
    """
    Create a Google Calendar event
    
    Args:
        title: Event title (attendees will be prefixed automatically)
        start_time: ISO 8601 datetime string (e.g., "2026-03-02T20:00:00+09:00")
        end_time: ISO 8601 datetime string (optional, defaults to start_time + 1 hour)
        attendees: List of attendee names (e.g., ["Reus", "Roki", "bon"])
        description: Event description
        calendar_id: Target calendar ID (optional, uses default from credentials)
        access_token: OAuth token (optional, will refresh if not provided)
    
    Returns:
        Event object with htmlLink, id, etc.
    """
    creds = load_credentials()
    
    if not access_token:
        access_token = refresh_token(creds)
    
    if not calendar_id:
        calendar_id = creds.get("default_calendar_id")
    
    if not calendar_id:
        print("Error: No calendar_id provided and no default_calendar_id in credentials", file=sys.stderr)
        sys.exit(1)
    
    # Parse start time and generate end time if not provided
    start_dt = datetime.fromisoformat(start_time)
    if not end_time:
        end_dt = start_dt + timedelta(hours=1)
        end_time = end_dt.isoformat()
    
    # Add attendee prefix to title
    attendee_prefix = format_attendee_prefix(attendees or [])
    full_title = f"{attendee_prefix}{title}"
    
    event_body = {
        "summary": full_title,
        "description": description,
        "start": {
            "dateTime": start_time,
            "timeZone": "Asia/Seoul"
        },
        "end": {
            "dateTime": end_time,
            "timeZone": "Asia/Seoul"
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "popup", "minutes": 30}
            ]
        }
    }
    
    data = json.dumps(event_body).encode('utf-8')
    
    req = urllib.request.Request(
        f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events",
        data=data,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        },
        method='POST'
    )
    
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Create Google Calendar event with attendee prefix")
    parser.add_argument("title", help="Event title")
    parser.add_argument("start_time", help="Start time (ISO 8601, e.g., 2026-03-02T20:00:00+09:00)")
    parser.add_argument("--end-time", help="End time (ISO 8601, defaults to start + 1h)")
    parser.add_argument("--attendees", nargs="+", help="Attendee names (e.g., Reus Roki bon)")
    parser.add_argument("--description", default="", help="Event description")
    parser.add_argument("--calendar-id", help="Target calendar ID")
    
    args = parser.parse_args()
    
    event = create_event(
        title=args.title,
        start_time=args.start_time,
        end_time=args.end_time,
        attendees=args.attendees,
        description=args.description,
        calendar_id=args.calendar_id
    )
    
    print(json.dumps(event, indent=2, ensure_ascii=False))

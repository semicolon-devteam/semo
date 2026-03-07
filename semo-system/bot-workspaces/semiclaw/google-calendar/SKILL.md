---
name: google-calendar
description: Create, read, and manage Google Calendar events with automatic attendee prefix formatting. Use when creating calendar events, scheduling meetings, or managing schedules. Automatically prefixes event titles with @attendee format for easy visual identification.
---

# Google Calendar

Manage Google Calendar events with attendee-prefixed titles for better calendar visibility.

## Quick Start

Create an event with attendees:

```bash
python3 scripts/create_event.py \
  "프로젝트 미팅" \
  "2026-03-02T20:00:00+09:00" \
  --attendees Reus Roki bon Goni \
  --description "참석자: Reus, Roki, bon, Goni"
```

Result: `@Reus @Roki @bon @Goni 프로젝트 미팅`

## Core Features

### Attendee Prefix Format

Event titles automatically include attendee names with `@` prefix:
- Input: `title="미팅"`, `attendees=["Reus", "Roki"]`
- Output title: `@Reus @Roki 미팅`

This makes it easy to see who's attending without opening event details.

### Event Creation

Use `scripts/create_event.py`:

**Required:**
- `title` - Event name (attendees added automatically)
- `start_time` - ISO 8601 datetime (e.g., `2026-03-02T20:00:00+09:00`)

**Optional:**
- `--end-time` - End datetime (defaults to start + 1 hour)
- `--attendees` - Space-separated names (e.g., `Reus Roki bon`)
- `--description` - Event description
- `--calendar-id` - Override default calendar

### Default Behavior

- **Timezone:** Asia/Seoul
- **Duration:** 1 hour if end-time not specified
- **Reminders:** Popup 30 minutes before
- **Calendar:** Uses `default_calendar_id` from credentials

## Credentials

Credentials must exist at `scripts/gcal-tokens.json`. See [setup.md](references/setup.md) for structure.

## Examples

Single attendee:
```bash
python3 scripts/create_event.py "점심" "2026-03-02T12:00:00+09:00" --attendees Reus
```
→ `@Reus 점심`

Multiple attendees, custom time:
```bash
python3 scripts/create_event.py "회의" "2026-03-02T14:00:00+09:00" \
  --end-time "2026-03-02T15:30:00+09:00" \
  --attendees Reus Garden Roki
```
→ `@Reus @Garden @Roki 회의` (14:00-15:30)

No attendees (no prefix):
```bash
python3 scripts/create_event.py "개인 작업" "2026-03-02T10:00:00+09:00"
```
→ `개인 작업`

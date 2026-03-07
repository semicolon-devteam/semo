# Google Calendar Setup

## Credentials Structure

Credentials must be stored in `scripts/gcal-tokens.json`:

```json
{
  "client_id": "...",
  "client_secret": "...",
  "refresh_token": "...",
  "scope": "https://www.googleapis.com/auth/calendar",
  "calendar_email": "...",
  "default_calendar_id": "...",
  "default_calendar_name": "..."
}
```

## OAuth Token Flow

1. Token is automatically refreshed before each API call
2. No need to manually manage access tokens
3. Refresh token must be valid in credentials file

## Calendar ID

- Use `default_calendar_id` from credentials
- Or override with `--calendar-id` argument

# SEMO Sync Agent

Periodically syncs OpenClaw bot status data from Mac Mini to PostgreSQL (OCI).

## Architecture

```
[Mac Mini]                          [OCI]
Bot OpenClaw files              SEMO Dashboard
~/.openclaw-*/                  (Next.js)
    ↓                               ↓
Sync Agent (cron)              PostgreSQL (appdb)
- sessions.json    →           - bot_status
- cron/jobs.json   →           - bot_sessions
                               - bot_cron_jobs
```

## Setup

### 1. Install dependencies

```bash
cd semo-system/sync-agent
npm install
```

### 2. Set environment variable

```bash
export DATABASE_URL="postgresql://app:<PASSWORD>@central-db.semi-dev.internal:5432/appdb"
```

### 3. Create DB schema

```bash
psql $DATABASE_URL -f schema.sql
```

### 4. Test run

```bash
npm run sync
```

## Cron Setup

### Option 1: OpenClaw Cron (Recommended)

Add to SemiClaw (or any bot) cron jobs:

```javascript
{
  "name": "sync-bot-status",
  "schedule": {
    "kind": "every",
    "everyMs": 60000  // 1 minute
  },
  "payload": {
    "kind": "systemEvent",
    "text": "node /Users/reus/Desktop/Sources/semicolon/projects/semo/semo-system/sync-agent/sync.js"
  },
  "sessionTarget": "main",
  "enabled": true
}
```

### Option 2: System Cron

```bash
crontab -e

# Add:
* * * * * cd /Users/reus/Desktop/Sources/semicolon/projects/semo/semo-system/sync-agent && npm run sync >> /tmp/sync-agent.log 2>&1
```

## Monitoring

Check logs:
```bash
tail -f /tmp/sync-agent.log
```

Check DB:
```sql
SELECT bot_id, status, session_count, synced_at 
FROM bot_status 
ORDER BY synced_at DESC;
```

## Configuration

Edit `config.js`:

- `DATABASE_URL` - PostgreSQL connection string
- `SYNC_INTERVAL_MS` - Sync interval (not used in cron mode, but available for continuous mode)

## Files

- `sync.js` - Main entry point
- `lib/collector.js` - Data collection from OpenClaw directories
- `lib/parser.js` - Parse sessions.json and jobs.json
- `lib/uploader.js` - Upload to PostgreSQL
- `config.js` - Configuration
- `schema.sql` - Database schema

## Troubleshooting

**No bots found:**
- Check if `~/.openclaw-*` directories exist
- Verify bot IDs match directory names

**DB connection failed:**
- Check `DATABASE_URL` environment variable
- Verify network access to OCI PostgreSQL

**Sync errors:**
- Check `/tmp/sync-agent.log` for details
- Verify file permissions on `~/.openclaw-*` directories

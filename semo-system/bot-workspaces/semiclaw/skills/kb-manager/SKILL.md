---
name: kb-manager
description: Manage the Semicolon team Knowledge Base (PostgreSQL + pgvector). Use when searching, adding, or updating team knowledge, running KB queries, setting up the SSH tunnel, or managing bot-specific knowledge entries. Supports vector similarity search via Voyage-3 embeddings.
---

# KB Manager

Manages the Semicolon team's Knowledge Base (PostgreSQL + pgvector) via CLI. Covers SSH tunnel setup, CRUD operations, vector search, and bot-specific knowledge.

## 1. Prerequisites

- SSH tunnel: `bash <skill-dir>/scripts/kb-tunnel.sh start` (15432 → 10.0.0.91:5432)
- Node.js + semo project node_modules (NODE_PATH)
- Base command: `cd /Users/reus/Desktop/Sources/semicolon/projects/semo && NODE_PATH=./node_modules node <skill-dir>/scripts/kb-cli.js <cmd> [args]`

## 2. Common KB Commands (knowledge_base table)

| Command | Description | Example |
|---|---|---|
| `search "query" [limit]` | Vector similarity search (Voyage-3) | `search "프론트엔드 개발자" 3` |
| `get <domain> <key>` | Exact match lookup | `get team reus` |
| `list [domain]` | List entries | `list project` |
| `list-domains` | List all domains | `list-domains` |
| `upsert <domain> <key> "content" [author]` | Add/update entry | `upsert team newbie "신규 팀원" semiclaw` |
| `stats` | Show statistics | `stats` |

## 3. Bot-specific KB Commands (bot_knowledge table)

| Command | Description | Example |
|---|---|---|
| `bot-search <bot_id> "query"` | Bot-scoped vector search | `bot-search workclaw "코드 스타일"` |
| `bot-get <bot_id> <domain> <key>` | Bot-scoped exact match | `bot-get semiclaw config role` |
| `bot-list [bot_id]` | List bot entries | `bot-list workclaw` |
| `bot-upsert <bot_id> <domain> <key> "content"` | Add/update bot entry | `bot-upsert workclaw learned pr-convention "PR 규칙..."` |

## 4. Domains

Common: team, project, decision, process, infra
Bot-specific: config, learned, context (free-form)

## 5. Technical Details

- DB: appdb, schema: semo, pgvector extension
- Embedding: Voyage-3 (1024 dimensions), auto-generated on upsert
- Output: JSON (pipe to `jq` for parsing)
- Tunnel port: 15432 → 10.0.0.91:5432

## 6. Tunnel Management

```bash
bash scripts/kb-tunnel.sh start   # Start tunnel
bash scripts/kb-tunnel.sh stop    # Stop tunnel  
bash scripts/kb-tunnel.sh status  # Check status
```

## 7. Troubleshooting

- Connection refused → tunnel not running, run `kb-tunnel.sh start`
- Embedding error → check VOYAGE_API_KEY env var
- Permission denied → SSH key not configured for 10.0.0.91

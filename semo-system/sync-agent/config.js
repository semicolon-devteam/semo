/**
 * Sync Agent Configuration
 */

module.exports = {
  // PostgreSQL connection
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://app:password@central-db.semi-dev.internal:5432/appdb',
  
  // Sync interval (milliseconds)
  SYNC_INTERVAL_MS: parseInt(process.env.SYNC_INTERVAL_MS || '60000', 10), // 1 minute
  
  // GitHub workspace paths (for metadata enrichment)
  GITHUB_REPO: 'semicolon-devteam/semo',
  BOT_WORKSPACES_PATH: 'semo-system/bot-workspaces',
};

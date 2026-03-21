/**
 * Database Uploader
 * 
 * Upload collected bot data to PostgreSQL
 */

const { Client } = require('pg');
const config = require('../config');

/**
 * Upload bot data to database
 * @param {Array<object>} botDataList - Array of bot data objects
 */
async function uploadToDatabase(botDataList) {
  const client = new Client({
    connectionString: config.DATABASE_URL,
  });
  
  await client.connect();
  
  try {
    for (const botData of botDataList) {
      const { botId, lastActive, sessionCount, status, workspacePath, sessions, cronJobs } = botData;
      
      // 1. Upsert bot_status
      await client.query(`
        INSERT INTO semo.bot_status (bot_id, last_active, session_count, status, workspace_path, synced_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (bot_id)
        DO UPDATE SET
          last_active = EXCLUDED.last_active,
          session_count = EXCLUDED.session_count,
          status = EXCLUDED.status,
          workspace_path = EXCLUDED.workspace_path,
          synced_at = NOW()
      `, [botId, lastActive, sessionCount, status, workspacePath]);

      // 2. Delete old sessions for this bot
      await client.query('DELETE FROM semo.bot_sessions WHERE bot_id = $1', [botId]);

      // 3. Insert new sessions
      for (const session of sessions) {
        await client.query(`
          INSERT INTO semo.bot_sessions (
            bot_id, session_key, label, kind, chat_type, last_activity, message_count, synced_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          botId,
          session.sessionKey,
          session.label,
          session.kind,
          session.chatType,
          session.lastActivity,
          session.messageCount,
        ]);
      }

      // 4. Delete old cron jobs for this bot
      await client.query('DELETE FROM semo.bot_cron_jobs WHERE bot_id = $1', [botId]);

      // 5. Insert new cron jobs
      for (const job of cronJobs) {
        await client.query(`
          INSERT INTO semo.bot_cron_jobs (
            bot_id, job_id, name, schedule, enabled, last_run, next_run, session_target, payload, synced_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
          botId,
          job.jobId,
          job.name,
          JSON.stringify(job.schedule),
          job.enabled,
          job.lastRun,
          job.nextRun,
          job.sessionTarget,
          job.payload ? JSON.stringify(job.payload) : null,
        ]);
      }
      
      console.log(`[Uploader] Synced bot ${botId}: ${sessionCount} sessions, ${cronJobs.length} cron jobs`);
    }
    
    console.log(`[Uploader] Successfully synced ${botDataList.length} bots`);
  } finally {
    await client.end();
  }
}

/**
 * Upload workspace files to semo.bot_workspace_files
 * Uses SHA-256 hash for change detection (skip unchanged files)
 * @param {Array<{botId: string, files: Array}>} workspaceDataList
 */
async function uploadWorkspaceFiles(workspaceDataList) {
  const client = new Client({
    connectionString: config.DATABASE_URL,
  });

  await client.connect();

  try {
    for (const { botId, files } of workspaceDataList) {
      let upserted = 0;

      for (const file of files) {
        const result = await client.query(`
          INSERT INTO semo.bot_workspace_files (bot_id, file_path, content, file_size, file_hash, synced_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (bot_id, file_path) DO UPDATE SET
            content = EXCLUDED.content,
            file_size = EXCLUDED.file_size,
            file_hash = EXCLUDED.file_hash,
            synced_at = NOW()
          WHERE bot_workspace_files.file_hash IS DISTINCT FROM EXCLUDED.file_hash
        `, [botId, file.filePath, file.content, file.fileSize, file.fileHash]);

        if (result.rowCount > 0) upserted++;
      }

      // Remove files that no longer exist on disk
      const currentPaths = files.map(f => f.filePath);
      if (currentPaths.length > 0) {
        await client.query(`
          DELETE FROM semo.bot_workspace_files
          WHERE bot_id = $1 AND file_path != ALL($2::text[])
        `, [botId, currentPaths]);
      }

      console.log(`[Uploader] Workspace ${botId}: ${upserted} files updated, ${files.length} total`);
    }
  } finally {
    await client.end();
  }
}

module.exports = {
  uploadToDatabase,
  uploadWorkspaceFiles,
};

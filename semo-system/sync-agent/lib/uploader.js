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
        INSERT INTO bot_status (bot_id, last_active, session_count, status, workspace_path, synced_at)
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
      await client.query('DELETE FROM bot_sessions WHERE bot_id = $1', [botId]);
      
      // 3. Insert new sessions
      for (const session of sessions) {
        await client.query(`
          INSERT INTO bot_sessions (
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
      await client.query('DELETE FROM bot_cron_jobs WHERE bot_id = $1', [botId]);
      
      // 5. Insert new cron jobs
      for (const job of cronJobs) {
        await client.query(`
          INSERT INTO bot_cron_jobs (
            bot_id, job_id, name, schedule, enabled, last_run, next_run, session_target, synced_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
          botId,
          job.jobId,
          job.name,
          JSON.stringify(job.schedule),
          job.enabled,
          job.lastRun,
          job.nextRun,
          job.sessionTarget,
        ]);
      }
      
      console.log(`[Uploader] Synced bot ${botId}: ${sessionCount} sessions, ${cronJobs.length} cron jobs`);
    }
    
    console.log(`[Uploader] Successfully synced ${botDataList.length} bots`);
  } finally {
    await client.end();
  }
}

module.exports = {
  uploadToDatabase,
};

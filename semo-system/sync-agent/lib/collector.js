/**
 * Data Collector
 * 
 * Collect bot status data from OpenClaw home directories
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { parseSessions, parseCronJobs, countSessionMessages } = require('./parser');

/**
 * Get list of OpenClaw bot directories
 * @returns {Promise<Array<string>>} - Array of bot IDs
 */
async function getOpenClawBots() {
  const homeDir = os.homedir();
  const files = await fs.readdir(homeDir);
  
  return files
    .filter(file => file.startsWith('.openclaw-'))
    .map(file => file.replace('.openclaw-', ''));
}

/**
 * Collect data for a single bot
 * @param {string} botId - Bot ID
 * @returns {Promise<object|null>} - Bot data object or null if failed
 */
async function collectBotData(botId) {
  const homeDir = os.homedir();
  const botPath = path.join(homeDir, `.openclaw-${botId}`);
  
  try {
    // Check if bot directory exists
    await fs.access(botPath);
    
    // Parse sessions
    const sessionsPath = path.join(botPath, 'agents/main/sessions/sessions.json');
    const sessions = await parseSessions(sessionsPath);
    
    // Enrich sessions with message counts
    for (const session of sessions) {
      const sessionLogPath = path.join(
        botPath, 
        'agents/main/sessions', 
        `${session.sessionKey}.jsonl`
      );
      session.messageCount = await countSessionMessages(sessionLogPath);
    }
    
    // Parse cron jobs
    const cronPath = path.join(botPath, 'cron/jobs.json');
    const cronJobs = await parseCronJobs(cronPath);
    
    // Calculate bot status
    const lastActive = sessions.length > 0 
      ? new Date(Math.max(...sessions.map(s => new Date(s.lastActivity))))
      : null;
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    
    let status = 'idle';
    if (lastActive && lastActive > oneHourAgo) {
      status = 'active';
    }
    
    return {
      botId,
      lastActive: lastActive ? lastActive.toISOString() : null,
      sessionCount: sessions.length,
      status,
      workspacePath: `semo-system/bot-workspaces/${botId}`,
      sessions,
      cronJobs,
    };
  } catch (error) {
    console.warn(`[Collector] Failed to collect data for ${botId}:`, error.message);
    return null;
  }
}

/**
 * Collect data for all bots
 * @returns {Promise<Array<object>>} - Array of bot data objects
 */
async function collectAllBots() {
  const botIds = await getOpenClawBots();
  console.log(`[Collector] Found ${botIds.length} bots: ${botIds.join(', ')}`);
  
  const results = await Promise.all(
    botIds.map(botId => collectBotData(botId))
  );
  
  // Filter out null results (failed collections)
  return results.filter(data => data !== null);
}

module.exports = {
  collectAllBots,
  collectBotData,
};

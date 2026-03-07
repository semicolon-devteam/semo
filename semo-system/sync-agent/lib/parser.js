/**
 * File Parsers
 * 
 * Parse OpenClaw state files (sessions.json, jobs.json)
 */

const fs = require('fs').promises;

/**
 * Parse sessions.json
 * @param {string} filePath - Path to sessions.json
 * @returns {Promise<Array>} - Array of session objects
 */
async function parseSessions(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // sessions.json structure varies by OpenClaw version
    // Adapt based on actual structure
    if (Array.isArray(data)) {
      return data.map(session => ({
        sessionKey: session.sessionKey || session.id,
        label: session.label || '',
        kind: session.kind || 'main',
        chatType: session.chatType || '',
        lastActivity: session.lastActivity || new Date().toISOString(),
        messageCount: session.messageCount || 0,
      }));
    } else if (typeof data === 'object') {
      // Handle object-based sessions
      return Object.entries(data).map(([sessionKey, session]) => ({
        sessionKey,
        label: session.label || '',
        kind: session.kind || 'main',
        chatType: session.chatType || '',
        lastActivity: session.lastActivity || new Date().toISOString(),
        messageCount: session.messageCount || 0,
      }));
    }
    
    return [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist - no sessions
      return [];
    }
    console.warn(`[Parser] Failed to parse sessions (${filePath}):`, error.message);
    return [];
  }
}

/**
 * Parse cron/jobs.json
 * @param {string} filePath - Path to jobs.json
 * @returns {Promise<Array>} - Array of cron job objects
 */
async function parseCronJobs(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // jobs.json structure: { jobs: [...] }
    const jobs = data.jobs || [];
    
    return jobs.map(job => ({
      jobId: job.jobId || job.id,
      name: job.name || '',
      schedule: job.schedule || {},
      enabled: job.enabled !== false,
      lastRun: job.lastRun || null,
      nextRun: job.nextRun || null,
      sessionTarget: job.sessionTarget || 'main',
    }));
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist - no cron jobs
      return [];
    }
    console.warn(`[Parser] Failed to parse cron jobs (${filePath}):`, error.message);
    return [];
  }
}

/**
 * Count messages in session log (JSONL)
 * @param {string} filePath - Path to session JSONL file
 * @returns {Promise<number>} - Message count
 */
async function countSessionMessages(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    return lines.length;
  } catch (error) {
    return 0;
  }
}

module.exports = {
  parseSessions,
  parseCronJobs,
  countSessionMessages,
};

#!/usr/bin/env node

/**
 * SEMO Sync Agent
 * 
 * Collects OpenClaw bot status data and syncs to PostgreSQL
 */

const { collectAllBots } = require('./lib/collector');
const { uploadToDatabase, uploadWorkspaceFiles } = require('./lib/uploader');
const { collectAllWorkspaceFiles } = require('./lib/workspace-collector');

async function main() {
  const startTime = Date.now();
  console.log(`[Sync Agent] Starting at ${new Date().toISOString()}`);
  
  try {
    // 1. Collect data from all bots
    const botDataList = await collectAllBots();
    console.log(`[Sync Agent] Collected data for ${botDataList.length} bots`);
    
    if (botDataList.length === 0) {
      console.log(`[Sync Agent] No bots found. Exiting.`);
      return;
    }
    
    // 2. Upload to database
    await uploadToDatabase(botDataList);

    // 3. Collect and upload workspace files
    try {
      const workspaceData = await collectAllWorkspaceFiles();
      console.log(`[Sync Agent] Collected workspace files for ${workspaceData.length} bots`);
      if (workspaceData.length > 0) {
        await uploadWorkspaceFiles(workspaceData);
      }
    } catch (wsError) {
      console.error(`[Sync Agent] Workspace file sync error (non-fatal):`, wsError.message);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Sync Agent] Completed in ${elapsed}ms`);
  } catch (error) {
    console.error(`[Sync Agent] Error:`, error);
    process.exit(1);
  }
}

// Run immediately if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };

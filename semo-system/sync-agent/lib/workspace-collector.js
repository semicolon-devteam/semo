/**
 * Workspace File Collector
 *
 * Scans bot workspace directories and collects file contents
 * for upload to semo.bot_workspace_files.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ALLOWED_EXTENSIONS = new Set(['.md', '.ts', '.json', '.txt', '.yaml', '.yml', '.js', '.png']);
const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.claude', '__pycache__']);
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

/**
 * Read workspace path from openclaw.json config
 * @param {string} botId
 * @returns {string|null}
 */
function getWorkspacePath(botId) {
  const homeDir = os.homedir();
  // Try bot-specific config first, then default (~/.openclaw for semiclaw)
  const candidates = [
    path.join(homeDir, `.openclaw-${botId}`, 'openclaw.json'),
    ...(botId === 'semiclaw' ? [path.join(homeDir, '.openclaw', 'openclaw.json')] : []),
  ];

  for (const cfgPath of candidates) {
    try {
      const raw = require('fs').readFileSync(cfgPath, 'utf-8');
      const cfg = JSON.parse(raw);
      const ws = cfg?.agents?.defaults?.workspace;
      if (ws) return ws;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Recursively scan a directory for allowed files
 * @param {string} dirPath - Directory to scan
 * @param {string} basePath - Base path for relative file paths
 * @returns {Promise<Array<{filePath: string, content: string, fileSize: number, fileHash: string}>>}
 */
async function scanDirectory(dirPath, basePath) {
  const results = [];

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const subResults = await scanDirectory(fullPath, basePath);
      results.push(...subResults);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      try {
        const stat = await fs.stat(fullPath);
        if (stat.size > MAX_FILE_SIZE) continue;

        // For binary files like .png, store a placeholder
        const isBinary = ext === '.png';
        const rawContent = await fs.readFile(fullPath);
        const content = isBinary
          ? `[binary: ${stat.size} bytes]`
          : rawContent.toString('utf-8');
        const fileHash = crypto.createHash('sha256').update(rawContent).digest('hex');

        results.push({
          filePath: relativePath,
          content,
          fileSize: stat.size,
          fileHash,
        });
      } catch {
        // skip unreadable files
      }
    }
  }

  return results;
}

/**
 * Collect workspace files for all bots
 * @returns {Promise<Array<{botId: string, files: Array}>>}
 */
async function collectAllWorkspaceFiles() {
  const homeDir = os.homedir();
  const dirEntries = await fs.readdir(homeDir);
  const botIds = dirEntries
    .filter(f => f.startsWith('.openclaw-'))
    .map(f => f.replace('.openclaw-', ''));

  const results = [];

  for (const botId of botIds) {
    const wsPath = getWorkspacePath(botId);
    if (!wsPath) {
      console.warn(`[WorkspaceCollector] No workspace path for ${botId}, skipping`);
      continue;
    }

    try {
      await fs.access(wsPath);
    } catch {
      console.warn(`[WorkspaceCollector] Workspace not accessible for ${botId}: ${wsPath}`);
      continue;
    }

    const files = await scanDirectory(wsPath, wsPath);
    results.push({ botId, files });
    console.log(`[WorkspaceCollector] ${botId}: ${files.length} files collected from ${wsPath}`);
  }

  return results;
}

module.exports = {
  collectAllWorkspaceFiles,
  getWorkspacePath,
  scanDirectory,
};

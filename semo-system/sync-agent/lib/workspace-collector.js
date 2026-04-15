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

// ── KB-managed files: these are now in KB and should NOT be synced to bot_workspace_files ──
// Bot config/meta docs → KB domain: bot-config
const KB_MANAGED_ROOT_FILES = new Set([
  'IDENTITY.md', 'AGENTS.md', 'RULES.md', 'TOOLS.md',
  'HEARTBEAT.md', 'BOOTSTRAP.md', 'CLAUDE.md',
]);

// Curated memory files → KB domains: team, project, decision, process, infra, kpi, bot-config
const KB_MANAGED_MEMORY_FILES = new Set([
  // Common across all bots
  'memory/bots.md', 'memory/cicd.md', 'memory/decisions.md',
  'memory/operations.md', 'memory/process.md', 'memory/github-rules.md',
  'memory/team.md', 'memory/infra.md', 'memory/ontology.md',
  'memory/projects.md', 'memory/services.md', 'memory/workflows.md',
  // Bot-specific curated files (not daily logs or runtime state)
  'memory/gh-aw-audit.md', 'memory/gh-aw-deployment-summary.md',
  'memory/bot-setup-pipeline.md', 'memory/design-workflow.md',
  'memory/review-standards.md', 'memory/infra-structure.md',
  'memory/lessons-learned.md', 'memory/vercel-to-oke-migration.md',
  'memory/onboarding-checklist.md', 'memory/kpi-tracking.md',
  'memory/google-api.md', 'memory/design-tools-research.md',
  'memory/wishket-context.md', 'memory/core-backend-context.md',
  'memory/project-context.md', 'memory/repo-analysis.md',
  'memory/service-urls.md', 'memory/point-exchanger-design-spec.md',
  // Workclaw spec files in memory/
  'memory/play-idol-spec.md', 'memory/play-idol-api-spec.md',
  'memory/play-idol-test-workflow.md', 'memory/land-platform-guide.md',
  'memory/proj-office-land-spring-migration.md', 'memory/proj-play-land-schema.md',
]);

// Directories whose content is entirely KB-managed (except scripts/)
// skills/*/SKILL.md and skills/*/references/ → KB domain: skill
// bot-team/ → KB domain: process, bot-config
const KB_MANAGED_DIR_PREFIXES = [
  'bot-team/',
  'docs/',
  'specs/',
];

// Source code directories that should never be synced (belong in project repos)
const SOURCE_CODE_DIRS = new Set([
  'proj-star-spot', 'proj-acaiv', 'proj-play-land', 'proj-office-land',
  'axoracle', 'wishket-crawler', 'core-backend', 'land-backend',
  'ms-point-exchanger', 'semi-colon-ops', 'spring-backend-modules',
  'temp-star-spot', 'cm-jungchipan', 'kb',
]);

/**
 * Check if a file path is managed by KB and should be excluded from sync
 * @param {string} relativePath
 * @returns {boolean}
 */
function isKBManaged(relativePath) {
  // Root-level bot config files
  if (KB_MANAGED_ROOT_FILES.has(relativePath)) return true;

  // Curated memory files (not daily logs)
  if (KB_MANAGED_MEMORY_FILES.has(relativePath)) return true;

  // Memory subdirectory files (e.g., memory/projects/*.md) but NOT daily logs (memory/2026-*.md)
  if (relativePath.startsWith('memory/projects/')) return true;

  // KB-managed directory prefixes
  for (const prefix of KB_MANAGED_DIR_PREFIXES) {
    if (relativePath.startsWith(prefix)) return true;
  }

  // Skill definition and reference files (but NOT scripts/)
  // skills/{name}/SKILL.md → KB managed
  // skills/{name}/references/* → KB managed
  // skills/{name}/scripts/* → NOT KB managed (needs local execution)
  // Also handles nested paths like skills/_archived/*/references/*
  if (relativePath.startsWith('skills/')) {
    const rest = relativePath.slice('skills/'.length);
    // Check if any segment of the path after skills/ contains SKILL.md or references/
    if (rest.endsWith('/SKILL.md') || rest.includes('SKILL.md')) return true;
    if (rest.includes('/references/') || rest.endsWith('/references')) return true;
    // _archived skills are fully KB-managed (or just deletable)
    if (rest.startsWith('_archived/')) return true;
  }

  // Spec/design docs at root level
  if (relativePath.match(/^(prd-|starspot-|cat-|semo-dashboard-|land-account-linking-).*\.md$/)) return true;

  return false;
}

/**
 * Get workspace path for a bot
 * @param {string} botId
 * @returns {string}
 */
function getWorkspacePath(botId) {
  return path.join(os.homedir(), '.semo', 'workspaces', botId);
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
      // Skip source code directories entirely
      if (SOURCE_CODE_DIRS.has(entry.name)) continue;
      const subResults = await scanDirectory(fullPath, basePath);
      results.push(...subResults);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      // Skip files that are now managed by KB
      const relativePath = path.relative(basePath, fullPath);
      if (isKBManaged(relativePath)) continue;

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
  const wsDir = path.join(os.homedir(), '.semo', 'workspaces');
  let botIds = [];
  try {
    const dirEntries = await fs.readdir(wsDir);
    botIds = dirEntries.filter(f => !f.startsWith('.'));
  } catch {
    console.warn('[WorkspaceCollector] ~/.semo/workspaces not found');
    return [];
  }

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

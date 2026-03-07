/**
 * GitHub API Wrapper
 * 
 * Provides methods to access bot workspace files from GitHub repository.
 */

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'semicolon-devteam/semo';

interface GitHubFileResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

/**
 * Fetch file content from GitHub
 */
export async function getFileContent(path: string): Promise<string> {
  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${path}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3.raw',
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${path} (${response.status})`);
  }

  return response.text();
}

/**
 * List directory contents from GitHub
 */
export async function listDirectory(path: string): Promise<GitHubFileResponse[]> {
  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${path}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`Failed to list directory: ${path} (${response.status})`);
  }

  return response.json();
}

/**
 * Get list of bot workspace directories
 */
export async function getBotWorkspaces(): Promise<string[]> {
  const files = await listDirectory('semo-system/bot-workspaces');
  return files
    .filter(file => file.type === 'dir')
    .map(file => file.name);
}

/**
 * Get bot workspace files
 */
export async function getBotFiles(botId: string, path = ''): Promise<GitHubFileResponse[]> {
  const fullPath = `semo-system/bot-workspaces/${botId}/${path}`;
  return listDirectory(fullPath);
}

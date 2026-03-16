/**
 * @file lib/github.ts
 * @description GitHub API 래퍼. 봇 워크스페이스 파일 접근을 담당한다.
 *   파일 읽기/목록 조회는 5분 캐시를 사용하고, 쓰기(updateFileContent)는 캐시 없이 실행한다.
 * @dependencies GITHUB_TOKEN, GITHUB_REPO 환경변수
 * @usage
 *   import { getFileContent, getBotFiles } from '@/lib/github';
 *   const soul = await getFileContent('semo-system/bot-workspaces/workclaw/SOUL.md');
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

export interface GitHubFileEntry {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

/**
 * GitHub에서 파일 원문을 가져온다. (5분 캐시)
 *
 * @param path - 레포 내 파일 경로 (e.g. "semo-system/bot-workspaces/workclaw/SOUL.md")
 * @returns 파일 텍스트 내용
 * @throws {Error} 파일이 없거나 GitHub API 오류 시
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
 * GitHub 디렉토리 내 파일 목록을 가져온다. (5분 캐시)
 *
 * @param path - 레포 내 디렉토리 경로
 * @returns GitHub API 파일 응답 배열
 * @throws {Error} 디렉토리가 없거나 GitHub API 오류 시
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
 * 파일 또는 디렉토리 콘텐츠를 sha와 함께 가져온다. (캐시 없음, 파일 편집용)
 *
 * @param path - 레포 내 경로 (파일 또는 디렉토리)
 * @returns 디렉토리면 `{ kind: 'dir', items }`, 파일이면 `{ kind: 'file', sha, content, size }`
 * @throws {Error} 경로가 없거나 GitHub API 오류 시
 */
export async function getContents(
  path: string,
): Promise<
  | { kind: 'dir'; items: GitHubFileEntry[] }
  | { kind: 'file'; sha: string; content: string; size: number }
> {
  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${path}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch contents: ${path} (${response.status})`);
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    return {
      kind: 'dir',
      items: (data as GitHubFileResponse[]).map(f => ({
        name: f.name,
        path: f.path,
        sha: f.sha,
        size: f.size,
        type: f.type,
      })),
    };
  }

  const raw = (data as GitHubFileResponse).content ?? '';
  const content = Buffer.from(raw.replace(/\n/g, ''), 'base64').toString('utf-8');
  return { kind: 'file', sha: (data as GitHubFileResponse).sha, content, size: (data as GitHubFileResponse).size };
}

/**
 * GitHub에 파일을 커밋하여 업데이트한다.
 *
 * @param path - 레포 내 파일 경로
 * @param content - 새 파일 내용 (UTF-8 텍스트)
 * @param sha - 현재 파일 SHA (충돌 방지용, getContents로 획득)
 * @param message - 커밋 메시지
 * @throws {Error} SHA 불일치(충돌) 또는 GitHub API 오류 시
 */
export async function updateFileContent(
  path: string,
  content: string,
  sha: string,
  message: string,
): Promise<void> {
  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${path}`;
  const encoded = Buffer.from(content, 'utf-8').toString('base64');

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content: encoded, sha }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update file: ${path} (${response.status}): ${errorText}`);
  }
}

/**
 * 봇 워크스페이스 디렉토리 목록을 가져온다.
 *
 * @returns 봇 ID 배열 (e.g. ["workclaw", "reviewclaw", ...])
 * @throws {Error} GitHub API 오류 시
 */
export async function getBotWorkspaces(): Promise<string[]> {
  const files = await listDirectory('semo-system/bot-workspaces');
  return files
    .filter(file => file.type === 'dir')
    .map(file => file.name);
}

/**
 * 특정 봇의 워크스페이스 파일 목록을 가져온다.
 *
 * @param botId - 봇 식별자
 * @param path - 워크스페이스 내 하위 경로 (기본값: 루트)
 * @returns GitHub 파일 응답 배열
 * @throws {Error} 봇 워크스페이스가 없거나 GitHub API 오류 시
 */
export async function getBotFiles(botId: string, path = ''): Promise<GitHubFileResponse[]> {
  const fullPath = `semo-system/bot-workspaces/${botId}/${path}`;
  return listDirectory(fullPath);
}

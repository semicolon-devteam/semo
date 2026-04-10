/**
 * GitHub Auto-Publish
 *
 * When an entire phase is approved, publish the combined content
 * to the semicolon-devteam/docs repo as a Markdown file.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DOCS_REPO = 'semicolon-devteam/docs';

/**
 * Publish approved phase content to GitHub docs repo.
 * Uses `gh` CLI (requires GITHUB_TOKEN in env).
 */
export async function publishPhaseToGitHub(
  projectName: string,
  phaseName: string,
  content: string,
): Promise<void> {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');
  const path = `docs/planclaw/${slug}/${phaseName}.md`;
  const message = `docs(planclaw): Update ${slug} ${phaseName}`;

  // Base64 encode to safely pass content through CLI
  const encoded = Buffer.from(content).toString('base64');

  try {
    // Try to get existing file SHA for update (404 if new)
    let sha = '';
    try {
      const { stdout } = await execAsync(`gh api repos/${DOCS_REPO}/contents/${path} --jq '.sha'`);
      sha = stdout.trim();
    } catch {
      // File doesn't exist yet — that's fine
    }

    const shaArg = sha ? `-f sha="${sha}"` : '';
    await execAsync(
      `gh api --method PUT repos/${DOCS_REPO}/contents/${path} \
        -f message="${message}" \
        -f content="${encoded}" \
        ${shaArg}`,
    );

    console.log(`[GitHub] Published: ${path}`);
  } catch (error) {
    console.error(`[GitHub] Failed to publish ${path}:`, error);
    throw error;
  }
}

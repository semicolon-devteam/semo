/**
 * Meeting GitHub Discussion Integration
 *
 * Creates GitHub Discussions in semicolon-devteam/command-center
 * Meeting-Minutes category via GraphQL API.
 */

const GITHUB_GRAPHQL = 'https://api.github.com/graphql';
const REPO_ID = 'R_kgDOOdzh9w';
const CATEGORY_ID = 'DIC_kwDOOdzh984Cw9Lp'; // Meeting-Minutes

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN environment variable is not set');
  return token;
}

export interface DiscussionResult {
  number: number;
  url: string;
  id: string;
}

/**
 * Create a new Discussion in the Meeting-Minutes category.
 */
export async function createMeetingDiscussion(
  title: string,
  body: string,
): Promise<DiscussionResult> {
  const response = await fetch(GITHUB_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `mutation($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: {
          repositoryId: $repoId
          categoryId: $categoryId
          title: $title
          body: $body
        }) {
          discussion {
            number
            url
            id
          }
        }
      }`,
      variables: { repoId: REPO_ID, categoryId: CATEGORY_ID, title, body },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    data?: { createDiscussion: { discussion: DiscussionResult } };
    errors?: { message: string }[];
  };

  if (data.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${data.errors.map((e) => e.message).join(', ')}`);
  }

  if (!data.data?.createDiscussion?.discussion) {
    throw new Error('Unexpected GitHub API response');
  }

  return data.data.createDiscussion.discussion;
}

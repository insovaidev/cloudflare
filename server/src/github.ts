// Create a repository and commit README.md as its first commit.
import type { Env } from './env';

const API = 'https://api.github.com';

const gh = (env: Env, path: string, init: RequestInit = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'skill-gap-worker',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

const ghError = async (res: Response, what: string) => {
  const body = await res.json<{ message?: string; errors?: { message?: string }[] }>().catch(() => null);
  const detail = [body?.message, ...(body?.errors ?? []).map((e) => e.message)].filter(Boolean).join(': ');
  return new Error(`GitHub ${what} failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
};

export const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') ||
  'skill-gap-project';

const toBase64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export const createRepoWithReadme = async (
  env: Env,
  opts: { name: string; description: string; readme: string },
) => {
  const base = slugify(opts.name);
  const isPrivate = (env.GITHUB_REPO_PRIVATE ?? 'true') !== 'false';

  // Retry with a suffix when the name is taken (422).
  let repo: { full_name: string; html_url: string } | null = null;
  for (let attempt = 0; attempt < 4 && !repo; attempt++) {
    const name = attempt === 0 ? base : `${base}-${Date.now().toString(36).slice(-4)}${attempt}`;
    const res = await gh(env, '/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: opts.description.slice(0, 350),
        private: isPrivate,
        auto_init: false,
        has_issues: true,
      }),
    });
    if (res.ok) repo = await res.json();
    else if (res.status !== 422) throw await ghError(res, 'repository creation');
  }
  if (!repo) throw new Error(`GitHub repository creation failed: name "${base}" is unavailable`);

  const res = await gh(env, `/repos/${repo.full_name}/contents/README.md`, {
    method: 'PUT',
    body: JSON.stringify({ message: 'Initial commit: project README', content: toBase64(opts.readme) }),
  });
  if (!res.ok) throw await ghError(res, 'README commit');

  return { fullName: repo.full_name, url: repo.html_url };
};

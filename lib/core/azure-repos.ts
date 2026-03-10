// ---------------------------------------------------------------------------
// Azure DevOps Git REST API Client
// ---------------------------------------------------------------------------
// All functions require org/project/pat passed as parameters.
// PAT is never read from environment variables.
// API Reference: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AzureRepo {
  id: string;
  name: string;
  defaultBranch: string;
  webUrl: string;
}

export interface AzureRepoItem {
  path: string;
  isFolder: boolean;
  url: string;
  commitId?: string;
}

export class AzureReposError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AzureReposError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHeaders(pat: string): HeadersInit {
  // Azure DevOps uses Basic auth with empty username and PAT as password
  const encoded = Buffer.from(`:${pat}`).toString('base64');
  return {
    Authorization: `Basic ${encoded}`,
    Accept: 'application/json',
  };
}

function buildBaseUrl(org: string): string {
  // Support both dev.azure.com and {org}.visualstudio.com
  return `https://dev.azure.com/${encodeURIComponent(org)}`;
}

async function handleResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    throw new AzureReposError(
      `Azure DevOps ${context} failed (HTTP ${res.status}): ${body}`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all Git repositories in an Azure DevOps project.
 */
export async function listRepos(
  org: string,
  project: string,
  pat: string,
): Promise<AzureRepo[]> {
  const url = `${buildBaseUrl(org)}/${encodeURIComponent(project)}/_apis/git/repositories?api-version=7.1`;
  const res = await fetch(url, { headers: buildHeaders(pat) });
  const data = await handleResponse<{ value: Array<Record<string, unknown>> }>(
    res,
    'list repositories',
  );

  return (data.value || []).map((repo) => ({
    id: repo.id as string,
    name: repo.name as string,
    defaultBranch: ((repo.defaultBranch as string) || 'refs/heads/main').replace(
      'refs/heads/',
      '',
    ),
    webUrl: (repo.webUrl as string) || '',
  }));
}

/**
 * List file/folder items in a repository at a given path.
 */
export async function listItems(
  org: string,
  project: string,
  repoId: string,
  pat: string,
  scopePath?: string,
  branch?: string,
): Promise<AzureRepoItem[]> {
  const params = new URLSearchParams({
    'api-version': '7.1',
    recursionLevel: 'OneLevel',
  });
  if (scopePath) params.set('scopePath', scopePath);
  if (branch) params.set('versionDescriptor.version', branch);

  const url = `${buildBaseUrl(org)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repoId)}/items?${params.toString()}`;
  const res = await fetch(url, { headers: buildHeaders(pat) });
  const data = await handleResponse<{ value: Array<Record<string, unknown>> }>(
    res,
    'list items',
  );

  return (data.value || []).map((item) => ({
    path: item.path as string,
    isFolder: item.isFolder === true,
    url: (item.url as string) || '',
    commitId: item.commitId as string | undefined,
  }));
}

/**
 * Fetch the raw content of a single file from a repository.
 * Returns the file content as a Buffer.
 */
export async function fetchFileContent(
  org: string,
  project: string,
  repoId: string,
  pat: string,
  filePath: string,
  branch?: string,
): Promise<{ content: Buffer; fileName: string }> {
  const params = new URLSearchParams({
    'api-version': '7.1',
    path: filePath,
    download: 'true',
  });
  if (branch) params.set('versionDescriptor.version', branch);

  const url = `${buildBaseUrl(org)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repoId)}/items?${params.toString()}`;
  const res = await fetch(url, { headers: buildHeaders(pat) });

  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    throw new AzureReposError(
      `Azure DevOps fetch file failed (HTTP ${res.status}): ${body}`,
      res.status,
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  const fileName = filePath.split('/').pop() || 'unknown';

  return {
    content: Buffer.from(arrayBuffer),
    fileName,
  };
}

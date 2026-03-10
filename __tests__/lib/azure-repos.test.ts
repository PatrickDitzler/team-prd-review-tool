import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listRepos, listItems, fetchFileContent, AzureReposError } from '@/lib/core/azure-repos';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('listRepos', () => {
  it('returns list of repos on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          { id: 'repo-1', name: 'my-repo', defaultBranch: 'refs/heads/main', webUrl: 'https://test' },
          { id: 'repo-2', name: 'other-repo', defaultBranch: 'refs/heads/develop', webUrl: '' },
        ],
      }),
    });

    const repos = await listRepos('myorg', 'myproj', 'my-pat');
    expect(repos).toHaveLength(2);
    expect(repos[0].name).toBe('my-repo');
    expect(repos[0].defaultBranch).toBe('main'); // refs/heads/ stripped
    expect(repos[1].defaultBranch).toBe('develop');
  });

  it('sends correct authorization header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [] }),
    });

    await listRepos('org', 'proj', 'test-pat');

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    const expectedAuth = `Basic ${Buffer.from(':test-pat').toString('base64')}`;
    expect(callHeaders.Authorization).toBe(expectedAuth);
  });

  it('throws AzureReposError on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    try {
      await listRepos('org', 'proj', 'bad-pat');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AzureReposError);
      expect((err as AzureReposError).message).toContain('HTTP 401');
      expect((err as AzureReposError).statusCode).toBe(401);
    }
  });

  it('calls the correct API URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [] }),
    });

    await listRepos('contoso', 'MyProject', 'pat');
    expect(mockFetch.mock.calls[0][0]).toContain('dev.azure.com/contoso/MyProject/_apis/git/repositories');
  });
});

describe('listItems', () => {
  it('returns file items on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          { path: '/docs/prd.md', isFolder: false, url: 'https://test', commitId: 'abc' },
          { path: '/docs', isFolder: true, url: 'https://test' },
        ],
      }),
    });

    const items = await listItems('org', 'proj', 'repo-id', 'pat');
    expect(items).toHaveLength(2);
    expect(items[0].path).toBe('/docs/prd.md');
    expect(items[0].isFolder).toBe(false);
    expect(items[1].isFolder).toBe(true);
  });

  it('includes branch in request when specified', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [] }),
    });

    await listItems('org', 'proj', 'repo-id', 'pat', '/', 'develop');
    expect(mockFetch.mock.calls[0][0]).toContain('versionDescriptor.version=develop');
  });

  it('throws AzureReposError on 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });

    await expect(listItems('org', 'proj', 'bad-id', 'pat')).rejects.toThrow(AzureReposError);
  });
});

describe('fetchFileContent', () => {
  it('returns file content as Buffer', async () => {
    const content = new TextEncoder().encode('# PRD Content');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => content.buffer,
    });

    const result = await fetchFileContent('org', 'proj', 'repo', 'pat', '/docs/prd.md');
    expect(result.fileName).toBe('prd.md');
    expect(Buffer.from(result.content).toString()).toBe('# PRD Content');
  });

  it('throws AzureReposError on 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    await expect(fetchFileContent('org', 'proj', 'repo', 'pat', '/file')).rejects.toThrow(AzureReposError);
  });
});

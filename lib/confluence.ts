import TurndownService from 'turndown';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfluencePage {
  id: string;
  title: string;
  spaceKey: string;
  version: number;
  htmlBody: string;
  markdown: string;
}

// ---------------------------------------------------------------------------
// URL / ID helpers
// ---------------------------------------------------------------------------

/**
 * Extract a Confluence page ID from a full URL or return the raw ID string.
 *
 * Supported URL patterns:
 *   • /wiki/spaces/{spaceKey}/pages/{pageId}/...
 *   • /wiki/pages/viewpage.action?pageId={pageId}
 *   • plain numeric string
 */
export function extractPageId(input: string): string {
  const trimmed = input.trim();

  // Plain numeric ID
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // Modern URL pattern: /wiki/spaces/.../pages/{id}
  const modernMatch = trimmed.match(/\/pages\/(\d+)/);
  if (modernMatch) {
    return modernMatch[1];
  }

  // Legacy URL pattern: pageId query param
  try {
    const url = new URL(trimmed);
    const pageId = url.searchParams.get('pageId');
    if (pageId) {
      return pageId;
    }
  } catch {
    // Not a valid URL — fall through
  }

  throw new Error(
    `Could not extract a page ID from "${trimmed}". Provide a numeric page ID or a valid Confluence URL.`,
  );
}

// ---------------------------------------------------------------------------
// Confluence REST API
// ---------------------------------------------------------------------------

export async function fetchConfluencePage(pageId: string): Promise<ConfluencePage> {
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  const email = process.env.CONFLUENCE_USER_EMAIL;
  const token = process.env.CONFLUENCE_API_TOKEN;

  if (!baseUrl || !email || !token) {
    throw new Error(
      'Missing Confluence credentials. Set CONFLUENCE_BASE_URL, CONFLUENCE_USER_EMAIL, and CONFLUENCE_API_TOKEN in .env.local',
    );
  }

  const apiUrl = `${baseUrl.replace(/\/+$/, '')}/wiki/rest/api/content/${pageId}?expand=body.storage,version,space`;

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Confluence API error ${res.status}: ${body}`);
  }

  const data = await res.json();

  const htmlBody: string = data.body?.storage?.value ?? '';
  const markdown = htmlToMarkdown(htmlBody);

  return {
    id: data.id,
    title: data.title,
    spaceKey: data.space?.key ?? '',
    version: data.version?.number ?? 1,
    htmlBody,
    markdown,
  };
}

// ---------------------------------------------------------------------------
// HTML → Markdown conversion
// ---------------------------------------------------------------------------

export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  // Confluence wraps code in <ac:structured-macro> → just treat <pre>/<code> normally
  // Strip Confluence-specific macros that turndown can't handle
  const cleaned = html
    .replace(/<ac:structured-macro[^>]*>[\s\S]*?<\/ac:structured-macro>/g, (match) => {
      // Try to extract plain text body from macro
      const bodyMatch = match.match(/<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>/);
      if (bodyMatch) {
        return `<pre><code>${bodyMatch[1]}</code></pre>`;
      }
      const richMatch = match.match(/<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>/);
      if (richMatch) {
        return richMatch[1];
      }
      return '';
    })
    .replace(/<ac:[^>]*\/>/g, '') // self-closing Confluence tags
    .replace(/<\/?ac:[^>]*>/g, '') // remaining Confluence tags
    .replace(/<\/?ri:[^>]*>/g, ''); // resource identifier tags

  return turndown.turndown(cleaned).trim();
}

// ---------------------------------------------------------------------------
// Filename helper
// ---------------------------------------------------------------------------

export function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

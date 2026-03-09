import { describe, it, expect } from 'vitest';
import { extractPageId, htmlToMarkdown, sanitizeFilename } from '@/lib/confluence';

// ─── extractPageId ───────────────────────────────────────────────────────────

describe('extractPageId', () => {
  it('returns a plain numeric ID as-is', () => {
    expect(extractPageId('123456')).toBe('123456');
  });

  it('handles leading/trailing whitespace', () => {
    expect(extractPageId('  789  ')).toBe('789');
  });

  it('extracts ID from modern Confluence URL', () => {
    const url = 'https://acme.atlassian.net/wiki/spaces/ENG/pages/98765/My+PRD';
    expect(extractPageId(url)).toBe('98765');
  });

  it('extracts ID from legacy viewpage URL', () => {
    const url = 'https://acme.atlassian.net/wiki/pages/viewpage.action?pageId=54321';
    expect(extractPageId(url)).toBe('54321');
  });

  it('throws for non-numeric, non-URL input', () => {
    expect(() => extractPageId('not-a-page')).toThrow('Could not extract a page ID');
  });

  it('throws for URL without page ID', () => {
    expect(() => extractPageId('https://acme.atlassian.net/wiki/spaces/ENG')).toThrow(
      'Could not extract a page ID',
    );
  });
});

// ─── htmlToMarkdown ──────────────────────────────────────────────────────────

describe('htmlToMarkdown', () => {
  it('converts headings', () => {
    expect(htmlToMarkdown('<h1>Title</h1>')).toBe('# Title');
  });

  it('converts paragraph text', () => {
    expect(htmlToMarkdown('<p>Hello world</p>')).toBe('Hello world');
  });

  it('converts bold and italic', () => {
    expect(htmlToMarkdown('<p><strong>bold</strong> and <em>italic</em></p>')).toBe(
      '**bold** and _italic_',
    );
  });

  it('converts unordered lists', () => {
    const html = '<ul><li>One</li><li>Two</li></ul>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('One');
    expect(md).toContain('Two');
    expect(md).toMatch(/^-/m);
  });

  it('handles Confluence structured macros with plain text body', () => {
    const html =
      '<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[console.log("hi")]]></ac:plain-text-body></ac:structured-macro>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('console.log("hi")');
  });

  it('strips Confluence-specific tags cleanly', () => {
    const html = '<p>Normal text</p><ac:emoticon ac:name="smile"/><p>More text</p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('Normal text');
    expect(md).toContain('More text');
    expect(md).not.toContain('ac:');
  });

  it('returns empty string for empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
  });
});

// ─── sanitizeFilename ────────────────────────────────────────────────────────

describe('sanitizeFilename', () => {
  it('lowercases and replaces non-alphanumeric chars with hyphens', () => {
    expect(sanitizeFilename('My PRD: Version 2.0')).toBe('my-prd-version-2-0');
  });

  it('strips leading/trailing hyphens', () => {
    expect(sanitizeFilename('---Hello---')).toBe('hello');
  });

  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(80);
  });
});

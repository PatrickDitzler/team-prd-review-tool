import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { extractPageId, fetchConfluencePage, sanitizeFilename } from '@/lib/confluence';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input: string = body.pageId || body.confluenceUrl;

    if (!input) {
      return NextResponse.json(
        { error: 'Provide a "pageId" or "confluenceUrl" in the request body.' },
        { status: 400 },
      );
    }

    const pageId = extractPageId(input);
    const page = await fetchConfluencePage(pageId);

    // Write markdown to prds/ directory
    const prdsDir = path.join(process.cwd(), 'prds');
    await fs.mkdir(prdsDir, { recursive: true });

    const filename = `${sanitizeFilename(page.title)}.md`;
    const filePath = path.join(prdsDir, filename);

    const fileContent = `# ${page.title}\n\n> **Space:** ${page.spaceKey} · **Version:** ${page.version} · **Page ID:** ${page.id}\n\n---\n\n${page.markdown}`;

    await fs.writeFile(filePath, fileContent, 'utf-8');

    return NextResponse.json({
      title: page.title,
      markdown: page.markdown,
      filePath: `prds/${filename}`,
      pageId: page.id,
      spaceKey: page.spaceKey,
      version: page.version,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('credentials') ? 500 : message.includes('API error') ? 502 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}

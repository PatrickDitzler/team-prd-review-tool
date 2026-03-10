import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
const pdfParse = require('pdf-parse');
import * as mammoth from 'mammoth';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = '';

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text;
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF, DOCX, or Markdown file.' }, { status: 400 });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract any text from the provided file.' }, { status: 400 });
    }
    
    // Generate an ID for the PRD, format the extracted text, and save it.
    const pageId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
    const prdsDir = path.join(process.cwd(), 'prds');
    await fs.mkdir(prdsDir, { recursive: true });

    const mdPath = path.join(prdsDir, `${pageId}.md`);
    
    const formattedMarkdown = `# Uploaded Document: ${file.name}\n\n${extractedText.replace(/\n{3,}/g, '\n\n')}`;
    await fs.writeFile(mdPath, formattedMarkdown, 'utf-8');

    return NextResponse.json({
      title: file.name,
      markdown: formattedMarkdown,
      filePath: mdPath,
      pageId: pageId,
      spaceKey: 'UPLOAD',
      version: 1,
    });
  } catch (error) {
    console.error('File upload logic failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown upload error' }, { status: 500 });
  }
}

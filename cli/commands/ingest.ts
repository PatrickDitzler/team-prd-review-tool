import { Command } from 'commander';
import { select, input } from '@inquirer/prompts';
import ora from 'ora';
import path from 'path';
import { promises as fs } from 'fs';
import { ingestFromConfluence, ingestFromFile, ingestDemo } from '../../lib/core/ingest';
import { printSuccess, printError, printHeader, printInfo } from '../utils/display';

export function registerIngestCommand(program: Command) {
  program
    .command('ingest [source]')
    .description('Ingest a PRD from Confluence, a local file, or the built-in demo')
    .option('-d, --demo', 'Use the built-in demo PRD')
    .action(async (source?: string, options?: { demo?: boolean }) => {
      try {
        printHeader('📥 Ingest PRD');

        let effectiveSource = source;

        // Demo shortcut
        if (options?.demo || effectiveSource === 'demo') {
          const spinner = ora('Creating demo PRD...').start();
          const result = await ingestDemo();
          spinner.succeed('Demo PRD created');
          printSuccess(`Title: ${result.title}`);
          printSuccess(`Saved to: ${result.filePath}`);
          printInfo(`Page ID: ${result.pageId}`);
          console.log('');
          printInfo(`Next step: npx tsx cli/index.ts review ${result.pageId}`);
          return;
        }

        // Interactive prompt if no source provided
        if (!effectiveSource) {
          const method = await select({
            message: 'How would you like to provide the PRD?',
            choices: [
              { name: '📎 Confluence URL or Page ID', value: 'confluence' },
              { name: '📁 Local file path (PDF, DOCX, MD, TXT)', value: 'file' },
              { name: '🎮 Demo PRD (no API needed)', value: 'demo' },
            ],
          });

          if (method === 'demo') {
            const spinner = ora('Creating demo PRD...').start();
            const result = await ingestDemo();
            spinner.succeed('Demo PRD created');
            printSuccess(`Title: ${result.title}`);
            printSuccess(`Saved to: ${result.filePath}`);
            printInfo(`Page ID: ${result.pageId}`);
            console.log('');
            printInfo(`Next step: npx tsx cli/index.ts review ${result.pageId}`);
            return;
          }

          if (method === 'confluence') {
            effectiveSource = await input({
              message: 'Enter Confluence URL or Page ID:',
              validate: (val) => (val.trim().length > 0 ? true : 'Please enter a value'),
            });
          } else {
            effectiveSource = await input({
              message: 'Enter the file path:',
              validate: (val) => (val.trim().length > 0 ? true : 'Please enter a file path'),
            });
          }
        }

        // Determine if source is a file path or Confluence
        const resolvedPath = path.resolve(effectiveSource);
        let isFile = false;
        try {
          await fs.access(resolvedPath);
          isFile = true;
        } catch {
          // Not a file — assume Confluence URL/ID
        }

        if (isFile) {
          const spinner = ora(`Parsing ${path.basename(resolvedPath)}...`).start();
          const result = await ingestFromFile(resolvedPath);
          spinner.succeed('File parsed and staged');
          printSuccess(`Title: ${result.title}`);
          printSuccess(`Saved to: ${result.filePath}`);
          printInfo(`Page ID: ${result.pageId}`);
          console.log('');
          printInfo(`Next step: npx tsx cli/index.ts review ${result.pageId}`);
        } else {
          const spinner = ora('Fetching from Confluence...').start();
          const result = await ingestFromConfluence(effectiveSource);
          spinner.succeed('Confluence page fetched and staged');
          printSuccess(`Title: ${result.title}`);
          printSuccess(`Saved to: ${result.filePath}`);
          printInfo(`Page ID: ${result.pageId}`);
          console.log('');
          printInfo(`Next step: npx tsx cli/index.ts review ${result.pageId}`);
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : 'Ingest failed');
        process.exit(1);
      }
    });
}

import { Command } from 'commander';
import { select, input } from '@inquirer/prompts';
import ora from 'ora';
import path from 'path';
import { promises as fs } from 'fs';
import { ingestFromConfluence, ingestFromFile, ingestFromLocalRepo, ingestFromAzureRepo, ingestDemo } from '../../lib/core/ingest';
import { listPRDFiles } from '../../lib/core/repo-browser';
import { listRepos, listItems } from '../../lib/core/azure-repos';
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
          printSuccess(`Saved to: ${result.stagedFilePath}`);
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
              { name: '📂 From local repository (browse for PRD files)', value: 'repo-local' },
              { name: '☁️  From Azure DevOps Repo', value: 'repo-azure' },
              { name: '🎮 Demo PRD (no API needed)', value: 'demo' },
            ],
          });

          if (method === 'demo') {
            const spinner = ora('Creating demo PRD...').start();
            const result = await ingestDemo();
            spinner.succeed('Demo PRD created');
            printSuccess(`Title: ${result.title}`);
            printSuccess(`Saved to: ${result.stagedFilePath}`);
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
          } else if (method === 'file') {
            effectiveSource = await input({
              message: 'Enter the file path:',
              validate: (val) => (val.trim().length > 0 ? true : 'Please enter a file path'),
            });
          } else if (method === 'repo-local') {
            const repoPathInput = await input({
              message: 'Enter the repository root path:',
              validate: (val) => (val.trim().length > 0 ? true : 'Please enter a path'),
            });
            const spinner = ora('Scanning for PRD files...').start();
            const files = listPRDFiles(repoPathInput.trim());
            spinner.succeed(`Found ${files.length} PRD file(s)`);

            if (files.length === 0) {
              printError('No PRD files found in this repository.');
              return;
            }

            const selectedFile = await select({
              message: 'Select a PRD file:',
              choices: files.map((f) => ({
                name: `${f.relativePath} (${(f.sizeBytes / 1024).toFixed(1)} KB)`,
                value: f.relativePath,
              })),
            });

            const ingestSpinner = ora('Ingesting PRD from repo...').start();
            const result = await ingestFromLocalRepo(repoPathInput.trim(), selectedFile);
            ingestSpinner.succeed('PRD ingested from repository');
            printSuccess(`Title: ${result.title}`);
            printSuccess(`Saved to: ${result.stagedFilePath}`);
            printInfo(`Page ID: ${result.pageId}`);
            printInfo(`Repo context saved for downstream use.`);
            console.log('');
            printInfo(`Next step: npx tsx cli/index.ts review ${result.pageId}`);
            return;
          } else if (method === 'repo-azure') {
            const org = await input({ message: 'Azure DevOps Organization:' });
            const project = await input({ message: 'Azure DevOps Project:' });
            const pat = await input({ message: 'Personal Access Token (PAT):' });

            const repoSpinner = ora('Listing repositories...').start();
            const repos = await listRepos(org.trim(), project.trim(), pat);
            repoSpinner.succeed(`Found ${repos.length} repository(ies)`);

            if (repos.length === 0) {
              printError('No repositories found.');
              return;
            }

            const selectedRepo = await select({
              message: 'Select a repository:',
              choices: repos.map((r) => ({ name: `${r.name} (${r.defaultBranch})`, value: r })),
            });

            const itemsSpinner = ora('Listing files...').start();
            const items = await listItems(org.trim(), project.trim(), selectedRepo.id, pat);
            const prdExtensions = ['.md', '.pdf', '.docx', '.txt'];
            const prdItems = items.filter(
              (item) => !item.isFolder && prdExtensions.some((ext) => item.path.toLowerCase().endsWith(ext)),
            );
            itemsSpinner.succeed(`Found ${prdItems.length} PRD file(s)`);

            if (prdItems.length === 0) {
              printError('No PRD files found in this repository.');
              return;
            }

            const selectedItem = await select({
              message: 'Select a PRD file:',
              choices: prdItems.map((item) => ({ name: item.path, value: item.path })),
            });

            const ingestSpinner = ora('Ingesting PRD from Azure DevOps...').start();
            const result = await ingestFromAzureRepo(
              org.trim(),
              project.trim(),
              selectedRepo.id,
              selectedItem,
              selectedRepo.defaultBranch,
              pat,
            );
            ingestSpinner.succeed('PRD ingested from Azure DevOps');
            printSuccess(`Title: ${result.title}`);
            printSuccess(`Saved to: ${result.stagedFilePath}`);
            printInfo(`Page ID: ${result.pageId}`);
            console.log('');
            printInfo(`Next step: npx tsx cli/index.ts review ${result.pageId}`);
            return;
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
          printSuccess(`Saved to: ${result.stagedFilePath}`);
          printInfo(`Page ID: ${result.pageId}`);
          console.log('');
          printInfo(`Next step: npx tsx cli/index.ts review ${result.pageId}`);
        } else {
          const spinner = ora('Fetching from Confluence...').start();
          const result = await ingestFromConfluence(effectiveSource);
          spinner.succeed('Confluence page fetched and staged');
          printSuccess(`Title: ${result.title}`);
          printSuccess(`Saved to: ${result.stagedFilePath}`);
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

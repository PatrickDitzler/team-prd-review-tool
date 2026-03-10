import { Command } from 'commander';
import { input, confirm } from '@inquirer/prompts';
import ora from 'ora';
import { promises as fs } from 'fs';
import path from 'path';
import { exportToAzureDevOps } from '../../lib/core/export';
import { loadConfig } from '../../lib/core/config';
import { printHeader, printSuccess, printError, printInfo, printWarning } from '../utils/display';

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

async function loadSession(pageId: string) {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), `.prd-review-session-${pageId}.json`),
      'utf-8',
    );
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Export command
// ---------------------------------------------------------------------------

export function registerExportCommand(program: Command) {
  program
    .command('export <pageId>')
    .description('Export PBIs to Azure DevOps as a Feature with child work items')
    .option('--demo', 'Run a mock demo export (no Azure connection needed)')
    .action(async (pageId: string, options: { demo?: boolean }) => {
      try {
        printHeader('🚀 Export to Azure DevOps');

        // Load PRD
        const prdsDir = path.join(process.cwd(), 'prds');
        const files = await fs.readdir(prdsDir);
        const match = files.find((f) => f.startsWith(pageId) || f === `${pageId}.md`);
        if (!match) {
          printError(`No staged PRD found for page ID "${pageId}"`);
          process.exit(1);
        }
        const prdContext = await fs.readFile(path.join(prdsDir, match), 'utf-8');

        // Load session
        const session = await loadSession(pageId);
        const pbis = session.pbis;
        if (!pbis || pbis.length === 0) {
          printError('No PBIs found in session.');
          printInfo('Run "npx tsx cli/index.ts evaluate ' + pageId + '" first.');
          process.exit(1);
        }

        printInfo(`Found ${pbis.length} PBI(s) to export.`);

        // Demo mode
        if (options.demo) {
          const spinner = ora('Running demo export...').start();
          const result = await exportToAzureDevOps(
            pbis,
            { org: '', project: '', pat: '', demo: true },
            prdContext,
          );
          spinner.succeed('Demo export complete');
          printSuccess(`URL: ${result.url}`);
          return;
        }

        // Collect Azure config
        const config = await loadConfig();
        let org = config.azure?.org || '';
        let project = config.azure?.project || '';
        let pat = config.azure?.pat || '';

        if (!org) {
          org = await input({ message: 'Azure DevOps Organization:' });
        }
        if (!project) {
          project = await input({ message: 'Azure DevOps Project:' });
        }
        if (!pat) {
          pat = await input({ message: 'Personal Access Token (PAT):' });
        }

        printWarning(`Exporting ${pbis.length} PBIs to ${org}/${project}`);
        const proceed = await confirm({ message: 'Continue?', default: true });
        if (!proceed) {
          printInfo('Export cancelled.');
          return;
        }

        const spinner = ora('Creating Feature and PBIs in Azure DevOps...').start();
        const result = await exportToAzureDevOps(pbis, { org, project, pat }, prdContext);
        spinner.succeed('Export complete');

        if (result.url) {
          printSuccess(`Feature created: ${result.url}`);
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : 'Export failed');
        process.exit(1);
      }
    });
}

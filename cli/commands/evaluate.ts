import { Command } from 'commander';
import { input } from '@inquirer/prompts';
import ora from 'ora';
import { promises as fs } from 'fs';
import path from 'path';
import { evaluatePBIs } from '../../lib/core/evaluate';
import { scanCodebase } from '../../lib/core/codebase-scanner';
import { loadConfig, getEffectiveSettings } from '../../lib/core/config';
import {
  printHeader,
  printPBIs,
  printSuccess,
  printError,
  printInfo,
  printConfigStatus,
} from '../utils/display';

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

async function saveSession(pageId: string, data: Record<string, unknown>) {
  const existing = await loadSession(pageId);
  const merged = { ...existing, ...data };
  await fs.writeFile(
    path.join(process.cwd(), `.prd-review-session-${pageId}.json`),
    JSON.stringify(merged, null, 2),
    'utf-8',
  );
}

// ---------------------------------------------------------------------------
// Evaluate command
// ---------------------------------------------------------------------------

export function registerEvaluateCommand(program: Command) {
  program
    .command('evaluate <pageId>')
    .description('Run the 6-agent swarm evaluation on the approved breakdown')
    .option('-c, --codebase <path>', 'Absolute path to local codebase for context')
    .action(async (pageId: string, options: { codebase?: string }) => {
      try {
        printHeader('🐝 Swarm Evaluation');

        // Load PRD
        const prdsDir = path.join(process.cwd(), 'prds');
        const files = await fs.readdir(prdsDir);
        const match = files.find((f) => f.startsWith(pageId) || f === `${pageId}.md`);
        if (!match) {
          printError(`No staged PRD found for page ID "${pageId}"`);
          process.exit(1);
        }
        const markdown = await fs.readFile(path.join(prdsDir, match), 'utf-8');

        // Load config & session
        const config = await loadConfig();
        const settings = getEffectiveSettings(config);
        printConfigStatus(settings.provider, settings.model);

        const session = await loadSession(pageId);
        const breakdown = session.breakdown;
        if (!breakdown) {
          printError('No approved breakdown found in session.');
          printInfo('Run "npx tsx cli/index.ts breakdown ' + pageId + '" first.');
          process.exit(1);
        }

        // Codebase context
        let codebasePath = options.codebase || config.codebasePath;
        if (!codebasePath) {
          codebasePath = await input({
            message: 'Enter absolute path to your local codebase (or press Enter to skip):',
            default: process.cwd(),
          });
        }

        let codebaseContext = '';
        if (codebasePath && codebasePath.trim()) {
          const cbSpinner = ora('Scanning codebase...').start();
          try {
            codebaseContext = scanCodebase(codebasePath.trim());
            cbSpinner.succeed('Codebase scanned');
          } catch (err) {
            cbSpinner.warn('Codebase scan failed, continuing without context');
          }
        }

        // Run evaluation
        const evalSpinner = ora(
          'Running swarm evaluation (Security, Architect, QA, Compliance, Frontend, Backend)...',
        ).start();

        const pbis = await evaluatePBIs(
          markdown,
          breakdown,
          codebaseContext,
          settings,
          config.customPrompts,
        );

        evalSpinner.succeed(`Swarm evaluation complete — ${pbis.length} PBI(s) generated`);

        printPBIs(pbis);

        // Save to session
        await saveSession(pageId, { pbis });
        printSuccess('PBIs saved to session.');
        console.log('');
        printInfo(`Next step: npx tsx cli/index.ts export ${pageId}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : 'Evaluation failed');
        process.exit(1);
      }
    });
}

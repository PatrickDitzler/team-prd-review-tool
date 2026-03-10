import { Command } from 'commander';
import { confirm, editor } from '@inquirer/prompts';
import ora from 'ora';
import { promises as fs } from 'fs';
import path from 'path';
import { generateBreakdown } from '../../lib/core/breakdown';
import { loadConfig, getEffectiveSettings } from '../../lib/core/config';
import {
  printHeader,
  printSuccess,
  printError,
  printInfo,
  printConfigStatus,
  printDivider,
} from '../utils/display';
import type { AnsweredQuestion } from '../../lib/core/types';

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

function compileCombinedNotes(session: Record<string, unknown>): string {
  let notes = `### General Team Notes:\n${(session.teamNotes as string) || ''}\n\n`;
  const formatQ = (list: AnsweredQuestion[], label: string) => {
    if (!list || list.length === 0) return '';
    return (
      `### ${label} Decisions:\n` +
      list
        .map((q) => `**Q:** ${q.text}\n**A:** ${q.answer || 'No answer provided yet.'}`)
        .join('\n\n') +
      '\n\n'
    );
  };
  notes += formatQ(session.qaQuestions as AnsweredQuestion[], 'QA');
  notes += formatQ(session.engQuestions as AnsweredQuestion[], 'Engineering');
  notes += formatQ(session.designQuestions as AnsweredQuestion[], 'Design');
  return notes;
}

// ---------------------------------------------------------------------------
// Breakdown command
// ---------------------------------------------------------------------------

export function registerBreakdownCommand(program: Command) {
  program
    .command('breakdown <pageId>')
    .description('Generate a high-level concept breakdown from the PRD and review notes')
    .option('-n, --notes <notes>', 'Additional team notes to include')
    .action(async (pageId: string, options: { notes?: string }) => {
      try {
        printHeader('🧩 Concept Breakdown');

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
        if (options.notes) {
          session.teamNotes = options.notes;
        }
        const teamNotes = compileCombinedNotes(session);

        let breakdown = '';
        let approved = false;

        while (!approved) {
          const spinner = ora('Generating breakdown...').start();
          breakdown = await generateBreakdown(markdown, teamNotes, settings, config.customPrompts);
          spinner.succeed('Breakdown generated');

          console.log('');
          printDivider();
          console.log(breakdown);
          printDivider();
          console.log('');

          const action = await confirm({
            message: 'Approve this breakdown?',
            default: true,
          });

          if (action) {
            approved = true;
          } else {
            const editChoice = await confirm({
              message: 'Would you like to edit the breakdown manually?',
              default: true,
            });

            if (editChoice) {
              breakdown = await editor({
                message: 'Edit and save the breakdown:',
                default: breakdown,
              });

              console.log('');
              printDivider();
              console.log(breakdown);
              printDivider();
              console.log('');

              const afterEdit = await confirm({
                message: 'Approve this edited breakdown?',
                default: true,
              });
              if (afterEdit) {
                approved = true;
              }
              // Otherwise loop back to regenerate
            }
            // Otherwise regenerate
          }
        }

        // Save to session
        await saveSession(pageId, { breakdown });
        printSuccess('Breakdown approved and saved to session.');
        console.log('');
        printInfo(`Next step: npx tsx cli/index.ts evaluate ${pageId}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : 'Breakdown failed');
        process.exit(1);
      }
    });
}

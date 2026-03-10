import { Command } from 'commander';
import { select, input, confirm, editor } from '@inquirer/prompts';
import ora from 'ora';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { ingestFromConfluence, ingestFromFile, ingestDemo } from '../../lib/core/ingest';
import { generateReviewQuestions } from '../../lib/core/review';
import { generateBreakdown } from '../../lib/core/breakdown';
import { evaluatePBIs } from '../../lib/core/evaluate';
import { scanCodebase } from '../../lib/core/codebase-scanner';
import { exportToAzureDevOps } from '../../lib/core/export';
import { loadConfig, getEffectiveSettings } from '../../lib/core/config';
import { exportReviewToMarkdown, importReviewFromMarkdown } from '../../lib/core/review-session';
import {
  printBanner,
  printHeader,
  printQuestions,
  printPBIs,
  printSuccess,
  printError,
  printInfo,
  printWarning,
  printConfigStatus,
  printDivider,
  printReviewStatus,
  printReviewSummary,
} from '../utils/display';
import type {
  AnsweredQuestion,
  LLMSettings,
  IngestResult,
  ReviewQuestion,
} from '../../lib/core/types';

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

async function saveSession(pageId: string, data: Record<string, unknown>) {
  const sessionPath = path.join(process.cwd(), `.prd-review-session-${pageId}.json`);
  let existing: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(sessionPath, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    // fresh session
  }
  const merged = { ...existing, ...data };
  await fs.writeFile(sessionPath, JSON.stringify(merged, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Full pipeline command
// ---------------------------------------------------------------------------

export function registerRunCommand(program: Command) {
  program
    .command('run [source]')
    .description('Run the full PRD review pipeline interactively')
    .option('-d, --demo', 'Use demo PRD with mock provider')
    .action(async (source?: string, options?: { demo?: boolean }) => {
      try {
        printBanner();

        const config = await loadConfig();
        const settings: LLMSettings = getEffectiveSettings(config);
        printConfigStatus(settings.provider, settings.model);
        console.log('');

        // ── Step 1: Ingest ──────────────────────────────────────────────
        printHeader('STEP 1 — Select PRD');

        let result: IngestResult;

        if (options?.demo || source === 'demo') {
          const spinner = ora('Creating demo PRD...').start();
          result = await ingestDemo();
          spinner.succeed('Demo PRD created');
        } else if (source) {
          // Check if it's a local file
          const resolved = path.resolve(source);
          let isFile = false;
          try {
            await fs.access(resolved);
            isFile = true;
          } catch {
            // not a file
          }

          if (isFile) {
            const spinner = ora(`Parsing ${path.basename(resolved)}...`).start();
            result = await ingestFromFile(resolved);
            spinner.succeed('File parsed and staged');
          } else {
            const spinner = ora('Fetching from Confluence...').start();
            result = await ingestFromConfluence(source);
            spinner.succeed('Confluence page fetched and staged');
          }
        } else {
          const method = await select({
            message: 'How would you like to provide the PRD?',
            choices: [
              { name: '📎 Confluence URL or Page ID', value: 'confluence' },
              { name: '📁 Local file (PDF, DOCX, MD, TXT)', value: 'file' },
              { name: '🎮 Demo PRD (no API needed)', value: 'demo' },
            ],
          });

          if (method === 'demo') {
            const spinner = ora('Creating demo PRD...').start();
            result = await ingestDemo();
            spinner.succeed('Demo PRD created');
          } else if (method === 'confluence') {
            const url = await input({ message: 'Confluence URL or Page ID:' });
            const spinner = ora('Fetching from Confluence...').start();
            result = await ingestFromConfluence(url);
            spinner.succeed('Confluence page fetched and staged');
          } else {
            const filePath = await input({ message: 'File path:' });
            const spinner = ora(`Parsing ${path.basename(filePath)}...`).start();
            result = await ingestFromFile(path.resolve(filePath));
            spinner.succeed('File parsed and staged');
          }
        }

        printSuccess(`Title: ${result.title}`);
        printSuccess(`Saved: ${result.filePath}`);
        const pageId = result.pageId;

        // ── Step 2: Review ──────────────────────────────────────────────
        printHeader('STEP 2 — Review (Interactive Session)');

        const session: Record<string, unknown> = {};
        const prdTitle = result.title || pageId;

        // Helper functions for the review menu
        const sessionKey = (type: 'qa' | 'eng' | 'design') =>
          `${type}Questions` as 'qaQuestions' | 'engQuestions' | 'designQuestions';
        const personaLabel = (type: 'qa' | 'eng' | 'design') =>
          type === 'qa' ? 'QA' : type === 'eng' ? 'Engineering' : 'Design';
        const sessionData = () => ({
          qaQuestions: (session.qaQuestions as AnsweredQuestion[]) || [],
          engQuestions: (session.engQuestions as AnsweredQuestion[]) || [],
          designQuestions: (session.designQuestions as AnsweredQuestion[]) || [],
          teamNotes: (session.teamNotes as string) || '',
        });

        let reviewDone = false;
        while (!reviewDone) {
          console.log('');
          printDivider();
          printReviewStatus(sessionData());
          console.log('');

          const action = await select({
            message: 'What would you like to do?',
            choices: [
              { name: '🔄 Generate Questions        (choose persona or all)', value: 'generate' },
              {
                name: '✏️  Answer Questions          (pick persona, answer one by one)',
                value: 'answer',
              },
              {
                name: '➕ Add Custom Questions      (add your own for any persona)',
                value: 'custom',
              },
              { name: '📝 Add Discussion Notes      (free-form team notes)', value: 'notes' },
              {
                name: '📄 Export to Markdown         (save as .md for team editing)',
                value: 'export',
              },
              {
                name: '📥 Import from Markdown       (read back an edited .md file)',
                value: 'import',
              },
              { name: '📊 View Summary              (see current status)', value: 'summary' },
              { name: '💾 Save & Continue → Breakdown', value: 'done' },
            ],
          });

          switch (action) {
            case 'generate': {
              const genChoice = await select({
                message: 'Generate questions for which persona?',
                choices: [
                  { name: 'QA', value: 'qa' as const },
                  { name: 'Engineering', value: 'eng' as const },
                  { name: 'Design', value: 'design' as const },
                  { name: 'All three', value: 'all' as const },
                  { name: '← Back', value: 'back' as const },
                ],
              });
              if (genChoice !== 'back') {
                const types: ('qa' | 'eng' | 'design')[] =
                  genChoice === 'all' ? ['qa', 'eng', 'design'] : [genChoice];
                for (const type of types) {
                  const key = sessionKey(type);
                  const existing = (session[key] as AnsweredQuestion[]) || [];
                  if (existing.length > 0) {
                    const ow = await confirm({
                      message: `${personaLabel(type)} already has ${existing.length} questions. Regenerate?`,
                      default: false,
                    });
                    if (!ow) continue;
                  }
                  const label = personaLabel(type);
                  const spinner = ora(`Generating ${label} questions...`).start();
                  const questions: ReviewQuestion[] = await generateReviewQuestions(
                    result.markdown,
                    type,
                    settings,
                    config.customPrompts,
                  );
                  spinner.succeed(`${label} — ${questions.length} questions generated`);
                  printQuestions(questions, type);
                  session[key] = questions.map((q) => ({
                    text: q.text,
                    answer: '',
                    priority: q.priority,
                    isAiGenerated: true,
                  }));
                }
              }
              break;
            }
            case 'answer': {
              const data = sessionData();
              const ansChoices: { name: string; value: 'qa' | 'eng' | 'design' }[] = [];
              for (const type of ['qa', 'eng', 'design'] as const) {
                const qs = data[sessionKey(type)];
                if (qs.length === 0) continue;
                const unans = qs.filter((q) => !q.answer || !q.answer.trim()).length;
                const label = personaLabel(type);
                ansChoices.push({
                  name:
                    unans > 0
                      ? `${label} (${unans} unanswered)`
                      : `${label} (${chalk.green('all answered')})`,
                  value: type,
                });
              }
              if (ansChoices.length === 0) {
                printWarning('No questions generated yet. Generate questions first.');
              } else {
                const ansType = await select({
                  message: 'Answer questions for which persona?',
                  choices: [...ansChoices, { name: '← Back', value: 'back' as 'qa' }],
                });
                if (ansType !== ('back' as 'qa')) {
                  const key = sessionKey(ansType);
                  const questions = (session[key] as AnsweredQuestion[]) || [];
                  for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];
                    const status =
                      q.answer && q.answer.trim()
                        ? chalk.green(' (answered)')
                        : chalk.yellow(' (unanswered)');
                    console.log('');
                    console.log(
                      chalk.bold(`  ${personaLabel(ansType)} Q${i + 1} of ${questions.length}`) +
                        status,
                    );
                    console.log(`  ${q.text}`);
                    const existingHint =
                      q.answer && q.answer.trim()
                        ? ` (current: "${q.answer.substring(0, 60)}...")`
                        : '';
                    const answer = await input({
                      message: `Your answer${existingHint}:`,
                      default: q.answer || '',
                    });
                    questions[i] = { ...q, answer };
                  }
                  session[key] = questions;
                  printSuccess(`${personaLabel(ansType)} answers saved.`);
                }
              }
              break;
            }
            case 'custom': {
              const custType = await select({
                message: 'Add a custom question to which persona?',
                choices: [
                  { name: 'QA', value: 'qa' as const },
                  { name: 'Engineering', value: 'eng' as const },
                  { name: 'Design', value: 'design' as const },
                  { name: '← Back', value: 'back' as const },
                ],
              });
              if (custType !== 'back') {
                let addMore = true;
                while (addMore) {
                  const text = await input({ message: 'Question text:' });
                  const priority = (await select({
                    message: 'Priority:',
                    choices: [
                      { name: 'High', value: 'high' },
                      { name: 'Medium', value: 'medium' },
                      { name: 'Low', value: 'low' },
                    ],
                  })) as 'low' | 'medium' | 'high';
                  const answer = await input({
                    message: 'Your answer (Enter to skip):',
                    default: '',
                  });
                  const key = sessionKey(custType);
                  const existing = (session[key] as AnsweredQuestion[]) || [];
                  existing.push({ text, answer, priority, isAiGenerated: false });
                  session[key] = existing;
                  printSuccess(`Custom ${personaLabel(custType)} question added.`);
                  addMore = await confirm({ message: 'Add another?', default: false });
                }
              }
              break;
            }
            case 'notes': {
              const existingNotes = (session.teamNotes as string) || '';
              if (existingNotes.trim()) {
                console.log(chalk.dim('Current notes:'));
                existingNotes.split('\n').forEach((l) => console.log(chalk.dim(`  ${l}`)));
              }
              const noteMode = await select({
                message: 'How would you like to add notes?',
                choices: [
                  { name: 'Append to existing notes', value: 'append' },
                  { name: 'Replace all notes', value: 'replace' },
                  { name: 'Open in editor', value: 'editor' },
                  { name: '← Back', value: 'back' },
                ],
              });
              if (noteMode === 'editor') {
                const edited = await editor({
                  message: 'Edit your team notes:',
                  default: existingNotes,
                });
                session.teamNotes = edited;
                printSuccess('Notes updated.');
              } else if (noteMode !== 'back') {
                console.log(chalk.dim('  Type notes. Press Enter on an empty line to finish.'));
                const noteLines: string[] = [];
                let emptyCount = 0;
                 
                while (true) {
                  const line = await input({ message: '>' });
                  if (line.trim() === '') {
                    emptyCount++;
                    if (emptyCount >= 1 && noteLines.length > 0) break;
                  } else {
                    emptyCount = 0;
                    noteLines.push(line);
                  }
                }
                const newNotes = noteLines.join('\n');
                session.teamNotes =
                  noteMode === 'replace'
                    ? newNotes
                    : existingNotes
                      ? existingNotes.trim() + '\n\n' + newNotes
                      : newNotes;
                printSuccess('Notes saved.');
              }
              break;
            }
            case 'export': {
              const data = sessionData();
              const md = exportReviewToMarkdown({ ...data, title: prdTitle });
              const prdsPath = path.join(process.cwd(), 'prds');
              await fs.mkdir(prdsPath, { recursive: true });
              const filePath = path.join(prdsPath, `${pageId}-review.md`);
              await fs.writeFile(filePath, md, 'utf-8');
              printSuccess(`Exported to: ${chalk.cyan(filePath)}`);
              printInfo(
                'Edit with your team, then use "Import from Markdown" to bring changes back.',
              );
              break;
            }
            case 'import': {
              const defaultMdPath = path.join(process.cwd(), 'prds', `${pageId}-review.md`);
              const importPath = await input({
                message: 'Path to markdown file:',
                default: defaultMdPath,
              });
              try {
                const md = await fs.readFile(importPath, 'utf-8');
                const data = sessionData();
                const importResult = importReviewFromMarkdown(md, { ...data, title: prdTitle });
                session.qaQuestions = importResult.qaQuestions;
                session.engQuestions = importResult.engQuestions;
                session.designQuestions = importResult.designQuestions;
                session.teamNotes = importResult.teamNotes;
                printSuccess(
                  'Imported! ' +
                    chalk.dim(
                      `${importResult.stats.questionsFound} Qs, ${importResult.stats.answersFound} answers, ${importResult.stats.customQuestionsFound} custom`,
                    ),
                );
              } catch (importErr) {
                printError(
                  `Could not read file: ${importErr instanceof Error ? importErr.message : 'unknown'}`,
                );
              }
              break;
            }
            case 'summary':
              printReviewSummary(sessionData());
              break;
            case 'done':
              reviewDone = true;
              break;
          }

          // Auto-save after each action
          if (action !== 'summary' && action !== 'done') {
            await saveSession(pageId, session);
          }
        }

        await saveSession(pageId, session);
        printSuccess('Review session saved.');

        // Build combined notes from session for breakdown context
        const finalData = sessionData();
        let combinedNotes = `### General Team Notes:\n${finalData.teamNotes}\n\n`;
        const formatQ = (list: AnsweredQuestion[], lbl: string) => {
          if (!list || list.length === 0) return '';
          return (
            `### ${lbl} Decisions:\n` +
            list
              .map((q) => `**Q:** ${q.text}\n**A:** ${q.answer || 'No answer provided yet.'}`)
              .join('\n\n') +
            '\n\n'
          );
        };
        combinedNotes += formatQ(finalData.qaQuestions, 'QA');
        combinedNotes += formatQ(finalData.engQuestions, 'Engineering');
        combinedNotes += formatQ(finalData.designQuestions, 'Design');

        // ── Step 3: Breakdown ───────────────────────────────────────────
        printHeader('STEP 3 — Concept Breakdown');

        const bdSpinner = ora('Generating breakdown...').start();
        let breakdown = await generateBreakdown(
          result.markdown,
          combinedNotes,
          settings,
          config.customPrompts,
        );
        bdSpinner.succeed('Breakdown generated');

        console.log('');
        printDivider();
        console.log(breakdown);
        printDivider();
        console.log('');

        let approved = await confirm({ message: 'Approve this breakdown?', default: true });
        while (!approved) {
          const regen = await confirm({ message: 'Regenerate?', default: true });
          if (regen) {
            const s = ora('Regenerating...').start();
            breakdown = await generateBreakdown(
              result.markdown,
              combinedNotes,
              settings,
              config.customPrompts,
            );
            s.succeed('Breakdown regenerated');
            console.log('');
            printDivider();
            console.log(breakdown);
            printDivider();
            console.log('');
          }
          approved = await confirm({ message: 'Approve this breakdown?', default: true });
        }

        await saveSession(pageId, { breakdown });
        printSuccess('Breakdown approved.');

        // ── Step 4: Swarm Evaluation ────────────────────────────────────
        printHeader('STEP 4 — Swarm Evaluation');

        let codebasePath = config.codebasePath || '';
        if (!codebasePath) {
          codebasePath = await input({
            message: 'Local codebase path for swarm context (Enter to use CWD):',
            default: process.cwd(),
          });
        }

        let codebaseContext = '';
        if (codebasePath.trim()) {
          const cbSpinner = ora('Scanning codebase...').start();
          try {
            codebaseContext = scanCodebase(codebasePath.trim());
            cbSpinner.succeed('Codebase scanned');
          } catch {
            cbSpinner.warn('Codebase scan skipped');
          }
        }

        const evalSpinner = ora('Running swarm (6 agents per PBI)...').start();
        const pbis = await evaluatePBIs(
          result.markdown,
          breakdown,
          codebaseContext,
          settings,
          config.customPrompts,
        );
        evalSpinner.succeed(`${pbis.length} PBI(s) evaluated`);

        printPBIs(pbis);
        await saveSession(pageId, { pbis });

        // ── Step 5: Export ──────────────────────────────────────────────
        printHeader('STEP 5 — Export');

        const doExport = await confirm({
          message: 'Export PBIs to Azure DevOps?',
          default: false,
        });

        if (doExport) {
          const useDemo = await confirm({
            message: 'Use demo export (mock)?',
            default: settings.provider === 'mock',
          });

          if (useDemo) {
            const spinner = ora('Demo export...').start();
            const exportResult = await exportToAzureDevOps(
              pbis,
              { org: '', project: '', pat: '', demo: true },
              result.markdown,
            );
            spinner.succeed('Demo export complete');
            printSuccess(`URL: ${exportResult.url}`);
          } else {
            const org = await input({
              message: 'Azure Organization:',
              default: config.azure?.org || '',
            });
            const project = await input({
              message: 'Azure Project:',
              default: config.azure?.project || '',
            });
            const pat = await input({ message: 'Azure PAT:' });

            const spinner = ora('Exporting to Azure DevOps...').start();
            const exportResult = await exportToAzureDevOps(
              pbis,
              { org, project, pat },
              result.markdown,
            );
            spinner.succeed('Export complete');
            if (exportResult.url) {
              printSuccess(`Feature created: ${exportResult.url}`);
            }
          }
        } else {
          printInfo('Export skipped. PBIs saved in session for later export.');
          printInfo(`Run: npx tsx cli/index.ts export ${pageId}`);
        }

        console.log('');
        printDivider();
        printSuccess('Pipeline complete! 🎉');
        printInfo(`Session file: .prd-review-session-${pageId}.json`);
      } catch (err) {
        printError(err instanceof Error ? err.message : 'Pipeline failed');
        process.exit(1);
      }
    });
}

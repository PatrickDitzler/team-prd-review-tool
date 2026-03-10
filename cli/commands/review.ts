import { Command } from 'commander';
import { select, input, confirm, editor } from '@inquirer/prompts';
import ora from 'ora';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { generateReviewQuestions } from '../../lib/core/review';
import { exportReviewToMarkdown, importReviewFromMarkdown } from '../../lib/core/review-session';
import { loadConfig, getEffectiveSettings } from '../../lib/core/config';
import {
  printHeader,
  printQuestions,
  printSuccess,
  printError,
  printInfo,
  printWarning,
  printConfigStatus,
  printReviewStatus,
  printReviewSummary,
  printDivider,
} from '../utils/display';
import type { AnsweredQuestion, ReviewQuestion, LLMSettings } from '../../lib/core/types';

// ---------------------------------------------------------------------------
// Session persistence
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
// Helpers
// ---------------------------------------------------------------------------

function sessionData(session: Record<string, unknown>) {
  return {
    qaQuestions: (session.qaQuestions as AnsweredQuestion[]) || [],
    engQuestions: (session.engQuestions as AnsweredQuestion[]) || [],
    designQuestions: (session.designQuestions as AnsweredQuestion[]) || [],
    teamNotes: (session.teamNotes as string) || '',
  };
}

function personaLabel(type: 'qa' | 'eng' | 'design') {
  return type === 'qa' ? 'QA' : type === 'eng' ? 'Engineering' : 'Design';
}

function sessionKey(type: 'qa' | 'eng' | 'design') {
  return `${type}Questions` as 'qaQuestions' | 'engQuestions' | 'designQuestions';
}

// ---------------------------------------------------------------------------
// Menu actions
// ---------------------------------------------------------------------------

async function actionGenerateQuestions(
  session: Record<string, unknown>,
  markdown: string,
  settings: LLMSettings,
  config: Record<string, unknown>,
) {
  const choice = await select({
    message: 'Generate questions for which persona?',
    choices: [
      { name: 'QA', value: 'qa' as const },
      { name: 'Engineering', value: 'eng' as const },
      { name: 'Design', value: 'design' as const },
      { name: 'All three', value: 'all' as const },
      { name: '← Back', value: 'back' as const },
    ],
  });

  if (choice === 'back') return;

  const types: ('qa' | 'eng' | 'design')[] = choice === 'all' ? ['qa', 'eng', 'design'] : [choice];

  for (const type of types) {
    const key = sessionKey(type);
    const existing = (session[key] as AnsweredQuestion[]) || [];

    if (existing.length > 0) {
      const overwrite = await confirm({
        message: `${personaLabel(type)} already has ${existing.length} questions. Regenerate? (existing answers will be lost)`,
        default: false,
      });
      if (!overwrite) continue;
    }

    const label = personaLabel(type);
    const spinner = ora(`Generating ${label} questions...`).start();
    const questions: ReviewQuestion[] = await generateReviewQuestions(
      markdown,
      type,
      settings,
      config.customPrompts as Record<string, string>,
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

async function actionAnswerQuestions(session: Record<string, unknown>) {
  const data = sessionData(session);

  // Build persona choices — only show personas with unanswered questions
  const choices: { name: string; value: 'qa' | 'eng' | 'design' }[] = [];
  for (const type of ['qa', 'eng', 'design'] as const) {
    const qs = data[sessionKey(type)];
    if (qs.length === 0) continue;
    const unanswered = qs.filter((q) => !q.answer || !q.answer.trim()).length;
    const label = personaLabel(type);
    if (unanswered > 0) {
      choices.push({ name: `${label} (${unanswered} unanswered)`, value: type });
    } else {
      choices.push({ name: `${label} (${chalk.green('all answered')})`, value: type });
    }
  }

  if (choices.length === 0) {
    printWarning('No questions generated yet. Generate questions first.');
    return;
  }

  const type = await select({
    message: 'Answer questions for which persona?',
    choices: [...choices, { name: '← Back', value: 'back' as 'qa' }],
  });

  if (type === ('back' as 'qa')) return;

  const key = sessionKey(type);
  const questions = (session[key] as AnsweredQuestion[]) || [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const status =
      q.answer && q.answer.trim() ? chalk.green(' (answered)') : chalk.yellow(' (unanswered)');
    console.log('');
    console.log(chalk.bold(`  ${personaLabel(type)} Q${i + 1} of ${questions.length}`) + status);
    console.log(`  ${q.text}`);

    const existingHint =
      q.answer && q.answer.trim() ? ` (current: "${q.answer.substring(0, 60)}...")` : '';
    const answer = await input({
      message: `Your answer${existingHint}:`,
      default: q.answer || '',
    });
    questions[i] = { ...q, answer };
  }

  session[key] = questions;
  printSuccess(`${personaLabel(type)} answers saved.`);
}

async function actionAddCustomQuestions(session: Record<string, unknown>) {
  const type = await select({
    message: 'Add a custom question to which persona?',
    choices: [
      { name: 'QA', value: 'qa' as const },
      { name: 'Engineering', value: 'eng' as const },
      { name: 'Design', value: 'design' as const },
      { name: '← Back', value: 'back' as const },
    ],
  });

  if (type === 'back') return;

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
      message: 'Your answer (or press Enter to leave unanswered):',
      default: '',
    });

    const key = sessionKey(type);
    const existing = (session[key] as AnsweredQuestion[]) || [];
    existing.push({ text, answer, priority, isAiGenerated: false });
    session[key] = existing;
    printSuccess(`Custom ${personaLabel(type)} question added.`);

    addMore = await confirm({ message: 'Add another custom question?', default: false });
  }
}

async function actionAddNotes(session: Record<string, unknown>) {
  const existing = (session.teamNotes as string) || '';

  console.log('');
  if (existing.trim()) {
    console.log(chalk.dim('Current notes:'));
    console.log(chalk.dim('─'.repeat(40)));
    existing.split('\n').forEach((l) => console.log(chalk.dim(`  ${l}`)));
    console.log(chalk.dim('─'.repeat(40)));
    console.log('');
  }

  const mode = await select({
    message: 'How would you like to add notes?',
    choices: [
      { name: 'Append to existing notes', value: 'append' },
      { name: 'Replace all notes', value: 'replace' },
      { name: 'Open in editor', value: 'editor' },
      { name: '← Back', value: 'back' },
    ],
  });

  if (mode === 'back') return;

  if (mode === 'editor') {
    const result = await editor({
      message: 'Edit your team notes (save and close the editor when done):',
      default: existing,
    });
    session.teamNotes = result;
    printSuccess('Notes updated from editor.');
    return;
  }

  console.log(chalk.dim('  Type your notes. Press Enter twice (empty line) to finish.'));
  const lines: string[] = [];
  let consecutive = 0;
   
  while (true) {
    const line = await input({ message: '>' });
    if (line.trim() === '') {
      consecutive++;
      if (consecutive >= 1 && lines.length > 0) break;
    } else {
      consecutive = 0;
      lines.push(line);
    }
  }

  const newNotes = lines.join('\n');
  if (mode === 'replace') {
    session.teamNotes = newNotes;
  } else {
    session.teamNotes = existing ? existing.trim() + '\n\n' + newNotes : newNotes;
  }
  printSuccess('Discussion notes saved.');
}

async function actionExportMarkdown(
  session: Record<string, unknown>,
  pageId: string,
  title: string,
) {
  const data = sessionData(session);
  const md = exportReviewToMarkdown({ ...data, title });

  const prdsDir = path.join(process.cwd(), 'prds');
  await fs.mkdir(prdsDir, { recursive: true });
  const filePath = path.join(prdsDir, `${pageId}-review.md`);
  await fs.writeFile(filePath, md, 'utf-8');

  printSuccess(`Review session exported to: ${chalk.cyan(filePath)}`);
  printInfo('Open this file in your editor, edit answers and notes with your team,');
  printInfo('then use "Import from Markdown" to bring the changes back.');
}

async function actionImportMarkdown(session: Record<string, unknown>, pageId: string) {
  const defaultPath = path.join(process.cwd(), 'prds', `${pageId}-review.md`);
  const filePath = await input({
    message: 'Path to markdown file:',
    default: defaultPath,
  });

  try {
    const md = await fs.readFile(filePath, 'utf-8');
    const data = sessionData(session);
    const result = importReviewFromMarkdown(md, { ...data, title: '' });

    session.qaQuestions = result.qaQuestions;
    session.engQuestions = result.engQuestions;
    session.designQuestions = result.designQuestions;
    session.teamNotes = result.teamNotes;

    printSuccess('Markdown imported successfully!');
    printInfo(
      `  ${result.stats.questionsFound} questions found, ` +
        `${result.stats.answersFound} answers, ` +
        `${result.stats.customQuestionsFound} custom questions`,
    );
  } catch (err) {
    printError(`Could not read file: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

async function actionViewSummary(session: Record<string, unknown>) {
  const data = sessionData(session);
  printReviewSummary(data);

  // Show answered questions in compact form
  for (const type of ['qa', 'eng', 'design'] as const) {
    const qs = data[sessionKey(type)];
    if (qs.length === 0) continue;

    const label = personaLabel(type);
    console.log(chalk.bold(`  ${label}:`));
    qs.forEach((q, i) => {
      const answered = q.answer && q.answer.trim();
      const icon = answered ? chalk.green('✓') : chalk.yellow('○');
      const qText = q.text.length > 70 ? q.text.substring(0, 70) + '...' : q.text;
      const custom = q.isAiGenerated ? '' : chalk.cyan(' [custom]');
      console.log(`    ${icon} Q${i + 1}: ${qText}${custom}`);
    });
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Review command
// ---------------------------------------------------------------------------

export function registerReviewCommand(program: Command) {
  program
    .command('review <pageId>')
    .description('Generate QA, Engineering, and Design review questions for a staged PRD')
    .option('-t, --type <type>', 'Question type: qa, eng, design, or all', 'all')
    .option('--non-interactive', 'Generate questions, export to markdown, and exit')
    .action(async (pageId: string, options: { type: string; nonInteractive?: boolean }) => {
      try {
        printHeader('🔍 PRD Review — Interactive Session');

        // Load PRD markdown
        const prdsDir = path.join(process.cwd(), 'prds');
        const files = await fs.readdir(prdsDir);
        const match = files.find((f) => f.startsWith(pageId) || f === `${pageId}.md`);
        if (!match) {
          printError(`No staged PRD found for page ID "${pageId}" in prds/`);
          printInfo('Run "npx tsx cli/index.ts ingest" first to stage a PRD.');
          process.exit(1);
        }
        const markdown = await fs.readFile(path.join(prdsDir, match), 'utf-8');
        const title = match.replace(/\.md$/, '');

        // Load settings and existing session
        const config = await loadConfig();
        const settings: LLMSettings = getEffectiveSettings(config);
        printConfigStatus(settings.provider, settings.model);

        const session: Record<string, unknown> = await loadSession(pageId);

        // ── Non-interactive mode ──
        if (options.nonInteractive) {
          const types: ('qa' | 'eng' | 'design')[] =
            options.type === 'all'
              ? ['qa', 'eng', 'design']
              : [options.type as 'qa' | 'eng' | 'design'];

          for (const type of types) {
            const label = personaLabel(type);
            const spinner = ora(`Generating ${label} questions...`).start();
            const questions = await generateReviewQuestions(
              markdown,
              type,
              settings,
              config.customPrompts as Record<string, string>,
            );
            spinner.succeed(`${label} — ${questions.length} questions generated`);
            session[sessionKey(type)] = questions.map((q) => ({
              text: q.text,
              answer: '',
              priority: q.priority,
              isAiGenerated: true,
            }));
          }

          await saveSession(pageId, session);
          await actionExportMarkdown(session, pageId, title);
          printInfo('Non-interactive mode: questions generated and exported.');
          printInfo(
            `Next step: edit prds/${pageId}-review.md, then run the review command again to import.`,
          );
          return;
        }

        // ── Interactive session loop ──
         
        while (true) {
          console.log('');
          printDivider();
          printReviewStatus(sessionData(session));
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
            case 'generate':
              await actionGenerateQuestions(
                session,
                markdown,
                settings,
                config as Record<string, unknown>,
              );
              await saveSession(pageId, session);
              break;
            case 'answer':
              await actionAnswerQuestions(session);
              await saveSession(pageId, session);
              break;
            case 'custom':
              await actionAddCustomQuestions(session);
              await saveSession(pageId, session);
              break;
            case 'notes':
              await actionAddNotes(session);
              await saveSession(pageId, session);
              break;
            case 'export':
              await actionExportMarkdown(session, pageId, title);
              await saveSession(pageId, session);
              break;
            case 'import':
              await actionImportMarkdown(session, pageId);
              await saveSession(pageId, session);
              break;
            case 'summary':
              await actionViewSummary(session);
              break;
            case 'done': {
              await saveSession(pageId, session);
              printSuccess('Review session saved.');
              console.log('');
              printInfo(`Next step: npx tsx cli/index.ts breakdown ${pageId}`);
              return;
            }
          }
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : 'Review failed');
        process.exit(1);
      }
    });
}

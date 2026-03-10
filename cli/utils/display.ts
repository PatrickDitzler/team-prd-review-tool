import chalk from 'chalk';
import type { EnhancedPBI, ReviewQuestion } from '../../lib/core/types';

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

export function printBanner() {
  console.log('');
  console.log(chalk.bold.cyan('  📋 PRD Review Tool — CLI'));
  console.log(chalk.dim('  Select PRD → Review → Breakdown → Evaluate → Export'));
  console.log('');
}

// ---------------------------------------------------------------------------
// Headers & Dividers
// ---------------------------------------------------------------------------

export function printHeader(text: string) {
  console.log('');
  console.log(chalk.bold.underline(text));
  console.log('');
}

export function printDivider() {
  console.log(chalk.dim('─'.repeat(60)));
}

export function printSuccess(text: string) {
  console.log(chalk.green('✓ ') + text);
}

export function printError(text: string) {
  console.error(chalk.red('✗ ') + text);
}

export function printInfo(text: string) {
  console.log(chalk.blue('ℹ ') + text);
}

export function printWarning(text: string) {
  console.log(chalk.yellow('⚠ ') + text);
}

// ---------------------------------------------------------------------------
// Questions Display
// ---------------------------------------------------------------------------

export function printQuestions(questions: ReviewQuestion[], type: string) {
  const colors: Record<string, typeof chalk> = {
    qa: chalk.magenta,
    eng: chalk.blue,
    design: chalk.green,
  };
  const color = colors[type] || chalk;
  const label = type === 'qa' ? 'QA' : type === 'eng' ? 'Engineering' : 'Design';

  console.log('');
  console.log(color.bold(`  ── ${label} Questions ──`));
  console.log('');

  questions.forEach((q, i) => {
    const priorityColor =
      q.priority === 'high' ? chalk.red : q.priority === 'medium' ? chalk.yellow : chalk.dim;
    console.log(`  ${chalk.bold(`${i + 1}.`)} ${q.text}`);
    console.log(`     ${priorityColor(`[${q.priority.toUpperCase()}]`)}`);
    console.log('');
  });
}

// ---------------------------------------------------------------------------
// PBI Display
// ---------------------------------------------------------------------------

export function printPBIs(pbis: EnhancedPBI[]) {
  pbis.forEach((pbi, i) => {
    console.log('');
    console.log(chalk.bold.cyan(`━━━ PBI ${i + 1} ━━━`));
    console.log('');
    console.log(chalk.bold('Description:'));
    console.log(`  ${pbi.description}`);
    console.log('');
    console.log(chalk.bold('Functional Requirements:'));
    pbi.functionalReqs.split('\n').forEach((line) => {
      console.log(`  ${line}`);
    });
    console.log('');
    console.log(chalk.bold('Acceptance Criteria (Gherkin):'));
    pbi.gherkin.split('\n').forEach((line) => {
      console.log(chalk.dim(`  ${line}`));
    });
    console.log('');

    if (pbi.agentReviews && pbi.agentReviews.length > 0) {
      console.log(chalk.bold('Swarm Agent Reviews:'));
      printDivider();
      pbi.agentReviews.forEach((review) => {
        const roleColors: Record<string, typeof chalk> = {
          Security: chalk.red,
          Architect: chalk.blue,
          QA: chalk.yellow,
          Compliance: chalk.green,
          Frontend: chalk.magenta,
          Backend: chalk.cyan,
        };
        const color = roleColors[review.role] || chalk;
        console.log(`  ${color.bold(`${review.agentName}`)} ${chalk.dim(`(${review.role})`)}`);
        review.feedback.split('\n').forEach((line) => {
          console.log(`    ${line}`);
        });
        console.log('');
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Config status display
// ---------------------------------------------------------------------------

export function printConfigStatus(provider: string, model: string) {
  console.log(
    chalk.dim(`  Provider: ${chalk.white(provider)} | Model: ${chalk.white(model || 'default')}`),
  );
}

// ---------------------------------------------------------------------------
// Review session display
// ---------------------------------------------------------------------------

export interface ReviewStatusInput {
  qaQuestions: { answer: string }[];
  engQuestions: { answer: string }[];
  designQuestions: { answer: string }[];
  teamNotes: string;
}

function personaStat(label: string, qs: { answer: string }[], color: (s: string) => string) {
  if (qs.length === 0) return chalk.dim(`${label} —`);
  const answered = qs.filter((q) => q.answer && q.answer.trim()).length;
  const tag =
    answered === qs.length
      ? chalk.green(`✓ ${answered}/${qs.length}`)
      : chalk.yellow(`${answered}/${qs.length}`);
  return `${color(label)} ${tag}`;
}

export function printReviewStatus(data: ReviewStatusInput) {
  const parts = [
    personaStat('QA', data.qaQuestions, chalk.magenta),
    personaStat('Eng', data.engQuestions, chalk.blue),
    personaStat('Design', data.designQuestions, chalk.green),
  ];
  const notes =
    data.teamNotes && data.teamNotes.trim() ? chalk.cyan('📝 notes') : chalk.dim('no notes');
  console.log(chalk.dim('  Status: ') + parts.join(chalk.dim(' | ')) + chalk.dim(' | ') + notes);
}

export function printReviewSummary(data: ReviewStatusInput) {
  console.log('');
  console.log(chalk.bold.underline('Review Summary'));
  console.log('');

  const rows = [
    { label: 'QA', qs: data.qaQuestions, color: chalk.magenta },
    { label: 'Engineering', qs: data.engQuestions, color: chalk.blue },
    { label: 'Design', qs: data.designQuestions, color: chalk.green },
  ];

  for (const row of rows) {
    const total = row.qs.length;
    const answered = row.qs.filter((q) => q.answer && q.answer.trim()).length;
    const custom = row.qs.filter((q: Record<string, unknown>) => !q.isAiGenerated).length;
    const status =
      total === 0
        ? chalk.dim('not generated')
        : answered === total
          ? chalk.green(`${answered}/${total} answered`)
          : chalk.yellow(`${answered}/${total} answered`);
    const customTag = custom > 0 ? chalk.cyan(` (+${custom} custom)`) : '';
    console.log(`  ${row.color.bold(row.label.padEnd(14))} ${status}${customTag}`);
  }

  if (data.teamNotes && data.teamNotes.trim()) {
    const wordCount = data.teamNotes.trim().split(/\s+/).length;
    console.log(`  ${chalk.cyan.bold('Notes'.padEnd(14))} ${chalk.white(`${wordCount} words`)}`);
  } else {
    console.log(`  ${chalk.dim('Notes'.padEnd(14))} ${chalk.dim('none')}`);
  }
  console.log('');
}

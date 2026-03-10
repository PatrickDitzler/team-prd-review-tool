import type { AnsweredQuestion } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewSessionData {
  title: string;
  qaQuestions: AnsweredQuestion[];
  engQuestions: AnsweredQuestion[];
  designQuestions: AnsweredQuestion[];
  teamNotes: string;
}

// ---------------------------------------------------------------------------
// Export review session to markdown
// ---------------------------------------------------------------------------

export function exportReviewToMarkdown(session: ReviewSessionData): string {
  const lines: string[] = [];

  lines.push(`# PRD Review Session: ${session.title}`);
  lines.push('');
  lines.push(
    '> Edit this file with your team, then import it back into the CLI with `npm run cli -- review <pageId>`.',
  );
  lines.push(
    '> Do not change the heading structure (lines starting with #). Only edit answers and add content.',
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  // Helper to render a persona section
  const renderPersona = (label: string, questions: AnsweredQuestion[]) => {
    lines.push(`## ${label} Questions`);
    lines.push('');

    const aiQuestions = questions.filter((q) => q.isAiGenerated);
    const customQuestions = questions.filter((q) => !q.isAiGenerated);

    if (aiQuestions.length === 0 && customQuestions.length === 0) {
      lines.push('_(no questions generated yet)_');
      lines.push('');
    }

    aiQuestions.forEach((q, i) => {
      lines.push(`### Q${i + 1}: ${q.text} [${q.priority.toUpperCase()}]`);
      lines.push('');
      lines.push(`**Answer:** ${q.answer && q.answer.trim() ? q.answer.trim() : '_unanswered_'}`);
      lines.push('');
    });

    if (customQuestions.length > 0) {
      lines.push(`### Custom ${label} Questions`);
      lines.push('');
      customQuestions.forEach((q, i) => {
        lines.push(`#### CQ${i + 1}: ${q.text} [${q.priority.toUpperCase()}]`);
        lines.push('');
        lines.push(`**Answer:** ${q.answer && q.answer.trim() ? q.answer.trim() : '_unanswered_'}`);
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('');
  };

  renderPersona('QA', session.qaQuestions);
  renderPersona('Engineering', session.engQuestions);
  renderPersona('Design', session.designQuestions);

  // Discussion notes
  lines.push('## Discussion Notes');
  lines.push('');
  if (session.teamNotes && session.teamNotes.trim()) {
    lines.push(session.teamNotes.trim());
  } else {
    lines.push('_(Add your team discussion notes here)_');
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Import review session from markdown
// ---------------------------------------------------------------------------

interface ImportResult {
  qaQuestions: AnsweredQuestion[];
  engQuestions: AnsweredQuestion[];
  designQuestions: AnsweredQuestion[];
  teamNotes: string;
  stats: {
    questionsFound: number;
    answersFound: number;
    customQuestionsFound: number;
  };
}

export function importReviewFromMarkdown(
  markdown: string,
  existing: ReviewSessionData,
): ImportResult {
  const lines = markdown.split('\n');

  type PersonaKey = 'qa' | 'eng' | 'design';
  let currentPersona: PersonaKey | null = null;
  let inCustom = false;
  let inNotes = false;

  const result: Record<PersonaKey, AnsweredQuestion[]> = {
    qa: [],
    eng: [],
    design: [],
  };

  let teamNotes = '';
  let currentQuestion: {
    text: string;
    priority: 'low' | 'medium' | 'high';
    isAiGenerated: boolean;
  } | null = null;

  const stats = { questionsFound: 0, answersFound: 0, customQuestionsFound: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Section headers ──
    if (trimmed.startsWith('## QA Questions')) {
      currentPersona = 'qa';
      inCustom = false;
      inNotes = false;
      continue;
    }
    if (trimmed.startsWith('## Engineering Questions')) {
      currentPersona = 'eng';
      inCustom = false;
      inNotes = false;
      continue;
    }
    if (trimmed.startsWith('## Design Questions')) {
      currentPersona = 'design';
      inCustom = false;
      inNotes = false;
      continue;
    }
    if (trimmed.startsWith('## Discussion Notes')) {
      inNotes = true;
      currentPersona = null;
      inCustom = false;
      continue;
    }

    // ── Custom section within a persona ──
    if (trimmed.startsWith('### Custom') && currentPersona) {
      inCustom = true;
      continue;
    }

    // ── Discussion notes capture ──
    if (inNotes) {
      // Skip placeholder text
      if (trimmed === '_(Add your team discussion notes here)_') continue;
      if (trimmed === '---') continue;
      teamNotes += line + '\n';
      continue;
    }

    // ── Question detection ──
    // Regular question: ### Q1: text [PRIORITY]
    // Custom question: #### CQ1: text [PRIORITY]
    const questionMatch = trimmed.match(/^###?\s+(?:C?Q\d+):\s+(.+?)\s+\[(HIGH|MEDIUM|LOW)\]\s*$/i);
    if (questionMatch && currentPersona) {
      // Save previous question if any
      if (currentQuestion) {
        result[currentPersona].push({
          text: currentQuestion.text,
          answer: '',
          priority: currentQuestion.priority,
          isAiGenerated: currentQuestion.isAiGenerated,
        });
      }
      currentQuestion = {
        text: questionMatch[1],
        priority: questionMatch[2].toLowerCase() as 'low' | 'medium' | 'high',
        isAiGenerated: !inCustom,
      };
      if (inCustom) stats.customQuestionsFound++;
      stats.questionsFound++;
      continue;
    }

    // ── Answer detection ──
    const answerMatch = trimmed.match(/^\*\*Answer:\*\*\s*(.*)/);
    if (answerMatch && currentQuestion && currentPersona) {
      const answerText = answerMatch[1].trim() === '_unanswered_' ? '' : answerMatch[1].trim();
      if (answerText) stats.answersFound++;
      result[currentPersona].push({
        text: currentQuestion.text,
        answer: answerText,
        priority: currentQuestion.priority,
        isAiGenerated: currentQuestion.isAiGenerated,
      });
      currentQuestion = null;
      continue;
    }
  }

  // Handle trailing question with no answer
  if (currentQuestion && currentPersona) {
    result[currentPersona].push({
      text: currentQuestion.text,
      answer: '',
      priority: currentQuestion.priority,
      isAiGenerated: currentQuestion.isAiGenerated,
    });
  }

  return {
    qaQuestions: result.qa.length > 0 ? result.qa : existing.qaQuestions,
    engQuestions: result.eng.length > 0 ? result.eng : existing.engQuestions,
    designQuestions: result.design.length > 0 ? result.design : existing.designQuestions,
    teamNotes: teamNotes.trim() || existing.teamNotes,
    stats,
  };
}

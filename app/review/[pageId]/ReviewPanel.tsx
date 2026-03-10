'use client';

import { useState } from 'react';
import { Bot, Server, ListCollapse, PenTool, Trash2, Network, Palette } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import SwarmEvaluator from '@/components/SwarmEvaluator';

interface ReviewPanelProps {
  markdown: string;
  pageId: string;
}

interface QuestionObj {
  id: string;
  text: string;
  answer: string;
  isAiGenerated: boolean;
  priority: 'low' | 'medium' | 'high';
}

export default function ReviewPanel({ markdown, pageId }: ReviewPanelProps) {
  const [activeTab, setActiveTab] = useState<
    'qa' | 'eng' | 'design' | 'notes' | 'breakdown' | 'swarm'
  >('qa');

  const [qaQuestions, setQaQuestions] = useState<QuestionObj[]>([]);
  const [engQuestions, setEngQuestions] = useState<QuestionObj[]>([]);
  const [designQuestions, setDesignQuestions] = useState<QuestionObj[]>([]);
  const [generatingQa, setGeneratingQa] = useState(false);
  const [generatingEng, setGeneratingEng] = useState(false);
  const [generatingDesign, setGeneratingDesign] = useState(false);
  const [qaGenerated, setQaGenerated] = useState(false);
  const [engGenerated, setEngGenerated] = useState(false);
  const [designGenerated, setDesignGenerated] = useState(false);
  const [teamNotes, setTeamNotes] = useState('');

  const [addingCustomQa, setAddingCustomQa] = useState(false);
  const [customQaText, setCustomQaText] = useState('');
  const [customQaPriority, setCustomQaPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const [addingCustomEng, setAddingCustomEng] = useState(false);
  const [customEngText, setCustomEngText] = useState('');
  const [customEngPriority, setCustomEngPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const [addingCustomDesign, setAddingCustomDesign] = useState(false);
  const [customDesignText, setCustomDesignText] = useState('');
  const [customDesignPriority, setCustomDesignPriority] = useState<'low' | 'medium' | 'high'>(
    'medium',
  );

  const [breakdown, setBreakdown] = useState('');
  const [generatingBreakdown, setGeneratingBreakdown] = useState(false);
  const [isEditingBreakdown, setIsEditingBreakdown] = useState(false);
  const [approvedBreakdown, setApprovedBreakdown] = useState(false);

  const getSettings = () => {
    if (typeof window === 'undefined') return null;
    const s = localStorage.getItem('llm_settings');
    return s ? JSON.parse(s) : null;
  };

  const getPrompts = () => {
    if (typeof window === 'undefined') return {};
    const p = localStorage.getItem('custom_prompts');
    return p ? JSON.parse(p) : {};
  };

  const handleGenerateQuestions = async (type: 'qa' | 'eng' | 'design') => {
    const settings = getSettings();
    if (!settings) {
      alert(
        'Please configure your AI Provider Settings first by going back to the home page or via the gear icon.',
      );
      return;
    }

    if (type === 'qa') setGeneratingQa(true);
    else if (type === 'eng') setGeneratingEng(true);
    else setGeneratingDesign(true);

    try {
      const res = await fetch('/api/review/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, type, settings, customPrompts: getPrompts() }),
      });
      const data = await res.json();
      if (res.ok) {
        const newQuestions = (data.questions || []).map(
          (q: { text: string; priority?: 'low' | 'medium' | 'high' }, i: number) => ({
            id: `${type}-${Date.now()}-${i}`,
            text: q.text,
            answer: '',
            isAiGenerated: true,
            priority: q.priority || 'medium',
          }),
        );

        if (type === 'qa') {
          setQaQuestions(newQuestions);
          setQaGenerated(true);
        } else if (type === 'eng') {
          setEngQuestions(newQuestions);
          setEngGenerated(true);
        } else {
          setDesignQuestions(newQuestions);
          setDesignGenerated(true);
        }
      } else {
        alert(data.error || 'Failed to generate questions');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'An unknown error occurred');
    } finally {
      if (type === 'qa') setGeneratingQa(false);
      else if (type === 'eng') setGeneratingEng(false);
      else setGeneratingDesign(false);
    }
  };

  const handleGenerateBreakdown = async () => {
    const settings = getSettings();
    if (!settings) {
      alert('Please configure your AI Provider Settings first.');
      return;
    }

    setGeneratingBreakdown(true);
    setBreakdown('');
    setIsEditingBreakdown(false);
    setApprovedBreakdown(false);
    setActiveTab('breakdown');

    // Compile answered questions into the notes payload
    let combinedNotes = `### General Team Notes:\n${teamNotes}\n\n`;
    const formatQ = (list: QuestionObj[], label: string) => {
      if (list.length === 0) return '';
      return (
        `### ${label} Decisions:\n` +
        list
          .map((q) => `**Q:** ${q.text}\n**A:** ${q.answer || 'No answer provided yet.'}`)
          .join('\n\n') +
        '\n\n'
      );
    };
    combinedNotes += formatQ(qaQuestions, 'QA');
    combinedNotes += formatQ(engQuestions, 'Engineering');
    combinedNotes += formatQ(designQuestions, 'Design');

    try {
      const res = await fetch('/api/review/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown,
          teamNotes: combinedNotes,
          settings: getSettings(),
          customPrompts: getPrompts(),
        }),
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setBreakdown((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e: unknown) {
      alert(
        'Error generating breakdown: ' +
          (e instanceof Error ? e.message : 'An unknown error occurred'),
      );
    } finally {
      setGeneratingBreakdown(false);
    }
  };

  const handleApproveBreakdown = () => {
    localStorage.setItem('approved_prd_breakdown', breakdown);
    setApprovedBreakdown(true);
    setActiveTab('swarm');
  };

  return (
    <div className={`review-layout ${activeTab === 'swarm' ? 'review-layout--swarm-active' : ''}`}>
      {/* Left Column: Markdown Preview */}
      {activeTab !== 'swarm' && (
        <div className="review-left">
          <div className="review-card">
            <div className="review-card-header">
              <h3>PRD Document</h3>
              <span className="badge">ID: {pageId}</span>
            </div>
            <div className="review-card-body markdown-preview">
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Right Column: Interaction Panel */}
      <div className="review-right">
        <div className="review-tabs">
          <button
            className={`tab-btn ${activeTab === 'qa' ? 'active' : ''}`}
            onClick={() => setActiveTab('qa')}
          >
            <Bot size={16} /> QA
          </button>
          <button
            className={`tab-btn ${activeTab === 'eng' ? 'active' : ''}`}
            onClick={() => setActiveTab('eng')}
          >
            <Server size={16} /> Eng
          </button>
          <button
            className={`tab-btn ${activeTab === 'design' ? 'active' : ''}`}
            onClick={() => setActiveTab('design')}
          >
            <Palette size={16} /> Design
          </button>
          <button
            className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <PenTool size={16} /> Notes
          </button>
          <button
            className={`tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
            onClick={() => setActiveTab('breakdown')}
          >
            <ListCollapse size={16} /> Breakdown
          </button>
          <button
            className={`tab-btn ${activeTab === 'swarm' ? 'active' : ''}`}
            onClick={() => setActiveTab('swarm')}
            disabled={!approvedBreakdown}
            title={!approvedBreakdown ? 'Approve Breakdown first' : 'Swarm Evaluation'}
            style={{ opacity: !approvedBreakdown ? 0.5 : 1 }}
          >
            <Network size={16} /> Swarm
          </button>
        </div>

        <div className="review-tab-content review-card">
          {activeTab === 'qa' && (
            <div className="tab-pane fade-in">
              <h3 className="tab-title">QA Edge Cases & Testing</h3>
              <p className="tab-desc">
                Generate questions from the perspective of QA to challenge the PRD&apos;s
                completeness.
              </p>

              {!qaGenerated && qaQuestions.length === 0 ? (
                <button
                  className="btn-primary"
                  onClick={() => handleGenerateQuestions('qa')}
                  disabled={generatingQa}
                >
                  {generatingQa ? 'Generating QA Questions...' : 'Generate QA Questions'}
                </button>
              ) : (
                <div className="question-list">
                  {qaQuestions.map((q) => (
                    <div key={q.id} className="question-item interactive">
                      <div className="question-content">
                        <div
                          style={{
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <span className="question-icon qa-icon">
                              <Bot size={18} />
                            </span>
                            <div>
                              <p
                                style={{
                                  fontWeight: 600,
                                  color: 'var(--color-text)',
                                  marginBottom: '4px',
                                }}
                              >
                                {q.text}
                              </p>
                              <select
                                className={`priority-badge priority-${q.priority}`}
                                style={{
                                  border: 'none',
                                  outline: 'none',
                                  cursor: 'pointer',
                                  appearance: 'none',
                                }}
                                value={q.priority}
                                onChange={(e) =>
                                  setQaQuestions(
                                    qaQuestions.map((item) =>
                                      item.id === q.id
                                        ? {
                                            ...item,
                                            priority: e.target.value as 'low' | 'medium' | 'high',
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              >
                                <option value="low">Priority: LOW</option>
                                <option value="medium">Priority: MEDIUM</option>
                                <option value="high">Priority: HIGH</option>
                              </select>
                            </div>
                          </div>
                          <button
                            className="icon-button"
                            style={{
                              flexShrink: 0,
                              width: '28px',
                              height: '28px',
                              color: 'var(--color-error)',
                            }}
                            onClick={() =>
                              setQaQuestions(qaQuestions.filter((item) => item.id !== q.id))
                            }
                            title="Remove Question"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <textarea
                          className="form-textarea answer-input"
                          rows={3}
                          placeholder="Type the team's answer or decision here..."
                          value={q.answer}
                          onChange={(e) =>
                            setQaQuestions(
                              qaQuestions.map((item) =>
                                item.id === q.id ? { ...item, answer: e.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                  {!addingCustomQa ? (
                    <button className="btn-secondary" onClick={() => setAddingCustomQa(true)}>
                      + Add Custom Question
                    </button>
                  ) : (
                    <div
                      className="custom-question-form"
                      style={{
                        background: 'var(--color-surface-sunken)',
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Type your custom QA question..."
                        value={customQaText}
                        onChange={(e) => setCustomQaText(e.target.value)}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <label style={{ fontSize: '13px', fontWeight: 500 }}>Priority:</label>
                        <select
                          className="form-select"
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '13px' }}
                          value={customQaPriority}
                          onChange={(e) =>
                            setCustomQaPriority(e.target.value as 'low' | 'medium' | 'high')
                          }
                        >
                          <option value="low">Priority: Low</option>
                          <option value="medium">Priority: Medium</option>
                          <option value="high">Priority: High</option>
                        </select>
                        <div style={{ flex: 1 }}></div>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px' }}
                          onClick={() => {
                            setAddingCustomQa(false);
                            setCustomQaText('');
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          style={{ padding: '6px 12px' }}
                          onClick={() => {
                            if (customQaText.trim()) {
                              setQaQuestions([
                                ...qaQuestions,
                                {
                                  id: `qa-custom-${Date.now()}`,
                                  text: customQaText,
                                  answer: '',
                                  isAiGenerated: false,
                                  priority: customQaPriority,
                                },
                              ]);
                              setAddingCustomQa(false);
                              setCustomQaText('');
                              setCustomQaPriority('medium');
                            }
                          }}
                        >
                          Add Question
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'eng' && (
            <div className="tab-pane fade-in">
              <h3 className="tab-title">Engineering Feasibility</h3>
              <p className="tab-desc">
                Critical technical considerations proposed by the AI to align engineering.
              </p>

              {!engGenerated && engQuestions.length === 0 ? (
                <button
                  className="btn-primary"
                  onClick={() => handleGenerateQuestions('eng')}
                  disabled={generatingEng}
                >
                  {generatingEng ? 'Generating Eng Questions...' : 'Generate Eng Questions'}
                </button>
              ) : (
                <div className="question-list">
                  {engQuestions.map((q) => (
                    <div key={q.id} className="question-item interactive">
                      <div className="question-content">
                        <div
                          style={{
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <span className="question-icon eng-icon">
                              <Server size={18} />
                            </span>
                            <div>
                              <p
                                style={{
                                  fontWeight: 600,
                                  color: 'var(--color-text)',
                                  marginBottom: '4px',
                                }}
                              >
                                {q.text}
                              </p>
                              <select
                                className={`priority-badge priority-${q.priority}`}
                                style={{
                                  border: 'none',
                                  outline: 'none',
                                  cursor: 'pointer',
                                  appearance: 'none',
                                }}
                                value={q.priority}
                                onChange={(e) =>
                                  setEngQuestions(
                                    engQuestions.map((item) =>
                                      item.id === q.id
                                        ? {
                                            ...item,
                                            priority: e.target.value as 'low' | 'medium' | 'high',
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              >
                                <option value="low">Priority: LOW</option>
                                <option value="medium">Priority: MEDIUM</option>
                                <option value="high">Priority: HIGH</option>
                              </select>
                            </div>
                          </div>
                          <button
                            className="icon-button"
                            style={{
                              flexShrink: 0,
                              width: '28px',
                              height: '28px',
                              color: 'var(--color-error)',
                            }}
                            onClick={() =>
                              setEngQuestions(engQuestions.filter((item) => item.id !== q.id))
                            }
                            title="Remove Question"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <textarea
                          className="form-textarea answer-input"
                          rows={3}
                          placeholder="Type the team's answer or technical decision here..."
                          value={q.answer}
                          onChange={(e) =>
                            setEngQuestions(
                              engQuestions.map((item) =>
                                item.id === q.id ? { ...item, answer: e.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                  {!addingCustomEng ? (
                    <button className="btn-secondary" onClick={() => setAddingCustomEng(true)}>
                      + Add Custom Question
                    </button>
                  ) : (
                    <div
                      className="custom-question-form"
                      style={{
                        background: 'var(--color-surface-sunken)',
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Type your custom Engineering question..."
                        value={customEngText}
                        onChange={(e) => setCustomEngText(e.target.value)}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <label style={{ fontSize: '13px', fontWeight: 500 }}>Priority:</label>
                        <select
                          className="form-select"
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '13px' }}
                          value={customEngPriority}
                          onChange={(e) =>
                            setCustomEngPriority(e.target.value as 'low' | 'medium' | 'high')
                          }
                        >
                          <option value="low">Priority: Low</option>
                          <option value="medium">Priority: Medium</option>
                          <option value="high">Priority: High</option>
                        </select>
                        <div style={{ flex: 1 }}></div>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px' }}
                          onClick={() => {
                            setAddingCustomEng(false);
                            setCustomEngText('');
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          style={{ padding: '6px 12px' }}
                          onClick={() => {
                            if (customEngText.trim()) {
                              setEngQuestions([
                                ...engQuestions,
                                {
                                  id: `eng-custom-${Date.now()}`,
                                  text: customEngText,
                                  answer: '',
                                  isAiGenerated: false,
                                  priority: customEngPriority,
                                },
                              ]);
                              setAddingCustomEng(false);
                              setCustomEngText('');
                              setCustomEngPriority('medium');
                            }
                          }}
                        >
                          Add Question
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'design' && (
            <div className="tab-pane fade-in">
              <h3 className="tab-title">UI/UX & Product Design</h3>
              <p className="tab-desc">
                Evaluate user workflows, visual components, interaction patterns, and accessibility
                needs.
              </p>

              {!designGenerated && designQuestions.length === 0 ? (
                <button
                  className="btn-primary"
                  onClick={() => handleGenerateQuestions('design')}
                  disabled={generatingDesign}
                >
                  {generatingDesign
                    ? 'Generating Design Questions...'
                    : 'Generate Design Questions'}
                </button>
              ) : (
                <div className="question-list">
                  {designQuestions.map((q) => (
                    <div key={q.id} className="question-item interactive">
                      <div className="question-content">
                        <div
                          style={{
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <span
                              className="question-icon eng-icon"
                              style={{ background: 'var(--color-primary-muted)' }}
                            >
                              <Palette size={18} />
                            </span>
                            <div>
                              <p
                                style={{
                                  fontWeight: 600,
                                  color: 'var(--color-text)',
                                  marginBottom: '4px',
                                }}
                              >
                                {q.text}
                              </p>
                              <select
                                className={`priority-badge priority-${q.priority}`}
                                style={{
                                  border: 'none',
                                  outline: 'none',
                                  cursor: 'pointer',
                                  appearance: 'none',
                                }}
                                value={q.priority}
                                onChange={(e) =>
                                  setDesignQuestions(
                                    designQuestions.map((item) =>
                                      item.id === q.id
                                        ? {
                                            ...item,
                                            priority: e.target.value as 'low' | 'medium' | 'high',
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              >
                                <option value="low">Priority: LOW</option>
                                <option value="medium">Priority: MEDIUM</option>
                                <option value="high">Priority: HIGH</option>
                              </select>
                            </div>
                          </div>
                          <button
                            className="icon-button"
                            style={{
                              flexShrink: 0,
                              width: '28px',
                              height: '28px',
                              color: 'var(--color-error)',
                            }}
                            onClick={() =>
                              setDesignQuestions(designQuestions.filter((item) => item.id !== q.id))
                            }
                            title="Remove Question"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <textarea
                          className="form-textarea answer-input"
                          rows={3}
                          placeholder="Type the team's answer regarding UX/UI here..."
                          value={q.answer}
                          onChange={(e) =>
                            setDesignQuestions(
                              designQuestions.map((item) =>
                                item.id === q.id ? { ...item, answer: e.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                  {!addingCustomDesign ? (
                    <button className="btn-secondary" onClick={() => setAddingCustomDesign(true)}>
                      + Add Custom Question
                    </button>
                  ) : (
                    <div
                      className="custom-question-form"
                      style={{
                        background: 'var(--color-surface-sunken)',
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Type your custom Design question..."
                        value={customDesignText}
                        onChange={(e) => setCustomDesignText(e.target.value)}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <label style={{ fontSize: '13px', fontWeight: 500 }}>Priority:</label>
                        <select
                          className="form-select"
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '13px' }}
                          value={customDesignPriority}
                          onChange={(e) =>
                            setCustomDesignPriority(e.target.value as 'low' | 'medium' | 'high')
                          }
                        >
                          <option value="low">Priority: Low</option>
                          <option value="medium">Priority: Medium</option>
                          <option value="high">Priority: High</option>
                        </select>
                        <div style={{ flex: 1 }}></div>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px' }}
                          onClick={() => {
                            setAddingCustomDesign(false);
                            setCustomDesignText('');
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          style={{ padding: '6px 12px' }}
                          onClick={() => {
                            if (customDesignText.trim()) {
                              setDesignQuestions([
                                ...designQuestions,
                                {
                                  id: `design-custom-${Date.now()}`,
                                  text: customDesignText,
                                  answer: '',
                                  isAiGenerated: false,
                                  priority: customDesignPriority,
                                },
                              ]);
                              setAddingCustomDesign(false);
                              setCustomDesignText('');
                              setCustomDesignPriority('medium');
                            }
                          }}
                        >
                          Add Question
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="tab-pane fade-in">
              <h3 className="tab-title">Team Notes & Decisions</h3>
              <p className="tab-desc">
                Jot down any answers to the AI questions, new ideas, or structural notes. This will
                be fed into the Breakdown step.
              </p>

              <textarea
                className="form-textarea"
                rows={12}
                placeholder="Team discussion notes go here..."
                value={teamNotes}
                onChange={(e) => setTeamNotes(e.target.value)}
              />
              <p className="form-hint" style={{ marginTop: '12px' }}>
                Stored temporarily in browser memory for this session.
              </p>
            </div>
          )}

          {activeTab === 'breakdown' && (
            <div
              className="tab-pane fade-in"
              style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              <h3 className="tab-title">Concept Breakdown</h3>
              <p className="tab-desc">
                High-level work architecture synthesized from the PRD and team decisions.
              </p>

              {!breakdown && !generatingBreakdown ? (
                <button className="btn-primary" onClick={handleGenerateBreakdown}>
                  Generate Concept Breakdown
                </button>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <div
                    className="markdown-body"
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      background: 'var(--color-bg)',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {isEditingBreakdown ? (
                      <textarea
                        className="form-textarea"
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: '300px',
                          resize: 'vertical',
                        }}
                        value={breakdown}
                        onChange={(e) => setBreakdown(e.target.value)}
                      />
                    ) : (
                      <ReactMarkdown>{breakdown}</ReactMarkdown>
                    )}
                  </div>

                  {breakdown && !generatingBreakdown && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end',
                        marginTop: 'auto',
                      }}
                    >
                      <button
                        className="btn-secondary"
                        onClick={() => setIsEditingBreakdown(!isEditingBreakdown)}
                      >
                        {isEditingBreakdown ? 'Save Edits' : 'Edit Breakdown'}
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={handleGenerateBreakdown}
                        disabled={isEditingBreakdown}
                      >
                        Regenerate
                      </button>
                      <button
                        className="btn-primary"
                        onClick={handleApproveBreakdown}
                        disabled={isEditingBreakdown || approvedBreakdown}
                        style={{
                          backgroundColor: approvedBreakdown ? 'var(--color-success)' : undefined,
                          color: approvedBreakdown ? '#fff' : undefined,
                        }}
                      >
                        {approvedBreakdown ? 'Approved ✓' : 'Approve & Proceed'}
                      </button>
                    </div>
                  )}
                  {generatingBreakdown && (
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'var(--color-text-muted)',
                        fontStyle: 'italic',
                        textAlign: 'center',
                      }}
                    >
                      AI is streaming output...
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {activeTab === 'swarm' && (
            <div className="tab-pane fade-in">
              <SwarmEvaluator prdContext={markdown} breakdownContext={breakdown} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

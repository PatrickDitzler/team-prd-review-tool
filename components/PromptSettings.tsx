'use client';

import { useState, useEffect } from 'react';

export const DEFAULT_PROMPTS = {
  qa_generation: '',
  eng_generation: '',
  design_generation: '',
  breakdown_generation: '',
  sec_agent: '',
  arch_agent: '',
  qa_agent: '',
  law_agent: '',
  fe_agent: '',
  be_agent: '',
};

export type CustomPrompts = typeof DEFAULT_PROMPTS;

export default function PromptSettings() {
  const [prompts, setPrompts] = useState<CustomPrompts>(DEFAULT_PROMPTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedPrompts = localStorage.getItem('custom_prompts');
    if (savedPrompts) {
      try {
        const parsed = JSON.parse(savedPrompts);
        setPrompts({ ...DEFAULT_PROMPTS, ...parsed });
      } catch (e) {
        console.error('Failed to parse custom prompts', e);
      }
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('custom_prompts', JSON.stringify(prompts));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    if (
      confirm(
        'Are you sure you want to completely reset all custom prompts to their built-in defaults?',
      )
    ) {
      setPrompts(DEFAULT_PROMPTS);
      localStorage.setItem('custom_prompts', JSON.stringify(DEFAULT_PROMPTS));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleChange = (key: keyof CustomPrompts, value: string) => {
    setPrompts((prev) => ({ ...prev, [key]: value }));
  };

  const renderPromptInput = (key: keyof CustomPrompts, label: string, placeholder: string) => (
    <div className="form-group" style={{ marginBottom: '16px' }}>
      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span
          style={{
            fontSize: '11px',
            color: prompts[key].length > 500 ? 'var(--color-error)' : 'var(--color-text-muted)',
          }}
        >
          {prompts[key].length} / 500
        </span>
      </label>
      <textarea
        className="form-textarea"
        style={{ minHeight: '80px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
        value={prompts[key]}
        onChange={(e) => handleChange(key, e.target.value)}
        maxLength={500}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="settings-card" style={{ marginTop: '32px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Custom Personas & Prompts</h2>
        <button
          className="btn-secondary"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
          onClick={handleReset}
        >
          Reset All
        </button>
      </div>
      <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
        Override the system instructions for specific agents and actions. Leave blank to use the
        factory defaults. Max 500 characters to prevent context length rot.
      </p>

      <form onSubmit={handleSave}>
        {saved && (
          <div className="status-banner status-banner--success" role="status">
            <span className="status-banner-icon">✓</span>
            Prompts saved successfully!
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <h3
              style={{
                fontSize: '14px',
                marginBottom: '16px',
                color: 'var(--color-accent)',
                fontWeight: 600,
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '8px',
              }}
            >
              Interactive Review (Questions)
            </h3>
            {renderPromptInput(
              'qa_generation',
              'QA Question Generator',
              'e.g., Focus heavily on mobile devices and responsive bugs.',
            )}
            {renderPromptInput(
              'eng_generation',
              'Engineering Question Generator',
              'e.g., You must strictly enforce microservice architecture constraints.',
            )}
            {renderPromptInput(
              'design_generation',
              'Design Question Generator',
              'e.g., Prioritize strict ADA compliance and screen-reader usability.',
            )}

            <h3
              style={{
                fontSize: '14px',
                marginBottom: '16px',
                marginTop: '24px',
                color: 'var(--color-accent)',
                fontWeight: 600,
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '8px',
              }}
            >
              Work Breakdown
            </h3>
            {renderPromptInput(
              'breakdown_generation',
              'Concept Breakdown Generator',
              'e.g., Always output PBIs structured for the SAFe methodology.',
            )}
          </div>

          <div>
            <h3
              style={{
                fontSize: '14px',
                marginBottom: '16px',
                color: 'var(--color-accent)',
                fontWeight: 600,
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '8px',
              }}
            >
              Swarm Review Agents
            </h3>
            {renderPromptInput(
              'sec_agent',
              'Security Expert',
              'e.g., You are an ex-NSA contractor. Find zero-days.',
            )}
            {renderPromptInput(
              'arch_agent',
              'System Architect',
              'e.g., Focus specifically on GraphQL caching strategies.',
            )}
            {renderPromptInput(
              'qa_agent',
              'QA Automation Engineer',
              'e.g., Must provide code snippets for Cypress E2E tests in the feedback.',
            )}
            {renderPromptInput(
              'law_agent',
              'Legal & Compliance',
              'e.g., You are an expert in European privacy law (GDPR).',
            )}
            {renderPromptInput(
              'fe_agent',
              'Frontend Engineer (Pixel)',
              'e.g., Assume the codebase uses Vue.js instead of React.',
            )}
            {renderPromptInput(
              'be_agent',
              'Backend Engineer (Node)',
              'e.g., Assume the database is MongoDB and focus on NoSQL structures.',
            )}
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
            Save Custom Prompts
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Network, Shield, Ruler, FlaskConical, Gavel, Cpu, CheckCircle, LayoutTemplate, Database } from 'lucide-react';

interface SwarmEvaluatorProps {
  prdContext: string;
  breakdownContext: string;
}

interface AgentFeedback {
  agentName: string;
  role: string;
  feedback: string;
}

interface EnhancedPBI {
  description: string;
  functionalReqs: string;
  gherkin: string;
  agentReviews: AgentFeedback[];
}

export default function SwarmEvaluator({ prdContext, breakdownContext }: SwarmEvaluatorProps) {
  const [localPath, setLocalPath] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationComplete, setEvaluationComplete] = useState(false);
  const [enhancedPBIs, setEnhancedPBIs] = useState<EnhancedPBI[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingPbiIndex, setEditingPbiIndex] = useState<number | null>(null);
  const [showAzureModal, setShowAzureModal] = useState(false);
  const [azureConfig, setAzureConfig] = useState({ org: '', project: '', pat: '' });
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessUrl, setExportSuccessUrl] = useState('');
  
  const handlePbiEditChange = (index: number, field: keyof EnhancedPBI, value: string) => {
    const newPbis = [...enhancedPBIs];
    // @ts-ignore
    newPbis[index][field] = value;
    setEnhancedPBIs(newPbis);
  };

  const handleEvaluate = async () => {
    if (!localPath.trim()) {
      setError('Please provide a valid absolute path to the local repository.');
      return;
    }

    setIsEvaluating(true);
    setError(null);

    try {
      // 1. Fetch Codebase Context
      const cbRes = await fetch('/api/codebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absolutePath: localPath.trim() })
      });

      const cbData = await cbRes.json();
      if (!cbRes.ok) throw new Error(cbData.error || 'Failed to fetch codebase context');

      const codebaseContext = cbData.context;

      // 2. Fetch AI Settings
      const settingsRaw = localStorage.getItem('llm_settings');
      if (!settingsRaw) throw new Error('AI Provider settings missing. Please configure them on the home page.');
      const settings = JSON.parse(settingsRaw);

      const promptsRaw = localStorage.getItem('custom_prompts');
      const customPrompts = promptsRaw ? JSON.parse(promptsRaw) : {};

      // 3. Trigger Evaluation API
      const evalRes = await fetch('/api/evaluate-pbi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prdContext,
          breakdownContext,
          codebaseContext,
          settings,
          customPrompts
        })
      });

      const evalData = await evalRes.json();
      if (!evalRes.ok) throw new Error(evalData.error || 'Failed to evaluate PBIs');

      setEnhancedPBIs(evalData.pbis || []);
      setEvaluationComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown evaluation error');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleDemo = () => {
    setIsEvaluating(true);
    setError(null);
    setTimeout(() => {
      setEnhancedPBIs([
        {
          description: "Build the user registration API endpoint",
          functionalReqs: "- Accepts email and password\n- Hashes password using bcrypt\n- Returns JWT token",
          gherkin: "Given a new user with valid email\nWhen they sign up\nThen an account is created",
          agentReviews: [
            { agentName: 'SecBot', role: 'Security', feedback: 'Looks good, but ensure rate limits are in place.' },
            { agentName: 'ArchBot', role: 'Architect', feedback: 'Store the users in the `users` table with a unique constraint on email.' },
            { agentName: 'QABot', role: 'QA', feedback: 'Need to test with empty passwords and invalid email formats.' },
            { agentName: 'LawBot', role: 'Compliance', feedback: 'Ensure we have a checkbox for terms of service consent.' },
            { agentName: 'Pixel', role: 'Frontend', feedback: 'Not applicable. This is purely a backend API ticket, so no React or CSS changes are needed.' },
            { agentName: 'Node', role: 'Backend', feedback: 'I will create the `/api/register` route using Next.js route handlers and the `bcrypt` standard library.' },
          ]
        },
        {
          description: "Implement the Registration UI Form",
          functionalReqs: "- Form with Email and Password inputs\n- Client-side validation for email format\n- Error state handling for API collisions",
          gherkin: "Given I am on the signup page\nWhen I enter an invalid email\nThen I see a red validation error message",
          agentReviews: [
            { agentName: 'SecBot', role: 'Security', feedback: 'Ensure we are not logging passwords in the browser console during error states.' },
            { agentName: 'ArchBot', role: 'Architect', feedback: 'We should use React Hook Form for state management.' },
            { agentName: 'QABot', role: 'QA', feedback: 'Write Cypress tests for the red validation error state.' },
            { agentName: 'LawBot', role: 'Compliance', feedback: 'Include a link to the privacy policy below the submit button.' },
            { agentName: 'Pixel', role: 'Frontend', feedback: 'I will build this using Tailwind classes and Lucide icons for the error alert.' },
            { agentName: 'Node', role: 'Backend', feedback: 'Not applicable. Let the frontend handle the visual state.' },
          ]
        }
      ]);
      setEvaluationComplete(true);
      setIsEvaluating(false);
    }, 2000);
  };

  const handleExportAzure = async (isDemo = false) => {
    if (!isDemo && (!azureConfig.org || !azureConfig.project || !azureConfig.pat)) {
      alert('Please fill out all Azure DevOps configuration fields.');
      return;
    }
    
    setIsExporting(true);
    setExportSuccessUrl('');
    
    try {
      const res = await fetch('/api/azure/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pbis: enhancedPBIs, 
          config: isDemo ? { demo: true } : azureConfig,
          prdContext,
          breakdownContext
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setExportSuccessUrl(data.url);
      } else {
        alert(data.error || 'Failed to export to Azure DevOps');
      }
    } catch (e: any) {
      alert(e.message || 'An error occurred during export');
    } finally {
      setIsExporting(false);
    }
  };

  if (!evaluationComplete && !isEvaluating) {
    return (
      <div className="swarm-setup">
        <h3 className="tab-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Network size={20} /> Swarm Evaluation
        </h3>
        <p className="tab-desc">
          Provide a local repository to give the swarm architectural and codebase context before evaluating the breakdown and writing Gherkin PBIs.
        </p>
        
        <div style={{ background: 'var(--color-surface-sunken)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginTop: '16px' }}>
          <label className="fetch-card-label" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Local Codebase Path (Absolute)</label>
          <div className="fetch-input-row">
            <input 
              type="text" 
              className="fetch-input" 
              placeholder="/Users/name/Projects/my-app"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
            />
            <button className="fetch-button" style={{ width: 'auto', margin: 0 }} onClick={handleEvaluate} disabled={isEvaluating}>
              Run Swarm
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button 
              className="btn-secondary" 
              style={{ fontSize: '12px', padding: '6px 12px', margin: 0, width: 'auto' }}
              onClick={() => setLocalPath('/Users/patrickditzler/Desktop/Repos/team-prd-review-tool')}
            >
              Use Current Project Path
            </button>
            <button 
              className="btn-secondary" 
              style={{ fontSize: '12px', padding: '6px 12px', margin: 0, width: 'auto' }}
              onClick={handleDemo}
            >
              Quick Demo (Mock Result)
            </button>
          </div>
          {error && <p style={{ color: 'var(--color-error)', fontSize: '13px', marginTop: '8px' }}>{error}</p>}
        </div>
      </div>
    );
  }

  if (isEvaluating) {
    return (
      <div className="swarm-loading" style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
         <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px', margin: '0 auto 16px', borderColor: 'var(--color-primary) transparent var(--color-primary) transparent' }} />
         <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>The Swarm is Analyzing...</h3>
         <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>Reading codebase context, generating detailed PBIs with Gherkin scenarios, and consulting the Security, Architect, QA, Legal, Frontend, and Backend agents.</p>
         <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '24px', color: 'var(--color-border-hover)' }}>
           <Shield className="pulse-anim" /> <Ruler className="pulse-anim" style={{ animationDelay: '0.2s' }} /> <FlaskConical className="pulse-anim" style={{ animationDelay: '0.4s' }} /> <Gavel className="pulse-anim" style={{ animationDelay: '0.6s' }} /> <LayoutTemplate className="pulse-anim" style={{ animationDelay: '0.8s' }} /> <Database className="pulse-anim" style={{ animationDelay: '1.0s' }} />
         </div>
      </div>
    );
  }

  return (
    <div className="swarm-results">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
         <CheckCircle size={24} color="var(--color-success)" />
         <h3 style={{ margin: 0, fontSize: '20px' }}>Swarm Evaluation Complete</h3>
      </div>
      
      {enhancedPBIs.length === 0 ? (
        <p>No PBIs generated. Please try again with different context.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {enhancedPBIs.map((pbi, i) => (
             <div key={i} className="review-card pbi-card" style={{ border: '1px solid var(--color-primary-muted)', overflow: 'hidden' }}>
               <div className="review-card-header" style={{ background: 'var(--color-surface-sunken)'}}>
                 <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>PBI {i + 1}</h4>
                 <div style={{ display: 'flex', gap: '8px' }}>
                    {editingPbiIndex === i ? (
                       <button className="btn-primary" style={{ padding: '4px 12px', fontSize: '12px', width: 'auto', margin: 0 }} onClick={() => setEditingPbiIndex(null)}>
                         Save Edits
                       </button>
                    ) : (
                       <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px', width: 'auto', margin: 0 }} onClick={() => setEditingPbiIndex(i)}>
                         Edit PBI
                       </button>
                    )}
                 </div>
               </div>
               <div className="review-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                 
                 {/* Top Block: PBI Content */}
                 <div className="pbi-content" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '24px' }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                     <div>
                       <h5 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.5px' }}>Description & Scope</h5>
                       {editingPbiIndex === i ? (
                         <textarea 
                           className="form-textarea" 
                           style={{ width: '100%', minHeight: '80px', fontSize: '13px' }} 
                           value={pbi.description} 
                           onChange={(e) => handlePbiEditChange(i, 'description', e.target.value)}
                         />
                       ) : (
                         <div className="markdown-body" style={{ fontSize: '14px' }}>
                           <ReactMarkdown>{pbi.description}</ReactMarkdown>
                         </div>
                       )}
                     </div>
                     
                     <div>
                       <h5 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.5px' }}>Functional Requirements</h5>
                       {editingPbiIndex === i ? (
                         <textarea 
                           className="form-textarea" 
                           style={{ width: '100%', minHeight: '120px', fontSize: '13px' }} 
                           value={pbi.functionalReqs} 
                           onChange={(e) => handlePbiEditChange(i, 'functionalReqs', e.target.value)}
                         />
                       ) : (
                         <div className="markdown-body" style={{ fontSize: '14px' }}>
                           <ReactMarkdown>{pbi.functionalReqs}</ReactMarkdown>
                         </div>
                       )}
                     </div>
                   </div>

                   <div>
                     <h5 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.5px' }}>Acceptance Criteria (Gherkin)</h5>
                     {editingPbiIndex === i ? (
                       <textarea 
                         className="form-textarea" 
                         style={{ width: '100%', minHeight: '150px', fontSize: '13px', fontFamily: 'monospace', background: '#1e1e1e', color: '#d4d4d4', height: '100%' }} 
                         value={pbi.gherkin} 
                         onChange={(e) => handlePbiEditChange(i, 'gherkin', e.target.value)}
                       />
                     ) : (
                       <div className="markdown-body gherkin-block" style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'monospace', height: 'calc(100% - 24px)', overflow: 'auto' }}>
                         <ReactMarkdown>{pbi.gherkin}</ReactMarkdown>
                       </div>
                     )}
                   </div>
                 </div>

                 {/* Bottom Block: Agent Swarm Feedback */}
                 <div className="swarm-feedback" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '24px', display: 'flex', flexDirection: 'column' }}>
                    <h5 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}><Cpu size={14}/> Swarm Consensus</h5>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '16px' }}>
                      {pbi.agentReviews.map((agent, j) => (
                        <div key={j} className="agent-review" style={{ background: 'var(--color-surface-sunken)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', borderBottom: '1px solid var(--color-border-hover)', paddingBottom: '8px' }}>
                             {agent.role === 'Security' && <Shield size={16} color="var(--color-error)" />}
                             {agent.role === 'Architect' && <Ruler size={16} color="var(--color-primary)" />}
                             {agent.role === 'QA' && <FlaskConical size={16} color="var(--color-warning)" />}
                             {agent.role === 'Compliance' && <Gavel size={16} color="var(--color-success)" />}
                             {agent.role === 'Frontend' && <LayoutTemplate size={16} color="#db2777" />}
                             {agent.role === 'Backend' && <Database size={16} color="#0891b2" />}
                             <span style={{ fontWeight: 600, fontSize: '14px' }}>{agent.agentName}</span>
                             <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '12px', marginLeft: 'auto' }}>{agent.role}</span>
                          </div>
                          <div className="markdown-body" style={{ fontSize: '13px', color: 'var(--color-text)' }}>
                             <ReactMarkdown>{agent.feedback}</ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>

               </div>
             </div>
          ))}
          
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
             <button className="btn-primary" style={{ width: 'auto', background: '#0078D4' }} onClick={() => setShowAzureModal(true)}>
                Export to Azure DevOps
             </button>
          </div>
        </div>
      )}
      
      {showAzureModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '32px', borderRadius: 'var(--radius-lg)', width: '480px', maxWidth: '90%' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Azure DevOps Export</h3>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>Export the PRD as a Feature and these PBIs as linked child work items.</p>
            
            {exportSuccessUrl ? (
               <div className="status-banner status-banner--success" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <CheckCircle className="status-banner-icon" />
                   <span>Export Successful!</span>
                 </div>
                 <a href={exportSuccessUrl} target="_blank" rel="noreferrer" style={{ color: '#0078D4', textDecoration: 'underline' }}>View Feature in Azure DevOps</a>
                 <button className="btn-secondary" style={{ marginTop: '16px' }} onClick={() => setShowAzureModal(false)}>Close</button>
               </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px' }}>Organization Name</label>
                    <input className="form-input" placeholder="e.g. contoso" value={azureConfig.org} onChange={e => setAzureConfig({...azureConfig, org: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px' }}>Project Name</label>
                    <input className="form-input" placeholder="e.g. MyStoreApp" value={azureConfig.project} onChange={e => setAzureConfig({...azureConfig, project: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px' }}>Personal Access Token (PAT)</label>
                    <input type="password" className="form-input" placeholder="Your PAT" value={azureConfig.pat} onChange={e => setAzureConfig({...azureConfig, pat: e.target.value})} />
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                   <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => setShowAzureModal(false)} disabled={isExporting}>Cancel</button>
                   <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => handleExportAzure(true)} disabled={isExporting}>
                     {isExporting ? 'Exporting...' : 'Demo Export (Mock)'}
                   </button>
                   <button className="btn-primary" style={{ width: 'auto', background: '#0078D4' }} onClick={() => handleExportAzure()} disabled={isExporting}>
                     {isExporting ? 'Exporting...' : 'Export'}
                   </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

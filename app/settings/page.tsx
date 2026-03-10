'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import PromptSettings from '@/components/PromptSettings';

export default function SettingsPage() {
  const router = useRouter();
  const [provider, setProvider] = useState('mock');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('llm_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setTimeout(() => {
          if (parsed.provider) setProvider(parsed.provider);
          if (parsed.model) setModel(parsed.model);
          if (parsed.apiKey) setApiKey(parsed.apiKey);
          if (parsed.baseURL) setBaseURL(parsed.baseURL);
        }, 0);
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const settings = { provider, model, apiKey, baseURL };
    localStorage.setItem('llm_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="settings-container">
      <header className="settings-header">
        <button
          className="icon-button back-button"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="settings-title">
            <Settings className="settings-icon" />
            AI Provider Settings
          </h1>
          <p className="settings-subtitle">
            Configure your preferred LLM provider. Keys are stored securely in your browser&apos;s
            local storage.
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <ThemeToggle />
        </div>
      </header>

      <form className="settings-card" onSubmit={handleSave}>
        {saved && (
          <div className="status-banner status-banner--success" role="status">
            <span className="status-banner-icon">✓</span>
            Settings saved successfully!
          </div>
        )}

        <div className="form-group">
          <label htmlFor="provider" className="form-label">
            Provider
          </label>
          <select
            id="provider"
            className="form-select"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="mock">Mock / Demo Mode (No API required)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
            <option value="local">Local (LM Studio / Ollama via OpenAI API)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="apiKey" className="form-label">
            API Key
          </label>
          <input
            id="apiKey"
            type="password"
            className="form-input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === 'local' ? 'Not needed for local models (usually)' : 'sk-...'}
          />
        </div>

        <div className="form-group">
          <label htmlFor="model" className="form-label">
            Model (Optional)
          </label>
          <input
            id="model"
            type="text"
            className="form-input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. gpt-4o, claude-3-7-sonnet-latest"
          />
          <p className="form-hint">Leave blank to use the provider&apos;s default model.</p>
        </div>

        {['openai', 'openrouter', 'local'].includes(provider) && (
          <div className="form-group">
            <label htmlFor="baseURL" className="form-label">
              Base URL (Optional)
            </label>
            <input
              id="baseURL"
              type="text"
              className="form-input"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="e.g. http://localhost:1234/v1"
            />
          </div>
        )}

        <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
          Save Settings
        </button>
      </form>

      <PromptSettings />
    </div>
  );
}

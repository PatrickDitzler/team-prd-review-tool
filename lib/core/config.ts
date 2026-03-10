import { promises as fs } from 'fs';
import path from 'path';
import type { PRDReviewConfig, LLMSettings } from './types';

// ---------------------------------------------------------------------------
// Config file name
// ---------------------------------------------------------------------------

const CONFIG_FILENAME = '.prd-review.json';

// ---------------------------------------------------------------------------
// Load config
// ---------------------------------------------------------------------------

export async function loadConfig(dir?: string): Promise<PRDReviewConfig> {
  const configDir = dir || process.cwd();
  const configPath = path.join(configDir, CONFIG_FILENAME);

  let fileConfig: PRDReviewConfig = {};

  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    fileConfig = JSON.parse(raw);
  } catch {
    // No config file found — that's fine, use defaults
  }

  // Environment variable overrides
  const envOverrides: Partial<PRDReviewConfig> = {};
  if (process.env.PRD_REVIEW_PROVIDER)
    envOverrides.provider = process.env.PRD_REVIEW_PROVIDER as LLMSettings['provider'];
  if (process.env.PRD_REVIEW_API_KEY) envOverrides.apiKey = process.env.PRD_REVIEW_API_KEY;
  if (process.env.PRD_REVIEW_MODEL) envOverrides.model = process.env.PRD_REVIEW_MODEL;
  if (process.env.PRD_REVIEW_BASE_URL) envOverrides.baseURL = process.env.PRD_REVIEW_BASE_URL;
  if (process.env.PRD_REVIEW_CODEBASE_PATH)
    envOverrides.codebasePath = process.env.PRD_REVIEW_CODEBASE_PATH;

  // Azure overrides
  if (
    process.env.PRD_REVIEW_AZURE_ORG ||
    process.env.PRD_REVIEW_AZURE_PROJECT ||
    process.env.PRD_REVIEW_AZURE_PAT
  ) {
    envOverrides.azure = {
      org: process.env.PRD_REVIEW_AZURE_ORG || fileConfig.azure?.org,
      project: process.env.PRD_REVIEW_AZURE_PROJECT || fileConfig.azure?.project,
      pat: process.env.PRD_REVIEW_AZURE_PAT || fileConfig.azure?.pat,
    };
  }

  return { ...fileConfig, ...envOverrides };
}

// ---------------------------------------------------------------------------
// Save config
// ---------------------------------------------------------------------------

export async function saveConfig(config: PRDReviewConfig, dir?: string): Promise<string> {
  const configDir = dir || process.cwd();
  const configPath = path.join(configDir, CONFIG_FILENAME);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  return configPath;
}

// ---------------------------------------------------------------------------
// Resolve effective LLM settings
// ---------------------------------------------------------------------------

export function getEffectiveSettings(config: PRDReviewConfig): LLMSettings {
  return {
    provider: config.provider || 'mock',
    model: config.model || '',
    apiKey: config.apiKey || '',
    baseURL: config.baseURL,
  };
}

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModel } from 'ai';

export interface LLMSettings {
  provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'local' | 'mock';
  model: string;
  apiKey: string;
  baseURL?: string;
}

export function getLLMProvider(settings: LLMSettings): LanguageModel {
  const { provider, model, apiKey, baseURL } = settings;

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey, baseURL });
      return openai(model || 'gpt-4o');
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey, baseURL });
      return anthropic(model || 'claude-3-7-sonnet-latest');
    }
    case 'gemini': {
      const google = createGoogleGenerativeAI({ apiKey, baseURL });
      return google(model || 'gemini-2.5-flash');
    }
    case 'openrouter': {
      const openrouter = createOpenAI({
        apiKey,
        baseURL: baseURL || 'https://openrouter.ai/api/v1',
      });
      return openrouter(model || 'anthropic/claude-3.7-sonnet');
    }
    case 'local': {
      const local = createOpenAI({
        apiKey: apiKey || 'not-needed',
        baseURL: baseURL || 'http://localhost:1234/v1',
      });
      return local(model || 'local-model');
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

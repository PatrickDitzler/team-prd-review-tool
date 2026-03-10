import { Command } from 'commander';
import { select, input, confirm } from '@inquirer/prompts';
import { saveConfig, loadConfig } from '../../lib/core/config';
import { printHeader, printSuccess, printError, printInfo } from '../utils/display';
import type { PRDReviewConfig, LLMSettings } from '../../lib/core/types';

export function registerConfigCommand(program: Command) {
  program
    .command('config')
    .description('Configure LLM provider, API keys, and preferences')
    .option('--show', 'Show current configuration')
    .action(async (options: { show?: boolean }) => {
      try {
        const existing = await loadConfig();

        if (options.show) {
          printHeader('⚙️  Current Configuration');
          console.log(
            JSON.stringify({ ...existing, apiKey: existing.apiKey ? '***' : '' }, null, 2),
          );
          return;
        }

        printHeader('⚙️  PRD Review Tool — Configuration');
        printInfo('This will create/update .prd-review.json in the current directory.');
        console.log('');

        const provider = (await select({
          message: 'LLM Provider:',
          choices: [
            { name: 'Mock / Demo Mode (No API needed)', value: 'mock' },
            { name: 'OpenAI', value: 'openai' },
            { name: 'Anthropic', value: 'anthropic' },
            { name: 'Google Gemini', value: 'gemini' },
            { name: 'OpenRouter', value: 'openrouter' },
            { name: 'Local (LM Studio / Ollama)', value: 'local' },
          ],
          default: existing.provider || 'mock',
        })) as LLMSettings['provider'];

        let apiKey = existing.apiKey || '';
        if (provider !== 'mock') {
          apiKey = await input({
            message: 'API Key:',
            default: apiKey,
          });
        }

        const model = await input({
          message: 'Model (leave blank for default):',
          default: existing.model || '',
        });

        let baseURL = existing.baseURL || '';
        if (['openai', 'openrouter', 'local'].includes(provider)) {
          baseURL = await input({
            message: 'Base URL (leave blank for default):',
            default: baseURL || (provider === 'local' ? 'http://localhost:1234/v1' : ''),
          });
        }

        const codebasePath = await input({
          message: 'Default codebase path (for swarm context):',
          default: existing.codebasePath || process.cwd(),
        });

        // Azure DevOps
        const configureAzure = await confirm({
          message: 'Configure Azure DevOps export?',
          default: false,
        });

        let azure: PRDReviewConfig['azure'] = existing.azure;
        if (configureAzure) {
          const org = await input({ message: 'Azure Organization:', default: azure?.org || '' });
          const project = await input({ message: 'Azure Project:', default: azure?.project || '' });
          const pat = await input({ message: 'Azure PAT:', default: azure?.pat || '' });
          azure = { org, project, pat };
        }

        const config: PRDReviewConfig = {
          provider,
          model: model || undefined,
          apiKey: apiKey || undefined,
          baseURL: baseURL || undefined,
          codebasePath: codebasePath || undefined,
          azure,
          customPrompts: existing.customPrompts,
        };

        const configPath = await saveConfig(config);
        console.log('');
        printSuccess(`Configuration saved to ${configPath}`);
        printInfo('Add .prd-review.json to your .gitignore (it may contain API keys).');
      } catch (err) {
        printError(err instanceof Error ? err.message : 'Config failed');
        process.exit(1);
      }
    });
}

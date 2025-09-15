import { ModelInfo } from './types';

export const MODEL_INFO: Record<string, ModelInfo> = {
  'gemini-flash': {
    api_name: 'google/gemini-2.0-flash-001',
    display_name: 'Gemini',
    company: 'openrouter',
  },
  'claude-3-opus': {
    api_name: 'anthropic/claude-3-opus',
    display_name: 'Claude 3 Opus',
    company: 'openrouter',
  },
  'claude-3.7-sonnet': {
    api_name: 'anthropic/claude-3.7-sonnet',
    display_name: 'Claude 3.7 Sonnet',
    company: 'openrouter',
  },
  'claude-3.5-haiku': {
    api_name: 'anthropic/claude-3.5-haiku',
    display_name: 'Claude 3.5 Haiku',
    company: 'openrouter',
  },
  'chatgpt-4o-latest': {
    api_name: 'openai/chatgpt-4o-latest',
    display_name: 'OpenAI ChatGPT-4o',
    company: 'openrouter',
  },
  '405b-base': {
    api_name: 'meta-llama/Meta-Llama-3.1-405B',
    display_name: 'B-405',
    company: 'hyperbolic_completion',
  },
  '405b-instruct': {
    api_name: 'meta-llama/Meta-Llama-3.1-405B-Instruct',
    display_name: 'I-405',
    company: 'hyperbolic_completion',
  },
  openrouter_custom: {
    api_name: 'custom', // This will be replaced with the actual model ID
    display_name: 'OpenRouter Custom',
    company: 'openrouter',
    is_custom_selector: true,
  },
};

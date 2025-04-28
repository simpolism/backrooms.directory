import { ModelInfo } from './types';

export const MODEL_INFO: Record<string, ModelInfo> = {
  "google/gemini-2.0-flash-001": {
    "api_name": "google/gemini-2.0-flash-001",
    "display_name": "Gemini", // This will be updated by the new naming logic
    "company": "openrouter",
  },
  "anthropic/claude-3-opus": {
    "api_name": "anthropic/claude-3-opus",
    "display_name": "Claude 3 Opus", // This will be updated by the new naming logic
    "company": "openrouter",
  },
  "anthropic/claude-3.7-sonnet": {
    "api_name": "anthropic/claude-3.7-sonnet",
    "display_name": "Claude 3.7 Sonnet", // This will be updated by the new naming logic
    "company": "openrouter",
  },
  "anthropic/claude-3.5-haiku": {
    "api_name": "anthropic/claude-3.5-haiku",
    "display_name": "Claude 3.5 Haiku", // This will be updated by the new naming logic
    "company": "openrouter",
  },
  "openai/chatgpt-4o-latest": {
    "api_name": "openai/chatgpt-4o-latest",
    "display_name": "OpenAI ChatGPT-4o", // This will be updated by the new naming logic
    "company": "openrouter",
  },
  "meta-llama/llama-3.1-405b:free": {
    "api_name": "meta-llama/llama-3.1-405b:free",
    "display_name": "Llama 3.1 405b (free)", // This will be updated by the new naming logic
    "company": "openrouter",
  },
  "openrouter_custom": {
    "api_name": "custom", // This will be replaced with the actual model ID
    "display_name": "OpenRouter Custom",
    "company": "openrouter",
    "is_custom_selector": true
  },
};
import { TemplateConfig, Message, CustomTemplate } from './types';
import { MODEL_INFO } from './models';
import { getModelDisplayName } from './utils';

// Custom template storage functions
export function saveCustomTemplate(template: CustomTemplate): void {
  localStorage.setItem('customTemplate', JSON.stringify(template));
}

export function getCustomTemplate(): CustomTemplate | null {
  const stored = localStorage.getItem('customTemplate');
  return stored ? JSON.parse(stored) : null;
}

export function clearCustomTemplate(): void {
  localStorage.removeItem('customTemplate');
}

export async function loadTemplate(
  templateName: string,
  models: string[]
): Promise<TemplateConfig[]> {
  try {
    let text: string;

    // Check if this is the custom template
    if (templateName === 'custom') {
      const customTemplate = getCustomTemplate();

      if (!customTemplate) {
        throw new Error('Custom template not found.');
      }

      text = customTemplate.content;
    } else {
      // Load built-in template
      const response = await fetch(`./public/templates/${templateName}.jsonl`);
      if (!response.ok) {
        throw new Error(`Template '${templateName}' not found.`);
      }
      text = await response.text();
    }
    const lines = text.trim().split('\n');
    const configs: TemplateConfig[] = lines.map((line) => JSON.parse(line));

    const companies: string[] = [];
    const actors: string[] = [];

    for (let i = 0; i < models.length; i++) {
      companies.push(MODEL_INFO[models[i]].company);
      const displayName = getModelDisplayName(
        models[i],
        i,
        MODEL_INFO[models[i]]
      );
      actors.push(`${displayName} ${i + 1}`);
    }

    for (let i = 0; i < configs.length; i++) {
      // Format system prompts and context with actor and company names
      if (configs[i].system_prompt) {
        let formattedPrompt = configs[i].system_prompt;

        // Replace placeholders
        for (let j = 0; j < companies.length; j++) {
          formattedPrompt = formattedPrompt.replace(
            new RegExp(`\\{lm${j + 1}_company\\}`, 'g'),
            companies[j]
          );
          formattedPrompt = formattedPrompt.replace(
            new RegExp(`\\{lm${j + 1}_actor\\}`, 'g'),
            actors[j]
          );
        }

        configs[i].system_prompt = formattedPrompt;
      }

      // Format context messages
      for (const message of configs[i].context) {
        let formattedContent = message.content;

        // Replace placeholders
        for (let j = 0; j < companies.length; j++) {
          formattedContent = formattedContent.replace(
            new RegExp(`\\{lm${j + 1}_company\\}`, 'g'),
            companies[j]
          );
          formattedContent = formattedContent.replace(
            new RegExp(`\\{lm${j + 1}_actor\\}`, 'g'),
            actors[j]
          );
        }

        message.content = formattedContent;
      }

      // OpenAI models need system prompt in a different format
      if (
        models[i] in MODEL_INFO &&
        MODEL_INFO[models[i]].company === 'openai' &&
        configs[i].system_prompt
      ) {
        let systemPromptAdded = false;

        for (const message of configs[i].context) {
          if (message.role === 'user') {
            message.content = `<SYSTEM>${configs[i].system_prompt}</SYSTEM>\n\n${message.content}`;
            systemPromptAdded = true;
            break;
          }
        }

        if (!systemPromptAdded) {
          configs[i].context.push({
            role: 'user',
            content: `<SYSTEM>${configs[i].system_prompt}</SYSTEM>`,
          });
        }
      }
    }

    return configs;
  } catch (error) {
    console.error(`Error loading template: ${error}`);
    throw error;
  }
}

export interface TemplateInfo {
  name: string;
  description: string;
}

export async function getAvailableTemplates(): Promise<TemplateInfo[]> {
  try {
    // In a browser environment, we'd typically have a predefined list or fetch from an API
    // This is a simplified version that could be expanded with backend support
    const response = await fetch('./public/templates/index.json');
    if (!response.ok) {
      throw new Error('Could not fetch template list');
    }

    const data = await response.json();

    // Handle both old and new format for backward compatibility
    if (Array.isArray(data.templates)) {
      // Old format: just an array of template names
      return data.templates.map((name: string) => ({
        name,
        description: '', // No description available
      }));
    } else {
      // New format: object with template names as keys and descriptions as values
      return Object.entries(data.templates).map(([name, description]) => ({
        name,
        description: description as string,
      }));
    }
  } catch (error) {
    console.error('Error fetching templates:', error);
    // Return a default template if fetch fails
    return [{ name: 'example', description: 'Default example template' }];
  }
}

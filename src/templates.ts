import { TemplateConfig, CustomTemplate, CustomTemplateInput } from './types';
import { MODEL_INFO } from './models';
import { getModelDisplayName } from './utils';
import {
  saveTemplate as persistTemplate,
  deleteTemplate,
  getTemplate as fetchStoredTemplate,
  listTemplates,
} from './state/templateStore';
import { StoredTemplate } from './state/schema';

const CUSTOM_TEMPLATE_PREFIX = 'custom:';

function createCustomTemplateId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `custom-${cryptoObj.randomUUID()}`;
  }
  return `custom-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function toCustomTemplate(stored: StoredTemplate): CustomTemplate {
  const rawLastModified = stored.metadata?.lastModified;
  let lastModified = Date.parse(stored.updatedAt);
  if (typeof rawLastModified === 'number') {
    lastModified = rawLastModified;
  } else if (typeof rawLastModified === 'string') {
    const parsed = Date.parse(rawLastModified);
    if (!Number.isNaN(parsed)) {
      lastModified = parsed;
    }
  }

  const createdAtIso = stored.createdAt || stored.updatedAt;
  const createdAtParsed = Date.parse(createdAtIso);
  const createdAt = Number.isNaN(createdAtParsed)
    ? Date.now()
    : createdAtParsed;

  return {
    id: stored.id,
    name: stored.name,
    description: stored.description || '',
    content: stored.content,
    originalName: stored.metadata?.originalName as string | undefined,
    lastModified,
    createdAt,
    stopTokens: Array.isArray(stored.stopTokens)
      ? stored.stopTokens.map((token) => `${token}`)
      : undefined,
  };
}

export function buildCustomTemplateValue(id: string): string {
  return `${CUSTOM_TEMPLATE_PREFIX}${id}`;
}

export function extractCustomTemplateId(value: string): string | null {
  if (!value) {
    return null;
  }

  if (value === 'custom') {
    return 'custom';
  }

  if (value.startsWith(CUSTOM_TEMPLATE_PREFIX)) {
    return value.substring(CUSTOM_TEMPLATE_PREFIX.length);
  }

  return null;
}

export function formatCustomTemplateLabel(template: CustomTemplate): string {
  return template.description
    ? `Custom: ${template.name} - ${template.description}`
    : `Custom: ${template.name}`;
}

export function listCustomTemplates(): CustomTemplate[] {
  return listTemplates()
    .filter((template) => template.source !== 'built-in')
    .map((template) => {
      if (!template.source) {
        // Treat legacy entries without explicit source as custom templates
        return { ...template, source: 'custom' as const };
      }
      return template;
    })
    .filter((template) => template.source === 'custom')
    .map(toCustomTemplate)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCustomTemplate(id: string): CustomTemplate | null {
  const stored = fetchStoredTemplate(id);
  if (!stored || stored.source === 'built-in') {
    return null;
  }
  return toCustomTemplate(stored);
}

export function saveCustomTemplate(
  template: CustomTemplateInput
): CustomTemplate {
  const now = Date.now();
  const id = template.id || createCustomTemplateId();
  const existing = fetchStoredTemplate(id);
  const createdAt = existing?.createdAt || new Date(now).toISOString();

  const storedTemplate: StoredTemplate = {
    id,
    name: template.name,
    description: template.description,
    content: template.content,
    stopTokens: template.stopTokens,
    createdAt,
    updatedAt: new Date(now).toISOString(),
    source: 'custom',
    metadata: {
      ...(existing?.metadata || {}),
      originalName:
        template.originalName ??
        (existing?.metadata?.originalName as string | undefined),
      lastModified: template.lastModified ?? now,
    },
  };

  persistTemplate(storedTemplate);
  return toCustomTemplate(storedTemplate);
}

export function deleteCustomTemplate(id: string): void {
  deleteTemplate(id);
}

export async function loadTemplate(
  templateName: string,
  models: string[]
): Promise<TemplateConfig[]> {
  try {
    let text = '';
    const customTemplateId = extractCustomTemplateId(templateName);

    if (customTemplateId) {
      const customTemplate = getCustomTemplate(customTemplateId);

      if (!customTemplate) {
        throw new Error(`Custom template '${customTemplateId}' not found.`);
      }

      text = customTemplate.content;
    } else {
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

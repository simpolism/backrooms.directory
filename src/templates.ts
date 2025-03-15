import { TemplateConfig, Message } from './types';
import { MODEL_INFO } from './models';

export async function loadTemplate(
  templateName: string,
  models: string[]
): Promise<TemplateConfig[]> {
  try {
    const response = await fetch(`./templates/${templateName}.jsonl`);
    if (!response.ok) {
      throw new Error(`Template '${templateName}' not found.`);
    }
    
    const text = await response.text();
    const lines = text.trim().split('\n');
    const configs: TemplateConfig[] = lines.map(line => JSON.parse(line));
    
    const companies: string[] = [];
    const actors: string[] = [];
    
    for (let i = 0; i < models.length; i++) {
      if (models[i].toLowerCase() === 'cli') {
        companies.push('CLI');
        actors.push('CLI');
      } else {
        companies.push(MODEL_INFO[models[i]].company);
        actors.push(`${MODEL_INFO[models[i]].display_name} ${i+1}`);
      }
    }
    
    for (let i = 0; i < configs.length; i++) {
      if (models[i].toLowerCase() === 'cli') {
        configs[i].cli = true;
        continue;
      }
      
      // Format system prompts and context with actor and company names
      if (configs[i].system_prompt) {
        let formattedPrompt = configs[i].system_prompt;
        
        // Replace placeholders
        for (let j = 0; j < companies.length; j++) {
          formattedPrompt = formattedPrompt.replace(new RegExp(`\\{lm${j+1}_company\\}`, 'g'), companies[j]);
          formattedPrompt = formattedPrompt.replace(new RegExp(`\\{lm${j+1}_actor\\}`, 'g'), actors[j]);
        }
        
        configs[i].system_prompt = formattedPrompt;
      }
      
      // Format context messages
      for (const message of configs[i].context) {
        let formattedContent = message.content;
        
        // Replace placeholders
        for (let j = 0; j < companies.length; j++) {
          formattedContent = formattedContent.replace(new RegExp(`\\{lm${j+1}_company\\}`, 'g'), companies[j]);
          formattedContent = formattedContent.replace(new RegExp(`\\{lm${j+1}_actor\\}`, 'g'), actors[j]);
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
            content: `<SYSTEM>${configs[i].system_prompt}</SYSTEM>`
          });
        }
      }
      
      configs[i].cli = configs[i].cli || false;
    }
    
    return configs;
  } catch (error) {
    console.error(`Error loading template: ${error}`);
    throw error;
  }
}

export async function getAvailableTemplates(): Promise<string[]> {
  try {
    // In a browser environment, we'd typically have a predefined list or fetch from an API
    // This is a simplified version that could be expanded with backend support
    const response = await fetch('./templates/index.json');
    if (!response.ok) {
      throw new Error('Could not fetch template list');
    }
    
    const data = await response.json();
    return data.templates;
  } catch (error) {
    console.error('Error fetching templates:', error);
    // Return a default template if fetch fails
    return ['cli'];
  }
}
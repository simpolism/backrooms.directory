import { StoredTemplate, TEMPLATES_STORAGE_KEY } from './schema';
import { loadFromLocalStorage, saveToLocalStorage } from '../utils';

let cachedTemplates: StoredTemplate[] | null = null;

function readTemplates(): StoredTemplate[] {
  if (cachedTemplates) {
    return cachedTemplates;
  }

  const stored = loadFromLocalStorage(TEMPLATES_STORAGE_KEY, []);
  if (Array.isArray(stored)) {
    cachedTemplates = stored.map((template) => ({ ...template }));
    return cachedTemplates;
  }

  cachedTemplates = [];
  return cachedTemplates;
}

function persist(templates: StoredTemplate[]): void {
  cachedTemplates = [...templates];
  saveToLocalStorage(TEMPLATES_STORAGE_KEY, cachedTemplates);
}

export function listTemplates(): StoredTemplate[] {
  return [...readTemplates()];
}

export function saveTemplate(template: StoredTemplate): void {
  const templates = readTemplates();
  const index = templates.findIndex((item) => item.id === template.id);
  if (index >= 0) {
    templates[index] = { ...template };
  } else {
    templates.push({ ...template });
  }
  persist(templates);
}

export function deleteTemplate(id: string): void {
  const templates = readTemplates().filter((template) => template.id !== id);
  persist(templates);
}

export function getTemplate(id: string): StoredTemplate | null {
  const template = readTemplates().find((item) => item.id === id);
  return template ? { ...template } : null;
}

export function replaceTemplates(templates: StoredTemplate[]): void {
  persist(templates.map((template) => ({ ...template })));
}

import { loadFromLocalStorage, saveToLocalStorage } from '../../utils';

const STORAGE_PREFIX = 'openrouter_custom_model_';

export interface CustomModelSelection {
  id: string;
  name?: string;
}

export function loadCustomModel(index: number): CustomModelSelection | null {
  const raw = loadFromLocalStorage(`${STORAGE_PREFIX}${index}`, null);
  if (!raw) {
    return null;
  }

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as CustomModelSelection;
    } catch (error) {
      console.error('Error parsing stored custom model selection:', error);
      return null;
    }
  }

  if (typeof raw === 'object' && raw !== null) {
    const { id, name } = raw as Partial<CustomModelSelection>;
    return id ? { id, name } : null;
  }

  return null;
}

export function saveCustomModel(
  index: number,
  selection: CustomModelSelection
): void {
  saveToLocalStorage(`${STORAGE_PREFIX}${index}`, selection);
}

export function clearCustomModel(index: number): void {
  saveToLocalStorage(`${STORAGE_PREFIX}${index}`, null);
}

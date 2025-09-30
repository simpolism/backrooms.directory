/* eslint-env browser */

const STORAGE_PREFIX = 'openrouter_custom_model_';

export interface CustomModelSelection {
  id: string;
  name?: string;
}

type BrowserStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const storage: BrowserStorage | null =
  typeof globalThis !== 'undefined' &&
  Object.prototype.hasOwnProperty.call(globalThis, 'localStorage')
    ? (globalThis as unknown as { localStorage: BrowserStorage }).localStorage
    : null;

function read(key: string): unknown {
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    globalThis.console?.error?.(
      'Error reading custom model from storage:',
      error
    );
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (!storage) {
    return;
  }

  try {
    if (value === null) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    globalThis.console?.error?.(
      'Error writing custom model to storage:',
      error
    );
  }
}

export function loadCustomModel(index: number): CustomModelSelection | null {
  const raw = read(`${STORAGE_PREFIX}${index}`);
  if (!raw) {
    return null;
  }

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as CustomModelSelection;
    } catch (error) {
      globalThis.console?.error?.(
        'Error parsing stored custom model selection:',
        error
      );
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
  write(`${STORAGE_PREFIX}${index}`, selection);
}

export function clearCustomModel(index: number): void {
  write(`${STORAGE_PREFIX}${index}`, null);
}

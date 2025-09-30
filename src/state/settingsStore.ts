import { SETTINGS_STORAGE_KEY, StoredSettings } from './schema';
import { loadFromLocalStorage, saveToLocalStorage } from '../utils';

type SettingsListener = (settings: StoredSettings) => void;

const DEFAULT_SETTINGS: StoredSettings = {
  modelSelections: [],
  outputFontSize: 12,
  outputWordWrap: true,
  outputAutoScroll: true,
  maxTokensPerModel: {},
  exploreModeSettings: {},
  collapsedPanels: {},
};

let cachedSettings: StoredSettings | null = null;
const listeners = new Set<SettingsListener>();

function readSettings(): StoredSettings {
  const existing = cachedSettings;
  if (existing) {
    return existing;
  }

  const stored = loadFromLocalStorage(SETTINGS_STORAGE_KEY, null);
  if (stored && typeof stored === 'object') {
    const merged: StoredSettings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      maxTokensPerModel: {
        ...DEFAULT_SETTINGS.maxTokensPerModel,
        ...(stored.maxTokensPerModel || {}),
      },
      exploreModeSettings: {
        ...DEFAULT_SETTINGS.exploreModeSettings,
        ...(stored.exploreModeSettings || {}),
      },
      collapsedPanels: {
        ...DEFAULT_SETTINGS.collapsedPanels,
        ...(stored.collapsedPanels || {}),
      },
    };
    cachedSettings = merged;
    return merged;
  }

  const defaults: StoredSettings = { ...DEFAULT_SETTINGS };
  cachedSettings = defaults;
  return defaults;
}

function persist(settings: StoredSettings): void {
  cachedSettings = { ...settings };
  saveToLocalStorage(SETTINGS_STORAGE_KEY, cachedSettings);
  listeners.forEach((listener) => listener(getSettings()));
}

export function getSettings(): StoredSettings {
  return { ...readSettings() };
}

export function updateSettings(
  update: Partial<StoredSettings>
): StoredSettings {
  const current = readSettings();
  const next: StoredSettings = {
    ...current,
    ...update,
    maxTokensPerModel: {
      ...current.maxTokensPerModel,
      ...(update.maxTokensPerModel || {}),
    },
    exploreModeSettings: {
      ...current.exploreModeSettings,
      ...(update.exploreModeSettings || {}),
    },
    collapsedPanels: {
      ...current.collapsedPanels,
      ...(update.collapsedPanels || {}),
    },
  };

  persist(next);
  return getSettings();
}

export function subscribeToSettings(listener: SettingsListener): () => void {
  listeners.add(listener);
  listener(getSettings());
  return () => listeners.delete(listener);
}

export function resetSettings(): void {
  persist({ ...DEFAULT_SETTINGS });
}

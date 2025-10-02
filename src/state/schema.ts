import { ExploreModeSettings } from '../types';

export const SETTINGS_STORAGE_KEY = 'backrooms.settings.v1';
export const TEMPLATES_STORAGE_KEY = 'backrooms.templates.v1';

export interface StoredSettings {
  hyperbolicApiKey?: string;
  openrouterApiKey?: string;
  selectedTemplate?: string;
  modelSelections: string[];
  seed?: string;
  outputFontSize?: number;
  outputWordWrap?: boolean;
  outputAutoScroll?: boolean;
  maxTokensPerModel?: Record<number, number>;
  exploreModeSettings?: ExploreModeSettings;
  collapsedPanels?: Record<string, boolean>;
}

export interface StoredTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  stopTokens?: string[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  source?: 'built-in' | 'custom';
  metadata?: Record<string, unknown>;
}

import { Message, ConversationUsage, ExploreModeSettings } from '../types';

export const SETTINGS_STORAGE_KEY = 'backrooms.settings.v1';
export const TEMPLATES_STORAGE_KEY = 'backrooms.templates.v1';
export const CONVERSATIONS_STORAGE_KEY = 'backrooms.conversations.v1';

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

export interface ConversationSnapshot {
  id: string;
  label?: string;
  models: string[];
  systemPrompts: (string | null)[];
  contexts: Message[][];
  usage?: ConversationUsage;
  templateName?: string;
  seed?: number;
  currentTurn: number;
  maxTurns: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StoredState {
  settings: StoredSettings;
  templates: StoredTemplate[];
  conversations: ConversationSnapshot[];
}

export const CURRENT_SNAPSHOT_VERSION = 1;

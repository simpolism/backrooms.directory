import {
  ConversationSnapshot,
  CONVERSATIONS_STORAGE_KEY,
  CURRENT_SNAPSHOT_VERSION,
} from './schema';
import { loadFromLocalStorage, saveToLocalStorage } from '../utils';

let cachedSnapshots: ConversationSnapshot[] | null = null;

function readSnapshots(): ConversationSnapshot[] {
  if (cachedSnapshots) {
    return cachedSnapshots;
  }

  const stored = loadFromLocalStorage(CONVERSATIONS_STORAGE_KEY, []);
  if (Array.isArray(stored)) {
    cachedSnapshots = stored.map((snapshot) => ({
      ...snapshot,
      version: snapshot.version ?? CURRENT_SNAPSHOT_VERSION,
    }));
    return cachedSnapshots;
  }

  cachedSnapshots = [];
  return cachedSnapshots;
}

function persist(snapshots: ConversationSnapshot[]): void {
  cachedSnapshots = [...snapshots];
  saveToLocalStorage(CONVERSATIONS_STORAGE_KEY, cachedSnapshots);
}

export function listConversationSnapshots(): ConversationSnapshot[] {
  return [...readSnapshots()];
}

export function saveConversationSnapshot(snapshot: ConversationSnapshot): void {
  const snapshots = readSnapshots();
  const index = snapshots.findIndex((item) => item.id === snapshot.id);
  if (index >= 0) {
    snapshots[index] = { ...snapshot, version: CURRENT_SNAPSHOT_VERSION };
  } else {
    snapshots.push({ ...snapshot, version: CURRENT_SNAPSHOT_VERSION });
  }
  persist(snapshots);
}

export function deleteConversationSnapshot(id: string): void {
  const snapshots = readSnapshots().filter((snapshot) => snapshot.id !== id);
  persist(snapshots);
}

export function getConversationSnapshot(
  id: string
): ConversationSnapshot | null {
  const snapshot = readSnapshots().find((item) => item.id === id);
  return snapshot ? { ...snapshot } : null;
}

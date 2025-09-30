import { Conversation } from '../../conversation';
import { SelectionCallback } from '../../types';

export interface ConversationUIState {
  startButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  resumeButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  maxTurnsInput: HTMLInputElement;
  seedInput: HTMLInputElement;
  loadButton: HTMLButtonElement;
  modelSelectsContainer: HTMLElement;
  templateSelect: HTMLSelectElement;
}

export type ConversationCompletionReason =
  | { status: 'stopped'; reason?: string }
  | { status: 'completed' }
  | { status: 'error'; error: unknown };

export interface ConversationLifecycleHooks {
  onStart?: () => void;
  onBeforeStart?: () => void;
  onAfterStart?: () => void;
  onComplete?: (result: ConversationCompletionReason) => void;
}

export interface ConversationLifecycleController {
  start(factory: () => Promise<Conversation>): Promise<ConversationCompletionReason>;
  stop(reason?: string): void;
  pause(): void;
  resume(): void;
  isRunning(): boolean;
  getActiveConversation(): Conversation | null;
  setSelectionCallback(callback: SelectionCallback | null): void;
}

interface InternalState {
  conversation: Conversation | null;
  running: boolean;
  selectionCallback: SelectionCallback | null;
  completionReason: ConversationCompletionReason | null;
}

export function createConversationLifecycleController(
  ui: ConversationUIState,
  hooks: ConversationLifecycleHooks = {}
): ConversationLifecycleController {
  const state: InternalState = {
    conversation: null,
    running: false,
    selectionCallback: null,
    completionReason: null,
  };

  function setRunning(running: boolean) {
    state.running = running;
    ui.startButton.textContent = running ? 'Stop Conversation' : 'Start Conversation';
    ui.startButton.classList.toggle('stop', running);
  }

  function toggleConfiguration(disabled: boolean) {
    ui.maxTurnsInput.disabled = disabled;
    ui.seedInput.disabled = disabled;
    ui.loadButton.disabled = disabled;
    ui.modelSelectsContainer
      .querySelectorAll<HTMLSelectElement>('.model-select')
      .forEach((select) => {
        select.disabled = disabled;
      });
    ui.templateSelect.disabled = disabled;
  }

  function updatePauseResume(pauseVisible: boolean, resumeVisible: boolean) {
    ui.pauseButton.style.display = pauseVisible ? 'inline-block' : 'none';
    ui.resumeButton.style.display = resumeVisible ? 'inline-block' : 'none';
  }

  async function runConversation(factory: () => Promise<Conversation>): Promise<void> {
    toggleConfiguration(true);
    ui.exportButton.style.display = 'none';
    updatePauseResume(true, false);
    state.completionReason = null;
    hooks.onBeforeStart?.();
    try {
      state.conversation = await factory();
      if (state.selectionCallback && state.conversation.setSelectionCallback) {
        state.conversation.setSelectionCallback(state.selectionCallback);
      }

      setRunning(true);
      hooks.onAfterStart?.();

      await state.conversation.start();

      if (!state.completionReason) {
        state.completionReason = { status: 'completed' };
      }
    } catch (error) {
      if (!state.completionReason) {
        state.completionReason = { status: 'error', error };
      }
      throw error;
    } finally {
      setRunning(false);
      toggleConfiguration(false);
      updatePauseResume(false, false);
      ui.exportButton.style.display = 'block';
      state.conversation = null;
    const completion = state.completionReason || { status: 'completed' };
    hooks.onComplete?.(completion);
    state.completionReason = null;
  }
}

function stopConversation(reason?: string) {
  if (!state.conversation) {
    return;
  }
  state.completionReason = { status: 'stopped', reason };
    state.conversation.stop();
    setRunning(false);
    toggleConfiguration(false);
    updatePauseResume(false, false);
    ui.exportButton.style.display = 'block';
    state.conversation = null;
  }

  return {
    async start(factory) {
      if (state.running) {
        return { status: 'stopped', reason: 'already running' } as ConversationCompletionReason;
      }
      try {
        await runConversation(factory);
        return state.completionReason || { status: 'completed' };
      } catch (error) {
        return state.completionReason || { status: 'error', error };
      }
    },
    stop(reason) {
      stopConversation(reason);
    },
    pause() {
      if (state.conversation && state.running) {
        state.conversation.pause();
        updatePauseResume(false, true);
      }
    },
    resume() {
      if (state.conversation && state.running) {
        state.conversation.resume();
        updatePauseResume(true, false);
      }
    },
    isRunning() {
      return state.running;
    },
    getActiveConversation() {
      return state.conversation;
    },
    setSelectionCallback(callback) {
      state.selectionCallback = callback;
      if (state.conversation && state.conversation.setSelectionCallback) {
        state.conversation.setSelectionCallback(callback);
      }
    },
  };
}

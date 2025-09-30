import { ExploreModeSettings } from '../../types';

interface ExploreOutputPayload {
  responseId: string;
  actor: string;
  content: string;
  isSelected?: boolean;
}

export interface ExploreModeController {
  renderOutput(payload: ExploreOutputPayload): void;
  clearOutputs(): void;
  updatePresentation(): void;
  updateVisibility(settings: ExploreModeSettings): void;
  handleUserSelection(responseId: string): void;
  confirmSelection(responseId: string): void;
  hasOutputs(): boolean;
}

interface ExploreModeControllerOptions {
  container: HTMLDivElement;
  outputsContainer: HTMLDivElement;
  getFontSize: () => number;
  isWordWrapEnabled: () => boolean;
  onSelect: (responseId: string) => void;
}

export function createExploreModeController(
  options: ExploreModeControllerOptions
): ExploreModeController {
  let lastSettings: ExploreModeSettings = {};

  function getOutputs(): NodeListOf<HTMLDivElement> {
    return options.outputsContainer.querySelectorAll<HTMLDivElement>(
      '.explore-output'
    );
  }

  function applyPresentation(element: HTMLElement): void {
    element.style.fontSize = `${options.getFontSize()}px`;
    element.style.whiteSpace = options.isWordWrapEnabled() ? 'pre-wrap' : 'pre';
  }

  function ensureOutput(payload: ExploreOutputPayload): HTMLDivElement {
    let output = document.getElementById(payload.responseId) as HTMLDivElement | null;

    if (!output) {
      output = document.createElement('div');
      output.id = payload.responseId;
      output.className = 'explore-output';

      const header = document.createElement('div');
      header.className = 'explore-output-header';

      const actorSpan = document.createElement('span');
      actorSpan.textContent = payload.actor;
      header.appendChild(actorSpan);

      const selectButton = document.createElement('button');
      selectButton.className = 'explore-select-button';
      selectButton.textContent = 'Select';
      selectButton.addEventListener('click', (event) => {
        event.stopPropagation();
        controller.handleUserSelection(payload.responseId);
      });
      header.appendChild(selectButton);

      const contentDiv = document.createElement('div');
      contentDiv.className = 'explore-output-content';
      contentDiv.textContent = payload.content;
      applyPresentation(contentDiv);

      output.appendChild(header);
      output.appendChild(contentDiv);
      output.addEventListener('click', () => {
        controller.handleUserSelection(payload.responseId);
      });

      options.outputsContainer.appendChild(output);
    }

    return output;
  }

  function markSelection(responseId: string): void {
    getOutputs().forEach((element) => {
      if (element.id === responseId) {
        element.classList.add('selected');
      } else {
        element.classList.remove('selected');
      }
    });
  }

  const controller: ExploreModeController = {
    renderOutput(payload) {
      const output = ensureOutput(payload);
      const contentDiv = output.querySelector(
        '.explore-output-content'
      ) as HTMLDivElement;
      contentDiv.textContent = payload.content;
      applyPresentation(contentDiv);

      if (payload.isSelected) {
        output.classList.add('selected');
      } else {
        output.classList.remove('selected');
      }

      controller.updateVisibility(lastSettings);
    },
    clearOutputs() {
      options.outputsContainer.innerHTML = '';
      controller.updateVisibility(lastSettings);
    },
    updatePresentation() {
      getOutputs().forEach((element) => {
        const contentDiv = element.querySelector(
          '.explore-output-content'
        ) as HTMLDivElement | null;
        if (contentDiv) {
          applyPresentation(contentDiv);
        }
      });
    },
    updateVisibility(settings) {
      lastSettings = { ...settings };
      const isAnyEnabled = Object.values(settings || {}).some(
        (entry) => entry?.enabled
      );
      const showOutputs = controller.hasOutputs();
      options.container.style.display =
        isAnyEnabled || showOutputs ? 'block' : 'none';
    },
    handleUserSelection(responseId) {
      options.onSelect(responseId);
    },
    confirmSelection(responseId) {
      markSelection(responseId);
      controller.clearOutputs();
    },
    hasOutputs() {
      return options.outputsContainer.children.length > 0;
    },
  };

  return controller;
}

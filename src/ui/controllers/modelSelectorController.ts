import { MODEL_INFO } from '../../models';
import {
  getModelDisplayName,
  loadFromLocalStorage,
  saveToLocalStorage,
} from '../../utils';
import { ExploreModeSettings, ModelInfo } from '../../types';
import { ExploreModeController } from './exploreModeController';
import { StoredSettings } from '../../state/schema';
import {
  loadCustomModel,
  saveCustomModel,
  clearCustomModel,
} from '../../persistence/customModels';

interface ApiKeys {
  hyperbolicApiKey: string;
  openrouterApiKey: string;
}

interface ModelSelectorControllerOptions {
  modelInputs: HTMLDivElement;
  templateSelect: HTMLSelectElement;
  hyperbolicKeyInput: HTMLInputElement;
  openrouterKeyInput: HTMLInputElement;
  getSettings: () => StoredSettings;
  updateSettings: (update: Partial<StoredSettings>) => void;
  exploreModeController: ExploreModeController;
  getWordWrap: () => boolean;
  getFontSize: () => number;
  showAuthMessage: (
    message: string,
    isError?: boolean,
    duration?: number
  ) => void;
  addSystemMessage: (message: string) => void;
  getTemplateModelCount: (templateName: string) => Promise<number>;
}

export interface ModelSelectorController {
  renderForTemplate(templateName: string): Promise<void>;
  refreshModelSelects(): void;
  getSelectedModels(): string[];
  getMaxTokensPerModel(): number[];
  getModelCount(): number;
}

interface OpenRouterModelSummary {
  id: string;
  name?: string;
}

export function createModelSelectorController(
  options: ModelSelectorControllerOptions
): ModelSelectorController {
  let currentModelCount = 0;

  function getApiKeys(): ApiKeys {
    return {
      hyperbolicApiKey: options.hyperbolicKeyInput.value,
      openrouterApiKey: options.openrouterKeyInput.value,
    };
  }

  async function fetchOpenRouterModels(
    apiKey: string
  ): Promise<OpenRouterModelSummary[]> {
    if (!apiKey) {
      return [];
    }

    try {
      const cached = loadFromLocalStorage('openrouterModelsCache', null);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (
            parsed.timestamp &&
            Date.now() - parsed.timestamp < 1000 * 60 * 60 * 24
          ) {
            return parsed.models || [];
          }
        } catch (error) {
          console.error('Error parsing cached OpenRouter models:', error);
        }
      }

      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'backrooms.directory',
        },
      });

      if (!response.ok) {
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      saveToLocalStorage(
        'openrouterModelsCache',
        JSON.stringify({ models: data.data, timestamp: Date.now() })
      );
      return data.data;
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      throw error;
    }
  }

  function getSavedModelSelections(): string[] {
    return options.getSettings().modelSelections || [];
  }

  function saveModelSelections(): void {
    const selects =
      options.modelInputs.querySelectorAll<HTMLSelectElement>('.model-select');
    const models = Array.from(selects).map((select) => select.value);
    options.updateSettings({ modelSelections: models });
  }

  async function createOpenRouterAutocomplete(
    select: HTMLSelectElement,
    index: number
  ): Promise<void> {
    const container = document.createElement('div');
    container.id = `openrouter-autocomplete-${index}`;
    container.className = 'openrouter-autocomplete-container';

    const subgroup = document.createElement('div');
    subgroup.className = 'model-input-subgroup';

    const labelElement = document.createElement('label');
    labelElement.textContent = 'OpenRouter:';
    labelElement.setAttribute('for', `openrouter-model-${index}`);

    const input = document.createElement('input');
    input.id = `openrouter-model-${index}`;
    input.type = 'text';
    input.className = 'openrouter-autocomplete-input';
    input.placeholder = 'Search OpenRouter models...';

    const dropdown = document.createElement('div');
    dropdown.className = 'openrouter-autocomplete-dropdown';
    dropdown.style.display = 'none';

    subgroup.appendChild(labelElement);
    subgroup.appendChild(input);
    container.appendChild(subgroup);
    container.appendChild(dropdown);

    const modelInputGroup = select.closest('.model-input-group');
    if (modelInputGroup && modelInputGroup.parentElement) {
      modelInputGroup.parentElement.insertBefore(
        container,
        modelInputGroup.nextSibling
      );
    }

    const savedModel = loadCustomModel(index);
    if (savedModel) {
      input.value = savedModel.name || '';
      input.dataset.id = savedModel.id;
    }

    const models = await fetchOpenRouterModels(getApiKeys().openrouterApiKey);

    const filterModels = (query: string) => {
      dropdown.innerHTML = '';
      dropdown.style.display = 'block';

      const filtered = query
        ? models.filter(
            (model) =>
              model.id.toLowerCase().includes(query.toLowerCase()) ||
              (model.name &&
                model.name.toLowerCase().includes(query.toLowerCase()))
          )
        : models;

      const displayModels = filtered.slice(0, 10);

      if (displayModels.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'openrouter-autocomplete-item';
        noResults.textContent = 'No models found';
        dropdown.appendChild(noResults);
        return;
      }

      displayModels.forEach((model) => {
        const item = document.createElement('div');
        item.className = 'openrouter-autocomplete-item';
        item.textContent = model.name || model.id;
        item.addEventListener('click', () => {
          input.value = model.name || model.id;
          input.dataset.id = model.id;
          saveCustomModel(index, {
            id: model.id,
            name: model.name || model.id,
          });
          dropdown.style.display = 'none';
        });
        dropdown.appendChild(item);
      });
    };

    input.addEventListener('input', () => {
      filterModels(input.value);
    });

    input.addEventListener('focus', () => {
      filterModels(input.value);
    });

    document.addEventListener('click', (event) => {
      if (!container.contains(event.target as Node)) {
        dropdown.style.display = 'none';
      }
    });
  }

  function populateModelSelect(
    select: HTMLSelectElement,
    index: number,
    currentValue: string | null
  ): void {
    const apiKeys = getApiKeys();
    select.innerHTML = '';

    Object.keys(MODEL_INFO).forEach((modelKey) => {
      const modelInfo = MODEL_INFO[modelKey];
      const company = modelInfo.company;

      const option = document.createElement('option');
      option.value = modelKey;

      let apiKeyAvailable = false;
      let apiKeyName = '';

      if (company === 'hyperbolic' || company === 'hyperbolic_completion') {
        apiKeyAvailable = !!apiKeys.hyperbolicApiKey;
        apiKeyName = 'Hyperbolic';
      } else if (company === 'openrouter') {
        apiKeyAvailable = !!apiKeys.openrouterApiKey;
        apiKeyName = 'OpenRouter';
      }

      const displayName = getModelDisplayName(modelKey, index, modelInfo);
      option.textContent = `${displayName} (${modelKey}) - ${apiKeyName}`;

      if (!apiKeyAvailable) {
        option.textContent += ' [API Key Missing]';
        option.style.color = '#999';
      }

      select.appendChild(option);
    });

    if (currentValue) {
      select.value = currentValue;
    } else {
      const savedSelections = getSavedModelSelections();
      if (savedSelections[index]) {
        select.value = savedSelections[index];
      }
    }
  }

  async function renderForTemplate(templateName: string): Promise<void> {
    try {
      const modelCount = await options.getTemplateModelCount(templateName);
      currentModelCount = modelCount;
      const savedModelSelections = getSavedModelSelections();
      const settings = options.getSettings();
      const exploreModeSettings = settings.exploreModeSettings || {};

      options.modelInputs.innerHTML = '';

      for (let i = 0; i < modelCount; i++) {
        const group = document.createElement('div');
        group.className = 'model-input-group';

        const label = document.createElement('label');
        label.setAttribute('for', `model-${i}`);
        label.textContent = `Model ${i + 1}:`;

        const select = document.createElement('select');
        select.id = `model-${i}`;
        select.className = 'model-select';

        group.appendChild(label);
        group.appendChild(select);
        options.modelInputs.appendChild(group);

        const currentValue =
          i < savedModelSelections.length ? savedModelSelections[i] : null;
        populateModelSelect(select, i, currentValue);

        const inputGroupsContainer = document.createElement('div');
        inputGroupsContainer.className = 'input-groups-container';

        const maxTokensGroup = document.createElement('div');
        maxTokensGroup.className = 'max-tokens-input-group';

        const maxTokensLabel = document.createElement('label');
        maxTokensLabel.setAttribute('for', `max-tokens-${i}`);
        maxTokensLabel.textContent = 'Max Completion Tokens:';

        const maxTokensInput = document.createElement('input');
        maxTokensInput.type = 'number';
        maxTokensInput.id = `max-tokens-${i}`;
        maxTokensInput.className = 'max-tokens-input';
        maxTokensInput.min = '0';
        maxTokensInput.max = '1024';
        maxTokensInput.step = '128';
        maxTokensInput.placeholder = '512';

        const savedMaxTokens = settings.maxTokensPerModel?.[i];
        maxTokensInput.value = savedMaxTokens
          ? savedMaxTokens.toString()
          : '512';

        maxTokensInput.addEventListener('change', () => {
          let value = parseInt(maxTokensInput.value, 10);
          value = Math.max(1, Math.min(value, 1024));
          maxTokensInput.value = value.toString();
          options.updateSettings({
            maxTokensPerModel: {
              ...(options.getSettings().maxTokensPerModel || {}),
              [i]: value,
            },
          });
        });

        maxTokensGroup.appendChild(maxTokensLabel);
        maxTokensGroup.appendChild(maxTokensInput);

        const exploreGroup = document.createElement('div');
        exploreGroup.className = 'explore-mode-input-group';

        const exploreLabel = document.createElement('label');
        exploreLabel.textContent = 'Explore Mode:';

        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'toggle-switch';

        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.id = `explore-mode-toggle-${i}`;
        const savedSetting = exploreModeSettings[i];
        toggleInput.checked = savedSetting?.enabled || false;

        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'toggle-slider';

        toggleContainer.appendChild(toggleInput);
        toggleContainer.appendChild(toggleSlider);

        const numRequestsContainer = document.createElement('div');
        numRequestsContainer.className = toggleInput.checked
          ? 'num-requests-container'
          : 'num-requests-container hidden';

        const numRequestsLabel = document.createElement('label');
        numRequestsLabel.textContent = 'Num Choices:';
        numRequestsLabel.setAttribute('for', `explore-mode-num-requests-${i}`);
        numRequestsLabel.style.marginRight = '5px';

        const numRequestsInput = document.createElement('input');
        numRequestsInput.type = 'number';
        numRequestsInput.id = `explore-mode-num-requests-${i}`;
        numRequestsInput.className = 'num-requests-input';
        numRequestsInput.min = '1';
        numRequestsInput.max = '8';
        numRequestsInput.value = (savedSetting?.numRequests || 3).toString();

        numRequestsContainer.appendChild(numRequestsLabel);
        numRequestsContainer.appendChild(numRequestsInput);

        const applyExploreSettings = (
          enabled: boolean,
          numRequests: number
        ) => {
          const nextSettings: ExploreModeSettings = {
            ...(options.getSettings().exploreModeSettings || {}),
            [i]: {
              enabled,
              numRequests,
            },
          };
          options.updateSettings({ exploreModeSettings: nextSettings });
          options.exploreModeController.updateVisibility(nextSettings);
        };

        toggleInput.addEventListener('change', () => {
          if (toggleInput.checked) {
            numRequestsContainer.classList.remove('hidden');
          } else {
            numRequestsContainer.classList.add('hidden');
          }

          const numRequests = parseInt(numRequestsInput.value, 10) || 3;
          applyExploreSettings(toggleInput.checked, numRequests);
        });

        toggleContainer.addEventListener('click', (event) => {
          if (event.target !== toggleInput && !toggleInput.disabled) {
            toggleInput.checked = !toggleInput.checked;
            toggleInput.dispatchEvent(new Event('change'));
          }
        });

        numRequestsInput.addEventListener('change', () => {
          let value = parseInt(numRequestsInput.value, 10);
          value = Math.max(1, Math.min(value, 8));
          numRequestsInput.value = value.toString();
          applyExploreSettings(toggleInput.checked, value);
        });

        exploreGroup.appendChild(exploreLabel);
        exploreGroup.appendChild(toggleContainer);
        exploreGroup.appendChild(numRequestsContainer);

        inputGroupsContainer.appendChild(maxTokensGroup);
        inputGroupsContainer.appendChild(exploreGroup);
        options.modelInputs.appendChild(inputGroupsContainer);

        select.addEventListener('change', () => {
          saveModelSelections();
          const selectedModelKey = select.value;
          const modelInfo: ModelInfo = MODEL_INFO[selectedModelKey];

          const existingAutocomplete = document.getElementById(
            `openrouter-autocomplete-${i}`
          );
          if (existingAutocomplete) {
            existingAutocomplete.remove();
          }

          clearCustomModel(i);

          if (
            modelInfo &&
            modelInfo.is_custom_selector &&
            getApiKeys().openrouterApiKey
          ) {
            createOpenRouterAutocomplete(select, i).catch((error) => {
              console.error('OpenRouter autocomplete error:', error);
            });
          }
        });

        if (select.value) {
          const modelInfo: ModelInfo = MODEL_INFO[select.value];
          if (
            modelInfo &&
            modelInfo.is_custom_selector &&
            getApiKeys().openrouterApiKey
          ) {
            createOpenRouterAutocomplete(select, i).catch((error) => {
              console.error('OpenRouter autocomplete error:', error);
            });
          }
        }
      }

      options.exploreModeController.updateVisibility(exploreModeSettings);
    } catch (error) {
      const message = `Error: ${error instanceof Error ? error.message : String(error)}`;
      if (message.toLowerCase().includes('openrouter')) {
        options.showAuthMessage(message, true);
      } else {
        options.addSystemMessage(message);
      }
    }
  }

  function refreshModelSelects(): void {
    const selects =
      options.modelInputs.querySelectorAll<HTMLSelectElement>('.model-select');
    selects.forEach((select, index) => {
      const currentValue = select.value;
      populateModelSelect(select, index, currentValue);
    });
  }

  function getSelectedModels(): string[] {
    const selects =
      options.modelInputs.querySelectorAll<HTMLSelectElement>('.model-select');
    return Array.from(selects).map((select) => select.value);
  }

  function getMaxTokensPerModel(): number[] {
    const inputs =
      options.modelInputs.querySelectorAll<HTMLInputElement>(
        '.max-tokens-input'
      );
    return Array.from(inputs).map((input) => {
      const value = parseInt(input.value, 10);
      if (Number.isNaN(value)) {
        return 512;
      }
      return Math.max(1, Math.min(value, 1024));
    });
  }

  return {
    renderForTemplate,
    refreshModelSelects,
    getSelectedModels,
    getMaxTokensPerModel,
    getModelCount: () => currentModelCount,
  };
}

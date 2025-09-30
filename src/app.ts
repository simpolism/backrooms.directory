import './styles'; // Import styles so webpack can process them
import { MODEL_INFO } from './models';
import { Conversation } from './conversation';
import {
  loadTemplate,
  getAvailableTemplates,
  saveCustomTemplate,
  getCustomTemplate,
  clearCustomTemplate,
} from './templates';
import {
  generateDistinctColors,
  getRgbColor,
  saveToLocalStorage,
  loadFromLocalStorage,
} from './utils';
import { ApiKeys, SelectionCallback } from './types';
import {
  initiateOAuthFlow,
  handleOAuthCallback,
  getAuthorizationCode,
} from './oauth';
import {
  getSettings,
  updateSettings,
  subscribeToSettings,
} from './state/settingsStore';
import {
  createUsageController,
  UsageElements,
  UsageController,
} from './ui/controllers/usageController';
import { createExploreModeController } from './ui/controllers/exploreModeController';
import { createModelSelectorController } from './ui/controllers/modelSelectorController';
import type { ModelSelectorController } from './ui/controllers/modelSelectorController';
import {
  createConversationLifecycleController,
  ConversationLifecycleController,
} from './ui/controllers/conversationController';
import {
  parseConversationLog,
  extractConversationLogFromDom,
  formatConversationLog,
} from './ui/persistence/conversationLog';
import { loadCustomModel } from './ui/persistence/customModels';
import { initializeTemplateEditor } from './ui/controllers/templateEditorController';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI elements
  const templateSelect = document.getElementById(
    'template-select'
  ) as HTMLSelectElement;
  const maxTurnsInput = document.getElementById(
    'max-turns'
  ) as HTMLInputElement;
  const seedInput = document.getElementById('seed') as HTMLInputElement;
  const startButton = document.getElementById(
    'start-conversation'
  ) as HTMLButtonElement;
  const exportButton = document.getElementById(
    'export-conversation'
  ) as HTMLButtonElement;
  const conversationOutput = document.getElementById(
    'conversation-output'
  ) as HTMLDivElement;
  const modelInputs = document.getElementById('model-inputs') as HTMLDivElement;
  const exploreModeContainer = document.getElementById(
    'explore-mode-container'
  ) as HTMLDivElement;
  const exploreModeOutputs = document.getElementById(
    'explore-mode-outputs'
  ) as HTMLDivElement;

  // Create load conversation button and file input
  const loadButton = document.createElement('button');
  loadButton.id = 'load-conversation';
  loadButton.textContent = 'Select Conversation File';
  loadButton.className = 'control-button';

  // Create hidden file input for loading conversation
  const loadFileInput = document.createElement('input');
  loadFileInput.type = 'file';
  loadFileInput.id = 'load-conversation-file';
  loadFileInput.accept = '.txt';
  loadFileInput.style.display = 'none';

  // Usage statistics UI elements
  const usageStats = document.getElementById('usage-stats') as HTMLDivElement;
  const totalInputTokensSpan = document.getElementById(
    'total-input-tokens'
  ) as HTMLSpanElement;
  const totalOutputTokensSpan = document.getElementById(
    'total-output-tokens'
  ) as HTMLSpanElement;
  const totalTokensSpan = document.getElementById(
    'total-tokens'
  ) as HTMLSpanElement;
  const totalCostSpan = document.getElementById(
    'total-cost'
  ) as HTMLSpanElement;
  const usageBreakdown = document.getElementById(
    'usage-breakdown'
  ) as HTMLDivElement;

  const usageElements: UsageElements = {
    usageStats,
    totalInputTokens: totalInputTokensSpan,
    totalOutputTokens: totalOutputTokensSpan,
    totalTokens: totalTokensSpan,
    totalCost: totalCostSpan,
    usageBreakdown,
  };
  const usageController: UsageController = createUsageController(usageElements);
  usageController.reset();

  let settings = getSettings();
  const unsubscribeSettings = subscribeToSettings((nextSettings) => {
    settings = nextSettings;
  });
  let modelController: ModelSelectorController | null = null;
  let conversationLifecycle: ConversationLifecycleController | null = null;

  // Font size and word wrap controls
  const decreaseFontSizeBtn = document.getElementById(
    'decrease-font-size'
  ) as HTMLButtonElement;
  const increaseFontSizeBtn = document.getElementById(
    'increase-font-size'
  ) as HTMLButtonElement;
  const currentFontSizeSpan = document.getElementById(
    'current-font-size'
  ) as HTMLSpanElement;
  const wordWrapToggle = document.getElementById(
    'word-wrap-toggle'
  ) as HTMLInputElement;

  let currentFontSize = settings.outputFontSize ?? 12;

  // Initialize collapsible sections
  const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
  collapsibleHeaders.forEach((header) => {
    const section = header.closest('.collapsible-section');
    if (!section) return;

    // Get section ID or create one based on its content
    const sectionId =
      section.id ||
      header
        .querySelector('h2')
        ?.textContent?.toLowerCase()
        .replace(/\s+/g, '-') ||
      'section-' + Math.random().toString(36).substring(2, 9);

    // Set ID if not already set
    if (!section.id) {
      section.id = sectionId;
    }

    // Load saved collapse state
    const savedState = loadFromLocalStorage(`collapse-${sectionId}`, null);
    if (savedState !== null) {
      if (savedState === 'true') {
        section.classList.add('collapsed');
      } else {
        section.classList.remove('collapsed');
      }
    } else {
      // Set default states for sections
      if (
        sectionId === 'settings' ||
        sectionId === 'output-settings' ||
        sectionId === 'api-keys'
      ) {
        // Settings panel, output settings, and API keys should be open by default
        section.classList.remove('collapsed');
      } else if (sectionId === 'template-editor') {
        // Template editor should be closed by default
        section.classList.add('collapsed');
      }
    }

    header.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      // Save collapse state
      saveToLocalStorage(
        `collapse-${sectionId}`,
        section.classList.contains('collapsed').toString()
      );
    });
  });

  const exploreModeController = createExploreModeController({
    container: exploreModeContainer,
    outputsContainer: exploreModeOutputs,
    getFontSize: () => currentFontSize,
    isWordWrapEnabled: () => wordWrapToggle.checked,
    onSelect: (responseId) => {
      conversationLifecycle
        ?.getActiveConversation()
        ?.handleSelection(responseId);
    },
  });
  exploreModeController.updateVisibility(settings.exploreModeSettings || {});

  // API key input elements
  const hyperbolicKeyInput = document.getElementById(
    'hyperbolic-key'
  ) as HTMLInputElement;
  const openrouterKeyInput = document.getElementById(
    'openrouter-key'
  ) as HTMLInputElement;
  const openrouterOAuthButton = document.getElementById(
    'openrouter-oauth-button'
  ) as HTMLButtonElement;

  // Create a container for OpenRouter auth messages
  const openrouterAuthContainer = document.createElement('div');
  openrouterAuthContainer.className = 'auth-message-container';
  openrouterAuthContainer.style.display = 'none';
  openrouterAuthContainer.style.marginTop = '15px';
  openrouterAuthContainer.style.marginBottom = '10px';
  openrouterAuthContainer.style.padding = '8px 10px';
  openrouterAuthContainer.style.border = '1px solid #000000';
  openrouterAuthContainer.style.fontSize = '14px';
  openrouterAuthContainer.style.fontFamily = 'Times New Roman, serif';
  openrouterAuthContainer.style.textAlign = 'center';
  openrouterAuthContainer.style.transition = 'opacity 0.3s ease';
  openrouterAuthContainer.style.width = '100%';
  openrouterAuthContainer.style.boxSizing = 'border-box';

  // Find the parent container of the OAuth button's parent
  // This places the message in a more appropriate location in the hierarchy
  const openrouterOAuthParent = openrouterOAuthButton.closest('.input-group');
  if (openrouterOAuthParent && openrouterOAuthParent.parentElement) {
    // Insert after the input group containing the OAuth button
    openrouterOAuthParent.parentElement.insertBefore(
      openrouterAuthContainer,
      openrouterOAuthParent.nextSibling
    );
  }

  // Load saved API keys if available
  hyperbolicKeyInput.value = settings.hyperbolicApiKey || '';
  openrouterKeyInput.value = settings.openrouterApiKey || '';

  // Function to show temporary auth messages
  function showAuthMessage(
    message: string,
    isError: boolean = false,
    duration: number = 5000
  ) {
    // Set message and styling
    openrouterAuthContainer.textContent = message;

    // Apply styling based on message type
    if (isError) {
      openrouterAuthContainer.style.backgroundColor = '#EEEEEE';
      openrouterAuthContainer.style.color = '#FF0000';
    } else {
      openrouterAuthContainer.style.backgroundColor = '#EEEEEE';
      openrouterAuthContainer.style.color = '#000000';
    }

    // Show the message with a fade-in effect
    openrouterAuthContainer.style.opacity = '0';
    openrouterAuthContainer.style.display = 'block';

    // Trigger reflow to ensure transition works
    void openrouterAuthContainer.offsetWidth;
    openrouterAuthContainer.style.opacity = '1';

    // Clear any existing timeout
    const existingTimeout = openrouterAuthContainer.dataset.timeoutId;
    if (existingTimeout) {
      window.clearTimeout(parseInt(existingTimeout));
    }

    // Set timeout to hide the message with fade-out effect
    const timeoutId = window.setTimeout(() => {
      openrouterAuthContainer.style.opacity = '0';

      // After fade-out completes, hide the element
      setTimeout(() => {
        openrouterAuthContainer.style.display = 'none';
      }, 300); // Match the transition duration
    }, duration);

    // Store timeout ID in dataset
    openrouterAuthContainer.dataset.timeoutId = timeoutId.toString();
  }

  // Max output length is now per-model and handled by the model controller

  // Load saved seed if available
  seedInput.value = settings.seed || '';

  // Initialize font size and word wrap with saved values
  currentFontSize = settings.outputFontSize ?? 12;
  currentFontSizeSpan.textContent = `${currentFontSize}px`;
  conversationOutput.style.fontSize = `${currentFontSize}px`;

  // Initialize word wrap with saved value
  wordWrapToggle.checked = settings.outputWordWrap ?? true;
  conversationOutput.style.whiteSpace = wordWrapToggle.checked ? 'pre-wrap' : 'pre';

  // Initialize auto-scroll with saved value
  const autoScrollToggle = document.getElementById(
    'auto-scroll-toggle'
  ) as HTMLInputElement;
  autoScrollToggle.checked = settings.outputAutoScroll ?? true;

  // Save API keys when changed and refresh model selects
  hyperbolicKeyInput.addEventListener('change', () => {
    updateSettings({ hyperbolicApiKey: hyperbolicKeyInput.value });
    modelController?.refreshModelSelects();
  });

  openrouterKeyInput.addEventListener('change', () => {
    updateSettings({ openrouterApiKey: openrouterKeyInput.value });
    modelController?.refreshModelSelects();
  });

  // Handle OpenRouter OAuth button click
  openrouterOAuthButton.addEventListener('click', async () => {
    try {
      // Show loading message
      showAuthMessage('Initiating authentication with OpenRouter...', false);

      // Start the OAuth flow
      await initiateOAuthFlow();
      // The page will be redirected to OpenRouter, so no need to do anything else here
    } catch (error) {
      console.error('Error initiating OAuth flow:', error);
      showAuthMessage(
        `Error initiating OAuth flow: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  });

  // Check if this is a callback from OpenRouter OAuth
  if (
    window.location.search.includes('code=') ||
    window.location.search.includes('error=')
  ) {
    // Show initial processing message
    showAuthMessage('Processing authentication response...', false, 60000);

    // Check for error parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (errorParam) {
      // Handle explicit error from OAuth provider
      console.error('OAuth error:', errorParam, errorDescription);
      showAuthMessage(
        `Authentication denied: ${errorDescription || errorParam}`,
        true,
        10000
      );

      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (getAuthorizationCode()) {
      // Handle the OAuth callback for successful code
      handleOAuthCallback(
        // Success callback
        (apiKey) => {
          // Persist the API key in settings
          updateSettings({ openrouterApiKey: apiKey });

          // Update the input field
          openrouterKeyInput.value = apiKey;

          // Refresh model selects
          modelController?.refreshModelSelects();

          // Show success message
          showAuthMessage(
            'Successfully authenticated with OpenRouter!',
            false,
            8000
          );

          // Clean up the URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        },
        // Error callback
        (error) => {
          console.error('Error handling OAuth callback:', error);
          showAuthMessage(
            `Error authenticating with OpenRouter: ${error.message}`,
            true,
            10000
          );

          // Clean up the URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        }
      );
    }
  }

  // Font size control event handlers
  decreaseFontSizeBtn.addEventListener('click', () => {
    if (currentFontSize > 8) {
      currentFontSize -= 2;
      updateFontSize();
    }
  });

  increaseFontSizeBtn.addEventListener('click', () => {
    if (currentFontSize < 32) {
      currentFontSize += 2;
      updateFontSize();
    }
  });

  // Update font size and save to localStorage
  function updateFontSize() {
    currentFontSizeSpan.textContent = `${currentFontSize}px`;

    // Apply font size to conversation output
    conversationOutput.style.fontSize = `${currentFontSize}px`;

    updateSettings({ outputFontSize: currentFontSize });
    exploreModeController.updatePresentation();
  }

  // Word wrap toggle event handler
  wordWrapToggle.addEventListener('change', () => {
    updateWordWrap();
  });

  // Also add click handler to the toggle switch container for better usability
  const toggleSwitch = wordWrapToggle.closest('.toggle-switch') as HTMLElement;
  if (toggleSwitch) {
    toggleSwitch.addEventListener('click', (e) => {
      // Prevent double triggering when clicking directly on the checkbox
      if (e.target !== wordWrapToggle) {
        wordWrapToggle.checked = !wordWrapToggle.checked;
        updateWordWrap();
      }
    });
  }

  // Update word wrap and save to localStorage
  function updateWordWrap() {
    // Apply word wrap to conversation output
    conversationOutput.style.whiteSpace = wordWrapToggle.checked
      ? 'pre-wrap'
      : 'pre';

    updateSettings({ outputWordWrap: wordWrapToggle.checked });
    exploreModeController.updatePresentation();
  }

  // Auto-scroll toggle event handler
  autoScrollToggle.addEventListener('change', () => {
    updateAutoScroll();
  });

  // Also add click handler to the auto-scroll toggle switch container for better usability
  const autoScrollToggleSwitch = autoScrollToggle.closest(
    '.toggle-switch'
  ) as HTMLElement;
  if (autoScrollToggleSwitch) {
    autoScrollToggleSwitch.addEventListener('click', (e) => {
      // Prevent double triggering when clicking directly on the checkbox
      if (e.target !== autoScrollToggle) {
        autoScrollToggle.checked = !autoScrollToggle.checked;
        updateAutoScroll();
      }
    });
  }

  // Update auto-scroll and save to localStorage
  function updateAutoScroll() {
    updateSettings({ outputAutoScroll: autoScrollToggle.checked });
  }

  // Load saved template selection if available
  const savedTemplateSelection = settings.selectedTemplate || '';

  // Color generator for actors
  const colorGenerator = generateDistinctColors();
  const actorColors: Record<string, string> = {};

  // Get the number of models from the template file
  async function getTemplateModelCount(templateName: string): Promise<number> {
    try {
      let text: string;

      // Check if this is the custom template
      if (templateName === 'custom') {
        const customTemplate = getCustomTemplate();

        if (!customTemplate) {
          throw new Error('Custom template not found.');
        }

        text = customTemplate.content;
      } else {
        // Load built-in template
        const response = await fetch(
          `./public/templates/${templateName}.jsonl`
        );
        if (!response.ok) {
          throw new Error(`Template '${templateName}' not found.`);
        }
        text = await response.text();
      }

      const lines = text.trim().split('\n');
      return lines.length;
    } catch (error) {
      console.error(`Error loading template: ${error}`);
      throw error;
    }
  }

  const exploreSelectionCallback: SelectionCallback = (responseId: string) => {
    exploreModeController.confirmSelection(responseId);
    exploreModeController.updateVisibility(settings.exploreModeSettings || {});
  };

  modelController = createModelSelectorController({
    modelInputs,
    templateSelect,
    hyperbolicKeyInput,
    openrouterKeyInput,
    getSettings: () => settings,
    updateSettings,
    exploreModeController,
    getWordWrap: () => wordWrapToggle.checked,
    getFontSize: () => currentFontSize,
    showAuthMessage,
    addSystemMessage: (message: string) => addOutputMessage('System', message),
    getTemplateModelCount,
  });

  // Populate template select
  async function populateTemplateSelect() {
    try {
      const templates = await getAvailableTemplates();
      templateSelect.innerHTML = '';

      templates.forEach((template) => {
        const option = document.createElement('option');
        option.value = template.name;
        // Show both name and description in the dropdown
        option.textContent = template.description
          ? `${template.name} - ${template.description}`
          : template.name;
        templateSelect.appendChild(option);
      });

      // Check if custom template exists and add it to the dropdown
      const customTemplate = getCustomTemplate();
      if (customTemplate) {
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        // Show both name and description for custom template
        customOption.textContent = customTemplate.description
          ? `Custom: ${customTemplate.name} - ${customTemplate.description}`
          : `Custom: ${customTemplate.name}`;
        templateSelect.appendChild(customOption);
      }

      // Set selected template if available
      if (savedTemplateSelection) {
        // Check if the saved selection exists in the options
        let selectionExists = false;
        for (let i = 0; i < templateSelect.options.length; i++) {
          if (templateSelect.options[i].value === savedTemplateSelection) {
            selectionExists = true;
            break;
          }
        }

        if (selectionExists) {
          templateSelect.value = savedTemplateSelection;
        }
      }

      if (modelController) {
        await modelController.renderForTemplate(templateSelect.value);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      addOutputMessage(
        'System',
        'Error loading templates. Please check the console for details.'
      );
    }
  }

  // Save seed when changed
  seedInput.addEventListener('change', () => {
    updateSettings({ seed: seedInput.value });
  });

  // Save template selection when changed and update model inputs
  templateSelect.addEventListener('change', async () => {
    updateSettings({ selectedTemplate: templateSelect.value });
    if (modelController) {
      await modelController.renderForTemplate(templateSelect.value);
    }
  });

  // Initialize UI
  populateTemplateSelect();
  initializeTemplateEditor(templateSelect);

  // Create pause/resume buttons
  const pauseButton = document.createElement('button');
  pauseButton.id = 'pause-conversation';
  pauseButton.textContent = 'Pause';
  pauseButton.className = 'control-button pause';
  pauseButton.style.display = 'none';

  const resumeButton = document.createElement('button');
  resumeButton.id = 'resume-conversation';
  resumeButton.textContent = 'Resume';
  resumeButton.className = 'control-button resume';
  resumeButton.style.display = 'none';

  // Add buttons to the DOM after the start button
  startButton.parentNode?.insertBefore(pauseButton, startButton.nextSibling);
  pauseButton.parentNode?.insertBefore(resumeButton, pauseButton.nextSibling);

  const templateButtons = [
    document.getElementById('edit-current-template') as HTMLButtonElement | null,
    document.getElementById('import-template') as HTMLButtonElement | null,
    document.getElementById('edit-custom-template') as HTMLButtonElement | null,
  ].filter((button): button is HTMLButtonElement => Boolean(button));

  function setTemplateButtonsDisabled(disabled: boolean): void {
    templateButtons.forEach((button) => {
      button.disabled = disabled;
    });
  }

  conversationLifecycle = createConversationLifecycleController(
    {
      startButton,
      pauseButton,
      resumeButton,
      exportButton,
      maxTurnsInput,
      seedInput,
      loadButton,
      modelSelectsContainer: modelInputs,
      templateSelect,
    },
    {
      onBeforeStart: () => {
        usageController.reset();
        conversationOutput.innerHTML = '';
        exploreModeController.clearOutputs();
        exploreModeController.updateVisibility(settings.exploreModeSettings || {});
        setTemplateButtonsDisabled(true);
      },
      onAfterStart: () => {
        const exploreModeSettings = settings.exploreModeSettings || {};
        const isExploreEnabled = Object.values(exploreModeSettings).some(
          (setting) => setting?.enabled
        );
        if (isExploreEnabled) {
          pauseButton.style.display = 'none';
          resumeButton.style.display = 'none';
        }
      },
      onComplete: (result) => {
        exploreModeController.clearOutputs();
        exploreModeController.updateVisibility(settings.exploreModeSettings || {});
        setTemplateButtonsDisabled(false);

        if (result.status === 'stopped' && result.reason) {
          addOutputMessage('System', result.reason);
        }
        if (result.status === 'error') {
          const message =
            result.error instanceof Error
              ? result.error.message
              : String(result.error);
          addOutputMessage('System', `Error: ${message}`);
        }
      },
    }
  );

  conversationLifecycle.setSelectionCallback(exploreSelectionCallback);

  // Handle button clicks
  startButton.addEventListener('click', () => {
    if (!conversationLifecycle) {
      return;
    }

    if (conversationLifecycle.isRunning()) {
      conversationLifecycle.stop('Stopped by user.');
      addOutputMessage('System', 'Conversation stopped by user.');
      return;
    }

    conversationLifecycle
      .start(() => createConversationInstance())
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        addOutputMessage('System', `Error: ${message}`);
      });
  });

  pauseButton.addEventListener('click', () => {
    conversationLifecycle?.pause();
  });

  resumeButton.addEventListener('click', () => {
    conversationLifecycle?.resume();
  });

  // Add load file input to the document body
  document.body.appendChild(loadFileInput);

  // Find the output settings section to add the load button
  const outputSettingsContent = document.querySelector(
    '.output-settings .collapsible-content'
  );
  if (outputSettingsContent) {
    // Create a container for the load button similar to other output settings
    const loadButtonGroup = document.createElement('div');
    loadButtonGroup.className = 'output-setting-group';

    // Create a label for the load button
    const loadButtonLabel = document.createElement('label');
    loadButtonLabel.textContent = 'Load Previous Conversation:';

    // Add the elements to the DOM
    loadButtonGroup.appendChild(loadButtonLabel);
    loadButtonGroup.appendChild(loadButton);
    outputSettingsContent.appendChild(loadButtonGroup);
  } else {
    // Fallback if output settings section not found
    exportButton.parentNode?.insertBefore(loadButton, exportButton.nextSibling);
  }

  // Handle export conversation button
  exportButton.addEventListener('click', exportConversation);

  // Handle load conversation button
  loadButton.addEventListener('click', () => {
    loadFileInput.click();
  });

  // Handle file selection for loading conversation
  loadFileInput.addEventListener('change', (event) => {
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      loadConversation(content);
    };

    reader.onerror = () => {
      addOutputMessage('System', 'Error: Failed to read the file.');
    };

    reader.readAsText(file);

    // Reset file input
    loadFileInput.value = '';
  });

  // Initialize template editor

  async function createConversationInstance(): Promise<Conversation> {
    if (!modelController) {
      throw new Error('Model controller is not ready.');
    }

    const models = modelController.getSelectedModels();
    if (models.length === 0) {
      throw new Error('Select at least one model.');
    }

    const templateName = templateSelect.value;
    const maxTurns = maxTurnsInput.value ? parseInt(maxTurnsInput.value, 10) : Infinity;
    const maxTokensPerModel = modelController.getMaxTokensPerModel();

    const apiKeys: ApiKeys = {
      hyperbolicApiKey: hyperbolicKeyInput.value,
      openrouterApiKey: openrouterKeyInput.value,
    };

    const requiredApis: Record<string, string> = {};
    for (const model of models) {
      const company = MODEL_INFO[model].company;
      if (company === 'hyperbolic' || company === 'hyperbolic_completion') {
        requiredApis['hyperbolicApiKey'] = 'Hyperbolic API Key';
      } else if (company === 'openrouter') {
        requiredApis['openrouterApiKey'] = 'OpenRouter API Key';
      }
    }

    const missingKeys = Object.entries(requiredApis)
      .filter(([key]) => !apiKeys[key as keyof ApiKeys])
      .map(([, name]) => name);

    if (missingKeys.length > 0) {
      throw new Error(`Missing required API key(s): ${missingKeys.join(', ')}`);
    }

    const templateModelCount = await getTemplateModelCount(templateName);
    if (templateModelCount !== models.length) {
      throw new Error(
        `Invalid template: Number of models (${models.length}) does not match the template (${templateModelCount})`
      );
    }

    const configs = await loadTemplate(templateName, models);
    const systemPrompts = configs.map((config) => config.system_prompt || null);
    const contexts = configs.map((config) => config.context || []);

    const exploreModeSettings = settings.exploreModeSettings || {};
    const seedValue = seedInput.value.trim();
    const seed = seedValue ? parseInt(seedValue, 10) : undefined;

    addOutputMessage(
      'System',
      `Starting conversation with template "${templateName}"...`
    );

    return new Conversation({
      models,
      systemPrompts,
      contexts,
      apiKeys,
      maxTurns,
      maxTokens: maxTokensPerModel,
      onOutput: addOutputMessage,
      seed,
      exploreModeSettings,
      onSelection: exploreSelectionCallback,
      onUsage: (modelDisplayName, usage) => {
        usageController.track(modelDisplayName, usage);
      },
      maxTokensProvider: (modelIndex) =>
        maxTokensPerModel[modelIndex] ?? 512,
      exploreSettingsProvider: () => settings.exploreModeSettings || {},
      customModelResolver: (modelIndex) => loadCustomModel(modelIndex)?.id || null,
    });
  }

  // Load conversation from a text file
  function loadConversation(text: string) {
    // Stop any active conversation (should never happen as button is disabled when started)
    if (conversationLifecycle?.isRunning()) {
      conversationLifecycle.stop('Loading previous conversation.');
    }

    // Clear existing conversation
    conversationOutput.innerHTML = '';

    try {
      const entries = parseConversationLog(text);
      if (entries.length === 0) {
        addOutputMessage(
          'System',
          'No messages found in the provided conversation log.'
        );
      } else {
        entries.forEach((entry) => {
          addOutputMessage(entry.actor, entry.content);
        });

        // Show export button after loading
        exportButton.style.display = 'block';

        addOutputMessage('System', 'Conversation loaded successfully.');
      }
    } catch (error) {
      console.error('Error parsing conversation:', error);
      addOutputMessage(
        'System',
        `Error loading conversation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Export conversation to a file
  function exportConversation() {
    const entries = extractConversationLogFromDom(conversationOutput);
    const conversationText = formatConversationLog(entries);

    const blob = new Blob([conversationText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    // Include date in the filename
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-');

    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Add message to conversation output
  function addOutputMessage(
    actor: string,
    content: string,
    elementId?: string,
    isLoading: boolean = false
  ) {
    // Check if this is a special message to clear explore outputs
    if (
      content === 'clear-explore-outputs' &&
      elementId &&
      elementId.startsWith('clear-explore-outputs-')
    ) {
      exploreModeController.clearOutputs();
      exploreModeController.updateVisibility(settings.exploreModeSettings || {});
      return;
    }

    // Check if this is an explore mode message
    if (elementId && elementId.startsWith('explore-')) {
      exploreModeController.renderOutput({
        responseId: elementId,
        actor,
        content,
      });
      return;
    }

    // Get or assign color for this actor
    if (!actorColors[actor]) {
      actorColors[actor] = getRgbColor(colorGenerator.next());
    }

    // Format current timestamp
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // If elementId is provided, try to update existing element
    if (elementId) {
      const existingMessage = document.getElementById(elementId);
      if (existingMessage) {
        const contentDiv = existingMessage.querySelector('.response-content');
        if (contentDiv) {
          // Update content
          contentDiv.textContent = content;

          // Scroll to bottom if auto-scroll is enabled
          if (autoScrollToggle.checked) {
            const conversationContainer = conversationOutput.closest(
              '.conversation-container'
            );
            if (conversationContainer) {
              conversationContainer.scrollTop =
                conversationContainer.scrollHeight;
            }
          }
          return;
        }
      }
    }

    // Create new message element
    const messageDiv = document.createElement('div');
    messageDiv.className = 'actor-response';
    if (elementId) {
      messageDiv.id = elementId;
    }

    const headerDiv = document.createElement('div');
    headerDiv.className = 'actor-header';
    headerDiv.textContent = `### ${actor} [${timestamp}] ###`;
    headerDiv.style.color = actorColors[actor];

    const contentDiv = document.createElement('div');
    contentDiv.className = 'response-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    conversationOutput.appendChild(messageDiv);

    // Scroll to bottom if auto-scroll is enabled
    if (autoScrollToggle.checked) {
      const conversationContainer = conversationOutput.closest(
        '.conversation-container'
      );
      if (conversationContainer) {
        conversationContainer.scrollTop = conversationContainer.scrollHeight;
      }
    }
  }

  window.addEventListener('beforeunload', () => {
    unsubscribeSettings();
  });
});

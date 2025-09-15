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
  getModelDisplayName,
} from './utils';
import {
  ApiKeys,
  CustomTemplate,
  ModelInfo,
  ExploreModeSettings,
  ExploreModeSetting,
  ParallelResponse,
  SelectionCallback,
  ConversationUsage,
  UsageData,
  ModelResponse,
} from './types';
import {
  initiateOAuthFlow,
  handleOAuthCallback,
  getAuthorizationCode,
} from './oauth';

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

  // Track current template model count
  let currentTemplateModelCount = 2; // Default to 2 models

  // Usage tracking state
  let conversationUsage: ConversationUsage = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    modelBreakdown: {},
  };

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

  // Conversation state
  let activeConversation: Conversation | null = null;
  let isConversationRunning = false;

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
  hyperbolicKeyInput.value = loadFromLocalStorage('hyperbolicApiKey', '');
  openrouterKeyInput.value = loadFromLocalStorage('openrouterApiKey', '');

  // Usage tracking functions
  function resetUsageTracking() {
    conversationUsage = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      modelBreakdown: {},
    };
    updateUsageDisplay();
  }

  function updateUsageWithResponse(modelDisplayName: string, usage: UsageData) {
    const previousTotalCost = conversationUsage.totalCost;
    const costToAdd = usage.cost || 0;

    // Initialize model breakdown if it doesn't exist
    if (!conversationUsage.modelBreakdown[modelDisplayName]) {
      conversationUsage.modelBreakdown[modelDisplayName] = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
      };
    }

    const modelStats = conversationUsage.modelBreakdown[modelDisplayName];

    // Check if this is a cost-only update (same tokens, different cost)
    const isCostOnlyUpdate =
      usage.totalTokens === modelStats.totalTokens &&
      usage.promptTokens === modelStats.promptTokens &&
      usage.completionTokens === modelStats.completionTokens &&
      costToAdd > (modelStats.cost || 0);

    if (isCostOnlyUpdate) {
      // Cost-only update: don't add tokens again, just update cost
      const previousModelCost = modelStats.cost || 0;
      const costDifference = costToAdd - previousModelCost;

      conversationUsage.totalCost += costDifference;
      modelStats.cost = costToAdd;
    } else {
      // Regular update: add tokens and cost
      conversationUsage.totalInputTokens += usage.promptTokens;
      conversationUsage.totalOutputTokens += usage.completionTokens;
      conversationUsage.totalTokens += usage.totalTokens;
      conversationUsage.totalCost += costToAdd;

      modelStats.promptTokens += usage.promptTokens;
      modelStats.completionTokens += usage.completionTokens;
      modelStats.totalTokens += usage.totalTokens;
      modelStats.cost = (modelStats.cost || 0) + costToAdd;
    }

    updateUsageDisplay();
  }

  function updateUsageDisplay() {
    // Update totals
    totalInputTokensSpan.textContent =
      conversationUsage.totalInputTokens.toLocaleString();
    totalOutputTokensSpan.textContent =
      conversationUsage.totalOutputTokens.toLocaleString();
    totalTokensSpan.textContent =
      conversationUsage.totalTokens.toLocaleString();
    totalCostSpan.textContent = conversationUsage.totalCost.toFixed(7);

    // Update breakdown
    usageBreakdown.innerHTML = '';
    Object.entries(conversationUsage.modelBreakdown).forEach(
      ([modelName, stats]) => {
        const modelDiv = document.createElement('div');
        modelDiv.className = 'model-usage';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'model-name';
        nameDiv.textContent = modelName;

        const statsDiv = document.createElement('div');
        statsDiv.className = 'model-stats';

        const inputTokensDiv = document.createElement('div');
        inputTokensDiv.className = 'model-stat';
        inputTokensDiv.innerHTML = `
        <div class="model-stat-label">Input</div>
        <div class="model-stat-value">${stats.promptTokens.toLocaleString()}</div>
      `;

        const outputTokensDiv = document.createElement('div');
        outputTokensDiv.className = 'model-stat';
        outputTokensDiv.innerHTML = `
        <div class="model-stat-label">Output</div>
        <div class="model-stat-value">${stats.completionTokens.toLocaleString()}</div>
      `;

        const tokensDiv = document.createElement('div');
        tokensDiv.className = 'model-stat';
        tokensDiv.innerHTML = `
        <div class="model-stat-label">Total</div>
        <div class="model-stat-value">${stats.totalTokens.toLocaleString()}</div>
      `;

        const costDiv = document.createElement('div');
        costDiv.className = 'model-stat';
        costDiv.innerHTML = `
        <div class="model-stat-label">Cost</div>
        <div class="model-stat-value">$${(stats.cost || 0).toFixed(7)}</div>
      `;

        statsDiv.appendChild(inputTokensDiv);
        statsDiv.appendChild(outputTokensDiv);
        statsDiv.appendChild(tokensDiv);
        statsDiv.appendChild(costDiv);

        modelDiv.appendChild(nameDiv);
        modelDiv.appendChild(statsDiv);

        usageBreakdown.appendChild(modelDiv);
      }
    );
  }

  function initializeUsageTracking() {
    // The collapsible behavior is now handled by the standard collapsible system
    // No custom toggle logic needed
  }

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

  // Max output length is now per-model and loaded in updateModelInputs

  // Load saved seed if available
  seedInput.value = loadFromLocalStorage('seed', '');
  // Load saved font size, word wrap, and auto-scroll settings
  const savedFontSize = loadFromLocalStorage('outputFontSize', '12');
  const savedWordWrap = loadFromLocalStorage('outputWordWrap', 'true');
  const savedAutoScroll = loadFromLocalStorage('outputAutoScroll', 'true');

  // Initialize font size and word wrap with saved values
  let currentFontSize = parseInt(savedFontSize);
  currentFontSizeSpan.textContent = `${currentFontSize}px`;
  conversationOutput.style.fontSize = `${currentFontSize}px`;

  // Initialize word wrap with saved value
  wordWrapToggle.checked = savedWordWrap === 'true';
  conversationOutput.style.whiteSpace = wordWrapToggle.checked
    ? 'pre-wrap'
    : 'pre';

  // Initialize auto-scroll with saved value
  const autoScrollToggle = document.getElementById(
    'auto-scroll-toggle'
  ) as HTMLInputElement;
  autoScrollToggle.checked = savedAutoScroll === 'true';
  conversationOutput.style.whiteSpace = wordWrapToggle.checked
    ? 'pre-wrap'
    : 'pre';

  // Function to refresh model selects when API keys change
  function refreshModelSelects() {
    const allModelSelects = document.querySelectorAll(
      '.model-select'
    ) as NodeListOf<HTMLSelectElement>;
    allModelSelects.forEach((select, index) => {
      const selectedValue = select.value;
      populateModelSelect(select, index, selectedValue);
    });
  }

  // Save API keys when changed and refresh model selects
  hyperbolicKeyInput.addEventListener('change', () => {
    saveToLocalStorage('hyperbolicApiKey', hyperbolicKeyInput.value);
    refreshModelSelects();
  });

  openrouterKeyInput.addEventListener('change', () => {
    saveToLocalStorage('openrouterApiKey', openrouterKeyInput.value);
    refreshModelSelects();
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
          // Save the API key to localStorage
          saveToLocalStorage('openrouterApiKey', apiKey);

          // Update the input field
          openrouterKeyInput.value = apiKey;

          // Refresh model selects
          refreshModelSelects();

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

    // Apply font size to explore mode outputs
    const exploreOutputContents = document.querySelectorAll(
      '.explore-output-content'
    );
    exploreOutputContents.forEach((content) => {
      (content as HTMLElement).style.fontSize = `${currentFontSize}px`;
    });

    saveToLocalStorage('outputFontSize', currentFontSize.toString());
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

    // Apply word wrap to explore mode outputs
    const exploreOutputContents = document.querySelectorAll(
      '.explore-output-content'
    );
    exploreOutputContents.forEach((content) => {
      (content as HTMLElement).style.whiteSpace = wordWrapToggle.checked
        ? 'pre-wrap'
        : 'pre';
    });

    saveToLocalStorage('outputWordWrap', wordWrapToggle.checked.toString());
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
    saveToLocalStorage('outputAutoScroll', autoScrollToggle.checked.toString());
  }

  // Load saved model and template selections if available
  const savedModelSelections = loadFromLocalStorage('modelSelections', []);
  const savedTemplateSelection = loadFromLocalStorage('templateSelection', '');

  // Function to save all model selections
  function saveModelSelections() {
    const allModelSelects = document.querySelectorAll(
      '.model-select'
    ) as NodeListOf<HTMLSelectElement>;
    const models: string[] = Array.from(allModelSelects).map(
      (select) => select.value
    );
    saveToLocalStorage('modelSelections', models);
  }

  // Function to fetch OpenRouter models
  async function fetchOpenRouterModels(apiKey: string): Promise<any[]> {
    try {
      // Check if we have cached models and they're not expired
      const cachedData = loadFromLocalStorage('openrouterModelsCache', null);
      if (cachedData) {
        try {
          const { models, timestamp } = JSON.parse(cachedData);
          // Cache expires after 1 hour (3600000 ms)
          if (Date.now() - timestamp < 3600000) {
            return models;
          }
        } catch (e) {
          console.error('Error parsing cached models:', e);
          // Continue to fetch fresh data if cache parsing fails
        }
      }

      // Fetch fresh data
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

      // Cache the results with timestamp
      saveToLocalStorage(
        'openrouterModelsCache',
        JSON.stringify({
          models: data.data,
          timestamp: Date.now(),
        })
      );

      return data.data;
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      throw error;
    }
  }

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

  // Update model inputs based on template
  async function updateModelInputs(templateName: string) {
    try {
      // Get the number of models from the template
      const modelCount = await getTemplateModelCount(templateName);
      currentTemplateModelCount = modelCount;

      // Save current model selections before clearing
      const currentSelections: string[] = [];
      const existingModelSelects = document.querySelectorAll(
        '.model-select'
      ) as NodeListOf<HTMLSelectElement>;
      existingModelSelects.forEach((select) => {
        currentSelections.push(select.value);
      });

      // Clear existing model inputs
      modelInputs.innerHTML = '';

      // Load saved explore mode settings
      const exploreModeSettings = loadExploreModeSettings();

      // Create the required number of model selects
      for (let i = 0; i < modelCount; i++) {
        // Create main model selection group
        const newGroup = document.createElement('div');
        newGroup.className = 'model-input-group';

        const label = document.createElement('label');
        label.setAttribute('for', `model-${i}`);
        label.textContent = `Model ${i + 1}:`;

        const select = document.createElement('select');
        select.id = `model-${i}`;
        select.className = 'model-select';

        newGroup.appendChild(label);
        newGroup.appendChild(select);
        modelInputs.appendChild(newGroup);

        // Populate the select with the current selection if available
        const currentValue =
          i < currentSelections.length ? currentSelections[i] : null;
        populateModelSelect(select, i, currentValue);

        // Create container for max tokens and explore mode input groups
        const inputGroupsContainer = document.createElement('div');
        inputGroupsContainer.className = 'input-groups-container';

        // Create max tokens input group
        const maxTokensGroup = document.createElement('div');
        maxTokensGroup.className = 'max-tokens-input-group';

        // Create label for max tokens
        const maxTokensLabel = document.createElement('label');
        maxTokensLabel.setAttribute('for', `max-tokens-${i}`);
        maxTokensLabel.textContent = `Max Completion Tokens:`;

        // Create input for max tokens
        const maxTokensInput = document.createElement('input');
        maxTokensInput.type = 'number';
        maxTokensInput.id = `max-tokens-${i}`;
        maxTokensInput.className = 'max-tokens-input';
        maxTokensInput.min = '0';
        maxTokensInput.max = '1024';
        maxTokensInput.step = '128';
        maxTokensInput.placeholder = '512';

        // Load saved max tokens value if available
        const savedMaxTokens = loadFromLocalStorage(`max-tokens-${i}`, '512');
        maxTokensInput.value = savedMaxTokens;

        // Add event listener for max tokens input
        maxTokensInput.addEventListener('change', () => {
          let value = parseInt(maxTokensInput.value);
          // Ensure the value is within the valid range
          value = Math.max(1, Math.min(value, 1024));
          maxTokensInput.value = value.toString();
          saveToLocalStorage(`max-tokens-${i}`, value.toString());
        });

        // Add elements to max tokens group
        maxTokensGroup.appendChild(maxTokensLabel);
        maxTokensGroup.appendChild(maxTokensInput);

        // Create explore mode toggle group
        const exploreGroup = document.createElement('div');
        exploreGroup.className = 'explore-mode-input-group';

        // Get model info for display name
        const modelKey =
          currentValue ||
          (i < savedModelSelections.length
            ? savedModelSelections[i]
            : Object.keys(MODEL_INFO)[0]);
        const modelInfo = MODEL_INFO[modelKey];
        const displayName = getModelDisplayName(modelKey, i, modelInfo);
        const modelName = `${displayName} ${i + 1}`;

        // Create label with model name
        const exploreLabel = document.createElement('label');
        exploreLabel.textContent = `Explore Mode:`;

        // Create toggle switch
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'toggle-switch';

        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.id = `explore-mode-toggle-${i}`;

        // Set toggle state from saved settings
        const savedSetting = exploreModeSettings[i];
        toggleInput.checked = savedSetting?.enabled || false;

        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'toggle-slider';

        toggleContainer.appendChild(toggleInput);
        toggleContainer.appendChild(toggleSlider);

        // Create container for num requests input and label
        const numRequestsContainer = document.createElement('div');
        numRequestsContainer.className = toggleInput.checked
          ? 'num-requests-container'
          : 'num-requests-container hidden';

        // Create label for n (number of requests)
        const numRequestsLabel = document.createElement('label');
        numRequestsLabel.textContent = 'Num Choices:';
        numRequestsLabel.setAttribute('for', `explore-mode-num-requests-${i}`);
        numRequestsLabel.style.marginRight = '5px';

        // Create input for n (number of requests)
        const numRequestsInput = document.createElement('input');
        numRequestsInput.type = 'number';
        numRequestsInput.id = `explore-mode-num-requests-${i}`;
        numRequestsInput.className = 'num-requests-input';
        numRequestsInput.min = '1';
        numRequestsInput.max = '8';
        numRequestsInput.value = (savedSetting?.numRequests || 3).toString();

        // Add label and input to container
        numRequestsContainer.appendChild(numRequestsLabel);
        numRequestsContainer.appendChild(numRequestsInput);

        // Add event listener for toggle
        toggleInput.addEventListener('change', () => {
          // Show/hide number requests container based on toggle state
          if (toggleInput.checked) {
            numRequestsContainer.classList.remove('hidden');
          } else {
            numRequestsContainer.classList.add('hidden');
          }

          // Update settings
          const settings = loadExploreModeSettings();
          settings[i] = {
            enabled: toggleInput.checked,
            numRequests: parseInt(numRequestsInput.value),
          };
          saveExploreModeSettings(settings);

          // Update explore mode container visibility
          updateExploreModeContainerVisibility();
        });

        // Add click handler to the toggle switch container for better usability
        toggleContainer.addEventListener('click', (e) => {
          // Prevent double triggering when clicking directly on the checkbox
          // Also check if the input is disabled
          if (e.target !== toggleInput && !toggleInput.disabled) {
            toggleInput.checked = !toggleInput.checked;

            // Manually trigger the change event
            const changeEvent = new Event('change');
            toggleInput.dispatchEvent(changeEvent);
          }
        });

        // Add event listener for number input
        numRequestsInput.addEventListener('change', () => {
          // Ensure value is within range
          let value = parseInt(numRequestsInput.value);
          value = Math.max(1, Math.min(value, 8));
          numRequestsInput.value = value.toString();

          // Update settings
          const settings = loadExploreModeSettings();
          settings[i] = {
            enabled: toggleInput.checked,
            numRequests: value,
          };
          saveExploreModeSettings(settings);
        });

        // Add elements to input group
        exploreGroup.appendChild(exploreLabel);
        exploreGroup.appendChild(toggleContainer);
        exploreGroup.appendChild(numRequestsContainer);

        // Add both groups to the container
        inputGroupsContainer.appendChild(maxTokensGroup);
        inputGroupsContainer.appendChild(exploreGroup);

        // Add the container to the model inputs
        modelInputs.appendChild(inputGroupsContainer);
      }

      // Update explore mode container visibility
      updateExploreModeContainerVisibility();
    } catch (error) {
      // Display error message
      const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;

      // If this is an OpenRouter-related error, show it in the auth message container
      if (errorMessage.toLowerCase().includes('openrouter')) {
        showAuthMessage(errorMessage, true);
      } else {
        // For other errors, use the conversation output
        addOutputMessage('System', errorMessage);
      }
    }
  }

  // Load saved explore mode settings
  function loadExploreModeSettings(): ExploreModeSettings {
    return loadFromLocalStorage('exploreModeSettings', {});
  }

  // Save explore mode settings
  function saveExploreModeSettings(settings: ExploreModeSettings) {
    saveToLocalStorage('exploreModeSettings', settings);
  }

  // Function removed - explore mode inputs are now created directly in updateModelInputs

  // Update explore mode container visibility based on settings
  function updateExploreModeContainerVisibility() {
    const settings = loadExploreModeSettings();
    const isAnyEnabled = Object.values(settings).some(
      (setting) => setting.enabled
    );

    // Only show the container if at least one model has explore mode enabled
    exploreModeContainer.style.display = isAnyEnabled ? 'block' : 'none';

    // Make sure the explore mode outputs container is empty when showing
    if (isAnyEnabled) {
      exploreModeOutputs.innerHTML = '';
    }
  }

  // Handle selection of a response in explore mode
  function handleExploreSelection(responseId: string) {
    if (activeConversation) {
      activeConversation.handleSelection(responseId);
    }
  }

  // Create explore mode output element
  function createExploreOutput(
    responseId: string,
    actor: string,
    content: string,
    isSelected: boolean = false
  ) {
    // Check if output already exists
    let outputElement = document.getElementById(responseId);

    if (!outputElement) {
      // Create new output element
      outputElement = document.createElement('div');
      outputElement.id = responseId;
      outputElement.className = 'explore-output';
      if (isSelected) {
        outputElement.classList.add('selected');
      }

      // Create header
      const header = document.createElement('div');
      header.className = 'explore-output-header';

      // Add actor name
      const actorSpan = document.createElement('span');
      actorSpan.textContent = actor;
      header.appendChild(actorSpan);

      // Add select button
      const selectButton = document.createElement('button');
      selectButton.className = 'explore-select-button';
      selectButton.textContent = 'Select';
      selectButton.addEventListener('click', () => {
        handleExploreSelection(responseId);
      });
      header.appendChild(selectButton);

      // Create content
      const contentDiv = document.createElement('div');
      contentDiv.className = 'explore-output-content';
      contentDiv.textContent = content;
      contentDiv.style.whiteSpace = wordWrapToggle.checked ? 'pre-wrap' : 'pre';
      contentDiv.style.fontSize = `${currentFontSize}px`;

      // Add elements to output
      outputElement.appendChild(header);
      outputElement.appendChild(contentDiv);

      // Add output to container
      exploreModeOutputs.appendChild(outputElement);

      // Auto-scroll to the new output if auto-scroll is enabled
      if (autoScrollToggle.checked) {
        exploreModeOutputs.scrollTop = exploreModeOutputs.scrollHeight;
      }

      // Add click handler to the whole output for selection
      outputElement.addEventListener('click', (e) => {
        // Don't trigger if clicking on the button (it has its own handler)
        if (
          e.target !== selectButton &&
          !selectButton.contains(e.target as Node)
        ) {
          handleExploreSelection(responseId);
        }
      });
    } else {
      // Update existing output
      const contentDiv = outputElement.querySelector('.explore-output-content');
      if (contentDiv) {
        contentDiv.textContent = content;
        (contentDiv as HTMLElement).style.whiteSpace = wordWrapToggle.checked
          ? 'pre-wrap'
          : 'pre';
        (contentDiv as HTMLElement).style.fontSize = `${currentFontSize}px`;
      }

      // Update selected state
      if (isSelected) {
        outputElement.classList.add('selected');
      } else {
        outputElement.classList.remove('selected');
      }

      // Auto-scroll when content is updated if auto-scroll is enabled
      if (autoScrollToggle.checked) {
        exploreModeOutputs.scrollTop = exploreModeOutputs.scrollHeight;
      }
    }

    return outputElement;
  }

  // Selection callback for explore mode
  const exploreSelectionCallback: SelectionCallback = (responseId: string) => {
    // Get all explore outputs
    const outputs = exploreModeOutputs.querySelectorAll('.explore-output');

    // Update selected state
    outputs.forEach((output) => {
      if (output.id === responseId) {
        output.classList.add('selected');
      } else {
        output.classList.remove('selected');
      }
    });
  };

  // Create OpenRouter autocomplete field
  async function createOpenRouterAutocomplete(
    select: HTMLSelectElement,
    index: number
  ) {
    // Create container for autocomplete
    const container = document.createElement('div');
    container.id = `openrouter-autocomplete-${index}`;
    container.className = 'openrouter-autocomplete-container';

    // Create subgroup with label (similar to model-input-group)
    const subgroup = document.createElement('div');
    subgroup.className = 'model-input-subgroup';

    // Create label
    const labelElement = document.createElement('label');
    labelElement.textContent = 'OpenRouter:';
    labelElement.setAttribute('for', `openrouter-model-${index}`);

    // Create input field
    const input = document.createElement('input');
    input.id = `openrouter-model-${index}`;
    input.type = 'text';
    input.className = 'openrouter-autocomplete-input';
    input.placeholder = 'Search OpenRouter models...';

    // Create dropdown for results
    const dropdown = document.createElement('div');
    dropdown.className = 'openrouter-autocomplete-dropdown';
    dropdown.style.display = 'none';

    // Add elements to container
    subgroup.appendChild(labelElement);
    subgroup.appendChild(input);
    container.appendChild(subgroup);
    container.appendChild(dropdown);

    // Find the model-input-group parent and insert after it
    const modelInputGroup = select.closest('.model-input-group');
    if (modelInputGroup && modelInputGroup.parentNode) {
      modelInputGroup.parentNode.insertBefore(
        container,
        modelInputGroup.nextSibling
      );
    } else {
      console.error('Cannot insert autocomplete: model input group not found');
      return;
    }

    // Try to load previously selected model
    const savedModel = loadFromLocalStorage(
      `openrouter_custom_model_${index}`,
      null
    );
    if (savedModel) {
      try {
        const savedModelData = JSON.parse(savedModel);
        input.value = savedModelData.name || '';
        input.dataset.id = savedModelData.id || '';
      } catch (e) {
        console.error('Error parsing saved model:', e);
      }
    }

    // Load OpenRouter models
    try {
      const models = await fetchOpenRouterModels(openrouterKeyInput.value);

      // Function to filter and display models
      const filterModels = (query: string) => {
        dropdown.innerHTML = '';
        dropdown.style.display = 'block';

        const filteredModels = query
          ? models.filter(
              (model) =>
                model.id.toLowerCase().includes(query.toLowerCase()) ||
                (model.name &&
                  model.name.toLowerCase().includes(query.toLowerCase()))
            )
          : models;

        // Limit to first 10 results
        const displayModels = filteredModels.slice(0, 10);

        if (displayModels.length === 0) {
          const noResults = document.createElement('div');
          noResults.className = 'openrouter-autocomplete-item';
          noResults.textContent = 'No models found';
          dropdown.appendChild(noResults);
        } else {
          displayModels.forEach((model) => {
            const item = document.createElement('div');
            item.className = 'openrouter-autocomplete-item';
            item.textContent = model.name || model.id;

            // Add click handler
            item.addEventListener('click', () => {
              input.value = model.name || model.id;
              input.dataset.id = model.id;
              dropdown.style.display = 'none';

              // Save selected model
              saveToLocalStorage(
                `openrouter_custom_model_${index}`,
                JSON.stringify({
                  id: model.id,
                  name: model.name || model.id,
                })
              );
            });

            dropdown.appendChild(item);
          });
        }
      };

      // Initial filter
      filterModels('');

      // Add input event listener
      input.addEventListener('input', () => {
        filterModels(input.value);
      });

      // Add focus event listener
      input.addEventListener('focus', () => {
        filterModels(input.value);
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (event) => {
        if (!container.contains(event.target as Node)) {
          dropdown.style.display = 'none';
        }
      });
    } catch (error) {
      console.error('Error loading OpenRouter models:', error);

      // Show error in dropdown
      const errorItem = document.createElement('div');
      errorItem.className = 'openrouter-autocomplete-item error';
      errorItem.textContent =
        'Error loading models. Please check your API key.';
      dropdown.innerHTML = '';
      dropdown.appendChild(errorItem);
      dropdown.style.display = 'block';
    }
  }

  // Populate a single model select
  function populateModelSelect(
    select: HTMLSelectElement,
    index?: number,
    currentValue?: string | null
  ) {
    select.innerHTML = '';

    // Get current API keys
    const apiKeys = {
      hyperbolic: hyperbolicKeyInput.value,
      openrouter: openrouterKeyInput.value,
    };

    // Remove any existing autocomplete field
    if (index !== undefined) {
      const existingAutocomplete = document.getElementById(
        `openrouter-autocomplete-${index}`
      );
      if (existingAutocomplete) {
        existingAutocomplete.remove();
      }
    }

    // Add model options
    Object.keys(MODEL_INFO).forEach((modelKey) => {
      const modelInfo = MODEL_INFO[modelKey];
      const company = modelInfo.company;

      // Create option element
      const option = document.createElement('option');
      option.value = modelKey;

      // Determine if this model's API key is available
      let apiKeyAvailable = false;
      let apiKeyName = '';

      if (company === 'hyperbolic' || company === 'hyperbolic_completion') {
        apiKeyAvailable = !!apiKeys.hyperbolic;
        apiKeyName = 'Hyperbolic';
      } else if (company === 'openrouter') {
        apiKeyAvailable = !!apiKeys.openrouter;
        apiKeyName = 'OpenRouter';
      }

      // Set option text with API key info
      const displayName =
        index !== undefined
          ? getModelDisplayName(modelKey, index, modelInfo)
          : modelInfo.display_name;
      option.textContent = `${displayName} (${modelKey}) - ${apiKeyName}`;

      // Add a visual indicator if API key is missing
      if (!apiKeyAvailable) {
        option.textContent += ' [API Key Missing]';
        option.style.color = '#999';
      }

      select.appendChild(option);
    });

    // Set selected value based on priority:
    // 1. Use currentValue if provided (from current selections)
    // 2. Otherwise use saved model selections if available
    if (currentValue) {
      select.value = currentValue;
    } else if (
      index !== undefined &&
      savedModelSelections &&
      savedModelSelections[index]
    ) {
      select.value = savedModelSelections[index];
    }

    // Add change event listener to save selection and handle OpenRouter custom selector
    select.addEventListener('change', (event) => {
      saveModelSelections();

      // Check if this is the OpenRouter custom selector
      if (index !== undefined) {
        const selectedModelKey = select.value;
        const modelInfo = MODEL_INFO[selectedModelKey];

        // Remove any existing autocomplete field
        const existingAutocomplete = document.getElementById(
          `openrouter-autocomplete-${index}`
        );
        if (existingAutocomplete) {
          existingAutocomplete.remove();
        }

        // If this is the OpenRouter custom selector and API key is available, show autocomplete
        if (modelInfo && modelInfo.is_custom_selector && apiKeys.openrouter) {
          createOpenRouterAutocomplete(select, index);
        }
      }
    });

    // Check if the current selection is the OpenRouter custom selector and show autocomplete if needed
    if (index !== undefined) {
      const currentValue = select.value;
      const modelInfo = MODEL_INFO[currentValue];
      if (modelInfo && modelInfo.is_custom_selector && apiKeys.openrouter) {
        createOpenRouterAutocomplete(select, index);
      }
    }
  }

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

      // Update model inputs based on selected template
      await updateModelInputs(templateSelect.value);
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
    saveToLocalStorage('seed', seedInput.value);
  });

  // Save template selection when changed and update model inputs
  templateSelect.addEventListener('change', async () => {
    saveToLocalStorage('templateSelection', templateSelect.value);
    await updateModelInputs(templateSelect.value);
  });

  // Initialize UI
  populateTemplateSelect();
  initializeTemplateEditor();

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

  // Handle button clicks
  startButton.addEventListener('click', handleStartStopButton);
  pauseButton.addEventListener('click', handlePauseButton);
  resumeButton.addEventListener('click', handleResumeButton);

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
  function initializeTemplateEditor() {
    const editCurrentTemplateBtn = document.getElementById(
      'edit-current-template'
    ) as HTMLButtonElement;
    const importTemplateBtn = document.getElementById(
      'import-template'
    ) as HTMLButtonElement;
    const templateFileInput = document.getElementById(
      'template-file-input'
    ) as HTMLInputElement;
    const templateEditorForm = document.getElementById(
      'template-editor-form'
    ) as HTMLDivElement;
    const templateNameInput = document.getElementById(
      'template-name'
    ) as HTMLInputElement;
    const templateDescriptionInput = document.getElementById(
      'template-description'
    ) as HTMLInputElement;
    const templateContentTextarea = document.getElementById(
      'template-content'
    ) as HTMLTextAreaElement;
    const saveTemplateBtn = document.getElementById(
      'save-template'
    ) as HTMLButtonElement;
    const exportTemplateBtn = document.getElementById(
      'export-template'
    ) as HTMLButtonElement;
    const clearCustomTemplateBtn = document.getElementById(
      'clear-custom-template'
    ) as HTMLButtonElement;
    const clearCustomTemplateStatusBtn = document.getElementById(
      'clear-custom-template-status'
    ) as HTMLButtonElement;
    const cancelEditBtn = document.getElementById(
      'cancel-edit'
    ) as HTMLButtonElement;
    const customTemplateStatus = document.getElementById(
      'custom-template-status'
    ) as HTMLDivElement;
    const customTemplateName = document.getElementById(
      'custom-template-name'
    ) as HTMLSpanElement;
    const editCustomTemplateBtn = document.getElementById(
      'edit-custom-template'
    ) as HTMLButtonElement;

    // Create a container for template editor error messages
    const templateErrorContainer = document.createElement('div');
    templateErrorContainer.className = 'template-error-container';
    templateErrorContainer.style.display = 'none';
    templateErrorContainer.style.marginTop = '15px';
    templateErrorContainer.style.marginBottom = '15px';
    templateErrorContainer.style.padding = '8px 10px';
    templateErrorContainer.style.border = '1px solid #000000';
    templateErrorContainer.style.fontSize = '14px';
    templateErrorContainer.style.fontFamily = 'Times New Roman, serif';
    templateErrorContainer.style.backgroundColor = '#EEEEEE';
    templateErrorContainer.style.color = '#FF0000';
    templateErrorContainer.style.position = 'relative';
    templateErrorContainer.style.width = '100%';
    templateErrorContainer.style.boxSizing = 'border-box';

    // Create dismiss button (X)
    const dismissButton = document.createElement('button');
    dismissButton.textContent = '×'; // × is the multiplication sign, looks like an X
    dismissButton.style.position = 'absolute';
    dismissButton.style.right = '5px';
    dismissButton.style.top = '5px';
    dismissButton.style.background = 'none';
    dismissButton.style.border = 'none';
    dismissButton.style.fontSize = '16px';
    dismissButton.style.fontWeight = 'bold';
    dismissButton.style.cursor = 'pointer';
    dismissButton.style.padding = '0 5px';
    dismissButton.style.lineHeight = '1';
    dismissButton.title = 'Dismiss';

    // Create message element
    const messageElement = document.createElement('div');
    messageElement.style.paddingRight = '20px'; // Make room for the X button

    // Add elements to container
    templateErrorContainer.appendChild(dismissButton);
    templateErrorContainer.appendChild(messageElement);

    // Add container to the template editor form
    templateEditorForm.appendChild(templateErrorContainer);

    // Add click handler to dismiss button
    dismissButton.addEventListener('click', () => {
      templateErrorContainer.style.display = 'none';
    });

    // Function to show template error messages
    function showTemplateError(message: string) {
      messageElement.textContent = message;
      templateErrorContainer.style.display = 'block';
    }

    // Check if custom template exists and update UI
    function updateCustomTemplateStatus() {
      const customTemplate = getCustomTemplate();

      if (customTemplate) {
        customTemplateName.textContent = customTemplate.name;
        customTemplateStatus.style.display = 'block';

        // Add "Custom" option to template select if not already present
        let customOptionExists = false;
        for (let i = 0; i < templateSelect.options.length; i++) {
          if (templateSelect.options[i].value === 'custom') {
            customOptionExists = true;
            break;
          }
        }

        if (!customOptionExists) {
          const customOption = document.createElement('option');
          customOption.value = 'custom';
          // Show both name and description
          customOption.textContent = customTemplate.description
            ? `Custom: ${customTemplate.name} - ${customTemplate.description}`
            : `Custom: ${customTemplate.name}`;
          templateSelect.appendChild(customOption);
        } else {
          // Update the text of the custom option
          for (let i = 0; i < templateSelect.options.length; i++) {
            if (templateSelect.options[i].value === 'custom') {
              // Show both name and description
              templateSelect.options[i].textContent = customTemplate.description
                ? `Custom: ${customTemplate.name} - ${customTemplate.description}`
                : `Custom: ${customTemplate.name}`;
              break;
            }
          }
        }
      } else {
        customTemplateStatus.style.display = 'none';

        // Remove "Custom" option from template select if present
        for (let i = 0; i < templateSelect.options.length; i++) {
          if (templateSelect.options[i].value === 'custom') {
            templateSelect.remove(i);
            break;
          }
        }
      }
    }

    // Edit current template
    editCurrentTemplateBtn.addEventListener('click', async () => {
      const currentTemplate = templateSelect.value;

      try {
        let templateContent: string;
        let templateName: string;
        let templateDescription: string = '';

        if (currentTemplate === 'custom') {
          // Edit existing custom template
          const customTemplate = getCustomTemplate();
          if (customTemplate) {
            templateContent = customTemplate.content;
            templateName = customTemplate.name;
            templateDescription = customTemplate.description || '';
          } else {
            throw new Error('Custom template not found');
          }
        } else {
          // Load built-in template
          const response = await fetch(
            `./public/templates/${currentTemplate}.jsonl`
          );
          if (!response.ok) {
            throw new Error(`Template '${currentTemplate}' not found.`);
          }
          templateContent = await response.text();
          templateName = `${currentTemplate} (Custom)`;

          // Try to get description from available templates
          const templates = await getAvailableTemplates();
          const templateInfo = templates.find(
            (t) => t.name === currentTemplate
          );
          if (templateInfo) {
            templateDescription = templateInfo.description || '';
          }
        }

        // Populate editor form
        templateNameInput.value = templateName;
        templateDescriptionInput.value = templateDescription;
        templateContentTextarea.value = templateContent;

        // Show editor form
        templateEditorForm.style.display = 'block';
      } catch (error) {
        console.error('Error loading template for editing:', error);
        showTemplateError(
          `Error loading template: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    // Import template
    importTemplateBtn.addEventListener('click', () => {
      templateFileInput.click();
    });

    // Handle file selection
    templateFileInput.addEventListener('change', (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target?.result as string;

        // Validate JSONL content
        try {
          const lines = content.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              JSON.parse(line); // This will throw if invalid JSON
            }
          }

          // Populate editor form
          templateNameInput.value = file.name.replace('.jsonl', '');
          templateDescriptionInput.value = ''; // Clear description field for imported templates
          templateContentTextarea.value = content;

          // Show editor form
          templateEditorForm.style.display = 'block';
        } catch (error) {
          console.error('Invalid JSONL file:', error);
          showTemplateError(
            'Invalid JSONL file. Please check the file format.'
          );
        }
      };

      reader.onerror = () => {
        showTemplateError('Failed to read the file.');
      };

      reader.readAsText(file);

      // Reset file input
      templateFileInput.value = '';
    });

    // Save template
    saveTemplateBtn.addEventListener('click', () => {
      const name = templateNameInput.value.trim();
      const content = templateContentTextarea.value.trim();

      if (!name) {
        showTemplateError('Template name is required.');
        return;
      }

      if (!content) {
        showTemplateError('Template content is required.');
        return;
      }

      // Validate JSONL content
      try {
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            JSON.parse(line); // This will throw if invalid JSON
          }
        }

        // Get description
        const description = templateDescriptionInput.value.trim();

        // Save custom template
        saveCustomTemplate({
          name,
          description,
          content,
          originalName:
            templateSelect.value !== 'custom'
              ? templateSelect.value
              : undefined,
          lastModified: Date.now(),
        });

        // Update UI
        templateEditorForm.style.display = 'none';
        updateCustomTemplateStatus();

        // Select custom template
        for (let i = 0; i < templateSelect.options.length; i++) {
          if (templateSelect.options[i].value === 'custom') {
            templateSelect.selectedIndex = i;
            break;
          }
        }

        // Trigger change event to update model inputs
        const event = new Event('change');
        templateSelect.dispatchEvent(event);

        // Show success message
        showTemplateError(`Custom template "${name}" saved successfully.`);
      } catch (error) {
        console.error('Invalid JSONL content:', error);
        showTemplateError('Invalid JSONL content. Please check the format.');
      }
    });

    // Export template
    exportTemplateBtn.addEventListener('click', () => {
      const name = templateNameInput.value.trim() || 'template';
      const content = templateContentTextarea.value.trim();

      if (!content) {
        showTemplateError('No content to export.');
        return;
      }

      // Create blob and download
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.jsonl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    // Clear custom template
    const handleClearCustomTemplate = () => {
      clearCustomTemplate();
      updateCustomTemplateStatus();

      // If custom template was selected, switch to first available template
      if (
        templateSelect.value === 'custom' &&
        templateSelect.options.length > 0
      ) {
        templateSelect.selectedIndex = 0;

        // Trigger change event to update model inputs
        const event = new Event('change');
        templateSelect.dispatchEvent(event);
      }

      showTemplateError('Custom template cleared.');
    };

    clearCustomTemplateBtn.addEventListener('click', handleClearCustomTemplate);
    clearCustomTemplateStatusBtn.addEventListener(
      'click',
      handleClearCustomTemplate
    );

    // Cancel editing
    cancelEditBtn.addEventListener('click', () => {
      templateEditorForm.style.display = 'none';
      templateNameInput.value = '';
      templateDescriptionInput.value = '';
      templateContentTextarea.value = '';
    });

    // Edit custom template
    editCustomTemplateBtn.addEventListener('click', () => {
      const customTemplate = getCustomTemplate();

      if (customTemplate) {
        templateNameInput.value = customTemplate.name;
        templateDescriptionInput.value = customTemplate.description || '';
        templateContentTextarea.value = customTemplate.content;
        templateEditorForm.style.display = 'block';
      }
    });

    // Initialize
    updateCustomTemplateStatus();
  }

  // Handle start/stop button click
  function handleStartStopButton() {
    if (isConversationRunning) {
      stopConversation();
    } else {
      startConversation();
    }
  }

  // Handle pause button click
  function handlePauseButton() {
    if (activeConversation && isConversationRunning) {
      activeConversation.pause();

      // Update UI
      pauseButton.style.display = 'none';
      resumeButton.style.display = 'inline-block';

      // Ensure max turns, max output length, seed, and load conversation button remain disabled
      maxTurnsInput.disabled = true;
      // maxOutputLengthInput no longer exists
      seedInput.disabled = true;
      loadButton.disabled = true;
    }
  }

  // Handle resume button click
  function handleResumeButton() {
    if (activeConversation && isConversationRunning) {
      activeConversation.resume();

      // Update UI
      pauseButton.style.display = 'inline-block';
      resumeButton.style.display = 'none';

      // Ensure max turns, seed, and load conversation button remain disabled
      maxTurnsInput.disabled = true;
      seedInput.disabled = true;
      loadButton.disabled = true;
    }
  }

  // Stop the active conversation
  function stopConversation() {
    if (activeConversation) {
      activeConversation.stop();
      addOutputMessage('System', 'Conversation stopped by user.');
    }
  }

  // Load conversation from a text file
  function loadConversation(text: string) {
    // Stop any active conversation (should never happen as button is disabled when started)
    if (activeConversation && isConversationRunning) {
      stopConversation();
    }

    // Clear existing conversation
    conversationOutput.innerHTML = '';

    try {
      // Use regex to find all message blocks
      // Each message starts with a header line "### Actor [timestamp] ###"
      const messageRegex = /### (.*?) \[(.*?)\] ###\n([\s\S]*?)(?=\n### |$)/g;
      let match;

      while ((match = messageRegex.exec(text)) !== null) {
        const actor = match[1];
        const timestamp = match[2];
        const content = match[3].trim();

        if (content) {
          // Add the message to the UI
          addOutputMessage(actor, content);
        }
      }

      // Show export button after loading
      exportButton.style.display = 'block';

      // Add a system message indicating successful load
      addOutputMessage('System', 'Conversation loaded successfully.');
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
    const conversationText = Array.from(conversationOutput.children)
      .map((child) => {
        const header = child.querySelector('.actor-header')?.textContent || '';
        const content =
          child.querySelector('.response-content')?.textContent || '';
        return `${header}\n${content}\n`;
      })
      .join('\n');

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
      exploreModeOutputs.innerHTML = '';
      return;
    }

    // Check if this is an explore mode message
    if (elementId && elementId.startsWith('explore-')) {
      // Create or update explore output
      // The selection state will be managed by the exploreSelectionCallback
      createExploreOutput(elementId, actor, content);
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

  // Start conversation
  async function startConversation() {
    // Hide export button when starting a new conversation
    exportButton.style.display = 'none';

    // Clear previous output
    conversationOutput.innerHTML = '';

    // Reset usage tracking for new conversation
    resetUsageTracking();

    // Get all model selects
    const allModelSelects = document.querySelectorAll(
      '.model-select'
    ) as NodeListOf<HTMLSelectElement>;

    // Get selected models
    const models: string[] = Array.from(allModelSelects).map(
      (select) => select.value
    );

    // Get template
    const templateName = templateSelect.value;

    // Get max turns
    const maxTurns = maxTurnsInput.value
      ? parseInt(maxTurnsInput.value)
      : Infinity;

    // Get max tokens for each model
    const maxTokensPerModel: number[] = [];
    for (let i = 0; i < models.length; i++) {
      const maxTokensInput = document.getElementById(
        `max-tokens-${i}`
      ) as HTMLInputElement;
      let maxTokens = maxTokensInput.value
        ? parseInt(maxTokensInput.value)
        : 512;
      // Ensure the value is within the valid range
      maxTokens = Math.max(1, Math.min(maxTokens, 1024));
      maxTokensPerModel.push(maxTokens);
    }

    // Disable max turns, max output length, seed fields, load conversation button,
    // and explore mode controls when conversation is in the "started" state (even if paused)
    maxTurnsInput.disabled = true;
    seedInput.disabled = true;
    loadButton.disabled = true;

    // Disable all explore mode toggles and number inputs
    const exploreToggles = document.querySelectorAll(
      '[id^="explore-mode-toggle-"]'
    ) as NodeListOf<HTMLInputElement>;
    const exploreNumInputs = document.querySelectorAll(
      '[id^="explore-mode-num-requests-"]'
    ) as NodeListOf<HTMLInputElement>;
    const maxTokensInputs = document.querySelectorAll(
      '[id^="max-tokens-"]'
    ) as NodeListOf<HTMLInputElement>;

    exploreToggles.forEach((toggle) => {
      toggle.disabled = true;
      // Also add disabled class to the parent toggle switch container
      const toggleContainer = toggle.closest('.toggle-switch');
      if (toggleContainer) {
        toggleContainer.classList.add('disabled');
      }
    });

    exploreNumInputs.forEach((input) => {
      input.disabled = true;
    });

    // Disable all max tokens inputs
    maxTokensInputs.forEach((input) => {
      input.disabled = true;
    });

    // Disable model and template dropdowns
    allModelSelects.forEach((select) => {
      select.disabled = true;
    });
    templateSelect.disabled = true;

    // Disable template-related buttons
    const templateButtons = [
      document.getElementById('edit-current-template') as HTMLButtonElement,
      document.getElementById('import-template') as HTMLButtonElement,
      document.getElementById('edit-custom-template') as HTMLButtonElement,
    ];

    templateButtons.forEach((button) => {
      if (button) {
        button.disabled = true;
      }
    });

    // Get API keys
    const apiKeys: ApiKeys = {
      hyperbolicApiKey: hyperbolicKeyInput.value,
      openrouterApiKey: openrouterKeyInput.value,
    };

    // Validate required API keys
    const requiredApis: Record<string, string> = {};

    for (const model of models) {
      const company = MODEL_INFO[model].company;
      if (company === 'hyperbolic' || company === 'hyperbolic_completion') {
        requiredApis['hyperbolicApiKey'] = 'Hyperbolic API Key';
      } else if (company === 'openrouter') {
        requiredApis['openrouterApiKey'] = 'OpenRouter API Key';
      }
    }

    // Check if any required API keys are missing
    const missingKeys: string[] = [];
    for (const [key, name] of Object.entries(requiredApis)) {
      if (!apiKeys[key as keyof ApiKeys]) {
        missingKeys.push(name);
      }
    }

    if (missingKeys.length > 0) {
      addOutputMessage(
        'System',
        `Error: Missing required API key(s): ${missingKeys.join(', ')}`
      );
      return;
    }

    try {
      // Update UI to show we're in conversation mode
      startButton.textContent = 'Stop Conversation';
      startButton.classList.add('stop');
      isConversationRunning = true;

      // Verify template exists and has the correct number of models
      try {
        const templateModelCount = await getTemplateModelCount(templateName);
        if (templateModelCount !== models.length) {
          throw new Error(
            `Invalid template: Number of models (${models.length}) does not match the number of elements in the template (${templateModelCount})`
          );
        }
      } catch (error) {
        throw new Error(
          `Invalid template: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Load template config
      const configs = await loadTemplate(templateName, models);

      // Extract system prompts and contexts
      const systemPrompts = configs.map(
        (config) => config.system_prompt || null
      );
      const contexts = configs.map((config) => config.context || []);

      // Get seed value if provided
      let seed: number | undefined = undefined;
      if (seedInput.value.trim()) {
        seed = parseInt(seedInput.value);
      }

      // Get explore mode settings
      const exploreModeSettings = loadExploreModeSettings();

      // Check if any model has explore mode enabled
      const isExploreEnabled = Object.values(exploreModeSettings).some(
        (setting) => setting.enabled
      );

      // Only show pause button if no model has explore mode enabled
      pauseButton.style.display = isExploreEnabled ? 'none' : 'inline-block';

      // Make sure the explore mode container is visible if needed
      exploreModeContainer.style.display = isExploreEnabled ? 'block' : 'none';

      // Clear explore mode outputs
      exploreModeOutputs.innerHTML = '';

      // Start conversation
      activeConversation = new Conversation(
        models,
        systemPrompts,
        contexts,
        apiKeys,
        maxTurns,
        maxTokensPerModel,
        addOutputMessage,
        seed,
        exploreModeSettings,
        exploreSelectionCallback,
        updateUsageWithResponse
      );

      addOutputMessage(
        'System',
        `Starting conversation with template "${templateName}"...`
      );
      await activeConversation.start();
    } catch (error) {
      console.error('Conversation error:', error);
      addOutputMessage(
        'System',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      // Reset UI on error
      isConversationRunning = false;
      startButton.textContent = 'Start Conversation';
      startButton.classList.remove('stop');
      pauseButton.style.display = 'none';
      resumeButton.style.display = 'none';
      exportButton.style.display = 'block';

      // Re-enable all explore mode toggles and number inputs
      exploreToggles.forEach((toggle) => {
        toggle.disabled = false;
        // Also remove disabled class from the parent toggle switch container
        const toggleContainer = toggle.closest('.toggle-switch');
        if (toggleContainer) {
          toggleContainer.classList.remove('disabled');
        }
      });

      exploreNumInputs.forEach((input) => {
        input.disabled = false;
      });

      // Re-enable all max tokens inputs
      maxTokensInputs.forEach((input) => {
        input.disabled = false;
      });

      // Re-enable model and template dropdowns
      allModelSelects.forEach((select) => {
        select.disabled = false;
      });
      templateSelect.disabled = false;

      // Re-enable template-related buttons
      const templateButtons = [
        document.getElementById('edit-current-template') as HTMLButtonElement,
        document.getElementById('import-template') as HTMLButtonElement,
        document.getElementById('edit-custom-template') as HTMLButtonElement,
      ];

      templateButtons.forEach((button) => {
        if (button) {
          button.disabled = false;
        }
      });

      // Re-enable max turns, seed fields and load conversation button
      maxTurnsInput.disabled = false;
      seedInput.disabled = false;
      loadButton.disabled = false;
    }
  }

  // Initialize usage tracking
  initializeUsageTracking();
});

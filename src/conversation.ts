import {
  Message,
  ApiKeys,
  ModelInfo,
  StreamingCallback,
  ExploreModeSettings,
  ExploreStreamingCallback,
  ParallelResponse,
  SelectionCallback,
  ModelResponse,
  UsageData,
} from './types';
import { MODEL_INFO } from './models';
import {
  hyperbolicCompletionConversation,
  openrouterConversation,
  getOpenRouterGenerationCost,
} from './api';
import { loadFromLocalStorage, getModelDisplayName } from './utils';

// Async cost updater function for OpenRouter
export async function updateOpenRouterCostAsync(
  generationId: string,
  modelDisplayName: string,
  originalUsage: UsageData,
  apiKeys: ApiKeys,
  usageCallback?: (modelDisplayName: string, usage: UsageData) => void
): Promise<void> {
  try {
    // Wait for the generation data to be available in OpenRouter's system
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const preciseCost = await getOpenRouterGenerationCost(
      generationId,
      apiKeys.openrouterApiKey
    );

    if (preciseCost !== null && usageCallback) {
      // Create updated usage data with precise cost
      const updatedUsage: UsageData = {
        ...originalUsage,
        cost: preciseCost,
      };

      // Call the usage callback with the updated cost
      usageCallback(modelDisplayName, updatedUsage);
    }
  } catch (error) {
    console.warn(
      'Failed to fetch precise cost from OpenRouter generations API:',
      error
    );
  }
}

export async function generateModelResponse(
  modelInfo: ModelInfo,
  actor: string,
  context: Message[],
  systemPrompt: string | null,
  apiKeys: ApiKeys,
  maxOutputLength: number = 1024,
  modelIndex?: number,
  onChunk?: StreamingCallback,
  abortSignal?: AbortSignal,
  seed?: number,
  usageCallback?: (modelDisplayName: string, usage: UsageData) => void
): Promise<ModelResponse> {
  // Determine which API to use based on the company
  const company = modelInfo.company;

  if (company === 'hyperbolic_completion') {
    const result = await hyperbolicCompletionConversation(
      actor,
      modelInfo.api_name,
      context,
      systemPrompt,
      apiKeys.hyperbolicApiKey,
      maxOutputLength,
      onChunk,
      abortSignal,
      seed
    );
    return result;
  } else if (company === 'openrouter') {
    // If this is the custom OpenRouter model, use the saved API name
    let apiName = modelInfo.api_name;

    if (modelInfo.is_custom_selector && modelIndex !== undefined) {
      const savedModel = loadFromLocalStorage(
        `openrouter_custom_model_${modelIndex}`,
        null
      );
      if (savedModel) {
        try {
          const savedModelData = JSON.parse(savedModel);
          if (savedModelData.id) {
            apiName = savedModelData.id;
          }
        } catch (e) {
          console.error('Error parsing saved model:', e);
        }
      }
    }

    const result = await openrouterConversation(
      actor,
      apiName,
      context,
      systemPrompt,
      apiKeys.openrouterApiKey,
      maxOutputLength,
      onChunk,
      abortSignal,
      seed
    );

    // If we have a generation ID, trigger async cost update
    if (result.generationId && usageCallback) {
      // Trigger async cost update without blocking
      updateOpenRouterCostAsync(
        result.generationId,
        actor,
        result.usage,
        apiKeys,
        usageCallback
      ).catch((error) => {
        console.warn('Async cost update failed:', error);
      });
    }

    return result;
  } else {
    throw new Error(`Unsupported model company: ${company}`);
  }
}

export class Conversation {
  private models: string[];
  private modelDisplayNames: string[];
  private systemPrompts: (string | null)[];
  private contexts: Message[][];
  private apiKeys: ApiKeys;
  private outputCallback: (
    actor: string,
    response: string,
    elementId?: string,
    isLoading?: boolean
  ) => void;
  private isRunning: boolean = false;
  private isPaused: boolean = false; // New state for pause functionality
  private maxTurns: number;
  private maxTokensPerModel: number[];
  private seed?: number; // Optional seed for deterministic responses
  private currentTurn: number = 0;
  private currentResponses: Map<string, string> = new Map(); // Track responses for each model
  private abortController: AbortController | null = null; // For cancelling API requests

  // Explore mode properties
  private exploreModeSettings: ExploreModeSettings;
  private selectionCallback: SelectionCallback | null = null;
  private isExploreMode: boolean = false;
  private parallelResponses: Map<string, ParallelResponse> = new Map(); // Track parallel responses for explore mode
  private selectedResponseId: string | null = null; // Track which response was selected
  private exploreAbortControllers: Map<string, AbortController> = new Map(); // For cancelling parallel requests
  private selectedMainOutputId: string | null = null; // Track the ID for the selected response in the main output
  private selectedMainOutputContent: string = ''; // Track the content for the selected response in the main output
  private usageCallback?: (modelDisplayName: string, usage: UsageData) => void; // Callback for usage tracking
  private currentExploreUsage: UsageData = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cost: 0,
  }; // Track usage for current explore mode

  constructor(
    models: string[],
    systemPrompts: (string | null)[],
    contexts: Message[][],
    apiKeys: ApiKeys,
    maxTurns: number = Infinity,
    maxTokensPerModel: number[] | number = 1024,
    outputCallback: (
      actor: string,
      response: string,
      elementId?: string,
      isLoading?: boolean
    ) => void,
    seed?: number,
    exploreModeSettings: ExploreModeSettings = {},
    selectionCallback: SelectionCallback | null = null,
    usageCallback?: (modelDisplayName: string, usage: UsageData) => void
  ) {
    this.models = models;
    this.systemPrompts = systemPrompts;
    this.contexts = contexts;
    this.apiKeys = apiKeys;
    this.maxTurns = maxTurns;

    // Handle both array and single number for backward compatibility
    if (Array.isArray(maxTokensPerModel)) {
      this.maxTokensPerModel = maxTokensPerModel;
    } else {
      // If a single number is provided, create an array with the same value for all models
      this.maxTokensPerModel = Array(models.length).fill(maxTokensPerModel);
    }

    this.outputCallback = outputCallback;
    this.seed = seed;
    this.exploreModeSettings = exploreModeSettings;
    this.selectionCallback = selectionCallback;
    this.usageCallback = usageCallback;

    // Generate model display names
    this.modelDisplayNames = models.map((model, index) => {
      const displayName = getModelDisplayName(model, index, MODEL_INFO[model]);
      return `${displayName} ${index + 1}`;
    });

    // Check if explore mode is enabled for any model
    this.isExploreMode = Object.values(exploreModeSettings).some(
      (setting) => setting.enabled
    );
  }

  /**
   * Get current max tokens for a model from localStorage
   */
  private getCurrentMaxTokens(modelIndex: number): number {
    const saved = loadFromLocalStorage(`max-tokens-${modelIndex}`, '512');
    const value = parseInt(saved);
    return Math.max(1, Math.min(value || 512, 1024));
  }

  /**
   * Get current explore mode settings from localStorage
   */
  private getCurrentExploreModeSettings(): ExploreModeSettings {
    return loadFromLocalStorage('exploreModeSettings', {});
  }

  public async start(): Promise<void> {
    // Clean up any existing abort controller
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.isRunning = true;
    this.currentTurn = 0;

    while (this.isRunning && this.currentTurn < this.maxTurns) {
      await this.processTurn();
      this.currentTurn++;
    }

    this.outputCallback('System', `Conversation ended.`);
  }

  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;

    // Cancel any in-progress API requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public pause(): void {
    if (this.isRunning && !this.isPaused) {
      this.isPaused = true;
    }
  }

  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
    }
  }

  public isPausedState(): boolean {
    return this.isPaused;
  }

  /**
   * Handles selection of a response in explore mode
   * @param responseId The ID of the selected response
   */
  public handleSelection(responseId: string): void {
    // Check if the response exists
    if (!this.parallelResponses.has(responseId)) {
      console.error(`Response with ID ${responseId} not found`);
      return;
    }

    // Mark this response as selected
    this.selectedResponseId = responseId;

    // Get the selected response
    const selectedResponse = this.parallelResponses.get(responseId);

    // Update all responses to reflect selection
    for (const [id, response] of this.parallelResponses.entries()) {
      const isSelected = id === responseId;
      this.parallelResponses.set(id, {
        ...response,
        isSelected,
      });

      // Cancel all other requests
      if (!isSelected && this.exploreAbortControllers.has(id)) {
        this.exploreAbortControllers.get(id)?.abort();
        this.exploreAbortControllers.delete(id);
      }
    }

    // Extract model index from responseId
    // Format is "explore-timestamp-modelIndex-optionNumber"
    const parts = responseId.split('-');
    let modelIndex = 0;

    if (parts.length >= 4) {
      try {
        modelIndex = parseInt(parts[2]);
      } catch (e) {
        console.error('Error parsing responseId parts:', e);
      }
    }

    // Create a unique ID for this response in the main output
    this.selectedMainOutputId = `main-output-${Date.now()}`;

    // Initialize the content with what we have so far
    this.selectedMainOutputContent = selectedResponse
      ? selectedResponse.content
      : '';

    // If the response is already complete, output it to the main output window immediately
    // Otherwise, the streaming callback will handle it
    if (selectedResponse && selectedResponse.isComplete) {
      this.outputCallback(
        this.modelDisplayNames[modelIndex],
        this.selectedMainOutputContent,
        this.selectedMainOutputId,
        false
      );
    }

    // Notify the selection callback if provided
    if (this.selectionCallback) {
      this.selectionCallback(responseId);
    }
  }

  /**
   * Creates a streaming callback for explore mode
   * @param responseId The ID of the response
   * @returns A streaming callback function
   */
  private createExploreStreamingCallback(
    responseId: string
  ): StreamingCallback {
    return (chunk: string, isDone: boolean) => {
      if (!this.isRunning) {
        return;
      }

      // Get current response
      const response = this.parallelResponses.get(responseId);
      if (!response) {
        return;
      }

      // Update content
      const updatedContent = response.content + chunk;

      // Update response in map
      this.parallelResponses.set(responseId, {
        ...response,
        content: updatedContent,
        isComplete: isDone,
      });

      // Extract model index and option number from responseId
      // Format is "explore-timestamp-modelIndex-optionNumber"
      const parts = responseId.split('-');
      let modelIndex = 0;
      let optionNumber = 0;

      if (parts.length >= 4) {
        try {
          modelIndex = parseInt(parts[2]);
          optionNumber = parseInt(parts[3]);
        } catch (e) {
          console.error('Error parsing responseId parts:', e);
        }
      }

      const modelName =
        modelIndex < this.modelDisplayNames.length
          ? this.modelDisplayNames[modelIndex]
          : `Model ${modelIndex + 1}`;

      // Always update the explore window with cursor
      this.outputCallback(
        `${modelName}`,
        updatedContent + (isDone ? '' : '█'),
        responseId,
        false
      );

      // If this is the selected response, also update the main output window with cursor
      if (response.isSelected && this.selectedMainOutputId) {
        // Update the accumulated content
        this.selectedMainOutputContent = updatedContent;

        // Update the main output window with cursor
        this.outputCallback(
          modelName,
          this.selectedMainOutputContent + (isDone ? '' : '█'),
          this.selectedMainOutputId,
          false
        );

        // Notify the selection callback if provided
        if (this.selectionCallback) {
          this.selectionCallback(responseId);
        }
      }
    };
  }

  /**
   * Makes parallel requests for explore mode
   * @param modelIndex The index of the model
   * @returns The selected response content and usage data
   */
  private async makeParallelRequests(
    modelIndex: number,
    maxTokens: number
  ): Promise<{ response: string; usage?: UsageData }> {
    const modelKey = this.models[modelIndex];
    const modelInfo = MODEL_INFO[modelKey];
    const modelName = this.modelDisplayNames[modelIndex];
    const currentExploreModeSettings = this.getCurrentExploreModeSettings();
    const exploreSetting = currentExploreModeSettings[modelIndex];

    if (!exploreSetting || !exploreSetting.enabled) {
      throw new Error(`Explore mode is not enabled for model ${modelName}`);
    }

    const numRequests = exploreSetting.numRequests;

    // Clear the explore mode outputs container by sending a special message
    // This ensures the UI is cleared before new parallel requests start
    const clearContainerId = `clear-explore-outputs-${Date.now()}`;
    this.outputCallback(
      'System',
      'clear-explore-outputs',
      clearContainerId,
      true
    );

    // Reset parallel responses and selected response
    this.parallelResponses.clear();
    this.selectedResponseId = null;
    this.selectedMainOutputId = null;
    this.selectedMainOutputContent = '';

    // Reset explore usage tracking
    this.currentExploreUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
    };

    // Clear any existing abort controllers
    for (const controller of this.exploreAbortControllers.values()) {
      controller.abort();
    }
    this.exploreAbortControllers.clear();

    // Create promises for parallel requests
    const requestPromises: Promise<void>[] = [];

    // Create parallel responses
    for (let i = 0; i < numRequests; i++) {
      const responseId = `explore-${Date.now()}-${modelIndex}-${i}`;

      // Initialize response
      this.parallelResponses.set(responseId, {
        id: responseId,
        content: '',
        isSelected: false,
        isComplete: false,
      });

      // Create abort controller for this request
      const abortController = new AbortController();
      this.exploreAbortControllers.set(responseId, abortController);

      // Create streaming callback
      const streamingCallback = this.createExploreStreamingCallback(responseId);

      // Make the request
      const requestPromise = generateModelResponse(
        modelInfo,
        `${modelName}`,
        this.contexts[modelIndex],
        this.systemPrompts[modelIndex],
        this.apiKeys,
        maxTokens,
        modelIndex,
        streamingCallback,
        abortController.signal,
        this.seed ? this.seed + i : undefined, // Use different seeds for diversity
        this.usageCallback
      )
        .then((modelResponse) => {
          // Accumulate usage data from this response
          if (modelResponse.usage) {
            this.currentExploreUsage.promptTokens +=
              modelResponse.usage.promptTokens;
            this.currentExploreUsage.completionTokens +=
              modelResponse.usage.completionTokens;
            this.currentExploreUsage.totalTokens +=
              modelResponse.usage.totalTokens;
            this.currentExploreUsage.cost =
              (this.currentExploreUsage.cost || 0) +
              (modelResponse.usage.cost || 0);
          }

          // Mark as complete
          const currentResponse = this.parallelResponses.get(responseId);
          if (currentResponse) {
            this.parallelResponses.set(responseId, {
              ...currentResponse,
              content: modelResponse.content,
              isComplete: true,
              usage: modelResponse.usage,
            });

            // If this is the selected response, update the main output window with the final content
            if (currentResponse.isSelected && this.selectedMainOutputId) {
              // Update the accumulated content
              this.selectedMainOutputContent = modelResponse.content;

              // Final update without cursor
              this.outputCallback(
                this.modelDisplayNames[modelIndex],
                this.selectedMainOutputContent,
                this.selectedMainOutputId,
                false
              );

              // If we have a selection callback, notify it
              if (this.selectionCallback) {
                this.selectionCallback(responseId);
              }
            }
          }
        })
        .catch((error) => {
          console.error(
            `Error in parallel request ${i} for ${modelName}:`,
            error
          );

          // If this was a cancelled request, just log it
          if (error instanceof Error && error.message === 'Request cancelled') {
            console.log(`Request ${i} for ${modelName} was cancelled`);
          } else {
            // For other errors, update the response with an error message
            const currentResponse = this.parallelResponses.get(responseId);
            if (currentResponse) {
              const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;

              this.parallelResponses.set(responseId, {
                ...currentResponse,
                content: errorMessage,
                isComplete: true,
              });

              // If this is the selected response, update the main output window with the error
              if (currentResponse.isSelected && this.selectedMainOutputId) {
                // Update the accumulated content
                this.selectedMainOutputContent = errorMessage;

                // Final update without cursor
                this.outputCallback(
                  this.modelDisplayNames[modelIndex],
                  this.selectedMainOutputContent,
                  this.selectedMainOutputId,
                  false
                );

                // If we have a selection callback, notify it
                if (this.selectionCallback) {
                  this.selectionCallback(responseId);
                }
              }
            }
          }
        });

      requestPromises.push(requestPromise);
    }

    // Wait for user to select a response AND for it to complete
    return new Promise<{ response: string; usage?: UsageData }>(
      (resolve, reject) => {
        // Create a function to check if a response has been selected and completed
        const checkSelectionAndCompletion = () => {
          if (this.selectedResponseId) {
            const selectedResponse = this.parallelResponses.get(
              this.selectedResponseId
            );
            if (selectedResponse) {
              // Only resolve if the selected response is complete
              if (selectedResponse.isComplete) {
                resolve({
                  response: selectedResponse.content,
                  usage:
                    this.currentExploreUsage.totalTokens > 0
                      ? this.currentExploreUsage
                      : undefined,
                });
              } else {
                // If selected but not complete, check again in 200ms
                setTimeout(checkSelectionAndCompletion, 200);
              }
            } else {
              console.error(
                'Selected response not found in parallelResponses map'
              );
              reject(new Error('Selected response not found'));
            }
          } else if (!this.isRunning) {
            reject(new Error('Conversation stopped'));
          } else {
            // No selection yet, check again in 200ms
            setTimeout(checkSelectionAndCompletion, 200);
          }
        };

        // Start checking for selection and completion
        checkSelectionAndCompletion();
      }
    );
  }

  private async processTurn(): Promise<void> {
    // Create a new AbortController for this turn
    this.abortController = new AbortController();

    for (let i = 0; i < this.models.length; i++) {
      if (!this.isRunning) break;

      // Check if conversation is paused before starting a new API request
      // This ensures we don't start new requests while paused
      while (this.isPaused && this.isRunning) {
        // Wait while paused
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // If we're no longer running after pause, break out
      if (!this.isRunning) break;

      // Check if explore mode is enabled for this model
      const currentExploreModeSettings = this.getCurrentExploreModeSettings();
      const exploreSetting = currentExploreModeSettings[i];
      const isExploreEnabled = exploreSetting && exploreSetting.enabled;

      try {
        let response: string;
        let usageData: UsageData | undefined;

        if (isExploreEnabled) {
          // Use explore mode with parallel requests
          // This will wait until a response is selected AND completed
          const result = await this.makeParallelRequests(
            i,
            this.getCurrentMaxTokens(i)
          );
          response = result.response;
          usageData = result.usage;

          // The response is already displayed in the main output window,
          // so we don't need to output it again
        } else {
          // Create a unique ID for this response
          const responseId = `response-${Date.now()}-${i}`;

          // Initialize empty response with retro cursor
          this.currentResponses.set(responseId, '');
          this.outputCallback(
            this.modelDisplayNames[i],
            '█',
            responseId,
            false
          );

          // Create streaming callback for this model
          const streamingCallback: StreamingCallback = (
            chunk: string,
            isDone: boolean
          ) => {
            if (!this.isRunning) return;

            // Get current accumulated response
            let currentResponse = this.currentResponses.get(responseId) || '';

            if (isDone) {
              // Final update without cursor
              this.outputCallback(
                this.modelDisplayNames[i],
                currentResponse,
                responseId,
                false
              );
            } else {
              // Update with new chunk and cursor
              currentResponse += chunk;
              this.currentResponses.set(responseId, currentResponse);

              // Always update the UI with new chunks, even when paused
              // This ensures ongoing API requests continue to display output
              this.outputCallback(
                this.modelDisplayNames[i],
                currentResponse + '█',
                responseId,
                false
              );
            }
          };

          // Store original usage data for comparison
          const originalUsageData = usageData;

          // Make the API call with streaming and pass the abort signal
          const modelResponse = await generateModelResponse(
            MODEL_INFO[this.models[i]],
            this.modelDisplayNames[i],
            this.contexts[i],
            this.systemPrompts[i],
            this.apiKeys,
            this.getCurrentMaxTokens(i),
            i, // Pass the model index
            streamingCallback, // Pass the streaming callback
            this.abortController.signal, // Pass the abort signal
            this.seed, // Pass the seed if provided
            this.usageCallback // Pass the usage callback for async cost updates
          );

          response = modelResponse.content;
          usageData = modelResponse.usage;
        }

        // Track usage data if available
        if (usageData && this.usageCallback) {
          this.usageCallback(this.modelDisplayNames[i], usageData);
        }

        // Check for conversation end signal
        if (response.includes('^C^C')) {
          const endMessage = `${this.modelDisplayNames[i]} has ended the conversation with ^C^C.`;
          this.outputCallback('System', endMessage);
          this.stop();
          return;
        }

        // Add response to all contexts
        for (let j = 0; j < this.contexts.length; j++) {
          const role = j === i ? 'assistant' : 'user';
          this.contexts[j].push({ role, content: response });
        }

        // Check if conversation is paused after completing this model's request
        // This ensures we don't immediately proceed to the next model while paused
        while (this.isPaused && this.isRunning) {
          // Wait while paused
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        // Check if this was a cancelled request
        if (error instanceof Error && error.message === 'Request cancelled') {
          // For cancelled requests, just ignore it
        } else {
          // For other errors, show the error message and stop the conversation
          this.outputCallback(
            'System',
            `Error: Failed to get response from ${this.modelDisplayNames[i]}: ${error instanceof Error ? error.message : String(error)}`,
            undefined,
            false
          );
          this.stop();
        }
      }
    }

    // Clean up the abort controller after the turn is complete
    this.abortController = null;
  }
}

import { Message, StreamingCallback } from './types';

// Define an interface for errors that should not be retried
interface NoRetryError extends Error {
  noRetry?: boolean;
}

// Helper function to retry a function with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 500
): Promise<T> {
  let retries = 0;
  let lastError: Error;

  while (retries <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if this is an abort error (request was cancelled)
      // or if the error has the noRetry flag set
      if (
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error as NoRetryError).noRetry === true
      ) {
        console.log('Not retrying due to error type or noRetry flag');
        throw error;
      }
      
      // If we've exhausted our retries, throw the error
      if (retries === maxRetries) {
        console.error(`Failed after ${retries + 1} attempts:`, error);
        throw error;
      }
      
      // Calculate delay with exponential backoff (500ms, 1000ms, etc.)
      const delay = initialDelay * Math.pow(2, retries);
      console.log(`Attempt ${retries + 1} failed, retrying in ${delay}ms...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }

  // This should never be reached due to the throw in the loop, but TypeScript needs it
  throw lastError!;
}

// Helper function to process streaming responses
async function processStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: StreamingCallback
): Promise<string> {
  const decoder = new TextDecoder();
  let fullText = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Signal completion
        onChunk('', true);
        break;
      }
      
      // Decode the chunk
      const chunk = decoder.decode(value, { stream: true });
      
      // Process the chunk (handle SSE format)
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            let content = '';
            
            // Extract content based on response format
            if (data.choices && data.choices[0]) {
              if (data.choices[0].text) {
                content = data.choices[0].text;
              } else if (data.choices[0].delta && data.choices[0].delta.content) {
                // OpenRouter streaming format (newer API versions)
                content = data.choices[0].delta.content;
              } else if (data.choices[0].message && data.choices[0].message.content) {
                // OpenRouter format (older API versions)
                content = data.choices[0].message.content;
              }
            }
            
            if (content) {
              if (fullText === '') {
                content = content.trimStart();
              }
              fullText += content;
              onChunk(content, false);
            }
            // ignore chunks without content
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }
  } catch (error) {
    // Check if this is an abort error (request was cancelled)
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('Stream reading was cancelled');
      throw new Error('Request cancelled');
    } else {
      console.error('Error reading stream:', error);
      throw error;
    }
  }
  
  return fullText;
}

export async function openrouterConversation(
  actor: string,
  model: string,
  context: Message[],
  systemPrompt: string | null,
  openrouterKey: string,
  maxTokens: number = 1024,
  onChunk?: StreamingCallback,
  abortSignal?: AbortSignal,
  seed?: number,
  isRawCompletion: boolean = false // Add isRawCompletion parameter
): Promise<string> {
  let requestBody: any;
  let apiUrl: string;

  if (isRawCompletion) {
    // Format messages into a completion prompt for raw completion
    let prompt = "";
    if (systemPrompt) {
      prompt += `System: ${systemPrompt}\n\n`;
    }

    for (const message of context.map(m => ({ role: m.role, content: m.content }))) {
      prompt += `${message.role}: ${message.content}\n\n`;
    }

    prompt += "assistant: ";

    requestBody = {
      model,
      prompt,
      temperature: 1.0,
      max_tokens: maxTokens,
      stream: true,
      // Add stop sequences if needed for raw completion
      stop: ["System:", "system:", "User:", "Assistant:", "user:", "assistant:"],
    };
    apiUrl = 'https://openrouter.ai/api/v1/completions'; // Use completions endpoint
  } else {
    // Chat completion format
    const messages = context.map(m => ({ role: m.role, content: m.content }));
    
    // Add system prompt if provided
    if (systemPrompt) {
      messages.unshift({ role: 'system', content: systemPrompt });
    }

    requestBody = {
      model,
      messages,
      temperature: 1.0,
      max_tokens: maxTokens,
      stream: true,
    };
    apiUrl = 'https://openrouter.ai/api/v1/chat/completions'; // Use chat completions endpoint
  }
  
  // Add seed if provided
  if (seed !== undefined) {
    requestBody.seed = seed;
  }

  // Create a flag to track if we've started receiving a response
  let hasStartedReceivingResponse = false;

  // Create a wrapper for onChunk that sets the flag when we receive content
  const onChunkWrapper: StreamingCallback | undefined = onChunk
    ? (chunk: string, isDone: boolean) => {
        if (chunk && !isDone) {
          hasStartedReceivingResponse = true;
        }
        onChunk(chunk, isDone);
      }
    : undefined;

  return withRetry(async () => {
    try {
      const response = await fetch(apiUrl, { // Use the determined API URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'backrooms.directory'
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      // Process the stream
      if (onChunkWrapper && response.body) {
        const reader = response.body.getReader();
        return processStream(reader, onChunkWrapper);
      } else {
        // Fallback to non-streaming for backward compatibility
        const data = await response.json();
        hasStartedReceivingResponse = true;
        // Handle response based on whether it's chat or raw completion
        return isRawCompletion ? data.choices[0].text : data.choices[0].message.content;
      }
    } catch (error) {
      // Check if this is an abort error (request was cancelled)
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('OpenRouter API request was cancelled');
        throw new Error('Request cancelled');
      }
      
      // If we've already started receiving a response, don't retry
      if (hasStartedReceivingResponse) {
        console.error('Error during OpenRouter API streaming (not retrying):', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const noRetryError = new Error(`OpenRouter API error (response already started): ${errorMessage}`);
        (noRetryError as NoRetryError).noRetry = true;
        throw noRetryError;
      }
      
      console.error('Error calling OpenRouter API (will retry):', error);
      throw error;
    }
  });
}

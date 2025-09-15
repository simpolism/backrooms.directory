/**
 * OAuth utility functions for OpenRouter PKCE flow
 */

// Constants
const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth';
const OPENROUTER_TOKEN_URL = 'https://openrouter.ai/api/v1/auth/keys';
const CODE_VERIFIER_STORAGE_KEY = 'openrouter_code_verifier';

/**
 * Generates a random string for use as a code verifier
 * @returns A random string of 43-128 characters
 */
export function generateCodeVerifier(): string {
  // Generate a random string of 43-128 characters
  const array = new Uint8Array(64); // 64 bytes = 512 bits
  crypto.getRandomValues(array);

  // Convert to base64url and ensure length is between 43-128 characters
  return base64UrlEncode(array.buffer).substring(0, 128);
}

/**
 * Creates a code challenge from a code verifier using SHA-256
 * @param codeVerifier The code verifier to hash
 * @returns A base64url encoded SHA-256 hash of the code verifier
 */
export async function createCodeChallenge(
  codeVerifier: string
): Promise<string> {
  // Create a SHA-256 hash of the code verifier
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);

  // Convert the hash to base64url encoding
  return base64UrlEncode(hash);
}

/**
 * Encodes an ArrayBuffer to base64url format
 * @param buffer The ArrayBuffer to encode
 * @returns A base64url encoded string
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  // Convert ArrayBuffer to base64
  const base64 = btoa(
    Array.from(new Uint8Array(buffer))
      .map((b) => String.fromCharCode(b))
      .join('')
  );

  // Convert base64 to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Stores the code verifier in sessionStorage
 * @param codeVerifier The code verifier to store
 */
export function storeCodeVerifier(codeVerifier: string): void {
  sessionStorage.setItem(CODE_VERIFIER_STORAGE_KEY, codeVerifier);
}

/**
 * Retrieves the code verifier from sessionStorage
 * @returns The stored code verifier or null if not found
 */
export function getCodeVerifier(): string | null {
  return sessionStorage.getItem(CODE_VERIFIER_STORAGE_KEY);
}

/**
 * Clears the code verifier from sessionStorage
 */
export function clearCodeVerifier(): void {
  sessionStorage.removeItem(CODE_VERIFIER_STORAGE_KEY);
}

/**
 * Initiates the OpenRouter OAuth flow
 * Generates a code verifier and challenge, stores the verifier, and redirects to OpenRouter
 */
export async function initiateOAuthFlow(): Promise<void> {
  try {
    // Generate code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);

    // Store the code verifier for later use
    storeCodeVerifier(codeVerifier);

    // Build the authorization URL
    const authUrl = new URL(OPENROUTER_AUTH_URL);
    authUrl.searchParams.append('callback_url', window.location.href);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

    // Redirect to OpenRouter
    window.location.href = authUrl.toString();
  } catch (error) {
    console.error('Error initiating OAuth flow:', error);
    throw error;
  }
}

/**
 * Exchanges an authorization code for an API key
 * @param code The authorization code from OpenRouter
 * @returns The API key
 */
export async function exchangeCodeForKey(code: string): Promise<string> {
  try {
    // Get the code verifier
    const codeVerifier = getCodeVerifier();
    if (!codeVerifier) {
      throw new Error('Code verifier not found. Please try again.');
    }

    // Exchange the code for an API key
    const response = await fetch(OPENROUTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        code_challenge_method: 'S256',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to exchange code for key: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();

    // Clear the code verifier as it's no longer needed
    clearCodeVerifier();

    // Return the API key
    return data.key;
  } catch (error) {
    console.error('Error exchanging code for key:', error);
    throw error;
  }
}

/**
 * Checks if the current URL contains an authorization code
 * @returns The authorization code or null if not found
 */
export function getAuthorizationCode(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('code');
}

/**
 * Cleans up the URL by removing the authorization code
 */
export function cleanupUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  window.history.replaceState({}, document.title, url.toString());
}

/**
 * Handles the OAuth callback
 * Extracts the authorization code, exchanges it for an API key, and updates the UI
 * @param onSuccess Callback function to call with the API key on success
 * @param onError Callback function to call with the error on failure
 */
export async function handleOAuthCallback(
  onSuccess: (apiKey: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    // Check if the URL contains an authorization code
    const code = getAuthorizationCode();
    if (!code) {
      return; // No code found, not a callback
    }

    // Clean up the URL
    cleanupUrl();

    // Exchange the code for an API key
    const apiKey = await exchangeCodeForKey(code);

    // Call the success callback
    onSuccess(apiKey);
  } catch (error) {
    // Call the error callback
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

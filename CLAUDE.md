# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Instructions

Never run the development server (pnpm run dev) as I already have it running locally. Focus only on making code changes to the files. If you need to verify changes, assume the dev server is already running and I can see the results. Under no circumstances should you attempt to start any development server.

## Project Overview

This is **backrooms.directory**, a TypeScript web application that enables AI conversations in the "backrooms" style - where multiple AI models engage in continuous conversations with each other. Users can watch these conversations unfold in real-time using their own API keys from OpenRouter and Hyperbolic.

## Development Commands

- **Start development server**: `npm run dev` (runs on port 9000)
- **Build for production**: `npm run build`
- **Install dependencies**: `npm install`
- **Type checking**: `npm run typecheck`
- **Linting**: `npm run lint` or `npm run lint:fix`
- **Formatting**: `npm run format` or `npm run format:check`

No testing commands are configured - the project relies on TypeScript compilation through webpack. Use npm throughout.

## Architecture Overview

### Core Components

- **src/app.ts**: Main application entry point and UI initialization. Handles DOM manipulation, event listeners, and orchestrates the entire user interface.
- **src/engine/conversationEngine.ts**: Core conversation logic and model response generation. Contains `generateModelResponse()` function that handles API routing between different providers.
- **src/api.ts**: API client implementations for OpenRouter and Hyperbolic services. Includes retry logic with exponential backoff for failed requests.
- **src/types.ts**: Central TypeScript type definitions for the entire application.
- **src/templates.ts**: Template system for conversation initialization using JSONL format.
- **src/models.ts**: Model configuration and metadata for available AI models.
- **src/utils.ts**: Utility functions for local storage, color generation, and common operations.
- **src/oauth.ts**: OAuth flow handling (primarily for OpenRouter authentication).

### State Management

- **src/state/settingsStore.ts**: Centralized settings store using localStorage with subscription pattern for reactive updates.
- **src/state/templateStore.ts**: Template persistence layer for custom templates.
- **src/state/schema.ts**: Type definitions for stored state.

### UI Controllers

- **src/ui/controllers/conversationController.ts**: Manages conversation lifecycle (start/pause/resume/stop).
- **src/ui/controllers/exploreModeController.ts**: Handles explore mode UI where users select from parallel model responses.
- **src/ui/controllers/modelSelectorController.ts**: Manages dynamic model selection UI.
- **src/ui/controllers/templateEditorController.ts**: Template editing functionality.
- **src/ui/controllers/usageController.ts**: Tracks and displays token usage and costs.

### Key Architecture Patterns

**API Provider Abstraction**: The application supports multiple LLM providers (OpenRouter, Hyperbolic) through a unified interface in `conversationEngine.ts`. The `generateModelResponse()` function routes to appropriate API clients based on model company.

**Template System**: Conversations are initialized using JSONL template files stored in `public/templates/`. Each line represents context for sequential models in the conversation. Templates support placeholders like `{lm1_company}` and `{lm1_actor}` that get replaced with actual model names.

**Explore Mode**: A sophisticated feature allowing users to generate multiple parallel responses from each model and select their preferred output to continue the conversation. This creates a "Choose Your Own Adventure" experience.

**State Management**: Uses a simple but effective subscription pattern in `settingsStore.ts` that notifies listeners when settings change, enabling reactive UI updates.

**Local Storage State**: All user settings (API keys, preferences, conversation history) are persisted in browser localStorage for a stateless deployment.

## Key Technical Details

- **Build System**: Webpack with TypeScript, CSS extraction, and automatic HTML generation
- **No Backend**: Pure frontend application - all API calls go directly to third-party providers
- **Streaming Support**: Real-time response streaming for better user experience
- **Error Handling**: Robust retry logic with exponential backoff for API failures (see `withRetry` in api.ts)
- **Responsive UI**: Font sizing, word wrap, and auto-scroll controls for different screen sizes
- **Custom Models**: Support for custom OpenRouter models via `persistence/customModels.ts`

## Template Format

Templates use JSONL (JSON Lines) format where each line defines the context for one model in the conversation:

```jsonl
{"system_prompt": "You are AI assistant 1", "context": []}
{"system_prompt": "You are AI assistant 2", "context": []}
```

Each template line must match the number of models selected. Templates support variable substitution for dynamic model names and companies.

## Security Considerations

API keys are stored in browser localStorage. The README explicitly warns users about this security limitation. Never commit API keys or sensitive data to the repository.

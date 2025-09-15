# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Instructions

Never run the development server (pnpm run dev) as I already have it running locally. Focus only on making code changes to the files. If you need to verify changes, assume the dev server is already running and I can see the results. Under no circumstances should you attempt to start any development server.

## Project Overview

This is **backrooms.directory**, a TypeScript web application that enables AI conversations in the "backrooms" style - where multiple AI models engage in continuous conversations with each other. Users can watch these conversations unfold in real-time using their own API keys from OpenRouter and Hyperbolic.

## Development Commands

- **Start development server**: `pnpm dev` (runs on port 9000)
- **Build for production**: `pnpm build`
- **Install dependencies**: `pnpm i`

No testing, or typecheck commands are configured - the project relies on TypeScript compilation through webpack. Use pnpm throughout instead of npm.

## Architecture Overview

### Core Components

- **src/app.ts**: Main application entry point and UI initialization. Handles DOM manipulation, event listeners, and orchestrates the entire user interface.
- **src/conversation.ts**: Core conversation logic and model response generation. Contains `generateModelResponse()` function that handles API routing between different providers.
- **src/api.ts**: API client implementations for OpenRouter and Hyperbolic services. Includes retry logic with exponential backoff for failed requests.
- **src/types.ts**: Central TypeScript type definitions for the entire application.
- **src/templates.ts**: Template system for conversation initialization using JSONL format.
- **src/models.ts**: Model configuration and metadata for available AI models.
- **src/utils.ts**: Utility functions for local storage, color generation, and common operations.
- **src/oauth.ts**: OAuth flow handling (primarily for potential future integrations).

### Key Architecture Patterns

**API Provider Abstraction**: The application supports multiple LLM providers (OpenRouter, Hyperbolic) through a unified interface in `conversation.ts`. The `generateModelResponse()` function routes to appropriate API clients based on model company.

**Template System**: Conversations are initialized using JSONL template files stored in `public/templates/`. Each line represents context for sequential models in the conversation.

**Explore Mode**: A sophisticated feature allowing users to generate multiple parallel responses from each model and select their preferred output to continue the conversation. This creates a "Choose Your Own Adventure" experience.

**Local Storage State**: All user settings (API keys, preferences, conversation history) are persisted in browser localStorage for a stateless deployment.

## Key Technical Details

- **Build System**: Webpack with TypeScript, CSS extraction, and automatic HTML generation
- **No Backend**: Pure frontend application - all API calls go directly to third-party providers
- **Streaming Support**: Real-time response streaming for better user experience
- **Error Handling**: Robust retry logic with exponential backoff for API failures
- **Responsive UI**: Font sizing, word wrap, and auto-scroll controls for different screen sizes

## Template Format

Templates use JSONL (JSON Lines) format where each line defines the context for one model in the conversation:

```jsonl
{"system_prompt": "You are AI assistant 1", "context": []}
{"system_prompt": "You are AI assistant 2", "context": []}
```

## Security Considerations

API keys are stored in browser localStorage. The README explicitly warns users about this security limitation. Never commit API keys or sensitive data to the repository.

# [backrooms.directory](https://backrooms.directory)

This repo replicates Scott Viteri's ["Universal Backrooms"](https://github.com/scottviteri/UniversalBackrooms) (specifically [cosmicoptima's fork](https://github.com/cosmicoptima/UniversalBackrooms)), itself a replication of Andy Ayrey's ["Backrooms"](https://dreams-of-an-electric-mind.webflow.io/), rewritten in typescript and runnable in a browser, so you can watch the backrooms in a browser with your own API keys.

## Configuration

As backrooms.directory is a static site, most settings will be saved to your browser's localStorage so that they persist across uses.

### API Keys

backrooms.directory currently uses [OpenRouter](https://openrouter.ai/) for all LLM completions. All models are available through the OpenRouter API.

**I know it's insecure to put your API keys in a browser, so use at your own risk.**

### Templates

Templates are "conversation starter" files used to initialize the conversation so the LLMs have some context. They're formatted as JSONL files, which are JSON files that support newlines. Each line specifies the context for each sequential model (so, a JSONL file with 2 lines will be a conversation between 2 models). The [meta template](public\templates\meta-template.jsonl) is a good starting point for writing your own.

Note that, for the purposes of chat completion, each LLM believes itself to be in the "assistant" role, while other models are "user" roles.

### Model Selection

The dropdown comes pre-populated with several commonly used models available on OpenRouter. There is also a "custom model" option, which will allow you to use any other model available on OpenRouter.

The "Max Completion Tokens" setting tells the provider the maximum length to generate. This can help you get shorter outputs to improve conversation speed, and also limit your API usage.

#### Explore Mode

If a model has Explore Mode enabled, then it will generate n different completions in parallel, and allow you to select which completion the model will reply with in the conversation. This gives the conversation a "Choose Your Own Adventure" quality. You can use Explore Mode on any configuration of available models.

Note that since it must make n API calls, one per possible completion, Explore Mode will consume tokens more rapidly, so I recommend reducing the Max Completion Tokens setting when using Explore Mode.

### Output Settings

Miscellaneous configuration:

- **Font Size** changes the text size rendered in the output windows. Useful on small or large screens.
- **Word Wrap** is included as the models sometimes like to generate ASCII art, which is easier to see without word wrap.
- **Auto-Scroll** can be annoying when you want to back-read while a conversation is in progress, so it can be toggled as well.
- **Max Conversation Turns** will automatically stop the conversation after N turns.
- **Seed** will provide a seed to the API endpoints, allowing you to run a deterministic conversation. Useful for testing template changes, or replaying a different branch on Explore Mode.
- **Load Previous Conversation** will parse an exported conversation back into the conversation window. This is mainly useful for capturing screenshots or reviewing historical conversation data, as conversations can't be restarted once stopped.

## Local Setup

To run locally, first install packages with `pnpm i` then run the development server with `pnpm dev`.

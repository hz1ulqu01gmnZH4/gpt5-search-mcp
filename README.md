# GPT-5 Search MCP Server

An MCP (Model Context Protocol) server that provides access to OpenAI's GPT-5 model with web search and advanced reasoning capabilities.

## Features

- **GPT-5 Integration**: Direct access to OpenAI's latest GPT-5 reasoning model
- **Web Search**: Built-in web search capabilities for up-to-date information
- **Type Safety**: Full TypeScript types with Zod validation for API responses
- **Error Handling**: Robust error handling with retry logic and structured error messages
- **Multiple Variants**: Different tools for various use cases:
  - `gpt5-search`: Main tool with web search and medium reasoning
  - `gpt5`: Pure reasoning without web search
  - `gpt5-low`: Fast responses with low reasoning effort
  - `gpt5-high`: Deep analysis with high reasoning effort
  - `gpt5-mini`: Using the smaller gpt-5-mini model
  - `gpt5-nano`: Using the smallest gpt-5-nano model

## Installation

```bash
npm install
npm run build
```

## Configuration

Set your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY=your-api-key-here
```

Optional environment variables:
- `SEARCH_CONTEXT_SIZE`: Controls web search context size (`low`, `medium`, `high`). Default: `medium`
- `REASONING_EFFORT`: Controls reasoning effort (`low`, `medium`, `high`). Default: `medium`

## Usage with Claude Code

Add to your Claude Code configuration (`.claude/config.json`):

```json
{
  "mcpServers": {
    "gpt5-search": {
      "command": "node",
      "args": ["/path/to/gpt5-search-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### gpt5-search
Main tool with web search capabilities. Best for queries requiring current information.

### gpt5
Pure reasoning without web search. Best for complex problem-solving that doesn't need current data.

### gpt5-low
Fast responses with low reasoning effort and web search. Good for simple queries.

### gpt5-high
High reasoning effort with web search. Best for complex problems requiring deep analysis.

### gpt5-mini
Uses the gpt-5-mini model - smaller, faster, and less expensive.

### gpt5-nano
Uses the gpt-5-nano model - smallest and fastest for simple queries.

## Implementation Details

### Architecture Improvements (v0.0.2)
- **Tool Factory Pattern**: Single `createTool` function eliminates code duplication
- **Configuration Registry**: Centralized `toolConfigs` object manages all tool variants
- **Type Safety**: Zod schemas validate API responses with proper TypeScript inference
- **Error Handling**: 
  - Custom `HttpError` class for structured errors
  - Automatic retry with exponential backoff for transient failures
  - Respects `Retry-After` headers for rate limiting
  - User-friendly error messages for different status codes

### API Response Format

The GPT-5 API returns a structured response with:
- Reasoning tokens (hidden but billed)
- Web search calls (if web search is enabled)
- Final message with text and URL citations

## Testing

Run the test script to verify the server is working:

```bash
node test-mcp.js
```

## License

MIT
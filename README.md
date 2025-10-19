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
  - `gpt5-pro`: ⚠️ **EXPENSIVE** - Premium GPT-5 Pro model (use only when explicitly requested)

## Limitations

⚠️ **No Local File Access**: This MCP server does not provide file reading capabilities. The GPT-5 tools cannot access or read local files from your system. Only text prompts are sent to the OpenAI API.

- **What it CAN do**: Write gpt5-pro outputs to files, make web searches, perform reasoning
- **What it CANNOT do**: Read local files, access your filesystem, include file contents in prompts

If you need to provide file contents to GPT-5, you must copy/paste the content into your prompt manually.

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
- `CLIENT_CWD`: Directory where gpt5-pro outputs will be saved. Default: server's current working directory

## Usage with Claude Code

Add to your Claude Code configuration (`.claude/config.json`):

```json
{
  "mcpServers": {
    "gpt5-search": {
      "command": "node",
      "args": ["/path/to/gpt5-search-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here",
        "CLIENT_CWD": "${workspaceFolder}"
      }
    }
  }
}
```

**Note**: The `CLIENT_CWD` variable controls where gpt5-pro output files are saved. Use `${workspaceFolder}` to save files in your current working directory, or specify an absolute path.

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

### gpt5-pro ⚠️
**EXPENSIVE MODEL - Use Only When Explicitly Requested**

Uses the `gpt-5-pro-2025-10-06` model with maximum reasoning capabilities and web search. This is a premium, high-cost model that provides the most advanced reasoning and analysis capabilities.

**Important Notes**:
- This model should only be invoked when the user explicitly requests it due to its significantly higher cost
- **Automatic File Output**: Due to extremely large output sizes that can crash clients, gpt5-pro responses are automatically saved to files in the `gpt5-pro-outputs/` directory
- The tool returns only a preview (first 1000 chars) and the file path
- Files are named with timestamps: `gpt5-pro-YYYY-MM-DDTHH-MM-SS-mmmZ.txt`
- Output location can be controlled with the `CLIENT_CWD` environment variable

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

WTFPL - Do What The Fuck You Want To Public License
---
name: gpt5-search
description: Search the web and get AI-powered answers using GPT-5 or GPT-5.2 models. Use when you need current information, web search results, or want to consult GPT-5/5.2 for complex analysis, coding questions, or research. Requires OPENAI_API_KEY environment variable.
---

# GPT-5/5.2 Web Search Skill

This skill provides access to OpenAI's GPT-5 and GPT-5.2 models with integrated web search capabilities.

## When to Use

- Searching for current/recent information not in your training data
- Getting GPT-5.2's perspective on complex coding or architecture questions
- Research tasks requiring web search with AI synthesis
- Troubleshooting errors by searching for solutions
- Fact-checking or verifying current information

## Usage

Run the search script from the skill directory:

```bash
# Basic query with GPT-5.2 (default)
node /home/ak/gpt5-search-mcp/skill/scripts/gpt5-search.js "your query here"

# Use GPT-5 instead
node /home/ak/gpt5-search-mcp/skill/scripts/gpt5-search.js --model gpt-5 "your query"

# High reasoning effort for complex problems
node /home/ak/gpt5-search-mcp/skill/scripts/gpt5-search.js --effort high "complex question"

# Read query from stdin (useful for long queries)
echo "your long query here" | node /home/ak/gpt5-search-mcp/skill/scripts/gpt5-search.js --stdin
```

## Options

| Option | Short | Values | Default | Description |
|--------|-------|--------|---------|-------------|
| `--model` | `-m` | `gpt-5`, `gpt-5.2` | `gpt-5.2` | Model to use |
| `--effort` | `-e` | `low`, `medium`, `high` | `medium` | Reasoning effort level |
| `--search-context` | `-s` | `low`, `medium`, `high` | `medium` | Web search context size |
| `--no-search` | | | | Disable web search |
| `--stdin` | | | | Read query from stdin |

## Model Comparison

| Feature | GPT-5 | GPT-5.2 |
|---------|-------|---------|
| Context Window | 200K | 400K |
| Max Output | 64K | 128K |
| Knowledge Cutoff | Jan 2025 | Aug 2025 |
| Best For | General tasks | Coding & agentic tasks |
| Price (input/output) | $1.25/$10 | $1.75/$14 |

## Examples

### Search for recent information
```bash
node /home/ak/gpt5-search-mcp/skill/scripts/gpt5-search.js "What are the latest features in React 19?"
```

### Complex coding question with high reasoning
```bash
node /home/ak/gpt5-search-mcp/skill/scripts/gpt5-search.js -e high "How should I architect a distributed event sourcing system with CQRS?"
```

### Troubleshoot an error
```bash
node /home/ak/gpt5-search-mcp/skill/scripts/gpt5-search.js "TypeScript error TS2345 argument of type string not assignable to parameter"
```

### Research with large context
```bash
node /home/ak/gpt5-search-mcp/skill/scripts/gpt5-search.js -s high "Compare the major AI agent frameworks in 2025"
```

## Requirements

- Node.js 18+
- `OPENAI_API_KEY` environment variable set
- OpenAI account with GPT-5/5.2 access

## Error Handling

The script provides clear error messages for common issues:
- **Insufficient credits**: Check your OpenAI billing
- **Rate limited**: Wait and retry
- **Authentication failed**: Verify your API key
- **Service unavailable**: OpenAI is down, retry later

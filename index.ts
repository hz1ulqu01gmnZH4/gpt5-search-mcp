#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import OpenAI from "openai";
import { z } from "zod";

// ============================================================================
// Type Definitions
// ============================================================================

// Define schema for GPT-5 response structure
const GPT5OutputContent = z.object({
  type: z.literal("output_text"),
  text: z.string(),
  annotations: z.array(z.any()).optional(),
  logprobs: z.array(z.any()).optional(),
});

const GPT5MessageOutput = z.object({
  id: z.string(),
  type: z.literal("message"),
  status: z.literal("completed"),
  content: z.array(GPT5OutputContent),
  role: z.literal("assistant"),
});

const GPT5ReasoningOutput = z.object({
  id: z.string(),
  type: z.literal("reasoning"),
  summary: z.array(z.any()),
});

const GPT5WebSearchOutput = z.object({
  id: z.string(),
  type: z.literal("web_search_call"),
  status: z.literal("completed"),
  action: z.any().optional(),
});

const GPT5Output = z.union([
  GPT5MessageOutput,
  GPT5ReasoningOutput,
  GPT5WebSearchOutput,
]);

const GPT5Response = z.object({
  id: z.string(),
  object: z.literal("response"),
  created_at: z.number(),
  status: z.literal("completed"),
  model: z.string(),
  output: z.array(GPT5Output),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    total_tokens: z.number(),
    input_tokens_details: z.any().optional(),
    output_tokens_details: z.any().optional(),
  }).optional(),
});

// Inferred TypeScript types
type GPT5Response = z.infer<typeof GPT5Response>;
type GPT5Output = z.infer<typeof GPT5Output>;

// ============================================================================
// Error Handling
// ============================================================================

class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  opts = { retries: 2, baseDelayMs: 300 }
): Promise<T> {
  let attempt = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      const isHttp = e instanceof HttpError;
      const retriable = isHttp && (e.status === 429 || (e.status >= 500 && e.status <= 599));
      
      if (!retriable || attempt > opts.retries) {
        throw e;
      }
      
      const delayMs = (isHttp && e.retryAfterMs) || opts.baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// ============================================================================
// Tool Configuration
// ============================================================================

interface ToolConfig {
  model: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';
  reasoning: {
    effort: 'low' | 'medium' | 'high';
  };
  webSearch?: {
    enabled: boolean;
    contextSize?: 'low' | 'medium' | 'high';
  };
  description: string;
}

// Tool configurations registry
const toolConfigs: Record<string, ToolConfig> = {
  'gpt5-search': {
    model: 'gpt-5',
    reasoning: { effort: process.env.REASONING_EFFORT as 'low' | 'medium' | 'high' || 'medium' },
    webSearch: {
      enabled: true,
      contextSize: process.env.SEARCH_CONTEXT_SIZE as 'low' | 'medium' | 'high' || 'medium',
    },
    description: 'An AI agent with advanced web search capabilities using GPT-5. Useful for finding the latest information, troubleshooting errors, and discussing ideas or design challenges.',
  },
  'gpt5': {
    model: 'gpt-5',
    reasoning: { effort: process.env.REASONING_EFFORT as 'low' | 'medium' | 'high' || 'medium' },
    description: 'GPT-5 with advanced reasoning capabilities but without web search. Best for complex problem-solving, coding, and analysis that doesn\'t require current information.',
  },
  'gpt5-low': {
    model: 'gpt-5',
    reasoning: { effort: 'low' },
    webSearch: {
      enabled: true,
      contextSize: 'low',
    },
    description: 'GPT-5 with low reasoning effort and web search capabilities. Faster responses for simpler queries.',
  },
  'gpt5-high': {
    model: 'gpt-5',
    reasoning: { effort: 'high' },
    webSearch: {
      enabled: true,
      contextSize: 'high',
    },
    description: 'GPT-5 with high reasoning effort and web search capabilities. Best for complex problems requiring deep analysis and current information.',
  },
  'gpt5-mini': {
    model: 'gpt-5-mini',
    reasoning: { effort: process.env.REASONING_EFFORT as 'low' | 'medium' | 'high' || 'medium' },
    webSearch: {
      enabled: true,
      contextSize: process.env.SEARCH_CONTEXT_SIZE as 'low' | 'medium' | 'high' || 'medium',
    },
    description: 'GPT-5-mini model with web search capabilities. Smaller, faster, and less expensive but may provide less comprehensive responses.',
  },
  'gpt5-nano': {
    model: 'gpt-5-nano',
    reasoning: { effort: 'low' },
    webSearch: {
      enabled: true,
      contextSize: 'low',
    },
    description: 'GPT-5-nano model with web search capabilities. Smallest and fastest model for simple queries.',
  },
};

// ============================================================================
// Core Functions
// ============================================================================

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create server instance
const server = new McpServer({
  name: "gpt5-search-mcp",
  version: "0.0.2",
});

// Helper function to extract text from GPT-5 response
function extractResponseText(output: GPT5Output[]): string {
  // Find message outputs with text content
  const messageOutputs = output.filter(
    (item): item is z.infer<typeof GPT5MessageOutput> => item.type === 'message'
  );

  if (messageOutputs.length === 0) {
    return "No response text available.";
  }

  // Extract and concatenate all text content
  const texts = messageOutputs
    .flatMap(msg => msg.content)
    .filter(content => content.type === 'output_text')
    .map(content => content.text);

  return texts.join('\n\n') || "No response text available.";
}

// Tool factory function
function createTool(name: string, config: ToolConfig) {
  return server.tool(
    name,
    config.description,
    { 
      input: z.string().describe('Ask questions, search for information, or consult about problems in English.')
    },
    async ({ input }) => {
      try {
        // Build request parameters
        const requestParams: any = {
          model: config.model,
          reasoning: config.reasoning,
          input: input,
        };

        // Add web search tool if enabled
        if (config.webSearch?.enabled) {
          requestParams.tools = [{
            type: "web_search_preview",
            search_context_size: config.webSearch.contextSize || 'medium',
          }];
        }

        // Make API call with retry logic
        const response = await withRetry(async () => {
          try {
            const apiResponse = await openai.responses.create(requestParams);
            return apiResponse as any; // OpenAI SDK types don't match actual response
          } catch (error) {
            if (error instanceof Error && 'status' in error) {
              const status = (error as any).status;
              const body = (error as any).response?.data;
              
              // Extract retry-after header if available
              const retryAfter = (error as any).response?.headers?.['retry-after'];
              const retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : undefined;
              
              throw new HttpError(
                `OpenAI API error: ${error.message}`,
                status || 500,
                body,
                retryAfterMs
              );
            }
            throw error;
          }
        });

        // Validate response structure
        const validationResult = GPT5Response.safeParse(response);
        
        if (!validationResult.success) {
          console.error("Response validation failed:", validationResult.error);
          // Fall back to unvalidated extraction if validation fails
          const responseText = extractResponseText(response.output as any[]);
          return {
            content: [
              {
                type: "text",
                text: responseText,
              },
            ],
          };
        }

        // Extract text from validated response
        const responseText = extractResponseText(validationResult.data.output);

        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        };
      } catch (error) {
        console.error(`Error in tool ${name}:`, error);
        
        // Provide structured error response
        if (error instanceof HttpError) {
          let errorMessage = `Error (${error.status}): ${error.message}`;
          
          if (error.status === 429) {
            errorMessage = `Rate limited. ${error.retryAfterMs ? `Please retry after ${error.retryAfterMs / 1000} seconds.` : 'Please try again later.'}`;
          } else if (error.status === 401) {
            errorMessage = "Authentication failed. Please check your OPENAI_API_KEY.";
          } else if (error.status >= 500) {
            errorMessage = "OpenAI service is temporarily unavailable. Please try again later.";
          }
          
          return {
            content: [
              {
                type: "text",
                text: errorMessage,
              },
            ],
          };
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
        };
      }
    }
  );
}

// ============================================================================
// Register Tools
// ============================================================================

// Create all tools from configuration
Object.entries(toolConfigs).forEach(([name, config]) => {
  createTool(name, config);
});

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Check API key after connection is established
  if (!process.env.OPENAI_API_KEY) {
    process.stderr.write("Warning: OPENAI_API_KEY environment variable is not set. Tools will fail without it.\n");
  }
  
  // Use stderr for logging to avoid interfering with stdio protocol
  process.stderr.write("GPT-5 MCP Server running on stdio (v0.0.2 - refactored)\n");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
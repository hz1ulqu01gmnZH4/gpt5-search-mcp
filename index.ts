#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import OpenAI from "openai";
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "gpt5-search-mcp",
  version: "0.0.1",
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration from environment variables
const searchContextSize = (process.env.SEARCH_CONTEXT_SIZE || 'medium') as 'low' | 'medium' | 'high';
const reasoningEffort = (process.env.REASONING_EFFORT || 'medium') as 'low' | 'medium' | 'high';

// Helper function to extract text from GPT-5 response
function extractResponseText(output: any[]): string {
  // Find the message output with text content
  const messageOutput = output.find(item => item.type === 'message');
  if (messageOutput?.content?.[0]?.text) {
    return messageOutput.content[0].text;
  }
  
  // Fallback to concatenating all text content
  return output
    .filter(item => item.type === 'message')
    .flatMap(item => item.content || [])
    .filter(content => content.type === 'output_text')
    .map(content => content.text)
    .join('\n\n') || "No response text available.";
}

// Define the gpt5-search tool (main variant with web search)
server.tool(
  "gpt5-search",
  `An AI agent with advanced web search capabilities using GPT-5. Useful for finding the latest information, troubleshooting errors, and discussing ideas or design challenges. Supports natural language queries.`,
  { input: z.string().describe('Ask questions, search for information, or consult about complex problems in English.') },
  async ({ input }) => {
    try {
      const response = await openai.responses.create({
        model: 'gpt-5',
        reasoning: { effort: reasoningEffort },
        tools: [{
          type: "web_search_preview",
          search_context_size: searchContextSize,
        }],
        input: input,
      });

      const responseText = extractResponseText(response.output);

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
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

// Define gpt5 tool (without web search, pure reasoning)
server.tool(
  "gpt5",
  `GPT-5 with advanced reasoning capabilities but without web search. Best for complex problem-solving, coding, and analysis that doesn't require current information.`,
  { input: z.string().describe('Ask questions or consult about complex problems in English.') },
  async ({ input }) => {
    try {
      const response = await openai.responses.create({
        model: 'gpt-5',
        reasoning: { effort: reasoningEffort },
        input: input,
      });

      const responseText = extractResponseText(response.output);

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
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

// Define gpt5-low tool (low reasoning effort with web search)
server.tool(
  "gpt5-low",
  `GPT-5 with low reasoning effort and web search capabilities. Faster responses for simpler queries.`,
  { input: z.string().describe('Ask questions, search for information, or consult about problems in English.') },
  async ({ input }) => {
    try {
      const response = await openai.responses.create({
        model: 'gpt-5',
        reasoning: { effort: 'low' },
        tools: [{
          type: "web_search_preview",
          search_context_size: 'low',
        }],
        input: input,
      });

      const responseText = extractResponseText(response.output);

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
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

// Define gpt5-high tool (high reasoning effort with web search)
server.tool(
  "gpt5-high",
  `GPT-5 with high reasoning effort and web search capabilities. Best for complex problems requiring deep analysis and current information.`,
  { input: z.string().describe('Ask questions, search for information, or consult about complex problems in English.') },
  async ({ input }) => {
    try {
      const response = await openai.responses.create({
        model: 'gpt-5',
        reasoning: { effort: 'high' },
        tools: [{
          type: "web_search_preview",
          search_context_size: 'high',
        }],
        input: input,
      });

      const responseText = extractResponseText(response.output);

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
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

// Define gpt5-mini tool (using gpt-5-mini model with web search)
server.tool(
  "gpt5-mini",
  `GPT-5-mini model with web search capabilities. Smaller, faster, and less expensive but may provide less comprehensive responses.`,
  { input: z.string().describe('Ask questions, search for information, or consult about problems in English.') },
  async ({ input }) => {
    try {
      const response = await openai.responses.create({
        model: 'gpt-5-mini',
        reasoning: { effort: reasoningEffort },
        tools: [{
          type: "web_search_preview",
          search_context_size: searchContextSize,
        }],
        input: input,
      });

      const responseText = extractResponseText(response.output);

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
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

// Define gpt5-nano tool (using gpt-5-nano model with web search)
server.tool(
  "gpt5-nano",
  `GPT-5-nano model with web search capabilities. Smallest and fastest model for simple queries.`,
  { input: z.string().describe('Ask questions, search for information, or consult about simple problems in English.') },
  async ({ input }) => {
    try {
      const response = await openai.responses.create({
        model: 'gpt-5-nano',
        reasoning: { effort: 'low' },
        tools: [{
          type: "web_search_preview",
          search_context_size: 'low',
        }],
        input: input,
      });

      const responseText = extractResponseText(response.output);

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("GPT-5 MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
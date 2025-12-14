#!/usr/bin/env node
/**
 * GPT-5/5.2 Search CLI Tool
 *
 * A standalone command-line tool for querying GPT-5 or GPT-5.2 with web search.
 * Can be used as a skill script or called directly from the terminal.
 *
 * Usage:
 *   npx ts-node gpt5-search.ts "your query here"
 *   npx ts-node gpt5-search.ts --model gpt-5.2 --effort high "your query"
 *   echo "your query" | npx ts-node gpt5-search.ts --stdin
 *
 * Environment:
 *   OPENAI_API_KEY - Required: Your OpenAI API key
 */
import OpenAI from "openai";
const defaultConfig = {
    model: 'gpt-5.2',
    effort: 'medium',
    searchContextSize: 'medium',
    webSearch: true,
};
// ============================================================================
// Argument Parsing
// ============================================================================
function parseArgs(args) {
    const config = { ...defaultConfig };
    let query = '';
    let useStdin = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--model':
            case '-m':
                const model = args[++i];
                if (model === 'gpt-5' || model === 'gpt-5.2') {
                    config.model = model;
                }
                else {
                    console.error(`Invalid model: ${model}. Use 'gpt-5' or 'gpt-5.2'`);
                    process.exit(1);
                }
                break;
            case '--effort':
            case '-e':
                const effort = args[++i];
                if (effort === 'low' || effort === 'medium' || effort === 'high') {
                    config.effort = effort;
                }
                else {
                    console.error(`Invalid effort: ${effort}. Use 'low', 'medium', or 'high'`);
                    process.exit(1);
                }
                break;
            case '--search-context':
            case '-s':
                const size = args[++i];
                if (size === 'low' || size === 'medium' || size === 'high') {
                    config.searchContextSize = size;
                }
                else {
                    console.error(`Invalid search context: ${size}. Use 'low', 'medium', or 'high'`);
                    process.exit(1);
                }
                break;
            case '--no-search':
                config.webSearch = false;
                break;
            case '--stdin':
                useStdin = true;
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
            default:
                if (!arg.startsWith('-')) {
                    query = arg;
                }
        }
    }
    if (useStdin) {
        return { config, query: '__STDIN__' };
    }
    return { config, query };
}
function printHelp() {
    console.log(`
GPT-5/5.2 Search CLI Tool

Usage:
  gpt5-search.ts [options] "your query"
  gpt5-search.ts --stdin [options]

Options:
  -m, --model <model>         Model to use: gpt-5 or gpt-5.2 (default: gpt-5.2)
  -e, --effort <level>        Reasoning effort: low, medium, high (default: medium)
  -s, --search-context <size> Search context size: low, medium, high (default: medium)
  --no-search                 Disable web search
  --stdin                     Read query from stdin
  -h, --help                  Show this help message

Environment:
  OPENAI_API_KEY              Required: Your OpenAI API key

Examples:
  gpt5-search.ts "What are the latest developments in AI?"
  gpt5-search.ts -m gpt-5.2 -e high "Explain quantum computing"
  echo "Search query" | gpt5-search.ts --stdin
`);
}
// ============================================================================
// API Call
// ============================================================================
async function queryGPT(query, config) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const requestParams = {
        model: config.model,
        reasoning: { effort: config.effort },
        input: query,
    };
    if (config.webSearch) {
        requestParams.tools = [{
                type: "web_search_preview",
                search_context_size: config.searchContextSize,
            }];
    }
    try {
        const response = await openai.responses.create(requestParams);
        // Extract text from response
        const messageOutputs = response.output?.filter((item) => item.type === 'message') || [];
        if (messageOutputs.length === 0) {
            return "No response text available.";
        }
        const texts = messageOutputs
            .flatMap((msg) => msg.content || [])
            .filter((content) => content.type === 'output_text')
            .map((content) => content.text);
        return texts.join('\n\n') || "No response text available.";
    }
    catch (error) {
        // Handle specific error types
        const errorType = error?.error?.type || error?.type;
        const errorCode = error?.error?.code || error?.code;
        const status = error?.status;
        if (errorType === 'insufficient_quota' || errorCode === 'insufficient_quota') {
            throw new Error('Insufficient OpenAI credits. Please check your billing at https://platform.openai.com/account/billing');
        }
        if (status === 429) {
            throw new Error('Rate limited. Please try again later.');
        }
        if (status === 401) {
            throw new Error('Authentication failed. Please check your OPENAI_API_KEY.');
        }
        if (status >= 500) {
            throw new Error('OpenAI service is temporarily unavailable. Please try again later.');
        }
        throw error;
    }
}
// ============================================================================
// Stdin Reading
// ============================================================================
async function readStdin() {
    return new Promise((resolve) => {
        let data = '';
        if (process.stdin.isTTY) {
            resolve('');
            return;
        }
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            resolve(data.trim());
        });
    });
}
// ============================================================================
// Main
// ============================================================================
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        printHelp();
        process.exit(1);
    }
    const { config, query: initialQuery } = parseArgs(args);
    let query = initialQuery;
    if (query === '__STDIN__') {
        query = await readStdin();
    }
    if (!query) {
        console.error('Error: No query provided');
        process.exit(1);
    }
    try {
        const result = await queryGPT(query, config);
        console.log(result);
    }
    catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}
main();

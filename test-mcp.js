#!/usr/bin/env node
import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Start the MCP server
const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env }
});

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Handle server output
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const json = JSON.parse(line);
        console.log('Server response:', JSON.stringify(json, null, 2));
      } catch {
        console.log('Server output:', line);
      }
    }
  });
});

// Send initialization
const init = {
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2025-01-07',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  },
  id: 1
};

console.log('Sending initialization...');
server.stdin.write(JSON.stringify(init) + '\n');

// Wait a bit then send a tool call
setTimeout(() => {
  const toolCall = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'gpt5-search',
      arguments: {
        input: 'What is the current weather in San Francisco?'
      }
    },
    id: 2
  };
  
  console.log('\nSending tool call...');
  server.stdin.write(JSON.stringify(toolCall) + '\n');
}, 1000);

// Close after 30 seconds
setTimeout(() => {
  console.log('\nClosing test client...');
  server.kill();
  process.exit(0);
}, 30000);

server.on('error', (err) => {
  console.error('Server error:', err);
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code || 0);
});
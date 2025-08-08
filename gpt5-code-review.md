Here are three concrete improvements with minimal, focused code you can drop in.

1) Reduce duplication: centralize endpoint metadata + use a tool factory
- Put the per-tool differences (path, method, input schema, response schema, request builder) into a single endpoints map.
- Build each tool from a single makeTool factory. This keeps UX the same (6 tools) while de-duplicating handler logic.

Example:
  // types and validation libs
  import { z } from 'zod';

  // 1) Define shared domain schemas (see section 2)
  const User = z.object({ id: z.string(), name: z.string(), email: z.string().email() });
  const UsersResponse = z.object({ users: z.array(User), nextPage: z.number().nullable().optional() });

  // 2) Endpoint registry describing all 6 “tools”
  const endpoints = {
    listUsers: {
      method: 'GET' as const,
      path: '/users',
      input: z.object({ page: z.number().int().min(1).default(1) }),
      response: UsersResponse,
      buildQuery: (input: { page: number }) => ({ page: String(input.page) }),
    },
    getUser: {
      method: 'GET' as const,
      path: (input: { id: string }) => `/users/${encodeURIComponent(input.id)}`,
      input: z.object({ id: z.string().min(1) }),
      response: z.object({ user: User }),
    },
    // ...4 more entries with only these bits changing
  } as const;

  type EndpointKey = keyof typeof endpoints;

  // 3) Typed HTTP client + error handling (see section 3 for details)
  class HttpError extends Error {
    constructor(
      message: string,
      public status: number,
      public body?: unknown,
      public retryAfterMs?: number,
    ) { super(message); }
  }

  async function fetchJson<T>(url: string, init: RequestInit, timeoutMs = 10_000): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      const body = text ? JSON.parse(text) : undefined;

      if (!res.ok) {
        const retryAfterHeader = res.headers.get('retry-after');
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
        throw new HttpError(
          `HTTP ${res.status} ${res.statusText}`,
          res.status,
          body,
          retryAfterMs,
        );
      }
      return body as T;
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new HttpError('Failed to parse JSON response', 502);
      }
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new HttpError('Request timed out', 504);
      }
      throw e;
    } finally {
      clearTimeout(id);
    }
  }

  // 4) Tool factory (shared logic)
  function makeTool<K extends EndpointKey>(key: K, baseUrl: string, authToken?: string) {
    const def = endpoints[key];

    // Convert zod to JSON Schema if your MCP server needs it; here we expose zod for brevity:
    const inputSchema = def.input; // replace with zodToJsonSchema(def.input) if needed

    return {
      name: key,
      description: `Calls ${key}`,
      // inputSchema: ...convert(def.input)...
      // For MCP SDKs that want a handler:
      handler: async (rawArgs: unknown) => {
        // Validate inputs at runtime
        const args = def.input.parse(rawArgs);

        // Build URL + init
        const url = typeof def.path === 'function'
          ? `${baseUrl}${def.path(args as any)}`
          : `${baseUrl}${def.path}`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        };

        const init: RequestInit = { method: def.method, headers };
        if (def.method === 'GET') {
          const qs = 'buildQuery' in def && def.buildQuery
            ? new URLSearchParams(def.buildQuery(args as any)).toString()
            : '';
          const fullUrl = qs ? `${url}?${qs}` : url;
          const json = await fetchJson<unknown>(fullUrl, init);
          const parsed = def.response.safeParse(json);
          if (!parsed.success) {
            throw new HttpError(`Response validation failed: ${parsed.error.message}`, 502, json);
          }
          return { content: [{ type: 'json', json: parsed.data }] };
        } else {
          init.body = JSON.stringify(args); // or def.buildBody(args)
          const json = await fetchJson<unknown>(url, init);
          const parsed = def.response.safeParse(json);
          if (!parsed.success) {
            throw new HttpError(`Response validation failed: ${parsed.error.message}`, 502, json);
          }
          return { content: [{ type: 'json', json: parsed.data }] };
        }
      },
    };
  }

  // 5) Build the six tools without duplication
  const BASE_URL = 'https://api.example.com';
  const AUTH = process.env.API_TOKEN;
  const tools = (Object.keys(endpoints) as EndpointKey[]).map(k => makeTool(k, BASE_URL, AUTH));

Why this helps:
- One place to change transport, auth, timeout, retries, logging.
- Easy to add the 7th tool: add an entry to endpoints, no copy/paste handler.

2) Add proper types: stop using any[]; validate at runtime
- Use unknown at the boundary, then validate and infer with zod (or io-ts) to turn data into typed objects.
- Export inferred TypeScript types for downstream code; you get autocomplete and safety.

Example:
  // Schemas
  const Project = z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string().datetime(),
  });
  const ProjectsResponse = z.object({
    projects: z.array(Project),
  });

  // Inferred static types
  type Project = z.infer<typeof Project>;
  type ProjectsResponse = z.infer<typeof ProjectsResponse>;

  // Parsing replaces any[]:
  const parsed = ProjectsResponse.safeParse(json);
  if (!parsed.success) throw new HttpError(`Response validation failed: ${parsed.error.message}`, 502);
  const projects: Project[] = parsed.data.projects;

Notes:
- Use unknown for untrusted input/output, never any.
- If your server must emit JSON schema, generate it from zod at build time and keep zod for runtime validation.

3) Better error handling: timeouts, status checks, retries, and user-friendly messages
- Always check response.ok and include response body snippet in errors when safe.
- Handle transient failures with optional retry for 429/5xx (exponential backoff, respect Retry-After).
- Add request timeouts with AbortController.
- Distinguish categories: input validation (400s), auth (401/403), not found (404), rate limit (429), server errors (5xx), parse/validation errors (bad upstream), timeouts.
- Surface structured errors to MCP so the model gets actionable context.

Optional retry wrapper:
  async function withRetry<T>(fn: () => Promise<T>, opts = { retries: 2, baseDelayMs: 300 }) {
    let attempt = 0;
    // simple backoff
    // For 429, use server-provided retryAfterMs if present
    while (true) {
      try {
        return await fn();
      } catch (e) {
        attempt++;
        const isHttp = e instanceof HttpError;
        const retriable = isHttp && (e.status === 429 || (e.status >= 500 && e.status <= 599));
        if (!retriable || attempt > opts.retries) throw e;
        const delayMs = (isHttp && e.retryAfterMs) || opts.baseDelayMs * 2 ** (attempt - 1);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

Use it in the handler:
  const json = await withRetry(() => fetchJson<unknown>(fullUrl, init));

Nice-to-haves:
- Add request IDs/correlation IDs to logs for tracing.
- Redact secrets in error messages.
- Map internal errors to clear user messages (e.g., “Rate limited, retry after Xs”).

Summary
- Reduce duplication: endpoint registry + tool factory (or a single parametric tool if you prefer).
- Proper types: use zod (or similar) to validate unknown -> typed data; eliminate any[].
- Error handling: typed HttpError, status checks, JSON parse guards, timeouts, and selective retries with backoff.

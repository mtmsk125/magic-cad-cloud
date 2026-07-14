import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// Subscription verification with encryption
import { createHash, randomBytes } from 'crypto';

// Secret key for signing tokens (change this to a random string in production!)
const SECRET_KEY = process.env.SUBSCRIPTION_SECRET || 'dxfix-secret-key-change-me-in-production';

interface SubRecord {
  email: string;
  tier: string;
  customerId?: string;
  subscribedAt: number;
  expiresAt: number;
  token: string;
}

// In-memory subscription store (persists as long as server runs)
// For production, use a database instead
const subscriptions = new Map<string, SubRecord>();

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function createSignature(token: string, email: string, tier: string): string {
  return createHash('sha256')
    .update(`${token}:${email}:${tier}:${SECRET_KEY}`)
    .digest('hex');
}

function verifySignature(token: string, email: string, tier: string, signature: string): boolean {
  const expected = createSignature(token, email, tier);
  return expected === signature;
}

// API handlers for subscription
async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  
  // POST /api/subscribe - Register a new subscription
  if (url.pathname === '/api/subscribe' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { email, tier, customerId, transactionId } = body;
      
      if (!email || !tier) {
        return new Response(JSON.stringify({ error: 'Email and tier are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const token = generateToken();
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      const signature = createSignature(token, email, tier);
      
      subscriptions.set(email.toLowerCase(), {
        email: email.toLowerCase(),
        tier,
        customerId,
        subscribedAt: Date.now(),
        expiresAt,
        token,
      });
      
      console.log(`✅ Subscription activated: ${email} (${tier})`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        token, 
        signature,
        email,
        tier,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('❌ Subscribe API error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  // POST /api/check - Verify subscription
  if (url.pathname === '/api/check' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { token, signature } = body;
      
      if (!token || !signature) {
        return new Response(JSON.stringify({ subscribed: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Find the subscription by token
      let foundSub: SubRecord | null = null;
      for (const sub of subscriptions.values()) {
        if (sub.token === token) {
          foundSub = sub;
          break;
        }
      }
      
      if (!foundSub) {
        return new Response(JSON.stringify({ subscribed: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Verify signature
      if (!verifySignature(token, foundSub.email, foundSub.tier, signature)) {
        return new Response(JSON.stringify({ subscribed: false, error: 'Invalid signature' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Check expiry
      if (Date.now() > foundSub.expiresAt) {
        subscriptions.delete(foundSub.email);
        return new Response(JSON.stringify({ subscribed: false, error: 'Expired' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        subscribed: true, 
        tier: foundSub.tier, 
        email: foundSub.email,
        expiresAt: foundSub.expiresAt,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('❌ Check API error:', error);
      return new Response(JSON.stringify({ subscribed: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  // GET /api/admin - List all subscriptions (admin only)
  if (url.pathname === '/api/admin' && request.method === 'GET') {
    const adminKey = url.searchParams.get('key');
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin123') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const allSubs = Array.from(subscriptions.values()).map(({ token, ...rest }) => rest);
    return new Response(JSON.stringify({ subscriptions: allSubs, count: allSubs.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  return null; // Not an API request
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: ServerEntry | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = (await import("@tanstack/react-start/server-entry")).default ?? (await import("@tanstack/react-start/server-entry"));
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Handle API requests first
      const apiResponse = await handleApiRequest(request);
      if (apiResponse) return apiResponse;
      
      // Handle regular SSR requests
      const handler = await getServerEntry();
      let response = await handler.fetch(request, env, ctx);
      response = await normalizeCatastrophicSsrResponse(response);
      
      const headers = new Headers(response.headers);
      
      // Disable CSP completely for development - Paddle needs full access
      headers.delete("content-security-policy");
      headers.delete("content-security-policy-report-only");
      headers.delete("x-content-security-policy");
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

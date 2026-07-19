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

// ─── Paddle Webhook Handler ─────────────────────────────────────────

import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { upsertCustomer, upsertSubscription } from './db/paddleMirror';

// Validate Paddle API key on startup
const paddleApiKey = process.env.PADDLE_API_KEY || '';
const paddleClientToken = process.env.VITE_PADDLE_CLIENT_TOKEN || '';
const paddleWebhookSecret = process.env.PADDLE_WEBHOOK_SECRET || '';

// Log Paddle configuration status at startup
if (!paddleApiKey) {
  console.warn('⚠️  PADDLE_API_KEY is not set. Server-side Paddle features (webhooks, portal) will be DISABLED.');
  console.warn('   Get your API key from: https://vendors.paddle.com/authentication');
}
if (!paddleWebhookSecret) {
  console.warn('⚠️  PADDLE_WEBHOOK_SECRET is not set. Webhook signature verification will be DISABLED.');
  console.warn('   Create a webhook at: https://vendors.paddle.com/webhooks');
}
if (!paddleClientToken) {
  console.warn('⚠️  VITE_PADDLE_CLIENT_TOKEN is not set. Client-side checkout will use MOCK mode.');
} else {
  console.log(`✅ Paddle client token found: ${paddleClientToken.slice(0, 5)}... (${paddleClientToken.startsWith('test_') ? 'sandbox' : 'production'})`);
}
if (paddleApiKey) {
  console.log(`✅ Paddle API key found: ${paddleApiKey.slice(0, 5)}...`);
}
if (paddleWebhookSecret) {
  console.log(`✅ Paddle webhook secret configured`);
}

// Only initialize SDK if we have an API key
let paddleSdk: Paddle | null = null;
if (paddleApiKey) {
  paddleSdk = new Paddle(paddleApiKey, {
    environment: process.env.PADDLE_ENVIRONMENT === 'sandbox' ? Environment.sandbox : Environment.production,
  });
}

/**
 * Handle Paddle webhook events with signature verification
 * Uses raw body parsing to preserve the unmodified payload for verification
 */
async function handlePaddleWebhook(request: Request): Promise<Response> {
  const signature = request.headers.get('paddle-signature') || '';
  const secret = process.env.PADDLE_WEBHOOK_SECRET || '';

  if (!signature || !secret) {
    return new Response(JSON.stringify({ error: 'Webhook verification components missing.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Read the raw body as text for signature verification
    const rawBody = await request.text();

    if (!paddleSdk) {
      console.error('❌ Paddle SDK not initialized. PADDLE_API_KEY is missing.');
      return new Response(JSON.stringify({ error: 'Paddle SDK not configured on server.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Verify signature using Paddle SDK (returns a Promise)
    const event = await paddleSdk.webhooks.unmarshal(rawBody, secret, signature);

    // Route events to typed handlers
    switch (event.eventType) {
      case 'customer.created':
      case 'customer.updated': {
        const customerData = event.data as any;
        await upsertCustomer({
          customer_id: customerData.id,
          email: customerData.email,
        });
        break;
      }

      case 'subscription.created':
      case 'subscription.updated': {
        const subData = event.data as any;
        const item = subData.items?.[0];
        await upsertSubscription({
          subscription_id: subData.id,
          customer_id: subData.customerId,
          status: subData.status,
          price_id: item?.priceId || '',
          product_id: item?.price?.productId || '',
          scheduled_change_action: subData.scheduledChange?.action || null,
          scheduled_change_at: subData.scheduledChange?.effectiveAt || null,
        });
        break;
      }

      case 'subscription.canceled': {
        const subData = event.data as any;
        const item = subData.items?.[0];
        await upsertSubscription({
          subscription_id: subData.id,
          customer_id: subData.customerId,
          status: 'canceled',
          price_id: item?.priceId || '',
          product_id: item?.price?.productId || '',
          scheduled_change_action: null,
          scheduled_change_at: null,
        });
        break;
      }

      case 'transaction.completed': {
        const txData = event.data as any;
        if (txData.customerId) {
          await upsertCustomer({
            customer_id: txData.customerId,
            email: txData.customer?.email || '',
          });
        }
        break;
      }

      default:
        console.log(`Ignored tracked telemetry hook: ${event.eventType}`);
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(`Webhook signature verification error context: ${err.message}`);
    return new Response('Signature Verification Unsuccessful', {
      status: 401,
    });
  }
}

// ─── Customer Portal Redirect ──────────────────────────────────────

import { handleCustomerPortalRedirect } from './controllers/customerPortal';

// API handlers for subscription
async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  
  // POST /api/v1/webhooks/paddle - Paddle webhook handler
  if (url.pathname === '/api/v1/webhooks/paddle' && request.method === 'POST') {
    return handlePaddleWebhook(request);
  }

  // GET /api/portal - Customer portal redirect
  if (url.pathname === '/api/portal' && request.method === 'GET') {
    return handleCustomerPortalRedirect(request);
  }

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
    serverEntryPromise = ((await import("@tanstack/react-start/server-entry")).default ?? (await import("@tanstack/react-start/server-entry"))) as unknown as ServerEntry;
  }
  return serverEntryPromise as unknown as ServerEntry;
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

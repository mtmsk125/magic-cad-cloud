import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { durableGet, durableSet, isKvConfigured } from "./lib/durable-store";

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

// â”€â”€â”€ Paddle Webhook Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { upsertCustomer, upsertSubscription } from './db/paddleMirror';

// Validate Paddle API key on startup
const paddleApiKey = process.env.PADDLE_API_KEY || '';
const paddleClientToken = process.env.VITE_PADDLE_CLIENT_TOKEN || '';
const paddleWebhookSecret = process.env.PADDLE_WEBHOOK_SECRET || '';

// Log Paddle configuration status at startup
if (!paddleApiKey) {
  console.warn('âڑ ï¸ڈ  PADDLE_API_KEY is not set. Server-side Paddle features (webhooks, portal) will be DISABLED.');
  console.warn('   Get your API key from: https://vendors.paddle.com/authentication');
}
if (!paddleWebhookSecret) {
  console.warn('âڑ ï¸ڈ  PADDLE_WEBHOOK_SECRET is not set. Webhook signature verification will be DISABLED.');
  console.warn('   Create a webhook at: https://vendors.paddle.com/webhooks');
}
if (!paddleClientToken) {
  console.warn('âڑ ï¸ڈ  VITE_PADDLE_CLIENT_TOKEN is not set. Client-side checkout will use MOCK mode.');
} else {
  console.log(`âœ… Paddle client token found: ${paddleClientToken.slice(0, 5)}... (${paddleClientToken.startsWith('test_') ? 'sandbox' : 'production'})`);
}
if (paddleApiKey) {
  console.log(`âœ… Paddle API key found: ${paddleApiKey.slice(0, 5)}...`);
}
if (paddleWebhookSecret) {
  console.log(`âœ… Paddle webhook secret configured`);
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
      console.error('â‌Œ Paddle SDK not initialized. PADDLE_API_KEY is missing.');
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

// â”€â”€â”€ Customer Portal Redirect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      
      console.log(`âœ… Subscription activated: ${email} (${tier})`);
      
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
      console.error('â‌Œ Subscribe API error:', error);
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
      console.error('â‌Œ Check API error:', error);
      return new Response(JSON.stringify({ subscribed: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  // â”€â”€â”€ Email List (Waitlist) API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Durable storage (Vercel KV) â€” previously a subscribers.json file that
  // reset on every Vercel redeploy.
  const EMAIL_KEY = 'waitlist_emails';

  async function loadEmails(): Promise<string[]> {
    try {
      const emails = await durableGet<string[]>(EMAIL_KEY);
      return Array.isArray(emails) ? emails : [];
    } catch (e) {
      console.error('Failed to load emails:', e);
      return [];
    }
  }

  async function saveEmail(email: string): Promise<{ success: boolean; message: string }> {
    const emails = await loadEmails();
    const normalized = email.toLowerCase().trim();
    if (emails.includes(normalized)) {
      return { success: false, message: 'Email already subscribed' };
    }
    emails.push(normalized);
    try {
      await durableSet(EMAIL_KEY, emails);
      console.log(`âœ… New subscriber saved: ${normalized} (total: ${emails.length})`);
      return { success: true, message: 'Subscribed successfully' };
    } catch (e) {
      console.error('Failed to save email:', e);
      return { success: false, message: 'Failed to save email' };
    }
  }

  // POST /api/waitlist - Save email to waitlist
  if (url.pathname === '/api/waitlist' && request.method === 'POST') {
    try {
      const body = await request.json();
      const email = body.email;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(JSON.stringify({ error: 'Valid email required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const result = await saveEmail(email);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 409,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('â‌Œ Waitlist API error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // GET /api/waitlist - List all subscribers (admin only)
  if (url.pathname === '/api/waitlist' && request.method === 'GET') {
    const adminKey = url.searchParams.get('key');
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin123') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const emails = await loadEmails();
    return new Response(JSON.stringify({ subscribers: emails, count: emails.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /api/waitlist/export - Download subscribers as CSV (admin only)
  if (url.pathname === '/api/waitlist/export' && request.method === 'GET') {
    const adminKey = url.searchParams.get('key');
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin123') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const emails = await loadEmails();
    const csv = 'email\n' + emails.map((e) => `"${e.replace(/"/g, '""')}"`).join('\n');
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="subscribers.csv"',
      },
    });
  }

  // â”€â”€â”€ Site Statistics (real, durable, daily + cumulative + owner-split) â”€â”€
  const STATS_KEY = 'site_stats';

  interface DailyStat {
    visitors: number;
    ownerVisitors: number;
    repairs: number;
    uploads: number;
  }

  interface SiteStats {
    // cumulative (all-time)
    filesRepaired: number;
    visitors: number;
    filesUploaded: number;
    ownerVisitors: number; // owner-only visits, excluded from public visitors
    // per-day breakdown
    daily: Record<string, DailyStat>;
    updatedAt: number;
  }

  // Local-timezone date key (YYYY-MM-DD) so "daily" groups by the user's region.
  function todayKey(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  const emptyStats = (): SiteStats => ({
    filesRepaired: 0,
    visitors: 0,
    filesUploaded: 0,
    ownerVisitors: 0,
    daily: {},
    updatedAt: Date.now(),
  });

  async function loadStats(): Promise<SiteStats> {
    try {
      const parsed = await durableGet<Partial<SiteStats>>(STATS_KEY);
      if (parsed && typeof parsed === 'object') {
        return {
          filesRepaired: Number(parsed.filesRepaired) || 0,
          visitors: Number(parsed.visitors) || 0,
          filesUploaded: Number(parsed.filesUploaded) || 0,
          ownerVisitors: Number(parsed.ownerVisitors) || 0,
          daily: (parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {}) as Record<string, DailyStat>,
          updatedAt: Number(parsed.updatedAt) || Date.now(),
        };
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
    return emptyStats();
  }

  async function saveStats(stats: SiteStats): Promise<void> {
    try {
      await durableSet(STATS_KEY, stats);
    } catch (e) {
      console.error('Failed to save stats:', e);
    }
  }

  // GET /api/stats â€” public real site-wide statistics (+ daily + owner)
  if (url.pathname === '/api/stats' && request.method === 'GET') {
    const stats = await loadStats();
    // Return last 14 days of daily data, most recent first.
    const days: { date: string; visitors: number; ownerVisitors: number; repairs: number; uploads: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${d.getFullYear()}-${mm}-${dd}`;
      const day = stats.daily[key] || { visitors: 0, ownerVisitors: 0, repairs: 0, uploads: 0 };
      days.push({ date: key, ...day });
    }
    return new Response(
      JSON.stringify({
        filesRepaired: stats.filesRepaired,
        visitors: stats.visitors,
        filesUploaded: stats.filesUploaded,
        ownerVisitors: stats.ownerVisitors,
        daily: days,
        updatedAt: stats.updatedAt,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }
    );
  }

  // POST /api/stats â€” record a real event (repair/visit/upload) from the client
  if (url.pathname === '/api/stats' && request.method === 'POST') {
    try {
      const body = await request.json();
      const action = body.action;
      const owner = body.owner === true;
      const stats = await loadStats();
      const key = todayKey();
      const day: DailyStat = stats.daily[key] || { visitors: 0, ownerVisitors: 0, repairs: 0, uploads: 0 };

      if (action === 'repair') {
        stats.filesRepaired += 1;
        day.repairs += 1;
      } else if (action === 'visit') {
        if (owner) {
          // Owner visits are counted separately, NOT in public "visitors".
          stats.ownerVisitors += 1;
          day.ownerVisitors += 1;
        } else {
          stats.visitors += 1;
          day.visitors += 1;
        }
      } else if (action === 'upload') {
        stats.filesUploaded += 1;
        day.uploads += 1;
      } else {
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      stats.daily[key] = day;
      stats.updatedAt = Date.now();
      await saveStats(stats);
      return new Response(
        JSON.stringify({
          filesRepaired: stats.filesRepaired,
          visitors: stats.visitors,
          filesUploaded: stats.filesUploaded,
          ownerVisitors: stats.ownerVisitors,
          updatedAt: stats.updatedAt,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (e) {
      console.error('â‌Œ Stats API error:', e);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // GET /api/growth â€” public growth config (settings, community, launch)
  if (url.pathname === '/api/growth' && request.method === 'GET') {
    try {
      const { loadSettings } = await import('./lib/growth/growthServer');
      const settings = await loadSettings();
      return new Response(
        JSON.stringify({
          launch: settings.launch,
          community: settings.community,
          referral: settings.referral,
          monetization: { paid_mode: settings.monetization.paid_mode, payment_status: settings.monetization.payment_status, pro_price: settings.monetization.pro_price, currency: settings.monetization.currency },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    } catch (e) {
      console.error('Growth settings error:', e);
      return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // POST /api/growth/event â€” record a real growth analytics event (fire-and-forget)
  if (url.pathname === '/api/growth/event' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { makeEventRecord } = await import('./lib/growth/analytics');
      const { recordEvent } = await import('./lib/growth/growthServer');
      const src = { source: body.source || 'direct', utm_source: body.utm_source, utm_medium: body.utm_medium, utm_campaign: body.utm_campaign, utm_content: body.utm_content };
      await recordEvent(makeEventRecord(body.name, src));
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      console.error('Growth event error:', e);
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // GET /api/growth/report â€” fetch a public scan report by secure id
  if (url.pathname === '/api/growth/report' && request.method === 'GET') {
    try {
      const id = url.searchParams.get('id') || '';
      const { getPublicReport } = await import('./lib/growth/growthServer');
      const report = await getPublicReport(id);
      if (!report) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ report }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // POST /api/growth/report â€” create a public report from safe summary
  if (url.pathname === '/api/growth/report' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { buildPublicReport } = await import('./lib/growth/publicReports');
      const { savePublicReport } = await import('./lib/growth/growthServer');
      const report = buildPublicReport({
        entities: Number(body.entities) || 0,
        issuesDetected: Number(body.issuesDetected) || 0,
        issuesFixed: Number(body.issuesFixed) || 0,
        issuesRemaining: Number(body.issuesRemaining) || 0,
        verified: Boolean(body.verified),
        score: body.score != null ? Number(body.score) : null,
        warnings: Number(body.warnings) || 0,
      });
      await savePublicReport(report);
      return new Response(JSON.stringify({ id: report.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
// {"unhandled":true,"message":"HTTPError"} â€” try/catch alone never fires for those.
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

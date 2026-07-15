/**
 * Customer Portal Redirect Controller
 * 
 * Handles redirecting authenticated users to Paddle's hosted customer portal
 * where they can manage their billing, subscriptions, and payment methods.
 */

import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { getCustomerByEmail } from '../db/paddleMirror';

const paddle = new Paddle(process.env.PADDLE_API_KEY || '', {
  environment: process.env.PADDLE_ENVIRONMENT === 'sandbox' ? Environment.sandbox : Environment.production,
});

/**
 * Handle customer portal redirect request
 * 
 * Authenticates the user from the server session, looks up their Paddle customer_id,
 * creates a portal session, and redirects them to the hosted portal.
 */
export async function handleCustomerPortalRedirect(req: Request): Promise<Response> {
  // In this serverless/edge environment, we check for a session token
  // The user must be authenticated via their subscription token
  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  if (!email || !token) {
    return new Response(JSON.stringify({ error: 'Authentication required before portal access.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Look up the customer in our mirror DB
    const customer = await getCustomerByEmail(email);
    if (!customer || !customer.customer_id) {
      return new Response(JSON.stringify({ error: 'No associated billing record found for this account.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create a Paddle portal session
    const portalSession = await paddle.customerPortalSessions.create(customer.customer_id, []);
    
    if (portalSession?.urls?.general?.overview) {
      return new Response(null, {
        status: 302,
        headers: { Location: portalSession.urls.general.overview },
      });
    } else {
      throw new Error('Paddle failed to generate the redirect portal configuration overview address.');
    }
  } catch (err: any) {
    console.error(`Portal Session Allocation Error: ${err.message}`);
    return new Response(JSON.stringify({ error: 'Failed to initialize administrative account access session.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
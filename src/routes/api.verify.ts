/**
 * API Route: Verify Subscription
 * GET /api/verify?email=user@example.com
 * Returns { subscribed: boolean, tier: string | null, email: string }
 */

import { createAPIFileRoute } from '@tanstack/react-start/api';
import { verifySubscription } from '@/lib/subscription-server';

export const Route = createAPIFileRoute('/api/verify')({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return new Response(JSON.stringify({ 
        subscribed: false, 
        tier: null, 
        error: 'Email is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const sub = verifySubscription(email);
    
    return new Response(JSON.stringify({
      subscribed: sub !== null,
      tier: sub?.tier || null,
      email,
      expiresAt: sub?.expiresAt || null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
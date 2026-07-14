/**
 * Subscription Server Verification
 * Server-side subscription validation and storage
 * Replaces insecure client-only localStorage approach
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export type SubscriptionTier = 'pro' | 'workshop' | 'enterprise' | 'free' | null;

export interface ServerSubscriptionData {
  email: string;
  tier: SubscriptionTier;
  customerId?: string;
  transactionId?: string;
  subscribedAt: number;
  expiresAt?: number;
  status: 'active' | 'cancelled' | 'expired';
}

interface SubscriptionStore {
  subscriptions: Record<string, ServerSubscriptionData>;
}

const DATA_DIR = join(process.cwd(), '.data');
const STORE_FILE = join(DATA_DIR, 'subscriptions.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getStore(): SubscriptionStore {
  ensureDataDir();
  if (!existsSync(STORE_FILE)) {
    return { subscriptions: {} };
  }
  try {
    const data = readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { subscriptions: {} };
  }
}

function saveStore(store: SubscriptionStore) {
  ensureDataDir();
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Verify if a user is subscribed (server-side)
 */
export function verifySubscription(email: string): ServerSubscriptionData | null {
  const store = getStore();
  const sub = store.subscriptions[email.toLowerCase()];
  
  if (!sub) return null;
  
  // Check if subscription is expired
  if (sub.expiresAt && Date.now() > sub.expiresAt) {
    sub.status = 'expired';
    saveStore(store);
    return null;
  }
  
  if (sub.status !== 'active') return null;
  
  return sub;
}

/**
 * Activate a subscription after successful Paddle payment
 */
export function activateSubscription(
  email: string,
  tier: SubscriptionTier,
  customerId?: string,
  transactionId?: string,
  webhookData?: any
): ServerSubscriptionData {
  const store = getStore();
  
  // Calculate expiry (30 days from now for monthly)
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  
  const subData: ServerSubscriptionData = {
    email: email.toLowerCase(),
    tier: tier || 'pro',
    customerId: customerId || '',
    transactionId: transactionId || '',
    subscribedAt: Date.now(),
    expiresAt,
    status: 'active',
  };
  
  store.subscriptions[email.toLowerCase()] = subData;
  saveStore(store);
  
  console.log(`✅ Subscription activated for ${email}: ${tier}`);
  return subData;
}

/**
 * Cancel a subscription
 */
export function cancelSubscription(email: string) {
  const store = getStore();
  const sub = store.subscriptions[email.toLowerCase()];
  
  if (sub) {
    sub.status = 'cancelled';
    saveStore(store);
    console.log(`❌ Subscription cancelled for ${email}`);
  }
}

/**
 * Get all active subscriptions (for admin)
 */
export function getAllSubscriptions(): ServerSubscriptionData[] {
  const store = getStore();
  return Object.values(store.subscriptions).filter(s => s.status === 'active');
}
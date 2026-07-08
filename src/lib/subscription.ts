/**
 * Subscription Management Library
 * Handles user subscription status, storage, and Paddle integration
 */

export type SubscriptionStatus = 'free' | 'pro' | 'workshop' | 'enterprise' | null;

export interface SubscriptionData {
  status: SubscriptionStatus;
  customerId?: string;
  subscriptionId?: string;
  email?: string;
  expiresAt?: number;
  lastChecked?: number;
}

const STORAGE_KEY = 'dxfix_subscription';
const STORAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if window is available (client-side)
 */
function isClient(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Get subscription data from localStorage
 */
export function getSubscriptionData(): SubscriptionData {
  if (!isClient()) {
    return { status: null };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { status: null };

    const data = JSON.parse(stored) as SubscriptionData;
    const now = Date.now();

    // Check if cached data has expired
    if (data.lastChecked && now - data.lastChecked > STORAGE_EXPIRY) {
      // Refresh check from Paddle
      return { status: null };
    }

    return data;
  } catch (e) {
    console.warn('Failed to parse subscription data:', e);
    return { status: null };
  }
}

/**
 * Save subscription data to localStorage
 */
export function saveSubscriptionData(data: SubscriptionData) {
  if (!isClient()) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...data,
      lastChecked: Date.now(),
    }));
  } catch (e) {
    console.error('Failed to save subscription data:', e);
  }
}

/**
 * Check if user is subscribed (not on free plan)
 */
export function isSubscribed(data?: SubscriptionData): boolean {
  const subscription = data || getSubscriptionData();
  return subscription.status !== null && subscription.status !== 'free';
}

/**
 * Mark user as free plan (after checkout cancellation)
 */
export function markAsFree() {
  saveSubscriptionData({ status: 'free' });
}

/**
 * Mark user as subscribed (pro or workshop)
 */
export function markAsSubscribed(
  status: 'pro' | 'workshop',
  customerId?: string,
  subscriptionId?: string,
  email?: string,
) {
  saveSubscriptionData({
    status,
    customerId,
    subscriptionId,
    email,
  });
}

/**
 * Clear all subscription data
 */
export function clearSubscriptionData() {
  if (!isClient()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear subscription data:', e);
  }
}

/**
 * Listen to Paddle checkout events
 */
export function initPaddleSubscriptionListener() {
  if (!isClient()) return;

  // Listen for Paddle checkout completion
  if (window.Paddle) {
    window.Paddle.Checkout?.addEventListener?.('complete', (data: any) => {
      // User completed checkout - mark as subscribed
      const subscriptionType = data.data?.plan?.name?.includes('Workshop')
        ? 'workshop'
        : 'pro';
      
      markAsSubscribed(
        subscriptionType,
        data.data?.customer?.id,
        data.data?.subscription?.id,
        data.data?.customer?.email,
      );

      // Redirect to tool
      window.location.href = '/tool';
    });
  }
}

/**
 * Handle Paddle subscription status after checkout
 */
export function handlePaddleCheckoutComplete(email: string) {
  if (!isClient()) return;

  // Mark user as having initiated subscription
  markAsSubscribed('pro', undefined, undefined, email);
}

// --- Free usage counter ---

const FREE_USAGE_STORAGE_KEY = 'dxfix_free_usage';

export const FREE_USAGE_LIMIT = 5;

/**
 * Get the current free usage count
 */
export function getFreeUsageCount(): number {
  if (!isClient()) return 0;
  try {
    const stored = localStorage.getItem(FREE_USAGE_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Increment the free usage counter and return the new count
 */
export function incrementFreeUsage(): number {
  if (!isClient()) return 0;
  const current = getFreeUsageCount();
  const newCount = current + 1;
  try {
    localStorage.setItem(FREE_USAGE_STORAGE_KEY, String(newCount));
  } catch {
    // ignore
  }
  return newCount;
}

/**
 * Reset free usage counter (called when user subscribes)
 */
export function resetFreeUsage() {
  if (!isClient()) return;
  try {
    localStorage.removeItem(FREE_USAGE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

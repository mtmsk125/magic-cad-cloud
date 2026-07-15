/**
 * Paddle Billing Mirror Layer
 * 
 * Database utilities for mirroring Paddle customer and subscription data.
 * Uses the existing in-memory subscription store from server.ts for now,
 * with a SQL-ready interface for future Postgres migration.
 */

// In-memory store (mirrors the server's subscription store)
// In production, replace with Postgres using the DATABASE_URL env var
interface CustomerRecord {
  customer_id: string;
  email: string;
  updated_at: number;
}

interface SubscriptionRecord {
  subscription_id: string;
  customer_id: string;
  status: string;
  price_id: string;
  product_id: string;
  scheduled_change_action: string | null;
  scheduled_change_at: string | null;
  updated_at: number;
}

const customers = new Map<string, CustomerRecord>();
const subscriptions = new Map<string, SubscriptionRecord>();

/**
 * Upsert a customer record
 */
export async function upsertCustomer(data: { customer_id: string; email: string }): Promise<void> {
  customers.set(data.customer_id, {
    customer_id: data.customer_id,
    email: data.email,
    updated_at: Date.now(),
  });
  console.log(`✅ Customer upserted: ${data.customer_id} (${data.email})`);
}

/**
 * Upsert a subscription record
 */
export async function upsertSubscription(data: {
  subscription_id: string;
  customer_id: string;
  status: string;
  price_id: string;
  product_id: string;
  scheduled_change_action: string | null;
  scheduled_change_at: string | null;
}): Promise<void> {
  subscriptions.set(data.subscription_id, {
    ...data,
    updated_at: Date.now(),
  });
  console.log(`✅ Subscription upserted: ${data.subscription_id} (${data.status})`);
}

/**
 * Check if a subscription grants paid access
 * Business logic: only 'active' and 'trialing' grant access.
 * Scheduled changes (cancel/pause) do NOT revoke access until status changes.
 */
export function checkPaidAccessEligibility(subscription: { status: string; scheduled_change_action: string | null }): boolean {
  return ['active', 'trialing'].includes(subscription.status);
}

/**
 * Get customer by email
 */
export async function getCustomerByEmail(email: string): Promise<CustomerRecord | null> {
  for (const customer of customers.values()) {
    if (customer.email.toLowerCase() === email.toLowerCase()) {
      return customer;
    }
  }
  return null;
}

/**
 * Get customer by ID
 */
export async function getCustomerById(customerId: string): Promise<CustomerRecord | null> {
  return customers.get(customerId) || null;
}

/**
 * Get subscription by ID
 */
export async function getSubscriptionById(subscriptionId: string): Promise<SubscriptionRecord | null> {
  return subscriptions.get(subscriptionId) || null;
}

/**
 * Get all subscriptions for a customer
 */
export async function getSubscriptionsByCustomerId(customerId: string): Promise<SubscriptionRecord[]> {
  const result: SubscriptionRecord[] = [];
  for (const sub of subscriptions.values()) {
    if (sub.customer_id === customerId) {
      result.push(sub);
    }
  }
  return result;
}
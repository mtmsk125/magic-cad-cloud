/**
 * growth/subscriptions.ts — Future subscription architecture.
 * Status strings per spec. Payment stays DISABLED until genuinely configured.
 */

export type SubscriptionStatus =
  | "launch_free"
  | "referral_free"
  | "trial"
  | "active"
  | "expired"
  | "cancelled"
  | "none";

export type PaymentStatus = "not_configured" | "configured" | "live";

// Configurable via admin (PRO_MONTHLY_PRICE / currency). Not hard-coded in UI.
export interface ProPlanConfig {
  price: number; // 9
  currency: string; // USD
}

/**
 * Effective access state for a user at a point in time.
 * launch_free / referral_free grant access; expired/none do not.
 */
export function currentAccess(opts: {
  subscription_status: SubscriptionStatus;
  launchActive: boolean;
  hasReferralReward: boolean;
  rewardDaysLeft: number;
  trialDaysLeft?: number;
}): { allowed: boolean; status: SubscriptionStatus; reason?: string } {
  if (opts.subscription_status === "active" || opts.subscription_status === "trial") {
    return { allowed: true, status: opts.subscription_status };
  }
  if (opts.launchActive && opts.subscription_status === "launch_free") {
    return { allowed: true, status: "launch_free" };
  }
  if (opts.hasReferralReward && opts.subscription_status === "referral_free" && opts.rewardDaysLeft > 0) {
    return { allowed: true, status: "referral_free" };
  }
  return { allowed: false, status: "expired", reason: "upgrade" };
}

/** Is the payment provider genuinely configured? (never assume real if unset) */
export function paymentConfigured(providerStatus: PaymentStatus): boolean {
  return providerStatus === "configured" || providerStatus === "live";
}

// Note: paymentConfigured guards against accidental paid UI.

export const PAYMENT_NOT_CONFIGURED = "PAYMENT_NOT_CONFIGURED";
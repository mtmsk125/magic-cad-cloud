/**
 * growth/referrals.ts — Referral code generation, attribution and qualifying.
 * Pure functions (no DOM/DB) so they are unit-testable.
 */

import { isoNow } from "./config";

export interface UserRecord {
  id: string;
  email: string;
  referral_code: string;
  referred_by?: string; // referrer's code
  referral_count: number; // qualified referrals this user got
  qualified_referrals: number;
  scans_count: number;
  reports_shared: number;
  reward_days: number; // active free days balance
  converted_from_referral?: boolean;
  subscribed_at?: number;
  subscription_status:
    | "launch_free"
    | "referral_free"
    | "trial"
    | "active"
    | "expired"
    | "cancelled"
    | "none";
  created_at: string;
  last_activity: string;
}

export interface ReferralEvent {
  id: string;
  referrer_code: string;
  invited_email: string;
  invited_id: string;
  qualified: boolean;
  rewarded: boolean;
  created_at: string;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

/** Generate a random referral code of the given length. */
export function generateReferralCode(length = 6, rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Ensure a code is unique against existing codes. */
export function generateUniqueReferralCode(
  existing: ReadonlySet<string>,
  rand?: () => number,
  attempts = 100
): string {
  for (let i = 0; i < attempts; i++) {
    const c = generateReferralCode(6, rand);
    if (!existing.has(c)) return c;
  }
  // extremely unlikely fallback: timestamp-hash
  return generateReferralCode(8, rand);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Is this address valid? Simple but sufficient. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/**
 * Attempt to attribute an invitee to a referrer.
 * Guards:
 *  - self referral (same email, or same as referrer)
 *  - duplicate email (invited email already exists)
 */
export function attributeReferral(opts: {
  inviteeEmail: string;
  referrerCode: string;
  existingEmails: ReadonlySet<string>;
  referrerEmail?: string;
  now?: number;
}): { ok: boolean; reason?: "self_referral" | "duplicate_email" | "unknown_referrer"; inviteeId?: string } {
  const email = normalizeEmail(opts.inviteeEmail);
  if (!isValidEmail(email)) return { ok: false, reason: "duplicate_email" };
  if (opts.referrerEmail && normalizeEmail(opts.referrerEmail) === email) {
    return { ok: false, reason: "self_referral" };
  }
  if (opts.existingEmails.has(email)) {
    return { ok: false, reason: "duplicate_email" };
  }
  if (!opts.referrerCode) return { ok: false, reason: "unknown_referrer" };
  return { ok: true, inviteeId: `u_${(opts.now ?? Date.now()).toString(36)}` };
}

/**
 * Whether a referral becomes QUALIFIED (not just a click).
 * Requires: valid email captured + scans completed.
 */
export function isQualifiedReferral(input: {
  invitedId?: string;
  scansCount: number;
  minScans: number;
  emailCaptured: boolean;
}): boolean {
  return Boolean(input.invitedId) && input.emailCaptured && input.scansCount >= input.minScans;
}

/**
 * Whether a reward may be granted to the referrer.
 * Guards: not already rewarded, referrer within referral limit.
 */
export function canGrantReferrerReward(input: {
  referral: ReferralEvent | undefined;
  referrerQualified: number;
  maxReferrals: number;
}): boolean {
  if (input.referral?.rewarded) return false; // already granted for this invite
  if (input.referrerQualified >= input.maxReferrals) return false; // limit reached
  return true;
}

/** Compute the free-days earned from a reward grant. */
export function rewardDays(settingsRewardDays: number, multiplier = 1): number {
  return Math.max(0, Math.floor(settingsRewardDays * multiplier));
}
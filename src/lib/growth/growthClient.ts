/**
 * growth/growthClient.ts — Client-side growth state (current browser session).
 * Persists the active user's referral identity, email-captured flag, referral
 * counts and earned days in localStorage. Production data is mirrored to server
 * endpoints (referrals/reports/events) defined in the backend.
 */

import { generateReferralCode } from "./referrals";

const REF_CODE_KEY = "g_ref_code";
const REFERRED_BY_KEY = "g_referred_by";
const EMAIL_KEY = "g_user_email";
const CAPTURED_KEY = "g_email_captured";
const SCANS_KEY = "g_scans_count";
const REPORTS_KEY = "g_reports_shared";
const REWARD_DAYS_KEY = "g_reward_days";
const QUALIFIED_COUNT_KEY = "g_qualified_count";

function ls(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}
function read(key: string): string | null {
  const l = ls();
  try {
    return l ? l.getItem(key) : null;
  } catch {
    return null;
  }
}
function write(key: string, val: string): void {
  const l = ls();
  try {
    l?.setItem(key, val);
  } catch {
    /* ignore */
  }
}
function num(key: string): number {
  const v = read(key);
  return v ? parseInt(v, 10) || 0 : 0;
}

/** Ensure the browser has a stable referral code (unique per user). */
export function ensureReferralCode(): string {
  let code = read(REFERRED_CODE_KEY_FALLBACK());
  if (code) return code;
  code = generateReferralCode(6);
  write(REFERRED_CODE_KEY_FALLBACK(), code);
  return code;
}

// fallback helper to keep single source of key names
function REFERRED_CODE_KEY_FALLBACK(): string {
  return REFERR_CODE_KEY_STABLE;
}
const REFERR_CODE_KEY_STABLE = "g_ref_code";

export function getReferralCode(): string | null {
  return read(REFERR_CODE_KEY_STABLE);
}

export function getReferralLink(origin?: string): string {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/?ref=${ensureReferralCode()}`;
}

export function setReferredBy(code: string | null): void {
  if (code) write(REFERRED_BY_KEY, code);
}
export function getReferredBy(): string | null {
  return read(REFERRED_BY_KEY);
}

export function markEmailCaptured(email: string): void {
  write(EMAIL_KEY, email.toLowerCase().trim());
  write(CAPTURED_KEY, "1");
}
export function isEmailCaptured(): boolean {
  return read(CAPTURED_KEY) === "1";
}
export function getCapturedEmail(): string | null {
  return read(EMAIL_KEY);
}

export function recordScan(): number {
  const next = num(SCANS_KEY) + 1;
  write(SCANS_KEY, String(next));
  return next;
}
export function getScansCount(): number {
  return num(SCANS_KEY);
}

export function recordReportShared(): number {
  const next = num(REPORTS_KEY) + 1;
  write(REPORTS_KEY, String(next));
  return next;
}
export function getReportsShared(): number {
  return num(REPORTS_KEY);
}

export function addRewardDays(days: number): number {
  const next = num(REWARD_DAYS_KEY) + days;
  write(REWARD_DAYS_KEY, String(next));
  return next;
}
export function getRewardDays(): number {
  return num(REWARD_DAYS_KEY);
}

export function getQualifiedCount(): number {
  return num(QUALIFIED_COUNT_KEY);
}
export function incrementQualifiedCount(step = 1): number {
  const next = num(QUALIFIED_COUNT_KEY) + step;
  write(QUALIFIED_COUNT_KEY, String(next));
  return next;
}

/** Cookie-style read of a query param value (used for ?ref= attribution). */
export function getQueryParam(params: URLSearchParams, key: string): string | null {
  return params.get(key);
}
/**
 * Viral Launch System
 * Handles email subscriptions, referral tracking, and viral unlock state
 * Local database storage prepared for future Supabase/MongoDB wiring
 */

export interface EmailEntry {
  id: string;
  email: string;
  subscribedAt: number;
  source: 'newsletter' | 'exit_popup' | 'viral_unlock';
  userIsSubscribed: boolean;
}

export interface ReferralEntry {
  id: string;
  refCode: string;
  email: string;
  clicks: number;
  signups: number;
  createdAt: number;
}

const EMAILS_STORAGE_KEY = 'dxfix_viral_emails';
const REFERRALS_STORAGE_KEY = 'dxfix_viral_referrals';
const USER_SUBSCRIBED_KEY = 'dxfix_user_is_subscribed';
const REFERRAL_CODE_KEY = 'dxfix_ref_code';
const REFERRAL_COUNT_KEY = 'dxfix_ref_count';

/**
 * Check if window is available (client-side)
 */
function isClient(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

// ─── Email Storage ───────────────────────────────────────────────

/**
 * Get all stored emails
 */
export function getEmails(): EmailEntry[] {
  if (!isClient()) return [];
  try {
    const stored = localStorage.getItem(EMAILS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save a new email subscription
 */
export function saveEmail(email: string, source: EmailEntry['source'] = 'newsletter'): EmailEntry {
  const entry: EmailEntry = {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email: email.trim().toLowerCase(),
    subscribedAt: Date.now(),
    source,
    userIsSubscribed: true,
  };

  if (!isClient()) return entry;

  try {
    const existing = getEmails();
    // Avoid duplicates
    const dup = existing.find(e => e.email === entry.email);
    if (!dup) {
      existing.push(entry);
      localStorage.setItem(EMAILS_STORAGE_KEY, JSON.stringify(existing));
    }
    // Mark user as subscribed in session
    setUserSubscribed(true);
  } catch (e) {
    console.error('Failed to save email:', e);
  }

  return entry;
}

/**
 * Check if a specific email is already stored
 */
export function isEmailStored(email: string): boolean {
  return getEmails().some(e => e.email === email.trim().toLowerCase());
}

// ─── User Subscribed State ───────────────────────────────────────

/**
 * Get the current userIsSubscribed state from session
 */
export function getUserSubscribed(): boolean {
  if (!isClient()) return false;
  try {
    return localStorage.getItem(USER_SUBSCRIBED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set the userIsSubscribed state for the active session
 */
export function setUserSubscribed(value: boolean): void {
  if (!isClient()) return;
  try {
    if (value) {
      localStorage.setItem(USER_SUBSCRIBED_KEY, 'true');
    } else {
      localStorage.removeItem(USER_SUBSCRIBED_KEY);
    }
  } catch (e) {
    console.error('Failed to set user subscribed state:', e);
  }
}

/**
 * Clear the viral unlock state
 */
export function clearViralState(): void {
  if (!isClient()) return;
  try {
    localStorage.removeItem(USER_SUBSCRIBED_KEY);
  } catch {
    // ignore
  }
}

// ─── Referral System ─────────────────────────────────────────────

/**
 * Generate or retrieve the user's unique referral code
 */
export function getOrCreateReferralCode(): string {
  if (!isClient()) return 'XXXXXX';

  try {
    let code = localStorage.getItem(REFERRAL_CODE_KEY);
    if (!code) {
      code = Math.random().toString(36).slice(2, 8).toUpperCase();
      localStorage.setItem(REFERRAL_CODE_KEY, code);
    }
    return code;
  } catch {
    return 'XXXXXX';
  }
}

/**
 * Get the user's full referral link
 */
export function getReferralLink(): string {
  const code = getOrCreateReferralCode();
  return `${window.location.origin}/?ref=${code}`;
}

/**
 * Get the current referral count
 */
export function getReferralCount(): number {
  if (!isClient()) return 0;
  try {
    const stored = localStorage.getItem(REFERRAL_COUNT_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Increment the referral count (called when someone signs up via a referral link)
 */
export function incrementReferralCount(): number {
  if (!isClient()) return 0;
  const current = getReferralCount();
  const newCount = current + 1;
  try {
    localStorage.setItem(REFERRAL_COUNT_KEY, String(newCount));
    // Auto-unlock if referral count reaches 3
    if (newCount >= 3) {
      setUserSubscribed(true);
    }
  } catch {
    // ignore
  }
  return newCount;
}

/**
 * Check if the user has reached the referral threshold (3)
 */
export function hasReachedReferralThreshold(): boolean {
  return getReferralCount() >= 3;
}

/**
 * Get all referral entries
 */
export function getReferralEntries(): ReferralEntry[] {
  if (!isClient()) return [];
  try {
    const stored = localStorage.getItem(REFERRALS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save a referral entry
 */
export function saveReferralEntry(email: string, refCode: string): ReferralEntry {
  const entry: ReferralEntry = {
    id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    refCode,
    email: email.trim().toLowerCase(),
    clicks: 0,
    signups: 0,
    createdAt: Date.now(),
  };

  if (!isClient()) return entry;

  try {
    const existing = getReferralEntries();
    existing.push(entry);
    localStorage.setItem(REFERRALS_STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save referral entry:', e);
  }

  return entry;
}

// ─── Database Export (for admin monitoring) ──────────────────────

/**
 * Get all stored data for admin dashboard
 */
export function getViralLaunchStats() {
  return {
    emails: getEmails(),
    totalEmails: getEmails().length,
    referrals: getReferralEntries(),
    totalReferrals: getReferralEntries().length,
    activeUnlocks: getUserSubscribed() ? 1 : 0,
  };
}
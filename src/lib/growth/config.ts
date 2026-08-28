/**
 * growth/config.ts — Growth & monetization configuration & defaults.
 * Central defaults; admin can override via server settings.
 */

export interface LaunchSettings {
  launch_enabled: boolean;
  launch_start: string; // ISO date
  launch_end: string; // ISO date
  launch_days: number; // duration in days
}

export interface ReferralSettings {
  enabled: boolean;
  reward_days: number; // 30
  max_referrals: number; // 5
  qualify_min_scans: number; // 1
}

export interface CommunitySettings {
  whatsapp_url: string;
  telegram_url: string; // "NOT_CONFIGURED" until set
}

export interface MonetizationSettings {
  paid_mode: boolean;
  pro_price: number; // 9
  currency: string; // "USD"
  payment_status: "not_configured" | "configured" | "live";
}

export interface GrowthSettings {
  launch: LaunchSettings;
  referral: ReferralSettings;
  community: CommunitySettings;
  monetization: MonetizationSettings;
}

export function defaultLaunchDays(): number {
  return 60;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoNow(): string {
  return new Date().toISOString();
}

/** Start + N days → end date (exclusive end). */
export function computeLaunchEnd(startISO: string, days: number): string {
  const d = new Date(startISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function defaultGrowthSettings(): GrowthSettings {
  const start = todayISO();
  return {
    launch: {
      launch_enabled: true,
      launch_start: start,
      launch_end: computeLaunchEnd(start, defaultSettingsDays()),
      launch_days: defaultSettingsDays(),
    },
    referral: { enabled: true, reward_days: 30, max_referrals: 5, qualify_min_scans: 1 },
    community: {
      whatsapp_url: "https://whatsapp.com/channel/0029Vb8U58jIXnlsaNklwU2k",
      telegram_url: "TELEGRAM_URL_NOT_CONFIGURED",
    },
    monetization: {
      paid_mode: false,
      pro_price: 9,
      currency: "USD",
      payment_status: "not_configured",
    },
  };
}

function defaultSettingsDays(): number {
  return 60;
}

/** Is the launch window currently active? Returns false if disabled. */
export function isLaunchActive(s: LaunchSettings): boolean {
  if (!s.launch_enabled) return false;
  const today = todayISO();
  return today >= s.launch_start && today < s.launch_end;
}

export function daysRemainingInLaunch(s: LaunchSettings): number {
  const end = new Date(s.launch_end + "T00:00:00Z");
  const now = Date.now();
  const ms = end.getTime() - now;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
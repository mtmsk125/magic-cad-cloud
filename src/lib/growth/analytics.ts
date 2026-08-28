/**
 * growth/analytics.ts — Real event analytics (daily + total + funnel).
 * Uses deterministic aggregation from recorded events.
 */

import { todayISO, isoNow } from "./config";

export type GrowthEventName =
  | "page_view"
  | "tool_open"
  | "upload_started"
  | "upload_completed"
  | "scan_completed"
  | "repair_completed"
  | "verification_completed"
  | "email_captured"
  | "download"
  | "report_created"
  | "report_shared"
  | "referral_visit"
  | "referral_signup"
  | "referral_qualified"
  | "reward_granted"
  | "subscription_started"
  | "subscription_cancelled"
  | "subscription_expired";

export interface TrafficSource {
  source: string; // direct | google | linkedin | community | referral | shared_report | ...
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

export interface GrowthEventRecord extends TrafficSource {
  id: string;
  name: GrowthEventName;
  ts: number;
  day: string;
}

export interface DailyAggregate {
  date: string;
  visitors: number;
  uploads: number;
  scans: number;
  repairs: number;
  downloads: number;
  emails: number;
  reports: number;
  referralVisits: number;
  qualifiedReferrals: number;
}

export interface FunnelNumbers {
  visitors: number;
  toolUsers: number;
  uploads: number;
  scans: number;
  emails: number;
  downloads: number;
  shares: number;
  referralVisitors: number;
  qualifiedReferrals: number;
  paidCustomers: number;
}

export function makeEventRecord(
  name: GrowthEventName,
  src: TrafficSource = { source: "unknown" }
): GrowthEventRecord {
  return { id: `evt_${Math.random().toString(36).slice(2, 10)}`, name, ts: Date.now(), day: todayISO(), ...src };
}

export function emptyDaily(): Omit<DailyAggregate, "date"> {
  return {
    visitors: 0, uploads: 0, scans: 0, repairs: 0, emails: 0,
    reports: 0, referralVisits: 0, qualifiedReferrals: 0, downloads: 0,
  };
}

/** Aggregate a flat list of event records into per-day aggregates (ascending). */
export function aggregateDaily(events: GrowthEventRecord[], days = 30): DailyAggregate[] {
  const map = new Map<string, { d: string; v: number; u: number; s: number; r: number; e: number; rp: number; rv: number; qr: number; dn: number }>();

  for (const ev of events) {
    const agg = map.get(ev.day) || {
      d: ev.day, v: 0, u: 0, s: 0, r: 0, e: 0, rp: 0, rv: 0, qr: 0, dn: 0,
    };
    switch (ev.name) {
      case "page_view": agg.v++; break;
      case "upload_started":
      case "upload_completed": agg.u++; break;
      case "scan_completed": agg.s++; break;
      case "repair_completed": agg.r++; break;
      case "email_captured": agg.e++; break;
      case "report_created":
      case "report_shared": agg.rp++; break;
      case "referral_visit": agg.rv++; break;
      case "referral_qualified": agg.qr++; break;
      case "download": agg.dn++; break;
      default: break;
    }
    map.set(ev.day, agg);
  }

  const out: DailyAggregate[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const agg = map.get(key);
    out.push({
      date: key,
      visitors: agg?.v ?? 0, uploads: agg?.u ?? 0, scans: agg?.s ?? 0,
      repairs: agg?.r ?? 0, emails: agg?.e ?? 0, reports: agg?.rp ?? 0,
      referralVisits: agg?.rv ?? 0, qualifiedReferrals: agg?.qr ?? 0, downloads: agg?.dn ?? 0,
    });
  }
  return out;
}

/** Count events of a given name across all records. */
export function countEvents(events: GrowthEventRecord[], name: GrowthEventName): number {
  return events.filter((e) => e.name === name).length;
}

/** Build the funnel counters from recorded events. */
export function computeFunnel(events: GrowthEventRecord[]): FunnelNumbers {
  return {
    visitors: countEvents(events, "page_view"),
    toolUsers: countEvents(events, "tool_open"),
    uploads: countEvents(events, "upload_completed"),
    scans: countEvents(events, "scan_completed"),
    emails: countEvents(events, "email_captured"),
    downloads: countEvents(events, "download"),
    shares: countEvents(events, "report_shared"),
    referralVisitors: countEvents(events, "referral_visit"),
    qualifiedReferrals: countEvents(events, "referral_qualified"),
    paidCustomers: countEvents(events, "subscription_started"),
  };
}

/**
 * Conversion rate between two funnel stages. Returns null (→ "N/A") when the
 * denominator is 0 (insufficient data). Never fabricates numbers.
 */
export function conversionRate(numerator: number, denominator: number): number | null {
  if (!denominator || numerator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}
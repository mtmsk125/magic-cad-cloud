/**
 * growth/growthServer.ts — Server-side persistence for growth data.
 * Uses the durable-store (Vercel KV / Supabase / memory) so data survives redeploys.
 */

import { durableGet, durableSet } from "../durable-store";
import { GrowthEventRecord, DailyAggregate, aggregateDaily, countEvents, computeFunnel } from "./analytics";
import { defaultGrowthSettings, type GrowthSettings } from "./config";
import type { PublicReport } from "./publicReports";

const SETTINGS_KEY = "growth_settings";
const EVENTS_KEY = "growth_events";
const REPORTS_KEY = "growth_reports";
const REFERRALS_KEY = "growth_referrals";

export async function loadSettings(): Promise<GrowthSettings> {
  const s = await durableGet<Partial<GrowthSettings>>(SETTINGS_KEY);
  const def = defaultGrowthSettings();
  if (!s) return def;
  return { ...def, ...s, launch: { ...def.launch, ...(s.launch || {}) }, referral: { ...def.referral, ...(s.referral || {}) }, community: { ...def.community, ...(s.community || {}) }, monetization: { ...def.monetization, ...(s.monetization || {}) } };
}

export async function saveSettings(s: GrowthSettings): Promise<void> {
  await durableSet(SETTINGS_KEY, s);
}

export async function loadEvents(): Promise<GrowthEventRecord[]> {
  const e = await durableGet<GrowthEventRecord[]>(EVENTS_KEY);
  return Array.isArray(e) ? e : [];
}

export async function recordEvent(ev: GrowthEventRecord): Promise<void> {
  const events = await loadEvents();
  events.push(ev);
  // Cap growth to last 10k events to avoid unbounded KV growth.
  const trimmed = events.slice(-10000);
  await durableSet(EVENTS_KEY, trimmed);
}

export async function getDailyAggregates(days = 30): Promise<DailyAggregate[]> {
  const events = await loadEvents();
  return aggregateDaily(events, days);
}

export async function getFunnel() {
  const events = await loadEvents();
  return computeFunnel(events);
}

export async function savePublicReport(report: PublicReport): Promise<void> {
  const reports = (await durableGet<PublicReport[]>(REPORTS_KEY)) || [];
  reports.push(report);
  await durableSet(REPORTS_KEY, reports.slice(-1000));
}

export async function getPublicReport(id: string): Promise<PublicReport | null> {
  const reports = (await durableGet<PublicReport[]>(REPORTS_KEY)) || [];
  return reports.find((r) => r.id === id) || null;
}

export async function getAllReports(): Promise<PublicReport[]> {
  return (await durableGet<PublicReport[]>(REPORTS_KEY)) || [];
}

export async function loadReferralEvents() {
  return (await durableGet<any[]>(REFERRALS_KEY)) || [];
}
export async function saveReferralEvents(list: any[]): Promise<void> {
  await durableSet(REFERRALS_KEY, list.slice(-5000));
}
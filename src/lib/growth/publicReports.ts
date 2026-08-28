/**
 * growth/publicReports.ts — Secure public scan reports.
 * Public reports expose ONLY safe aggregate data — never emails, user ids,
 * the source DXF or any private geometry.
 */

import { isoNow } from "./config";

export interface PublicReport {
  id: string;
  title: string;
  summary: {
    entities: number;
    issuesDetected: number;
    issuesFixed: number;
    issuesRemaining: number;
    verified: boolean;
    score: number | null;
    warnings: number;
    createdAt: string;
  };
}

/** Generate a cryptographically-random, unguessable report id. */
export function generateReportId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  // Fallback (non-cryptographic) — still random & non-sequential.
  return `r${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`;
}

export interface BuildReportInput {
  entities: number;
  issuesDetected: number;
  issuesFixed: number;
  issuesRemaining: number;
  verified: boolean;
  score: number | null;
  warnings: number;
  title?: string;
}

export function buildPublicReport(input: BuildReportInput): PublicReport {
  return {
    id: generateReportId(),
    title: input.title || "DXF Scan Report",
    summary: {
      entities: Math.max(0, Math.floor(input.entities)),
      issuesDetected: Math.max(0, Math.floor(input.issuesDetected)),
      issuesFixed: Math.max(0, Math.floor(input.issuesFixed)),
      issuesRemaining: Math.max(0, Math.floor(input.issuesRemaining)),
      verified: Boolean(input.verified),
      score: input.score,
      warnings: Math.max(0, Math.floor(input.warnings)),
      createdAt: isoNow(),
    },
  };
}

/** All fields that are safe to expose on a public report. */
export function publicSummary(report: PublicReport) {
  return { ...report.summary, id: report.id, title: report.title };
}

/** Hard check: a public report must never leak private fields. */
export function assertNoPrivateLeak(report: PublicReport): boolean {
  const allowed = new Set([
    "id", "title", "entities", "issuesDetected", "issuesFixed",
    "issuesRemaining", "verified", "score", "warnings", "createdAt",
  ]);
  return Object.keys(report.summary).every((k) => allowed.has(k));
}
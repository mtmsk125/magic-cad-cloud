/**
 * Real Site Statistics Library
 * -----------------------------
 * Talks to the backend `/api/stats` endpoints which persist counters
 * to a JSON file on the server. This REPLACES the old fake localStorage
 * counters (which were per-browser and not real).
 *
 * All numbers shown in the UI now come from real processing events:
 *  - `recordRepair()` is called after a successful DXF repair.
 *  - `recordVisit()` is called once per browser session.
 */

export interface SiteStats {
  filesRepaired: number;
  visitors: number;
  filesUploaded: number;
  updatedAt: number;
}

const VISIT_SESSION_KEY = "dxfix_visit_recorded";

/** Fetch the current real site-wide statistics from the server. */
export async function fetchSiteStats(): Promise<SiteStats | null> {
  try {
    const res = await fetch("/api/stats", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as SiteStats;
    return {
      filesRepaired: Number(data.filesRepaired) || 0,
      visitors: Number(data.visitors) || 0,
      filesUploaded: Number(data.filesUploaded) || 0,
      updatedAt: Number(data.updatedAt) || Date.now(),
    };
  } catch (e) {
    console.warn("fetchSiteStats failed:", e);
    return null;
  }
}

/** Record a successfully repaired file on the server (real counter). */
export async function recordRepair(): Promise<SiteStats | null> {
  try {
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "repair" }),
    });
    if (!res.ok) return null;
    return (await res.json()) as SiteStats;
  } catch (e) {
    console.warn("recordRepair failed:", e);
    return null;
  }
}

/** Record a file being uploaded on the server (real counter). */
export async function recordUpload(): Promise<SiteStats | null> {
  try {
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upload" }),
    });
    if (!res.ok) return null;
    return (await res.json()) as SiteStats;
  } catch (e) {
    console.warn("recordUpload failed:", e);
    return null;
  }
}

/** Record a visit on the server — once per browser session only. */
export async function recordVisit(): Promise<SiteStats | null> {
  if (typeof window === "undefined") return null;
  try {
    if (sessionStorage.getItem(VISIT_SESSION_KEY)) return null;
    sessionStorage.setItem(VISIT_SESSION_KEY, "1");
  } catch {
    // sessionStorage unavailable — still attempt the call
  }
  try {
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "visit" }),
    });
    if (!res.ok) return null;
    return (await res.json()) as SiteStats;
  } catch (e) {
    console.warn("recordVisit failed:", e);
    return null;
  }
}

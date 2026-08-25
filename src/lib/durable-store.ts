/**
 * durable-store.ts — Durable key/value storage that survives Vercel redeploys.
 *
 * Priority:
 *   1. Vercel KV (Redis) via its REST API — survives redeploys & serverless warm/cold.
 *      Configured with KV_REST_API_URL + KV_REST_API_TOKEN in the Vercel env.
 *   2. In-memory fallback — lost on cold start, but keeps the app working if KV is
 *      not configured.
 *
 * This replaces the previous `stats.json` / `subscribers.json` files, which were
 * written to Vercel's ephemeral filesystem and therefore reset on every redeploy.
 */

const KV_URL =
  typeof process !== "undefined" ? process.env.KV_REST_API_URL || "" : "";
const KV_TOKEN =
  typeof process !== "undefined" ? process.env.KV_REST_API_TOKEN || "" : "";

const memory = new Map<string, string>();

export function isKvConfigured(): boolean {
  return KV_URL !== "" && KV_TOKEN !== "";
}

/** Fetch a JSON value from the store. Returns null when absent. */
export async function durableGet<T>(key: string): Promise<T | null> {
  if (isKvConfigured()) {
    try {
      const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
      });
      if (!res.ok) throw new Error(`KV get ${res.status}`);
      const data = (await res.json()) as { result?: unknown };
      if (data.result == null) return null;
      // Result may be a string or an already-parsed object depending on how Vercel
      // stored it. Try to parse strings; return objects as-is.
      if (typeof data.result === "string") {
        try {
          return JSON.parse(data.result) as T;
        } catch {
          return data.result as unknown as T;
        }
      }
      return data.result as T;
    } catch (e) {
      console.error(`KV get failed for "${key}", using memory fallback:`, e);
    }
  }
  const mem = memory.get(key);
  return mem ? (JSON.parse(mem) as T) : null;
}

/** Write a JSON value to the store. */
export async function durableSet<T>(key: string, value: T): Promise<void> {
  if (isKvConfigured()) {
    try {
      const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(value),
      });
      if (!res.ok) throw new Error(`KV set ${res.status}`);
      return;
    } catch (e) {
      console.error(`KV set failed for "${key}", using memory fallback:`, e);
    }
  }
  memory.set(key, JSON.stringify(value));
}

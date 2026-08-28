/**
 * durable-store.ts — Durable key/value storage that survives Vercel redeploys.
 *
 * Priority:
 *   1. Vercel KV (Redis / Upstash) via REST API — KV_REST_API_URL + KV_REST_API_TOKEN.
 *   2. Supabase (PostgREST) — SUPABASE_URL + SUPABASE_ANON_KEY. Stores key/value
 *      rows in a `kv_store` table (see SQL below).
 *   3. In-memory fallback — survives only inside a single serverless instance.
 *
 * Supabase table (run once in the Supabase SQL Editor):
 *   create table if not exists public.kv_store (
 *     key    text primary key,
 *     value  jsonb not null
 *   );
 *   alter table public.kv_store enable row level security;
 *   create policy "anon read" on public.kv_store for select using (true);
 *   create policy "anon write" on public.kv_store for all using (true) with check (true);
 */

const KV_URL =
  typeof process !== "undefined" ? process.env.KV_REST_API_URL || "" : "";
const KV_TOKEN =
  typeof process !== "undefined" ? process.env.KV_REST_API_TOKEN || "" : "";
const SB_URL =
  typeof process !== "undefined" ? process.env.SUPABASE_URL || "" : "";
const SB_KEY =
  typeof process !== "undefined" ? process.env.SUPABASE_ANON_KEY || "" : "";

const memory = new Map<string, string>();

export function isKvConfigured(): boolean {
  return (
    (KV_URL !== "" && KV_TOKEN !== "") ||
    (SB_URL !== "" && SB_KEY !== "")
  );
}

/** Fetch a JSON value from the store. Returns null when absent. */
export async function durableGet<T>(key: string): Promise<T | null> {
  // 1) Vercel KV (Upstash Redis)
  if (KV_URL !== "" && KV_TOKEN !== "") {
    try {
      const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
      });
      if (!res.ok) throw new Error(`KV get ${res.status}`);
      const data = (await res.json()) as { result?: unknown };
      if (data.result == null) return null;
      if (typeof data.result === "string") {
        try {
          return JSON.parse(data.result) as T;
        } catch {
          return data.result as unknown as T;
        }
      }
      return data.result as T;
    } catch (e) {
      console.error(`KV get failed for "${key}", falling back:`, e);
    }
  }

  // 2) Supabase (PostgREST)
  if (SB_URL !== "" && SB_KEY !== "") {
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`,
        {
          headers: {
            apikey: SB_KEY,
            Authorization: `Bearer ${SB_KEY}`,
            Accept: "application/json",
          },
        }
      );
      if (!res.ok) throw new Error(`Supabase get ${res.status}`);
      const rows = (await res.json()) as { value: unknown }[];
      if (!rows || rows.length === 0) return null;
      return rows[0].value as T;
    } catch (e) {
      console.error(`Supabase get failed for "${key}", falling back:`, e);
    }
  }

  const mem = memory.get(key);
  return mem ? (JSON.parse(mem) as T) : null;
}

/** Write a JSON value to the store. */
export async function durableSet<T>(key: string, value: T): Promise<void> {
  // 1) Vercel KV (Upstash Redis)
  if (KV_URL !== "" && KV_TOKEN !== "") {
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
      console.error(`KV set failed for "${key}", falling back:`, e);
    }
  }

  // 2) Supabase (PostgREST) — upsert
  if (SB_URL !== "" && SB_KEY !== "") {
    try {
      const res = await fetch(`${SB_URL}/rest/v1/kv_store`, {
        method: "POST",
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error(`Supabase set ${res.status}`);
      return;
    } catch (e) {
      console.error(`Supabase set failed for "${key}":`, e);
    }
  }

  memory.set(key, JSON.stringify(value));
}

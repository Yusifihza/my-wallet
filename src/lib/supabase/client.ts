import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/**
 * Normalizes a Supabase project URL so accidental suffixes copied from
 * Supabase Dashboard → Project Settings → Data API (such as `/rest/v1`)
 * or missing `https://` scheme never break Auth/REST requests.
 */
export function normalizeSupabaseUrl(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return withScheme.replace(/\/(rest|auth|storage)\/v1.*$/i, '').replace(/\/+$/, '');
  }
}

export function normalizeSupabaseKey(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      normalizeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = normalizeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}

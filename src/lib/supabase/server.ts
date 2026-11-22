import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { normalizeSupabaseKey, normalizeSupabaseUrl } from '@/lib/supabase/client';

export async function getSupabaseServerClient() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = normalizeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore in Server Components where setting cookies is disallowed
        }
      },
    },
  });
}

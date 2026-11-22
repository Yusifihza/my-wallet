import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { normalizeSupabaseKey, normalizeSupabaseUrl } from '@/lib/supabase/client';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  const oauthError = searchParams.get('error_description') || searchParams.get('error');

  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';
  const baseOrigin =
    !isLocal && forwardedHost ? `https://${forwardedHost}` : origin;

  if (oauthError) {
    return NextResponse.redirect(
      `${baseOrigin}/?auth_error=${encodeURIComponent(oauthError)}`
    );
  }

  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = normalizeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (code && url && key) {
    const cookieStore = await cookies();
    const response = NextResponse.redirect(`${baseOrigin}${next}`);
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${baseOrigin}/?auth_error=${encodeURIComponent(error.message)}`
      );
    }
    return response;
  }

  return NextResponse.redirect(`${baseOrigin}${next}`);
}

'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  HardDrive,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  User,
} from 'lucide-react';
import { WalletLogo } from '@/components/WalletLogo';
import { useWallet } from '@/context/WalletContext';

export function AuthScreen() {
  const {
    supabaseConfigured,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    continueLocalMode,
  } = useWallet();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('auth_error');
  });
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('auth_error')) {
      params.delete('auth_error');
      const nextUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', nextUrl);
    }
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      const res =
        mode === 'reset'
          ? await sendPasswordReset(email)
          : mode === 'login'
            ? await signInWithEmail(email, password)
            : await signUpWithEmail(email, password, displayName);
      if (res.error) setErrorMsg(res.error);
      if (res.message) setInfoMsg(res.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      const res = await signInWithGoogle();
      if (res?.error) setErrorMsg(res.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--mw-bg)]">
      <div className="w-full max-w-md mw-card rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="space-y-3">
          <WalletLogo size="lg" />
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--mw-text)]">
              Catat keuangan lebih cepat, dari HP maupun desktop.
            </h1>
            <p className="text-sm text-[var(--mw-text-muted)] leading-relaxed">
              Pantau saldo tiap dompet, portofolio Bibit multi-produk, tabungan Wedding bersama pasangan, dan AI Advisor.
            </p>
          </div>
        </div>

        {supabaseConfigured ? (
          <div className="space-y-4">
            {/* Email & Password Auth (Zero Google Cloud Setup Needed!) */}
            <div className="p-4 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-3">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="py-1.5 rounded-lg cursor-pointer transition"
                  style={{
                    background: mode !== 'register' ? 'var(--mw-primary-soft)' : 'transparent',
                    color: mode !== 'register' ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
                  }}
                >
                  Masuk Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="py-1.5 rounded-lg cursor-pointer transition"
                  style={{
                    background: mode === 'register' ? 'var(--mw-primary-soft)' : 'transparent',
                    color: mode === 'register' ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
                  }}
                >
                  Daftar Baru
                </button>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-2.5 text-xs">
                {mode === 'reset' && (
                  <p className="text-[11px] text-[var(--mw-text-muted)] leading-relaxed">
                    Masukkan email akunmu untuk menerima link buat/reset password baru.
                  </p>
                )}
                {mode === 'register' && (
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mw-text-dim)]" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nama panggilan"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mw-text-dim)]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Alamat email (mis. kamu@gmail.com)"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                  />
                </div>
                {mode !== 'reset' && (
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mw-text-dim)]" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password (minimal 6 karakter)"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                    />
                  </div>
                )}

                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setErrorMsg(null);
                        setInfoMsg(null);
                      }}
                      className="text-[11px] font-medium text-[var(--mw-primary)] hover:underline cursor-pointer"
                    >
                      Lupa atau belum punya password?
                    </button>
                  </div>
                )}

                {errorMsg && (
                  <div
                    className="p-2.5 rounded-xl text-xs"
                    style={{ background: 'var(--mw-expense-soft)', color: 'var(--mw-expense)' }}
                  >
                    {errorMsg}
                  </div>
                )}
                {infoMsg && (
                  <div
                    className="p-2.5 rounded-xl text-xs"
                    style={{ background: 'var(--mw-primary-soft)', color: 'var(--mw-primary)' }}
                  >
                    {infoMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
                  style={{ background: 'var(--mw-primary)' }}
                >
                  <span>
                    {busy
                      ? 'Memproses...'
                      : mode === 'reset'
                        ? 'Kirim Link Buat / Reset Password'
                        : mode === 'login'
                          ? 'Masuk dengan Email'
                          : 'Buat Akun Baru'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {mode === 'reset' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="w-full py-1.5 text-[11px] font-medium text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer"
                  >
                    ← Kembali ke Masuk Email
                  </button>
                )}
              </form>
            </div>

            <div className="flex items-center gap-3 text-xs text-[var(--mw-text-dim)]">
              <div className="flex-1 h-px bg-[var(--mw-border)]" />
              <span>atau</span>
              <div className="flex-1 h-px bg-[var(--mw-border)]" />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-4 rounded-2xl font-semibold text-sm bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] border border-[var(--mw-border)] text-[var(--mw-text)] flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-60"
            >
              <span>Masuk dengan Google</span>
              <ArrowRight className="w-4 h-4 text-[var(--mw-primary)]" />
            </button>

            <button
              type="button"
              onClick={continueLocalMode}
              className="w-full py-2.5 px-4 rounded-2xl font-medium text-xs text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Atau coba Mode Lokal (offline di perangkat ini)</span>
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2.5 text-xs text-[var(--mw-text-muted)]">
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--mw-surface-2)]">
                <Smartphone className="w-4 h-4 shrink-0 text-[var(--mw-primary)]" />
                <span>Tampilan responsif &amp; bisa di-install ke home screen (PWA)</span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--mw-surface-2)]">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--mw-primary)]" />
                <span>12 dompet, 5 produk Bibit, &amp; seluruh struktur kategori siap pakai</span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--mw-surface-2)]">
                <ShieldCheck className="w-4 h-4 shrink-0 text-[var(--mw-primary)]" />
                <span>Transfer antar dompet tidak masuk hitungan pengeluaran</span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-xs text-[var(--mw-text-muted)] leading-relaxed space-y-1">
                <div className="font-semibold text-[var(--mw-text)]">
                  Supabase belum terhubung di environment ini
                </div>
                <p>
                  Tambahkan{' '}
                  <code className="font-mono text-[var(--mw-primary)]">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
                  dan{' '}
                  <code className="font-mono text-[var(--mw-primary)]">
                    NEXT_PUBLIC_SUPABASE_ANON_KEY
                  </code>{' '}
                  untuk mengaktifkan Login Email/Google &amp; sinkron cloud.
                </p>
              </div>

              <button
                type="button"
                onClick={continueLocalMode}
                className="w-full py-3.5 px-4 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition cursor-pointer"
                style={{ background: 'var(--mw-primary)' }}
              >
                <HardDrive className="w-4 h-4" />
                <span>Mulai Pakai di Mode Lokal</span>
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

'use client';

import { ArrowRight, CheckCircle2, HardDrive, ShieldCheck, Smartphone } from 'lucide-react';
import { WalletLogo } from '@/components/WalletLogo';
import { useWallet } from '@/context/WalletContext';

export function AuthScreen() {
  const { supabaseConfigured, signInWithGoogle, continueLocalMode } = useWallet();

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--mw-bg)]">
      <div className="w-full max-w-md mw-card rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="space-y-3">
          <WalletLogo size="lg" />
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--mw-text)]">
              Catat keuangan lebih cepat, dari HP maupun desktop.
            </h1>
            <p className="text-sm text-[var(--mw-text-muted)] leading-relaxed">
              Pantau saldo tiap dompet secara otomatis, pisahkan transfer dari pengeluaran, dan kejar target tabunganmu.
            </p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs text-[var(--mw-text-muted)]">
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--mw-surface-2)]">
            <Smartphone className="w-4 h-4 shrink-0 text-[var(--mw-primary)]" />
            <span>Tampilan responsif &amp; bisa di-install ke home screen (PWA)</span>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--mw-surface-2)]">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--mw-primary)]" />
            <span>12 dompet &amp; seluruh struktur kategorimu sudah siap pakai</span>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--mw-surface-2)]">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[var(--mw-primary)]" />
            <span>Transfer antar dompet tidak masuk hitungan pengeluaran</span>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          {supabaseConfigured ? (
            <button
              onClick={signInWithGoogle}
              className="w-full py-3.5 px-4 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2.5 transition cursor-pointer"
              style={{ background: 'var(--mw-primary)' }}
            >
              <span>Masuk dengan Google</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-xs text-[var(--mw-text-muted)] leading-relaxed space-y-1">
              <div className="font-semibold text-[var(--mw-text)]">Supabase belum terhubung di environment ini</div>
              <p>
                Tambahkan <code className="font-mono text-[var(--mw-primary)]">NEXT_PUBLIC_SUPABASE_URL</code> dan{' '}
                <code className="font-mono text-[var(--mw-primary)]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> untuk mengaktifkan login Google &amp; sinkron cloud.
              </p>
            </div>
          )}

          <button
            onClick={continueLocalMode}
            className={`w-full py-3.5 px-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              supabaseConfigured
                ? 'bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] text-[var(--mw-text)] border border-[var(--mw-border)]'
                : 'text-white'
            }`}
            style={supabaseConfigured ? undefined : { background: 'var(--mw-primary)' }}
          >
            <HardDrive className="w-4 h-4" />
            <span>{supabaseConfigured ? 'Atau coba Mode Lokal (offline)' : 'Mulai Pakai di Mode Lokal'}</span>
          </button>
        </div>
      </div>
    </main>
  );
}

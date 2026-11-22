'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  Cloud,
  Eye,
  EyeOff,
  HardDrive,
  Home,
  Menu,
  Moon,
  PieChart,
  Plus,
  Settings,
  Sun,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import { AuthScreen } from '@/components/AuthScreen';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { QuickInputSheet } from '@/components/QuickInputSheet';
import { WalletLogo } from '@/components/WalletLogo';
import { useWallet } from '@/context/WalletContext';
import { buildPeriodOptions } from '@/lib/finance';
import type { PeriodPreset } from '@/types/finance';

const NAV_ITEMS = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/transactions', label: 'Transaksi', icon: ArrowLeftRight },
  { href: '/wallets', label: 'Wallet', icon: Wallet },
  { href: '/budget', label: 'Budget', icon: PieChart },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    loading,
    authMode,
    dataset,
    period,
    setPeriod,
    openQuickInput,
    toast,
    dismissToast,
    setTheme,
    togglePrivacyMode,
  } = useWallet();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const periodOptions = useMemo(() => (loading ? [] : buildPeriodOptions()), [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--mw-bg)]">
        <div className="flex flex-col items-center gap-3">
          <WalletLogo size="lg" />
          <p className="text-xs text-[var(--mw-text-muted)]">Memuat data dompetmu...</p>
        </div>
      </div>
    );
  }

  if (authMode === 'unauthenticated') {
    return <AuthScreen />;
  }

  if (!dataset.profile.onboardingCompleted) {
    return <OnboardingWizard />;
  }

  const isDark = dataset.profile.theme !== 'light';
  const privacy = dataset.profile.privacyMode;

  return (
    <div className="min-h-screen flex bg-[var(--mw-bg)] text-[var(--mw-text)]">
      {/* TABLET ICON RAIL (md .. xl) & DESKTOP FULL SIDEBAR (xl+) */}
      <aside className="hidden md:flex md:w-20 xl:w-64 shrink-0 flex-col justify-between border-r border-[var(--mw-border)] bg-[var(--mw-surface)] sticky top-0 h-screen p-3 xl:p-4">
        <div className="space-y-6">
          <div className="flex items-center justify-center xl:justify-start px-1 pt-1">
            <Link href="/" aria-label="My Wallet Beranda">
              <span className="xl:hidden">
                <WalletLogo size="md" showWordmark={false} />
              </span>
              <span className="hidden xl:inline-flex">
                <WalletLogo size="md" showWordmark />
              </span>
            </Link>
          </div>

          <nav className="space-y-1" aria-label="Navigasi utama">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className="flex items-center justify-center xl:justify-start gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition"
                  style={{
                    background: active ? 'var(--mw-primary-soft)' : 'transparent',
                    color: active ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
                  }}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="hidden xl:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3">
          {/* Storage mode badge */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] text-xs text-[var(--mw-text-muted)]">
            {authMode === 'supabase' ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-[var(--mw-primary)] shrink-0" />
                <span className="truncate">Tersinkron Supabase</span>
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5 text-[var(--mw-text-dim)] shrink-0" />
                <span className="truncate">Mode Lokal (Offline)</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => openQuickInput({ mode: 'create' })}
            className="w-full py-3 px-3 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
            style={{ background: 'var(--mw-primary)' }}
            title="Tambah Transaksi (N)"
          >
            <Plus className="w-5 h-5 shrink-0" />
            <span className="hidden xl:inline">Tambah Transaksi</span>
            <kbd className="hidden xl:inline-block text-xs px-1.5 py-0.5 rounded bg-black/20 font-mono">
              N
            </kbd>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT COLUMN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER (Mobile + Tablet + Desktop) */}
        <header className="sticky top-0 z-30 border-b border-[var(--mw-border)] bg-[var(--mw-surface)]/90 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          {/* Mobile Brand */}
          <div className="md:hidden">
            <Link href="/">
              <WalletLogo size="sm" />
            </Link>
          </div>

          {/* Desktop / Tablet Period Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="global-period" className="hidden md:inline text-xs text-[var(--mw-text-muted)]">
              Periode:
            </label>
            <select
              id="global-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodPreset)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)] cursor-pointer"
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Right Utility Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={togglePrivacyMode}
              aria-label={privacy ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
              title={privacy ? 'Tampilkan nominal' : 'Mode privasi'}
              className="w-9 h-9 rounded-xl bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] border border-[var(--mw-border)] flex items-center justify-center text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer transition"
            >
              {privacy ? <EyeOff className="w-4 h-4 text-[var(--mw-primary)]" /> : <Eye className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
              title={isDark ? 'Tema terang' : 'Tema gelap'}
              className="w-9 h-9 rounded-xl bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] border border-[var(--mw-border)] flex items-center justify-center text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer transition"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              href="/settings"
              className="hidden sm:inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-xs font-medium text-[var(--mw-text)]"
            >
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'var(--mw-primary)' }}
              >
                {(dataset.profile.displayName || 'K').slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-24 truncate">{dataset.profile.displayName}</span>
            </Link>
          </div>
        </header>

        {/* PAGE BODY */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION (< md) */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--mw-border)] bg-[var(--mw-surface)]/95 backdrop-blur-md px-2 pt-1.5 pb-safe"
      >
        <div className="grid grid-cols-5 items-center max-w-md mx-auto">
          <MobileNavLink href="/" label="Beranda" icon={Home} active={pathname === '/'} />
          <MobileNavLink
            href="/transactions"
            label="Transaksi"
            icon={ArrowLeftRight}
            active={pathname.startsWith('/transactions')}
          />

          {/* Center Emerald + Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => openQuickInput({ mode: 'create' })}
              aria-label="Tambah Transaksi"
              className="w-12 h-12 -mt-4 rounded-2xl text-white flex items-center justify-center shadow-lg active:scale-95 transition cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
              }}
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <MobileNavLink
            href="/goals"
            label="Goals"
            icon={Target}
            active={pathname.startsWith('/goals')}
          />

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-1 text-[var(--mw-text-muted)] cursor-pointer"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[11px] font-medium">Menu</span>
          </button>
        </div>
      </nav>

      {/* MOBILE MENU DRAWER */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'var(--mw-backdrop)' }}
        >
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          <div className="bg-[var(--mw-surface)] rounded-t-3xl border-t border-[var(--mw-border)] p-5 pb-safe space-y-4 animate-sheet-up">
            <div className="flex items-center justify-between">
              <WalletLogo size="sm" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { href: '/wallets', label: 'Wallet & Transfer', icon: Wallet },
                { href: '/budget', label: 'Budget Bulanan', icon: PieChart },
                { href: '/goals', label: 'Target Tabungan', icon: Target },
                { href: '/settings', label: 'Settings', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-3.5 rounded-2xl border flex items-center gap-2.5 text-sm font-medium"
                    style={{
                      background: active ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                      borderColor: active ? 'var(--mw-primary)' : 'var(--mw-border)',
                      color: active ? 'var(--mw-primary)' : 'var(--mw-text)',
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL QUICK INPUT SHEET */}
      <QuickInputSheet />

      {/* UNDO TOAST */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-50 animate-sheet-up">
          <div className="px-4 py-3 rounded-2xl bg-[var(--mw-surface)] border border-[var(--mw-border)] shadow-xl flex items-center justify-between gap-3 text-xs">
            <span className="text-[var(--mw-text)] font-medium truncate">{toast.text}</span>
            <div className="flex items-center gap-2 shrink-0">
              {toast.undo && (
                <button
                  type="button"
                  onClick={() => {
                    toast.undo?.();
                    dismissToast();
                  }}
                  className="font-bold text-[var(--mw-primary)] hover:underline cursor-pointer"
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={dismissToast}
                className="text-[var(--mw-text-dim)] hover:text-[var(--mw-text)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-0.5 py-1 transition"
      style={{ color: active ? 'var(--mw-primary)' : 'var(--mw-text-muted)' }}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  );
}

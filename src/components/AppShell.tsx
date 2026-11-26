'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  BarChart3,
  Camera,
  Cloud,
  Eye,
  EyeOff,
  FlaskConical,
  HardDrive,
  Home,
  Menu,
  Moon,
  PieChart,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import { AuthScreen } from '@/components/AuthScreen';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { QuickInputSheet } from '@/components/QuickInputSheet';
import { ReceiptScannerModal } from '@/components/ReceiptScannerModal';
import { WalletLogo } from '@/components/WalletLogo';
import { useWallet } from '@/context/WalletContext';
import { buildPeriodOptions } from '@/lib/finance';
import type { PeriodPreset } from '@/types/finance';

const NAV_ITEMS = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/transactions', label: 'Transaksi', icon: ArrowLeftRight },
  { href: '/wallets', label: 'Wallet & Bibit', icon: Wallet },
  { href: '/budget', label: 'Budget', icon: PieChart },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/analytics', label: 'Analitik', icon: BarChart3 },
  { href: '/advisor', label: 'AI Advisor', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    loading,
    authMode,
    dataset,
    viewMode,
    period,
    setPeriod,
    openQuickInput,
    openReceiptScanner,
    toast,
    dismissToast,
    setTheme,
    togglePrivacyMode,
    removeDummyData,
  } = useWallet();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const periodOptions = useMemo(
    () => (loading ? [] : buildPeriodOptions(dataset.transactions)),
    [dataset.transactions, loading]
  );
  const safePeriod = periodOptions.some((o) => o.value === period) ? period : 'this_month';

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

  const toastBanner = toast ? (
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
  ) : null;

  if (!dataset.profile.onboardingCompleted) {
    return (
      <>
        <OnboardingWizard />
        {toastBanner}
      </>
    );
  }

  const isDark = dataset.profile.theme !== 'light';
  const privacy = dataset.profile.privacyMode;
  const forceMobile = viewMode === 'mobile';
  const forceDesktop = viewMode === 'desktop';

  return (
    <div
      className={`min-h-screen flex bg-[var(--mw-bg)] text-[var(--mw-text)] ${
        forceMobile ? 'justify-center' : ''
      }`}
    >
      {/* TABLET ICON RAIL (md .. xl) & DESKTOP FULL SIDEBAR (xl+) */}
      {!forceMobile && (
        <aside
          className={`${
            forceDesktop
              ? 'flex w-60 xl:w-64 p-4'
              : 'hidden md:flex md:w-20 xl:w-64 p-3 xl:p-4'
          } shrink-0 flex-col justify-between border-r border-[var(--mw-border)] bg-[var(--mw-surface)] sticky top-0 h-screen`}
        >
          <div className="space-y-6">
            <div
              className={`flex items-center px-1 pt-1 ${
                forceDesktop ? 'justify-start' : 'justify-center xl:justify-start'
              }`}
            >
              <Link href="/" aria-label="My Wallet Beranda">
                {forceDesktop ? (
                  <WalletLogo size="md" showWordmark />
                ) : (
                  <>
                    <span className="xl:hidden">
                      <WalletLogo size="md" showWordmark={false} />
                    </span>
                    <span className="hidden xl:inline-flex">
                      <WalletLogo size="md" showWordmark />
                    </span>
                  </>
                )}
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      forceDesktop ? 'justify-start' : 'justify-center xl:justify-start'
                    }`}
                    style={{
                      background: active ? 'var(--mw-primary-soft)' : 'transparent',
                      color: active ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
                    }}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className={forceDesktop ? 'inline' : 'hidden xl:inline'}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="space-y-3">
            {/* Storage mode badge */}
            <div
              className={`${
                forceDesktop ? 'flex' : 'hidden xl:flex'
              } items-center gap-2 px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] text-xs text-[var(--mw-text-muted)]`}
            >
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
              onClick={openReceiptScanner}
              className="w-full py-2.5 px-3 rounded-2xl text-xs font-semibold bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] border border-[var(--mw-border)] text-[var(--mw-text)] flex items-center justify-center gap-2 cursor-pointer transition"
              title="Scan Struk AI"
            >
              <Camera className="w-4 h-4 text-[var(--mw-primary)] shrink-0" />
              <span className={forceDesktop ? 'inline' : 'hidden xl:inline'}>Scan Struk AI</span>
            </button>

            <button
              type="button"
              onClick={() => openQuickInput({ mode: 'create' })}
              className="w-full py-3 px-3 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
              style={{ background: 'var(--mw-primary)' }}
              title="Tambah Transaksi (N)"
            >
              <Plus className="w-5 h-5 shrink-0" />
              <span className={forceDesktop ? 'inline' : 'hidden xl:inline'}>
                Tambah Transaksi
              </span>
              <kbd
                className={`${
                  forceDesktop ? 'inline-block' : 'hidden xl:inline-block'
                } text-xs px-1.5 py-0.5 rounded bg-black/20 font-mono`}
              >
                N
              </kbd>
            </button>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT COLUMN */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          forceMobile
            ? 'max-w-[480px] w-full border-x border-[var(--mw-border)] shadow-2xl bg-[var(--mw-bg)]'
            : ''
        }`}
      >
        {/* TOP HEADER (Mobile + Tablet + Desktop) */}
        <header
          className={`sticky top-0 z-30 border-b border-[var(--mw-border)] bg-[var(--mw-surface)]/90 backdrop-blur-md py-3 flex items-center justify-between gap-3 ${
            forceMobile ? 'px-4' : 'px-4 md:px-6'
          }`}
        >
          {/* Mobile Brand */}
          <div className={forceMobile ? 'block' : forceDesktop ? 'hidden' : 'md:hidden'}>
            <Link href="/">
              <WalletLogo size="sm" />
            </Link>
          </div>

          {/* Desktop / Tablet Period Filter */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="global-period"
              className={`${
                forceMobile ? 'hidden' : forceDesktop ? 'inline' : 'hidden md:inline'
              } text-xs text-[var(--mw-text-muted)]`}
            >
              Periode:
            </label>
            <select
              id="global-period"
              value={safePeriod}
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
              onClick={openReceiptScanner}
              aria-label="Scan Struk AI"
              title="Scan Struk AI"
              className={`${
                forceMobile ? 'hidden' : forceDesktop ? 'flex' : 'hidden md:flex'
              } w-9 h-9 rounded-xl bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] border border-[var(--mw-border)] items-center justify-center text-[var(--mw-primary)] cursor-pointer transition`}
            >
              <Camera className="w-4 h-4" />
            </button>

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
              className={`${
                forceMobile ? 'hidden' : 'hidden sm:inline-flex'
              } items-center gap-2 pl-1.5 pr-3 py-1 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-xs font-medium text-[var(--mw-text)]`}
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

        {/* DEMO DATA BANNER */}
        {dataset.profile.isDemoData && (
          <div
            className="px-4 md:px-6 py-2 border-b border-[var(--mw-border)] flex flex-wrap items-center justify-between gap-2 text-xs"
            style={{ background: 'var(--mw-warn-soft)' }}
          >
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--mw-text)]">
              <FlaskConical className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--mw-warn)' }} />
              <span>Mode Data Dummy 3 Bulan aktif (hanya untuk simulasi).</span>
            </span>
            <button
              type="button"
              onClick={removeDummyData}
              className="px-2.5 py-1 rounded-lg font-semibold bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] hover:border-[var(--mw-expense)] cursor-pointer transition"
            >
              Hapus Data Dummy (Mulai dari 0)
            </button>
          </div>
        )}

        {/* PAGE BODY */}
        <main
          className={`flex-1 w-full mx-auto ${
            forceMobile
              ? 'px-4 py-4 pb-24'
              : forceDesktop
                ? 'max-w-7xl px-6 py-6 pb-8'
                : 'max-w-7xl px-4 md:px-6 py-4 md:py-6 pb-24 md:pb-8'
          }`}
        >
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION (< md or forced Mobile mode) */}
      {!forceDesktop && (
        <nav
          aria-label="Navigasi bawah mobile"
          className={`${
            forceMobile
              ? 'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] border-x'
              : 'md:hidden fixed bottom-0 inset-x-0'
          } z-40 border-t border-[var(--mw-border)] bg-[var(--mw-surface)]/95 backdrop-blur-md px-1.5 pt-1.5 pb-safe`}
        >
          <div className="flex items-end justify-between max-w-md mx-auto">
            <div className="flex-1 grid grid-cols-2">
              <MobileNavLink href="/" label="Beranda" icon={Home} active={pathname === '/'} />
              <MobileNavLink
                href="/transactions"
                label="Transaksi"
                icon={ArrowLeftRight}
                active={pathname.startsWith('/transactions')}
              />
            </div>

            {/* Center Side-by-Side Buttons: + Catat & Scan Struk */}
            <div className="shrink-0 flex items-end gap-1.5 px-1">
              <button
                type="button"
                onClick={() => openQuickInput({ mode: 'create' })}
                aria-label="Tambah Transaksi"
                className="flex flex-col items-center justify-center gap-0.5 py-1 active:scale-95 transition cursor-pointer"
              >
                <span
                  className="w-11 h-10 -mt-4 rounded-2xl text-white flex items-center justify-center shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
                  }}
                >
                  <Plus className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-semibold text-[var(--mw-primary)]">Catat</span>
              </button>

              <button
                type="button"
                onClick={openReceiptScanner}
                aria-label="Scan Struk AI"
                className="flex flex-col items-center justify-center gap-0.5 py-1 active:scale-95 transition cursor-pointer"
              >
                <span
                  className="w-11 h-10 -mt-4 rounded-2xl flex items-center justify-center shadow-lg border"
                  style={{
                    background: 'var(--mw-surface-2)',
                    borderColor: 'var(--mw-primary)',
                    color: 'var(--mw-primary)',
                  }}
                >
                  <Camera className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-semibold text-[var(--mw-primary)]">Scan</span>
              </button>
            </div>

            <div className="flex-1 grid grid-cols-2">
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
          </div>
        </nav>
      )}

      {/* MOBILE MENU DRAWER */}
      {mobileMenuOpen && !forceDesktop && (
        <div
          className={`${
            forceMobile ? 'fixed inset-0 z-50 flex flex-col justify-end items-center' : 'md:hidden fixed inset-0 z-50 flex flex-col justify-end'
          }`}
          style={{ background: 'var(--mw-backdrop)' }}
        >
          <div className="flex-1 w-full" onClick={() => setMobileMenuOpen(false)} />
          <div
            className={`w-full ${
              forceMobile ? 'max-w-[480px]' : ''
            } bg-[var(--mw-surface)] rounded-t-3xl border-t border-[var(--mw-border)] p-5 pb-safe space-y-4 animate-sheet-up`}
          >
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
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openReceiptScanner();
              }}
              className="w-full p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-sm font-semibold text-white cursor-pointer"
              style={{ background: 'var(--mw-primary)', borderColor: 'var(--mw-primary)' }}
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span>Scan Struk AI (Kamera / Galeri)</span>
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { href: '/wallets', label: 'Wallet & Bibit', icon: Wallet },
                { href: '/budget', label: 'Budget Bulanan', icon: PieChart },
                { href: '/analytics', label: 'Analitik & Heatmap', icon: BarChart3 },
                { href: '/advisor', label: 'AI Advisor', icon: Sparkles },
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

      {/* GLOBAL RECEIPT SCANNER MODAL */}
      <ReceiptScannerModal />

      {/* UNDO TOAST */}
      {toastBanner}
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

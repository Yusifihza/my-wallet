'use client';

import { useState } from 'react';
import {
  Check,
  Cloud,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FlaskConical,
  HardDrive,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
} from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import {
  buildGoogleSheetsPayload,
  parseAmountExpression,
  transactionsToCSV,
} from '@/lib/finance';
import { todayISO } from '@/lib/seed';

const APPS_SCRIPT_SNIPPET = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(data.tabs).forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
    sheet.clearContents();
    var rows = data.tabs[tabName];
    if (rows && rows.length > 0) {
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    }
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}`;

export function SettingsView() {
  const {
    authMode,
    supabaseConfigured,
    dataset,
    setTheme,
    togglePrivacyMode,
    setDisplayName,
    addSubcategory,
    reopenOnboarding,
    resetLocalData,
    signOut,
    updateSheetsSync,
    triggerSheetsSync,
    loadThreeMonthDummyData,
    removeDummyData,
  } = useWallet();

  const [nameInput, setNameInput] = useState(dataset.profile.displayName);
  const [confirmReset, setConfirmReset] = useState(false);
  const [catId, setCatId] = useState(dataset.categories.find((c) => c.type === 'expense')?.id ?? '');
  const [subName, setSubName] = useState('');
  const [subBudget, setSubBudget] = useState('');
  const [subAliases, setSubAliases] = useState('');

  // Google Sheets mirror UI state
  const [webhookInput, setWebhookInput] = useState(dataset.sheetsSync.spreadsheetUrl || '');
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  const handleAddSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catId || !subName.trim()) return;
    const bud = subBudget.trim() ? parseAmountExpression(subBudget).value : null;
    const aliases = subAliases
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    addSubcategory(catId, subName.trim(), bud && bud > 0 ? bud : null, aliases);
    setSubName('');
    setSubBudget('');
    setSubAliases('');
  };

  const handleExportAll = () => {
    const csv = transactionsToCSV(
      dataset.transactions,
      dataset.wallets,
      dataset.categories,
      dataset.subcategories
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-wallet-backup-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport5TabBundle = () => {
    const payload = buildGoogleSheetsPayload(dataset);
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const sections = Object.entries(payload.tabs).map(
      ([name, rows]) =>
        `=== TAB: ${name} ===\n${rows.map((r) => r.map(esc).join(',')).join('\n')}`
    );
    const blob = new Blob([sections.join('\n\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-wallet-5tab-mirror-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSheetsSyncNow = async () => {
    setSyncingSheets(true);
    setSyncFeedback(null);
    updateSheetsSync({ spreadsheetUrl: webhookInput.trim() });
    const res = await triggerSheetsSync();
    setSyncFeedback(res.message);
    setSyncingSheets(false);
  };

  const handleCopyScript = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(APPS_SCRIPT_SNIPPET).catch(() => {});
    }
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--mw-text)]">
          Settings
        </h1>
        <p className="text-xs text-[var(--mw-text-muted)]">
          Pengaturan tampilan, data dummy 3 bulan, mirror Google Sheets, dan koneksi cloud
        </p>
      </div>

      {/* Dummy 3-Month Data Sandbox */}
      <section className="mw-card rounded-2xl p-5 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-[var(--mw-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--mw-text)]">
              Data Dummy 3 Bulan (Uji Coba &amp; Simulasi)
            </h2>
          </div>
          {dataset.profile.isDemoData && (
            <span
              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
              style={{ background: 'var(--mw-warn-soft)', color: 'var(--mw-warn)' }}
            >
              Sedang Aktif
            </span>
          )}
        </div>
        <p className="text-[var(--mw-text-muted)] leading-relaxed">
          Muat simulasi 3 bulan transaksi realistis, 5 produk Bibit (PU, Obligasi, Reksa Saham, Saham, SBN), kontribusi pasangan di Wedding, jadwal berulang, dan grafik tren. Bisa dihapus bersih kembali ke 0 dalam 1 klik kapan saja.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={loadThreeMonthDummyData}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
            style={{ background: 'var(--mw-primary)' }}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Muat Data Dummy 3 Bulan</span>
          </button>
          <button
            type="button"
            onClick={removeDummyData}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-400 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Data Dummy (Mulai dari 0)</span>
          </button>
        </div>
      </section>

      {/* Profile & Theme */}
      <section className="mw-card rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--mw-text)]">Profil &amp; Tampilan</h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <label htmlFor="set-name" className="text-[var(--mw-text-muted)]">
            Nama panggilan
          </label>
          <div className="flex items-center gap-2">
            <input
              id="set-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
            />
            <button
              type="button"
              onClick={() => nameInput.trim() && setDisplayName(nameInput.trim())}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
              style={{ background: 'var(--mw-primary)' }}
            >
              Simpan
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--mw-border)] text-xs">
          <div>
            <div className="font-medium text-[var(--mw-text)]">Tema Aplikasi</div>
            <div className="text-[var(--mw-text-muted)]">Default Dark dengan aksen Emerald/Teal</div>
          </div>
          <div className="inline-flex p-1 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className="px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-medium cursor-pointer"
              style={{
                background: dataset.profile.theme === 'dark' ? 'var(--mw-primary-soft)' : 'transparent',
                color: dataset.profile.theme === 'dark' ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
              }}
            >
              <Moon className="w-3.5 h-3.5" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className="px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-medium cursor-pointer"
              style={{
                background: dataset.profile.theme === 'light' ? 'var(--mw-primary-soft)' : 'transparent',
                color: dataset.profile.theme === 'light' ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
              }}
            >
              <Sun className="w-3.5 h-3.5" />
              Light
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--mw-border)] text-xs">
          <div>
            <div className="font-medium text-[var(--mw-text)]">Mode Privasi</div>
            <div className="text-[var(--mw-text-muted)]">Samarkan semua nominal Rupiah di layar</div>
          </div>
          <button
            type="button"
            onClick={togglePrivacyMode}
            className="px-3.5 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] font-semibold text-[var(--mw-text)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            {dataset.profile.privacyMode ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
                Aktif
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Nonaktif
              </>
            )}
          </button>
        </div>
      </section>

      {/* Google Sheets 1-Way Mirror */}
      <section className="mw-card rounded-2xl p-5 space-y-3.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[var(--mw-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--mw-text)]">
              Mirror Otomatis ke Google Sheets (5 Tab)
            </h2>
          </div>
          <span
            className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
            style={{
              background:
                dataset.sheetsSync.status === 'connected'
                  ? 'var(--mw-income-soft)'
                  : 'var(--mw-surface-2)',
              color:
                dataset.sheetsSync.status === 'connected'
                  ? 'var(--mw-income)'
                  : 'var(--mw-text-muted)',
            }}
          >
            {dataset.sheetsSync.status === 'connected' ? 'Terhubung' : 'Belum terhubung'}
          </span>
        </div>

        <p className="text-[var(--mw-text-muted)] leading-relaxed">
          Salin cermin 1 arah (read-only) ke 5 tab Google Sheets: <b>Transaksi</b>, <b>Dompet_Bibit</b>, <b>Budget</b>, <b>Goals_Pasangan</b>, dan <b>Ringkasan_Bulanan</b>. Di Google Sheet kamu, buka <i>Extensions → Apps Script</i>, tempel script di bawah, lalu <i>Deploy → Web app (Anyone)</i> dan tempel URL-nya di sini.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={webhookInput}
            onChange={(e) => setWebhookInput(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="flex-1 px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
          />
          <button
            type="button"
            disabled={syncingSheets}
            onClick={handleSheetsSyncNow}
            className="px-4 py-2 rounded-xl font-semibold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            style={{ background: 'var(--mw-primary)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingSheets ? 'animate-spin' : ''}`} />
            <span>{syncingSheets ? 'Menyinkronkan...' : 'Sync Sekarang'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyScript}
            className="px-3 py-1.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            {copiedScript ? (
              <>
                <Check className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
                <span>Script Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Script Google Sheets</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleExport5TabBundle}
            className="px-3 py-1.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Snapshot 5 Tab (CSV)</span>
          </button>
        </div>

        {(syncFeedback || dataset.sheetsSync.lastSyncedAt) && (
          <div className="text-[11px] text-[var(--mw-text-dim)]">
            {syncFeedback ? `${syncFeedback} · ` : ''}
            {dataset.sheetsSync.lastSyncedAt
              ? `Terakhir sinkron: ${new Date(dataset.sheetsSync.lastSyncedAt).toLocaleString('id-ID')}`
              : ''}
          </div>
        )}
      </section>

      {/* Add Custom Sub-category */}
      <section className="mw-card rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--mw-text)]">Tambah Sub-Kategori Baru</h2>
          <p className="text-xs text-[var(--mw-text-muted)]">
            Tambahkan sub-kategori beserta alias pencarian agar mudah ditemukan saat input cepat.
          </p>
        </div>

        <form onSubmit={handleAddSub} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[var(--mw-text-muted)] mb-1">Kategori Induk</label>
            <select
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)]"
            >
              {dataset.categories
                .filter((c) => !c.archived)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.type.toUpperCase()}] {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-[var(--mw-text-muted)] mb-1">Nama Sub-Kategori</label>
            <input
              type="text"
              required
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="Mis. Kopi Spesialti"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
            />
          </div>
          <div>
            <label className="block text-[var(--mw-text-muted)] mb-1">Budget Bulanan (opsional)</label>
            <input
              type="text"
              value={subBudget}
              onChange={(e) => setSubBudget(e.target.value)}
              placeholder="Kosong = Track only"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
            />
          </div>
          <div>
            <label className="block text-[var(--mw-text-muted)] mb-1">Alias Pencarian (pisah koma)</label>
            <input
              type="text"
              value={subAliases}
              onChange={(e) => setSubAliases(e.target.value)}
              placeholder="Mis. matcha, latte, cafe"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
              style={{ background: 'var(--mw-primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Sub-Kategori
            </button>
          </div>
        </form>
      </section>

      {/* Storage & Sync Status */}
      <section className="mw-card rounded-2xl p-5 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--mw-text)]">Database &amp; Sinkronisasi</h2>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--mw-surface-2)] text-[var(--mw-text)] font-medium">
            {authMode === 'supabase' ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
                Supabase Cloud
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5 text-[var(--mw-text-muted)]" />
                Mode Lokal
              </>
            )}
          </span>
        </div>

        {!supabaseConfigured && (
          <p className="text-[var(--mw-text-muted)] leading-relaxed">
            Untuk sinkron antar HP &amp; laptop: jalankan migrasi{' '}
            <code className="font-mono text-[var(--mw-primary)]">supabase/migrations/001_initial_schema.sql</code>{' '}
            di project Supabase-mu, lalu pasang{' '}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> dan{' '}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di Vercel.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={handleExportAll}
            className="px-3.5 py-2 rounded-xl bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] border border-[var(--mw-border)] text-[var(--mw-text)] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Backup CSV
          </button>

          <button
            type="button"
            onClick={reopenOnboarding}
            className="px-3.5 py-2 rounded-xl bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] border border-[var(--mw-border)] text-[var(--mw-text)] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Atur Ulang Saldo Awal
          </button>

          {authMode === 'local' &&
            (confirmReset ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmReset(false);
                    resetLocalData();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-red-600 text-white font-semibold cursor-pointer"
                >
                  Ya, Reset Semua
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] cursor-pointer"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium cursor-pointer"
              >
                Reset Data Lokal
              </button>
            ))}

          <button
            type="button"
            onClick={signOut}
            className="px-3.5 py-2 rounded-xl bg-[var(--mw-surface-2)] hover:bg-[var(--mw-surface-3)] border border-[var(--mw-border)] text-[var(--mw-text-muted)] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </section>
    </div>
  );
}

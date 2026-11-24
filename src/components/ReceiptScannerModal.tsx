'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ImagePlus,
  Layers,
  Loader2,
  Plus,
  ReceiptText,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { formatIDR, parseAmountExpression } from '@/lib/finance';
import { compressReceiptImage } from '@/lib/imageCompress';
import {
  buildReceiptSplitGroups,
  buildReceiptTransactions,
  calculateReceiptTotals,
  matchSubcategoryFallback,
  matchWalletHint,
  pickDominantSubcategoryId,
  type ReceiptSaveMode,
  type ScannedReceiptDraft,
  type ScannedReceiptItem,
} from '@/lib/receipt';
import { todayISO } from '@/lib/seed';

type ScanStep = 'pick' | 'scanning' | 'review';

interface EditableItem extends ScannedReceiptItem {
  priceText: string;
}

export function ReceiptScannerModal() {
  const {
    receiptScannerOpen,
    closeReceiptScanner,
    dataset,
    visibleWalletBalances,
    recentWalletIds,
    addTransaction,
    addTransactionsBatch,
  } = useWallet();

  if (!receiptScannerOpen) return null;

  return (
    <ReceiptScannerContent
      onClose={closeReceiptScanner}
      dataset={dataset}
      visibleWalletBalances={visibleWalletBalances}
      recentWalletIds={recentWalletIds}
      addTransaction={addTransaction}
      addTransactionsBatch={addTransactionsBatch}
    />
  );
}

function ReceiptScannerContent({
  onClose,
  dataset,
  visibleWalletBalances,
  recentWalletIds,
  addTransaction,
  addTransactionsBatch,
}: {
  onClose: () => void;
  dataset: ReturnType<typeof useWallet>['dataset'];
  visibleWalletBalances: ReturnType<typeof useWallet>['visibleWalletBalances'];
  recentWalletIds: string[];
  addTransaction: ReturnType<typeof useWallet>['addTransaction'];
  addTransactionsBatch: ReturnType<typeof useWallet>['addTransactionsBatch'];
}) {
  const privacy = dataset.profile.privacyMode;
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const itemSeqRef = useRef(100);

  const visibleWallets = useMemo(
    () => visibleWalletBalances.map((b) => b.wallet),
    [visibleWalletBalances]
  );

  const expenseCategories = useMemo(
    () => dataset.categories.filter((c) => c.type === 'expense' && !c.archived),
    [dataset.categories]
  );

  const expenseSubGroups = useMemo(() => {
    return expenseCategories
      .map((cat) => ({
        cat,
        subs: dataset.subcategories.filter((s) => s.categoryId === cat.id && !s.archived),
      }))
      .filter((g) => g.subs.length > 0);
  }, [dataset.subcategories, expenseCategories]);

  const subById = useMemo(
    () => new Map(dataset.subcategories.map((s) => [s.id, s])),
    [dataset.subcategories]
  );
  const catById = useMemo(
    () => new Map(dataset.categories.map((c) => [c.id, c])),
    [dataset.categories]
  );

  const fallbackSubId = useMemo(() => {
    return (
      dataset.subcategories.find((s) => !s.archived && /belanja bulanan/i.test(s.name))?.id ??
      expenseSubGroups[0]?.subs[0]?.id ??
      ''
    );
  }, [dataset.subcategories, expenseSubGroups]);

  const defaultWalletId = useMemo(() => {
    const recent = recentWalletIds.find((id) => visibleWallets.some((w) => w.id === id));
    return recent ?? visibleWallets[0]?.id ?? '';
  }, [recentWalletIds, visibleWallets]);

  const [step, setStep] = useState<ScanStep>('pick');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showZoom, setShowZoom] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Editable draft fields
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(() => todayISO());
  const [walletId, setWalletId] = useState(defaultWalletId);
  const [walletHint, setWalletHint] = useState<string | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [taxText, setTaxText] = useState('');
  const [discountText, setDiscountText] = useState('');
  const [reportedTotal, setReportedTotal] = useState<number | null>(null);
  const [engineUsed, setEngineUsed] = useState<string | undefined>(undefined);
  const [saveMode, setSaveMode] = useState<ReceiptSaveMode>('single');
  const [primarySubId, setPrimarySubId] = useState(fallbackSubId);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Pilih file gambar struk (JPG, PNG, atau WebP).');
        return;
      }
      setErrorMsg(null);
      setStep('scanning');

      try {
        const compressed = await compressReceiptImage(file);
        setPreviewUrl(compressed.previewDataUrl);

        const today = todayISO();
        const res = await fetch('/api/receipt/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: compressed.base64,
            mimeType: compressed.mimeType,
            today,
            categories: expenseSubGroups.map(({ cat, subs }) => ({
              id: cat.id,
              name: cat.name,
              subcategories: subs.map((s) => ({
                id: s.id,
                name: s.name,
                aliases: s.aliases,
              })),
            })),
            wallets: visibleWallets.map((w) => ({ id: w.id, name: w.name })),
          }),
        });

        const data = (await res.json()) as Partial<ScannedReceiptDraft> & { error?: string };
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Gagal memindai struk. Coba ulangi.');
        }

        const rawItems = Array.isArray(data.items) ? data.items : [];
        const mappedItems: EditableItem[] = rawItems.map((it, idx) => {
          const validSub =
            it.subcategoryId && subById.has(it.subcategoryId)
              ? it.subcategoryId
              : matchSubcategoryFallback(
                  `${data.merchant ?? ''} ${it.name ?? ''}`,
                  dataset.categories,
                  dataset.subcategories
                );
          const price = Math.max(0, Math.round(it.price || 0));
          return {
            id: it.id || `scan_${idx + 1}`,
            name: it.name || `Item ${idx + 1}`,
            qty: Math.max(1, Math.round(it.qty || 1)),
            price,
            priceText: price > 0 ? String(price) : '',
            subcategoryId: validSub || fallbackSubId,
          };
        });

        if (mappedItems.length === 0) {
          const fallbackAmt = data.reportedTotal && data.reportedTotal > 0 ? data.reportedTotal : 0;
          mappedItems.push({
            id: 'scan_1',
            name: data.merchant || 'Pembelian',
            qty: 1,
            price: fallbackAmt,
            priceText: fallbackAmt > 0 ? String(fallbackAmt) : '',
            subcategoryId:
              matchSubcategoryFallback(
                data.merchant || '',
                dataset.categories,
                dataset.subcategories
              ) || fallbackSubId,
          });
        }

        const matchedWallet = matchWalletHint(data.walletHint, dataset.wallets);
        const dominantSub = pickDominantSubcategoryId(mappedItems, fallbackSubId);
        const distinctSubs = new Set(mappedItems.map((i) => i.subcategoryId)).size;

        setMerchant(data.merchant || 'Struk Belanja');
        setDate(data.date || today);
        setWalletHint(data.walletHint || null);
        setWalletId(matchedWallet || defaultWalletId);
        setItems(mappedItems);
        setTaxText(data.taxOrService && data.taxOrService > 0 ? String(data.taxOrService) : '');
        setDiscountText(data.discount && data.discount > 0 ? String(data.discount) : '');
        setReportedTotal(data.reportedTotal ?? null);
        setEngineUsed(data.engine);
        setPrimarySubId(dominantSub);
        // Smart default: if receipt has multiple distinct categories, suggest split mode!
        setSaveMode(distinctSubs > 1 ? 'split_by_category' : 'single');
        setStep('review');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Gagal membaca struk. Coba foto ulang.';
        setErrorMsg(message);
        setStep('pick');
      }
    },
    [
      dataset.categories,
      dataset.subcategories,
      dataset.wallets,
      defaultWalletId,
      expenseSubGroups,
      fallbackSubId,
      subById,
      visibleWallets,
    ]
  );

  // Support Ctrl+V pasting a receipt screenshot on desktop & Escape to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showZoom) setShowZoom(false);
        else onClose();
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (step !== 'pick') return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith('image/')
      );
      if (file) {
        e.preventDefault();
        processFile(file);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, [onClose, processFile, showZoom, step]);

  const taxVal = parseAmountExpression(taxText).value;
  const discountVal = parseAmountExpression(discountText).value;

  const totals = useMemo(
    () => calculateReceiptTotals(items, taxVal, discountVal, reportedTotal),
    [discountVal, items, reportedTotal, taxVal]
  );

  const splitGroups = useMemo(
    () => buildReceiptSplitGroups(items, taxVal, discountVal, fallbackSubId),
    [discountVal, fallbackSubId, items, taxVal]
  );

  const handleItemChange = (id: string, patch: Partial<EditableItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        if (patch.priceText !== undefined) {
          next.price = parseAmountExpression(patch.priceText).value;
        }
        return next;
      })
    );
  };

  const handleAddItem = () => {
    itemSeqRef.current += 1;
    setItems((prev) => [
      ...prev,
      {
        id: `manual_${itemSeqRef.current}`,
        name: '',
        qty: 1,
        price: 0,
        priceText: '',
        subcategoryId: primarySubId || fallbackSubId,
      },
    ]);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleMatchReportedTotal = () => {
    if (totals.diffFromReported === null || totals.diffFromReported === 0) return;
    if (totals.diffFromReported < 0) {
      // Computed is lower than receipt total -> add difference to tax/service
      const nextTax = taxVal + Math.abs(totals.diffFromReported);
      setTaxText(String(nextTax));
    } else {
      // Computed is higher than receipt total -> add difference to discount
      const nextDisc = discountVal + totals.diffFromReported;
      setDiscountText(String(nextDisc));
    }
  };

  const handleSave = () => {
    if (totals.grandTotal <= 0 || !walletId) return;
    const draft: ScannedReceiptDraft = {
      merchant: merchant.trim() || 'Struk Belanja',
      date,
      walletHint,
      suggestedWalletId: walletId,
      items,
      taxOrService: taxVal,
      discount: discountVal,
      reportedTotal,
      engine: engineUsed,
    };

    const txs = buildReceiptTransactions(draft, {
      mode: saveMode,
      walletId,
      primarySubcategoryId: primarySubId || fallbackSubId,
      fallbackSubcategoryId: fallbackSubId,
    });

    if (txs.length === 0) return;
    if (txs.length === 1) {
      addTransaction(txs[0]);
    } else {
      addTransactionsBatch(txs, `Struk ${draft.merchant}`);
    }
    onClose();
  };

  const resetToPick = () => {
    setStep('pick');
    setPreviewUrl(null);
    setErrorMsg(null);
    setShowZoom(false);
  };

  const txCountToCreate = saveMode === 'single' ? 1 : Math.max(1, splitGroups.length);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4"
      style={{ background: 'var(--mw-backdrop)' }}
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full md:max-w-xl max-h-[94dvh] bg-[var(--mw-surface)] rounded-t-3xl md:rounded-3xl border-t md:border border-[var(--mw-border)] flex flex-col overflow-hidden animate-sheet-up shadow-2xl">
        {/* Mobile grab handle */}
        <div className="md:hidden pt-2.5 pb-0.5 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-[var(--mw-border)]" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--mw-border)] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)' }}
            >
              <ReceiptText className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-[var(--mw-text)] truncate">
                Scan Struk AI
              </h2>
              <p className="text-[11px] text-[var(--mw-text-muted)] truncate">
                {step === 'pick'
                  ? 'Foto struk atau upload screenshot e-receipt'
                  : step === 'scanning'
                    ? 'Membaca item, harga & kategori otomatis...'
                    : 'Cek & sesuaikan hasil scan sebelum disimpan'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup scan struk"
            className="p-2 rounded-xl bg-[var(--mw-surface-2)] text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) processFile(file);
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) processFile(file);
          }}
        />

        {/* Body */}
        <div className="flex-1 overflow-y-auto mw-scroll p-4 sm:p-5 space-y-4">
          {step === 'pick' && (
            <div className="space-y-4">
              {errorMsg && (
                <div
                  className="p-3 rounded-2xl text-xs flex items-start gap-2"
                  style={{ background: 'var(--mw-expense-soft)', color: 'var(--mw-expense)' }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) processFile(file);
                }}
                className="rounded-3xl border-2 border-dashed p-6 sm:p-8 text-center space-y-4 transition"
                style={{
                  borderColor: dragOver ? 'var(--mw-primary)' : 'var(--mw-border)',
                  background: dragOver ? 'var(--mw-primary-soft)' : 'var(--mw-surface-2)',
                }}
              >
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--mw-primary-soft)] text-[var(--mw-primary)] flex items-center justify-center">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-bold text-[var(--mw-text)]">
                    Ambil Foto atau Pilih Gambar Struk
                  </div>
                  <p className="text-xs text-[var(--mw-text-muted)] max-w-sm mx-auto leading-relaxed">
                    Cocok untuk struk Indomaret/Alfamart, kafe, restoran, SPBU, apotek, maupun screenshot GoFood / ShopeeFood / QRIS.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-3 px-4 rounded-2xl text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
                    style={{ background: 'var(--mw-primary)' }}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Foto Struk (Kamera)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="py-3 px-4 rounded-2xl text-xs font-semibold bg-[var(--mw-surface)] hover:bg-[var(--mw-surface-3)] border border-[var(--mw-border)] text-[var(--mw-text)] flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <ImagePlus className="w-4 h-4 text-[var(--mw-primary)]" />
                    <span>Galeri / Screenshot</span>
                  </button>
                </div>

                <p className="hidden md:block text-[11px] text-[var(--mw-text-dim)]">
                  Tips desktop: kamu juga bisa seret gambar ke kotak ini atau tekan <kbd className="px-1.5 py-0.5 rounded bg-[var(--mw-surface)] border border-[var(--mw-border)] font-mono">Ctrl+V</kbd> langsung!
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] text-[var(--mw-text-muted)]">
                <div className="p-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
                  <div className="font-semibold text-[var(--mw-text)]">Auto Item &amp; Harga</div>
                  <div className="mt-0.5">Pisahkan pajak, ongkir &amp; diskon otomatis.</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
                  <div className="font-semibold text-[var(--mw-text)]">Auto Kategori</div>
                  <div className="mt-0.5">Cocokkan ke sub-kategori milikmu.</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
                  <div className="font-semibold text-[var(--mw-text)]">Pecah Struk</div>
                  <div className="mt-0.5">Bisa gabung 1 atau pecah per kategori.</div>
                </div>
              </div>
            </div>
          )}

          {step === 'scanning' && (
            <div className="py-8 text-center space-y-4">
              {previewUrl && (
                <div className="relative w-40 h-52 mx-auto rounded-2xl overflow-hidden border border-[var(--mw-border)] shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview struk"
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 via-transparent to-emerald-500/25 animate-pulse" />
                </div>
              )}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--mw-primary-soft)] text-[var(--mw-primary)] text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI Gemini sedang membaca struk...</span>
              </div>
              <p className="text-xs text-[var(--mw-text-muted)]">
                Mengekstrak nama toko, daftar belanja, pajak/diskon &amp; mencocokkan kategorimu (± 2–5 detik).
              </p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4 text-xs">
              {/* Top Strip: Receipt Thumbnail + Rescan */}
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={() => setShowZoom(true)}
                      className="relative w-11 h-11 rounded-xl overflow-hidden border border-[var(--mw-border)] shrink-0 group cursor-pointer"
                      title="Perbesar foto struk"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Struk" className="w-full h-full object-cover" />
                      <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <ZoomIn className="w-3.5 h-3.5 text-white" />
                      </span>
                    </button>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--mw-text)] flex items-center gap-1.5 flex-wrap">
                      <span>Berhasil dibaca ({items.length} item)</span>
                      {engineUsed && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--mw-primary-soft)] text-[var(--mw-primary)]">
                          {engineUsed}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => previewUrl && setShowZoom(true)}
                      className="text-[11px] text-[var(--mw-primary)] hover:underline cursor-pointer"
                    >
                      Klik foto untuk cek ulang angka di struk
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetToPick}
                  className="px-2.5 py-1.5 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text-muted)] hover:text-[var(--mw-text)] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Scan Ulang</span>
                </button>
              </div>

              {/* Reported Total Mismatch Notice */}
              {totals.diffFromReported !== null && Math.abs(totals.diffFromReported) > 100 && (
                <div
                  className="p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2"
                  style={{
                    background: 'var(--mw-warn-soft)',
                    borderColor: 'var(--mw-warn)',
                  }}
                >
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <AlertTriangle
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: 'var(--mw-warn)' }}
                    />
                    <div className="text-[var(--mw-text)]">
                      Total hitungan (<b>{formatIDR(totals.grandTotal, privacy)}</b>) selisih{' '}
                      <b>{formatIDR(Math.abs(totals.diffFromReported), privacy)}</b> dari total di struk (
                      <b>{formatIDR(reportedTotal ?? 0, privacy)}</b>).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleMatchReportedTotal}
                    className="px-2.5 py-1 rounded-lg bg-[var(--mw-surface)] border border-[var(--mw-border)] font-semibold text-[var(--mw-text)] hover:border-[var(--mw-primary)] cursor-pointer shrink-0"
                  >
                    Sesuaikan ke Total Struk
                  </button>
                </div>
              )}

              {/* Merchant, Date, Wallet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[var(--mw-text-muted)] mb-1">Merchant / Toko</label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="Nama toko / restoran"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] font-medium focus:outline-none focus:border-[var(--mw-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--mw-text-muted)] mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[var(--mw-text-muted)]">Wallet Pembayaran</label>
                    {walletHint && (
                      <span className="text-[10px] font-semibold text-[var(--mw-primary)]">
                        Struk: {walletHint}
                      </span>
                    )}
                  </div>
                  <select
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                  >
                    {visibleWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Save Mode Toggle */}
              <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--mw-text)] inline-flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[var(--mw-primary)]" />
                    <span>Cara Simpan Transaksi</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)]">
                  <button
                    type="button"
                    onClick={() => setSaveMode('single')}
                    className="py-2 px-2 rounded-lg font-semibold cursor-pointer transition"
                    style={{
                      background: saveMode === 'single' ? 'var(--mw-primary-soft)' : 'transparent',
                      color: saveMode === 'single' ? 'var(--mw-primary)' : 'var(--mw-text-muted)',
                    }}
                  >
                    Gabung (1 Transaksi)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveMode('split_by_category')}
                    className="py-2 px-2 rounded-lg font-semibold cursor-pointer transition"
                    style={{
                      background:
                        saveMode === 'split_by_category' ? 'var(--mw-primary-soft)' : 'transparent',
                      color:
                        saveMode === 'split_by_category'
                          ? 'var(--mw-primary)'
                          : 'var(--mw-text-muted)',
                    }}
                  >
                    Pecah per Kategori ({Math.max(1, splitGroups.length)})
                  </button>
                </div>

                {saveMode === 'single' ? (
                  <div>
                    <label className="block text-[11px] text-[var(--mw-text-muted)] mb-1">
                      Kategori untuk transaksi gabungan:
                    </label>
                    <select
                      value={primarySubId}
                      onChange={(e) => setPrimarySubId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)]"
                    >
                      {expenseSubGroups.map(({ cat, subs }) => (
                        <optgroup key={cat.id} label={cat.name}>
                          {subs.map((s) => (
                            <option key={s.id} value={s.id}>
                              {cat.name} › {s.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--mw-text-muted)] leading-relaxed">
                    Item dengan sub-kategori berbeda akan otomatis disimpan sebagai transaksi terpisah (pajak/ongkir &amp; diskon dibagi proporsional).
                  </p>
                )}
              </div>

              {/* Editable Item List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--mw-text)]">
                    Daftar Item ({items.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 rounded-lg bg-[var(--mw-primary-soft)] text-[var(--mw-primary)] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="p-2.5 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={it.name}
                          onChange={(e) => handleItemChange(it.id, { name: e.target.value })}
                          placeholder="Nama item"
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] font-medium focus:outline-none focus:border-[var(--mw-primary)]"
                        />
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) =>
                            handleItemChange(it.id, {
                              qty: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          title="Qty"
                          className="w-12 px-2 py-1.5 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[var(--mw-text)] text-center tab-num focus:outline-none"
                        />
                        <div className="w-28 flex items-center gap-1 px-2 py-1.5 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)]">
                          <span className="text-[var(--mw-text-dim)]">Rp</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={it.priceText}
                            onChange={(e) => handleItemChange(it.id, { priceText: e.target.value })}
                            placeholder="0"
                            className="w-full bg-transparent text-[var(--mw-text)] font-bold tab-num text-right focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(it.id)}
                          aria-label="Hapus item"
                          className="p-1.5 rounded-lg text-[var(--mw-text-dim)] hover:text-red-400 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <select
                        value={it.subcategoryId}
                        onChange={(e) => handleItemChange(it.id, { subcategoryId: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--mw-surface)] border border-[var(--mw-border)] text-[11px] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
                      >
                        {expenseSubGroups.map(({ cat, subs }) => (
                          <optgroup key={cat.id} label={cat.name}>
                            {subs.map((s) => (
                              <option key={s.id} value={s.id}>
                                {cat.name} › {s.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax / Service & Discount */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[var(--mw-text-muted)] mb-1">
                    Pajak / Service / Ongkir (+)
                  </label>
                  <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
                    <span className="text-[var(--mw-text-dim)]">Rp</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={taxText}
                      onChange={(e) => setTaxText(e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent text-[var(--mw-text)] font-semibold tab-num focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[var(--mw-text-muted)] mb-1">
                    Diskon / Promo (−)
                  </label>
                  <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)]">
                    <span className="text-[var(--mw-text-dim)]">Rp</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={discountText}
                      onChange={(e) => setDiscountText(e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent text-[var(--mw-text)] font-semibold tab-num focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Live Split Preview when split_by_category */}
              {saveMode === 'split_by_category' && splitGroups.length > 0 && (
                <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] space-y-1.5">
                  <div className="font-semibold text-[var(--mw-text)]">
                    Pratinjau {splitGroups.length} Transaksi yang Akan Disimpan:
                  </div>
                  {splitGroups.map((g) => {
                    const sub = subById.get(g.subcategoryId);
                    const cat = sub ? catById.get(sub.categoryId) : null;
                    return (
                      <div
                        key={g.subcategoryId}
                        className="flex items-center justify-between gap-2 py-1 border-t border-[var(--mw-border)] first:border-t-0"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--mw-text)] truncate">
                            {cat ? `${cat.name} › ` : ''}
                            {sub?.name ?? 'Pengeluaran'}
                          </div>
                          <div className="text-[11px] text-[var(--mw-text-dim)] truncate">
                            {g.itemNames.join(', ')}
                          </div>
                        </div>
                        <span className="font-bold tab-num text-[var(--mw-expense)] shrink-0">
                          −{formatIDR(g.finalAmount, privacy)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Footer on Review Step */}
        {step === 'review' && (
          <div className="px-5 py-3.5 border-t border-[var(--mw-border)] bg-[var(--mw-surface)] space-y-2.5 shrink-0 pb-safe">
            <div className="flex items-center justify-between text-xs">
              <div className="text-[var(--mw-text-muted)] space-x-2 tab-num">
                <span>Subtotal {formatIDR(totals.itemsSubtotal, privacy)}</span>
                {totals.taxOrService > 0 && (
                  <span>+{formatIDR(totals.taxOrService, privacy)}</span>
                )}
                {totals.discount > 0 && (
                  <span style={{ color: 'var(--mw-income)' }}>
                    −{formatIDR(totals.discount, privacy)}
                  </span>
                )}
              </div>
              <div className="text-base font-extrabold tab-num text-[var(--mw-text)]">
                {formatIDR(totals.grandTotal, privacy)}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[var(--mw-surface-2)] text-[var(--mw-text)] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={totals.grandTotal <= 0 || !walletId}
                onClick={handleSave}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
                style={{ background: 'var(--mw-primary)' }}
              >
                <Check className="w-4 h-4" />
                <span>
                  Simpan {txCountToCreate} Transaksi · {formatIDR(totals.grandTotal, privacy)}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Image Zoom Lightbox */}
      {showZoom && previewUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setShowZoom(false)}
        >
          <button
            type="button"
            onClick={() => setShowZoom(false)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/15 text-white cursor-pointer"
            aria-label="Tutup pratinjau"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Foto struk diperbesar"
            className="max-w-full max-h-[88dvh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

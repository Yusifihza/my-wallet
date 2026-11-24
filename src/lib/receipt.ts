import type { Category, Subcategory, Transaction, Wallet } from '@/types/finance';

export interface ScannedReceiptItem {
  id: string;
  name: string;
  qty: number;
  /** Total price for this line item (qty * unit price) in IDR integer */
  price: number;
  subcategoryId: string;
}

export interface ScannedReceiptDraft {
  merchant: string;
  date: string; // YYYY-MM-DD
  walletHint: string | null;
  suggestedWalletId: string | null;
  items: ScannedReceiptItem[];
  /** Positive IDR amount for PPN / PB1 / Service Charge / Ongkir / Biaya Aplikasi */
  taxOrService: number;
  /** Positive IDR magnitude for Diskon / Promo / Voucher (subtracted from total) */
  discount: number;
  /** Total printed on receipt, if detected */
  reportedTotal: number | null;
  engine?: string;
}

export type ReceiptSaveMode = 'single' | 'split_by_category';

export interface ReceiptSplitGroup {
  subcategoryId: string;
  itemsSubtotal: number;
  adjustmentShare: number;
  finalAmount: number;
  itemNames: string[];
}

export interface ReceiptTotalsSummary {
  itemsSubtotal: number;
  taxOrService: number;
  discount: number;
  grandTotal: number;
  diffFromReported: number | null;
}

export function calculateReceiptTotals(
  items: Pick<ScannedReceiptItem, 'price'>[],
  taxOrService: number,
  discount: number,
  reportedTotal: number | null = null
): ReceiptTotalsSummary {
  const itemsSubtotal = items.reduce((s, it) => s + Math.max(0, Math.round(it.price || 0)), 0);
  const tax = Math.max(0, Math.round(taxOrService || 0));
  const disc = Math.max(0, Math.round(discount || 0));
  const grandTotal = Math.max(0, itemsSubtotal + tax - disc);
  const diffFromReported =
    reportedTotal !== null && reportedTotal > 0 ? grandTotal - Math.round(reportedTotal) : null;
  return {
    itemsSubtotal,
    taxOrService: tax,
    discount: disc,
    grandTotal,
    diffFromReported,
  };
}

/**
 * Groups receipt items by subcategory and proportionally allocates
 * (taxOrService - discount) with exact rounding reconciliation so that
 * the sum of all split transactions ALWAYS equals grandTotal down to Rp1.
 */
export function buildReceiptSplitGroups(
  items: ScannedReceiptItem[],
  taxOrService: number,
  discount: number,
  fallbackSubcategoryId: string
): ReceiptSplitGroup[] {
  const activeItems = items.filter((it) => Math.round(it.price || 0) > 0);
  if (activeItems.length === 0) return [];

  const totals = calculateReceiptTotals(activeItems, taxOrService, discount);
  if (totals.grandTotal <= 0) return [];

  const groupMap = new Map<
    string,
    { subcategoryId: string; itemsSubtotal: number; itemNames: string[] }
  >();

  for (const it of activeItems) {
    const subId = it.subcategoryId || fallbackSubcategoryId;
    const price = Math.max(0, Math.round(it.price));
    const existing = groupMap.get(subId);
    const label = it.qty > 1 ? `${it.name.trim()} ×${it.qty}` : it.name.trim();
    if (existing) {
      existing.itemsSubtotal += price;
      if (label) existing.itemNames.push(label);
    } else {
      groupMap.set(subId, {
        subcategoryId: subId,
        itemsSubtotal: price,
        itemNames: label ? [label] : [],
      });
    }
  }

  const groups = [...groupMap.values()].sort((a, b) => b.itemsSubtotal - a.itemsSubtotal);
  const netAdjustment = totals.taxOrService - totals.discount;

  const withShares: ReceiptSplitGroup[] = groups.map((g) => {
    const rawShare =
      totals.itemsSubtotal > 0
        ? Math.round((g.itemsSubtotal / totals.itemsSubtotal) * netAdjustment)
        : 0;
    return {
      subcategoryId: g.subcategoryId,
      itemsSubtotal: g.itemsSubtotal,
      adjustmentShare: rawShare,
      finalAmount: Math.max(0, g.itemsSubtotal + rawShare),
      itemNames: g.itemNames,
    };
  });

  // Exact rounding reconciliation onto the largest group
  const currentSum = withShares.reduce((s, g) => s + g.finalAmount, 0);
  const roundingDiff = totals.grandTotal - currentSum;
  if (roundingDiff !== 0 && withShares.length > 0) {
    withShares[0] = {
      ...withShares[0],
      adjustmentShare: withShares[0].adjustmentShare + roundingDiff,
      finalAmount: Math.max(0, withShares[0].finalAmount + roundingDiff),
    };
  }

  return withShares.filter((g) => g.finalAmount > 0);
}

function formatCompactItemNote(merchant: string, itemNames: string[]): string {
  const cleanMerchant = merchant.trim();
  const cleanItems = itemNames.map((n) => n.trim()).filter(Boolean);
  if (cleanItems.length === 0) return cleanMerchant || 'Scan struk';
  const preview = cleanItems.slice(0, 3).join(', ');
  const rest = cleanItems.length > 3 ? ` (+${cleanItems.length - 3} item)` : '';
  const body = `${preview}${rest}`;
  const full = cleanMerchant ? `${cleanMerchant}: ${body}` : body;
  return full.length > 140 ? `${full.slice(0, 137)}...` : full;
}

export function buildReceiptTransactions(
  draft: ScannedReceiptDraft,
  options: {
    mode: ReceiptSaveMode;
    walletId: string;
    primarySubcategoryId: string;
    fallbackSubcategoryId: string;
  }
): Omit<Transaction, 'id' | 'createdAt'>[] {
  const totals = calculateReceiptTotals(draft.items, draft.taxOrService, draft.discount);
  if (totals.grandTotal <= 0 || !options.walletId) return [];

  if (options.mode === 'single') {
    const names = draft.items
      .filter((it) => Math.round(it.price || 0) > 0)
      .map((it) => (it.qty > 1 ? `${it.name.trim()} ×${it.qty}` : it.name.trim()));
    return [
      {
        date: draft.date,
        type: 'expense',
        subcategoryId: options.primarySubcategoryId || options.fallbackSubcategoryId,
        walletId: options.walletId,
        toWalletId: null,
        amount: totals.grandTotal,
        fee: 0,
        goalId: null,
        investmentProductId: null,
        note: formatCompactItemNote(draft.merchant, names),
      },
    ];
  }

  const groups = buildReceiptSplitGroups(
    draft.items,
    draft.taxOrService,
    draft.discount,
    options.fallbackSubcategoryId
  );

  return groups.map((g) => ({
    date: draft.date,
    type: 'expense',
    subcategoryId: g.subcategoryId,
    walletId: options.walletId,
    toWalletId: null,
    amount: g.finalAmount,
    fee: 0,
    goalId: null,
    investmentProductId: null,
    note: formatCompactItemNote(draft.merchant, g.itemNames),
  }));
}

export function pickDominantSubcategoryId(
  items: ScannedReceiptItem[],
  fallbackSubcategoryId: string
): string {
  const bySub = new Map<string, number>();
  for (const it of items) {
    const p = Math.max(0, Math.round(it.price || 0));
    if (!it.subcategoryId || p <= 0) continue;
    bySub.set(it.subcategoryId, (bySub.get(it.subcategoryId) ?? 0) + p);
  }
  let bestId = fallbackSubcategoryId;
  let bestAmt = -1;
  for (const [id, amt] of bySub.entries()) {
    if (amt > bestAmt) {
      bestAmt = amt;
      bestId = id;
    }
  }
  return bestId;
}

export function matchWalletHint(hint: string | null | undefined, wallets: Wallet[]): string | null {
  if (!hint) return null;
  const h = hint.toLowerCase();
  const visible = wallets.filter((w) => !w.hidden && !w.archived);
  if (visible.length === 0) return null;

  // Direct name inclusion first
  const exact = visible.find((w) => h.includes(w.name.toLowerCase()));
  if (exact) return exact.id;

  const rules: [RegExp, RegExp][] = [
    [/gopay|go-pay/, /gopay/i],
    [/shopeepay|spay/, /shopee/i],
    [/\bdana\b/, /\bdana\b/i],
    [/\bovo\b/, /\bovo\b/i],
    [/linkaja/, /linkaja/i],
    [/tunai|cash/, /tunai|cash/i],
    [/mandiri|livin/, /mandiri/i],
    [/\bbni\b|wondr/, /\bbni\b/i],
    [/jago/, /jago/i],
    [/krom/, /krom/i],
    [/e-?money|flazz|brizzi|tol/, /e-?money/i],
    [/qris/, /gopay|jago|mandiri|dana|ovo/i],
  ];

  for (const [hintPattern, walletPattern] of rules) {
    if (hintPattern.test(h)) {
      const matched = visible.find((w) => walletPattern.test(w.name));
      if (matched) return matched.id;
    }
  }
  return null;
}

export function matchSubcategoryFallback(
  text: string,
  categories: Category[],
  subcategories: Subcategory[]
): string {
  const expenseCatIds = new Set(
    categories.filter((c) => c.type === 'expense' && !c.archived).map((c) => c.id)
  );
  const expenseSubs = subcategories.filter((s) => expenseCatIds.has(s.categoryId) && !s.archived);
  if (expenseSubs.length === 0) return subcategories[0]?.id ?? '';

  const q = text.toLowerCase();

  // 1. Check user's subcategory names & aliases
  for (const sub of expenseSubs) {
    if (sub.name.length >= 3 && q.includes(sub.name.toLowerCase())) {
      return sub.id;
    }
    if (sub.aliases.some((al) => al.length >= 2 && q.includes(al.toLowerCase()))) {
      return sub.id;
    }
  }

  // 2. Indonesian receipt item keyword rules
  const keywordRules: [RegExp, RegExp][] = [
    [
      /kopi|coffee|latte|cappuccino|americano|espresso|matcha|frappe|starbucks|fore|kenangan|janji jiwa|point coffee|tomoro|tuku|kafe|cafe/,
      /kafe/i,
    ],
    [
      /nasi|ayam|mie|bakso|soto|geprek|padang|warteg|sate|burger|pizza|ramen|sushi|bento|rice|chicken|beef|gofood|grabfood|shopeefood|makan/,
      /makanan pokok|restoran/i,
    ],
    [
      /snack|keripik|chitato|lays|pocky|coklat|chocolate|es krim|ice cream|boba|teh botol|aqua|le minerale|mineral|roti|bread|kue|donut|jajanan/,
      /jajanan/i,
    ],
    [
      /sabun|shampoo|odol|pasta gigi|pepsodent|sikat gigi|tisu|tissue|deterjen|rinso|molto|sunlight|indomaret|alfamart|superindo|hypermart|minyak goreng|beras|telur|susu|gula|kecap/,
      /belanja bulanan/i,
    ],
    [/pertamax|pertalite|dexlite|solar|spbu|shell|vivo|bensin|bbm/, /bensin/i],
    [/parkir|parking/, /parkir/i],
    [/goride|gocar|grab|maxim|taksi|bluebird|ojol/, /ojol|taksi/i],
    [/krl|mrt|lrt|transjakarta|busway|commuter/, /publik/i],
    [/obat|apotek|kimia farma|k24|vitamin|paracetamol|panadol|tolak angin|betadine|masker|hansaplast/, /obat/i],
    [/skincare|sunscreen|facial wash|serum|toner|barbershop|potong rambut|salon/, /perawatan/i],
    [/baju|kaos|celana|sepatu|sandal|uniqlo|h&m|zara|kemeja|jaket/, /fashion/i],
    [/pln|token|listrik/, /listrik/i],
    [/indihome|biznet|wifi|internet|telkomsel|xl|indosat|pulsa|kuota/, /internet|pulsa/i],
    [/xxi|cgv|cinepolis|bioskop|tiket nonton/, /film/i],
    [/laundry|cuci/, /laundry/i],
  ];

  for (const [itemPattern, subNamePattern] of keywordRules) {
    if (itemPattern.test(q)) {
      const matched = expenseSubs.find((s) => subNamePattern.test(s.name));
      if (matched) return matched.id;
    }
  }

  // Fallback to Makanan Pokok / Belanja bulanan / Umum
  return (
    expenseSubs.find((s) => /belanja bulanan/i.test(s.name))?.id ??
    expenseSubs.find((s) => /umum/i.test(s.name))?.id ??
    expenseSubs[0].id
  );
}

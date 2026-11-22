import { toISODate } from '@/lib/finance';
import { INVESTMENT_ASSET_COLORS } from '@/lib/seed';
import type {
  AppDataset,
  GoalContribution,
  InvestmentProduct,
  RecurringRule,
  Transaction,
  WalletValuation,
} from '@/types/finance';

function clampDay(year: number, month: number, day: number): string {
  const maxDay = new Date(year, month + 1, 0).getDate();
  return toISODate(new Date(year, month, Math.min(day, maxDay)));
}

/**
 * Resolves IDs by name/fallback so dummy data works seamlessly in both
 * local mode (seed string IDs) and Supabase mode (UUIDs).
 */
function findIds(ds: AppDataset) {
  const wallet = (name: string, fallbackId: string) =>
    ds.wallets.find((w) => w.name.toLowerCase() === name.toLowerCase())?.id ??
    ds.wallets.find((w) => w.id === fallbackId)?.id ??
    ds.wallets[0]?.id ??
    fallbackId;

  const sub = (name: string, fallbackId: string) =>
    ds.subcategories.find((s) => s.name.toLowerCase() === name.toLowerCase())?.id ??
    ds.subcategories.find((s) => s.id === fallbackId)?.id ??
    null;

  const goal = (name: string, fallbackId: string) =>
    ds.goals.find((g) => g.name.toLowerCase().includes(name.toLowerCase()))?.id ??
    ds.goals.find((g) => g.id === fallbackId)?.id ??
    null;

  return {
    wTunai: wallet('Tunai', 'w_tunai'),
    wJago: wallet('Jago', 'w_jago'),
    wKrom: wallet('Krom', 'w_krom'),
    wBni: wallet('BNI', 'w_bni'),
    wMandiri: wallet('Mandiri', 'w_mandiri'),
    wGopay: wallet('GoPay', 'w_gopay'),
    wShopee: wallet('ShopeePay', 'w_shopeepay'),
    wDana: wallet('DANA', 'w_dana'),
    wLinkAja: wallet('LinkAja', 'w_linkaja'),
    wOvo: wallet('OVO', 'w_ovo'),
    wEmoney: wallet('Mandiri e-money', 'w_emoney'),
    wBibit: wallet('Bibit', 'w_bibit'),
    sGaji: sub('Gaji', 'sub_inc_gaji'),
    sBonus: sub('Bonus', 'sub_inc_bonus'),
    sCashback: sub('Cashback', 'sub_inc_cashback'),
    sBunga: sub('Bunga', 'sub_inc_bunga'),
    sMakanPokok: sub('Makan pokok', 'sub_exp_makan_pokok'),
    sKafe: sub('Kafe/Ngopi', 'sub_exp_kafe'),
    sJajan: sub('Jajan', 'sub_exp_jajan'),
    sBensin: sub('Bensin', 'sub_exp_bensin'),
    sOjol: sub('Ojol', 'sub_exp_ojol'),
    sParkirTol: sub('Parkir & Tol', 'sub_exp_parkir_tol'),
    sBelanja: sub('Belanja bulanan', 'sub_exp_belanja_bulanan'),
    sKos: sub('Kos/Kontrakan', 'sub_exp_kos'),
    sInternet: sub('Internet & HP', 'sub_exp_internet'),
    sListrik: sub('Listrik & Air', 'sub_exp_listrik'),
    sLangganan: sub('Langganan', 'sub_exp_langganan'),
    sHiburan: sub('Nonton/Game/Hobi', 'sub_exp_hiburan'),
    sKesehatan: sub('Obat & Kesehatan', 'sub_exp_kesehatan'),
    sKeluarga: sub('Keluarga', 'sub_exp_keluarga'),
    sZakat: sub('Zakat/Sedekah', 'sub_exp_zakat'),
    sWedding: sub('Wedding', 'sub_sav_wedding'),
    sDarurat: sub('Dana darurat', 'sub_sav_darurat'),
    sInvestasi: sub('Investasi', 'sub_sav_investasi'),
    gWedding: goal('wedding', 'goal_wedding'),
    gDarurat: goal('darurat', 'goal_darurat'),
  };
}

/**
 * Generates realistic 3-month dummy data relative to referenceDate (default today)
 * so the user can immediately test MoM trends, daily heatmap, Bibit multi-product
 * market valuation, Wedding shared goal with partner, recurring rules, and AI Advisor.
 */
export function applyThreeMonthDummyData(
  base: AppDataset,
  referenceDate = new Date()
): AppDataset {
  const ids = findIds(base);
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();
  const todayDay = referenceDate.getDate();
  const todayStr = toISODate(referenceDate);

  const openingDate = clampDay(y, m - 2, 1);

  // Realistic opening balances 3 months ago
  const openingByWallet: Record<string, number> = {
    [ids.wTunai]: 350000,
    [ids.wJago]: 3200000,
    [ids.wKrom]: 1500000,
    [ids.wBni]: 900000,
    [ids.wMandiri]: 1100000,
    [ids.wGopay]: 450000,
    [ids.wShopee]: 250000,
    [ids.wDana]: 180000,
    [ids.wLinkAja]: 75000,
    [ids.wOvo]: 120000,
    [ids.wEmoney]: 140000,
    [ids.wBibit]: 11500000,
  };

  const wallets = base.wallets.map((w) => ({
    ...w,
    openingBalance: openingByWallet[w.id] ?? w.openingBalance,
    openingDate,
  }));

  // 5 Bibit Products for Wedding (PU, Obligasi, Reksa Saham, Saham, SBN)
  const existingProds = base.investmentProducts ?? [];
  const findProdId = (cls: InvestmentProduct['assetClass'], fallback: string) =>
    existingProds.find((p) => p.assetClass === cls && p.walletId === ids.wBibit)?.id ?? fallback;

  const prodPuId = findProdId('pu', 'prod_bibit_pu');
  const prodOblId = findProdId('obligasi', 'prod_bibit_obligasi');
  const prodRsId = findProdId('reksa_saham', 'prod_bibit_reksa_saham');
  const prodSahamId = findProdId('saham', 'prod_bibit_saham');
  const prodSbnId = findProdId('sbn', 'prod_bibit_sbn');

  const investmentProducts: InvestmentProduct[] = [
    {
      id: prodPuId,
      walletId: ids.wBibit,
      goalId: ids.gWedding,
      name: 'Pasar Uang (PU)',
      assetClass: 'pu',
      investedAmount: 4200000,
      marketValue: 4318000, // +2.81%
      color: INVESTMENT_ASSET_COLORS.pu,
      updatedAt: todayStr,
      sortOrder: 1,
    },
    {
      id: prodOblId,
      walletId: ids.wBibit,
      goalId: ids.gWedding,
      name: 'Obligasi',
      assetClass: 'obligasi',
      investedAmount: 3600000,
      marketValue: 3792000, // +5.33%
      color: INVESTMENT_ASSET_COLORS.obligasi,
      updatedAt: todayStr,
      sortOrder: 2,
    },
    {
      id: prodRsId,
      walletId: ids.wBibit,
      goalId: ids.gWedding,
      name: 'Reksa Saham',
      assetClass: 'reksa_saham',
      investedAmount: 2400000,
      marketValue: 2565000, // +6.88%
      color: INVESTMENT_ASSET_COLORS.reksa_saham,
      updatedAt: todayStr,
      sortOrder: 3,
    },
    {
      id: prodSahamId,
      walletId: ids.wBibit,
      goalId: ids.gWedding,
      name: 'Saham',
      assetClass: 'saham',
      investedAmount: 1800000,
      marketValue: 1742000, // -3.22% (realistic market fluctuation!)
      color: INVESTMENT_ASSET_COLORS.saham,
      updatedAt: todayStr,
      sortOrder: 4,
    },
    {
      id: prodSbnId,
      walletId: ids.wBibit,
      goalId: ids.gWedding,
      name: 'SBN (ORI/SBR)',
      assetClass: 'sbn',
      investedAmount: 2000000,
      marketValue: 2116000, // +5.80%
      color: INVESTMENT_ASSET_COLORS.sbn,
      updatedAt: todayStr,
      sortOrder: 5,
    },
  ];
  // Total Bibit Modal Disetor = Rp14.000.000 | Total Nilai Pasar = Rp14.533.000 (+Rp533.000 / +3,81%)

  const transactions: Transaction[] = [];
  let seq = 1;
  const pushTx = (
    monthOffset: number,
    day: number,
    tx: Omit<Transaction, 'id' | 'date' | 'createdAt'>
  ) => {
    const targetDate = new Date(y, m - monthOffset, 1);
    const maxDayForMonth =
      monthOffset === 0
        ? Math.max(1, todayDay)
        : new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    if (monthOffset === 0 && day > maxDayForMonth) return;
    const iso = clampDay(targetDate.getFullYear(), targetDate.getMonth(), day);
    transactions.push({
      ...tx,
      id: `demo_tx_${seq++}`,
      date: iso,
      createdAt: `${iso}T09:${String((seq * 7) % 59).padStart(2, '0')}:00.000Z`,
    });
  };

  // Build 3 months: offset 2 (2 bulan lalu), offset 1 (bulan lalu), offset 0 (bulan ini)
  const monthsConfig = [
    {
      offset: 2,
      bonus: 400000,
      kafeMul: 1.0,
      belanja: 480000,
      hiburan: 145000,
      weddingProd: prodOblId,
      weddingNote: 'Setoran Wedding — Obligasi Bibit',
    },
    {
      offset: 1,
      bonus: 0,
      kafeMul: 1.35, // Higher coffee/dining last month for realistic MoM insight!
      belanja: 560000,
      hiburan: 240000,
      weddingProd: prodRsId,
      weddingNote: 'Setoran Wedding — Reksa Saham Bibit',
    },
    {
      offset: 0,
      bonus: 250000,
      kafeMul: 0.9,
      belanja: 440000,
      hiburan: 110000,
      weddingProd: prodPuId,
      weddingNote: 'Setoran Wedding — Pasar Uang Bibit',
    },
  ];

  for (const cfg of monthsConfig) {
    const o = cfg.offset;
    // Income
    pushTx(o, 1, {
      type: 'income',
      amount: 6000000,
      fee: 0,
      subcategoryId: ids.sGaji,
      walletId: ids.wJago,
      toWalletId: null,
      goalId: null,
      note: 'Gaji bulanan',
    });
    if (cfg.bonus > 0) {
      pushTx(o, 14, {
        type: 'income',
        amount: cfg.bonus,
        fee: 0,
        subcategoryId: ids.sBonus,
        walletId: ids.wMandiri,
        toWalletId: null,
        goalId: null,
        note: 'Bonus project kecil',
      });
    }
    pushTx(o, 19, {
      type: 'income',
      amount: 42000,
      fee: 0,
      subcategoryId: ids.sBunga,
      walletId: ids.wKrom,
      toWalletId: null,
      goalId: null,
      note: 'Bunga tabungan Krom',
    });

    // Fixed & Routine Expenses
    pushTx(o, 2, {
      type: 'expense',
      amount: 950000,
      fee: 0,
      subcategoryId: ids.sKos,
      walletId: ids.wJago,
      toWalletId: null,
      goalId: null,
      note: 'Bayar kos bulanan',
    });
    pushTx(o, 3, {
      type: 'expense',
      amount: 165000,
      fee: 0,
      subcategoryId: ids.sInternet,
      walletId: ids.wJago,
      toWalletId: null,
      goalId: null,
      note: 'Paket data & WiFi',
    });
    pushTx(o, 4, {
      type: 'expense',
      amount: 120000,
      fee: 0,
      subcategoryId: ids.sListrik,
      walletId: ids.wGopay,
      toWalletId: null,
      goalId: null,
      note: 'Token listrik PLN',
    });
    pushTx(o, 5, {
      type: 'expense',
      amount: 300000,
      fee: 0,
      subcategoryId: ids.sKeluarga,
      walletId: ids.wBni,
      toWalletId: null,
      goalId: null,
      note: 'Transfer orang tua',
    });
    pushTx(o, 7, {
      type: 'expense',
      amount: cfg.belanja,
      fee: 0,
      subcategoryId: ids.sBelanja,
      walletId: ids.wShopee,
      toWalletId: null,
      goalId: null,
      note: 'Belanja bulanan kebutuhan rumah',
    });
    pushTx(o, 15, {
      type: 'expense',
      amount: 75000,
      fee: 0,
      subcategoryId: ids.sLangganan,
      walletId: ids.wJago,
      toWalletId: null,
      goalId: null,
      note: 'Spotify & iCloud',
    });
    pushTx(o, 18, {
      type: 'expense',
      amount: 150000,
      fee: 0,
      subcategoryId: ids.sZakat,
      walletId: ids.wJago,
      toWalletId: null,
      goalId: null,
      note: 'Sedekah bulanan',
    });
    pushTx(o, 21, {
      type: 'expense',
      amount: cfg.hiburan,
      fee: 0,
      subcategoryId: ids.sHiburan,
      walletId: ids.wGopay,
      toWalletId: null,
      goalId: null,
      note: 'Nonton bioskop & makan malam',
    });

    // Transfers (excluded from Expense except fee!)
    pushTx(o, 2, {
      type: 'transfer',
      amount: 700000,
      fee: 0,
      subcategoryId: null,
      walletId: ids.wJago,
      toWalletId: ids.wGopay,
      goalId: null,
      note: 'Top up GoPay bulanan',
    });
    pushTx(o, 6, {
      type: 'transfer',
      amount: 500000,
      fee: 2500,
      subcategoryId: null,
      walletId: ids.wJago,
      toWalletId: ids.wShopee,
      goalId: null,
      note: 'Top up ShopeePay (BI-FAST)',
    });
    pushTx(o, 11, {
      type: 'transfer',
      amount: 100000,
      fee: 1500,
      subcategoryId: null,
      walletId: ids.wMandiri,
      toWalletId: ids.wEmoney,
      goalId: null,
      note: 'Top up Mandiri e-money tol',
    });

    // Savings: Wedding (to Bibit with productId) & Dana Darurat (to Krom)
    pushTx(o, 3, {
      type: 'saving',
      amount: 850000,
      fee: 0,
      subcategoryId: ids.sWedding,
      walletId: ids.wJago,
      toWalletId: ids.wBibit,
      goalId: ids.gWedding,
      investmentProductId: cfg.weddingProd,
      note: cfg.weddingNote,
    });
    pushTx(o, 4, {
      type: 'saving',
      amount: 400000,
      fee: 0,
      subcategoryId: ids.sDarurat,
      walletId: ids.wJago,
      toWalletId: ids.wKrom,
      goalId: ids.gDarurat,
      note: 'Setoran Dana Darurat',
    });

    // Daily realistic spending scattered across the month for rich Heatmap!
    const dailyExpenses: [number, number, string | null, string, string][] = [
      [2, 32000, ids.sMakanPokok, ids.wGopay, 'Makan siang warteg'],
      [3, Math.round(35000 * cfg.kafeMul), ids.sKafe, ids.wGopay, 'Es kopi susu'],
      [4, 50000, ids.sBensin, ids.wTunai, 'Isi Pertamax'],
      [5, 28000, ids.sMakanPokok, ids.wTunai, 'Nasi padang'],
      [6, 42000, ids.sOjol, ids.wGopay, 'GoRide kantor PP'],
      [8, Math.round(58000 * cfg.kafeMul), ids.sKafe, ids.wGopay, 'Ngopi & croissant weekend'],
      [9, 65000, ids.sMakanPokok, ids.wGopay, 'Makan bareng pasangan'],
      [10, 35000, ids.sJajan, ids.wDana, 'Martabak & camilan'],
      [12, 50000, ids.sBensin, ids.wTunai, 'Isi bensin'],
      [13, 29000, ids.sMakanPokok, ids.wGopay, 'Ayam geprek'],
      [14, Math.round(45000 * cfg.kafeMul), ids.sKafe, ids.wOvo, 'Matcha latte'],
      [16, 38000, ids.sOjol, ids.wGopay, 'GrabCar hujan'],
      [17, 45000, ids.sParkirTol, ids.wEmoney, 'Tol & parkir mall'],
      [19, 85000, ids.sKesehatan, ids.wGopay, 'Vitamin & obat flu'],
      [20, 34000, ids.sMakanPokok, ids.wTunai, 'Soto ayam'],
      [22, Math.round(62000 * cfg.kafeMul), ids.sKafe, ids.wGopay, 'Kopi & ngobrol weekend'],
      [24, 50000, ids.sBensin, ids.wTunai, 'Isi bensin'],
      [25, 48000, ids.sMakanPokok, ids.wGopay, 'Makan malam ramen'],
      [27, 26000, ids.sJajan, ids.wShopee, 'Jajan sore'],
    ];
    for (const [d, amt, subId, wId, note] of dailyExpenses) {
      pushTx(o, d, {
        type: 'expense',
        amount: amt,
        fee: 0,
        subcategoryId: subId,
        walletId: wId,
        toWalletId: null,
        goalId: null,
        note,
      });
    }
  }

  // Sort newest first
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  // Bibit Historical Valuations (6 points over 3 months showing realistic growth!)
  const valuations: WalletValuation[] = [
    { id: 'demo_val_1', walletId: ids.wBibit, date: clampDay(y, m - 2, 5), marketValue: 12180000 },
    { id: 'demo_val_2', walletId: ids.wBibit, date: clampDay(y, m - 2, 22), marketValue: 12360000 },
    { id: 'demo_val_3', walletId: ids.wBibit, date: clampDay(y, m - 1, 6), marketValue: 13290000 },
    { id: 'demo_val_4', walletId: ids.wBibit, date: clampDay(y, m - 1, 23), marketValue: 13520000 },
    { id: 'demo_val_5', walletId: ids.wBibit, date: clampDay(y, m, Math.min(5, todayDay)), marketValue: 14410000 },
    { id: 'demo_val_6', walletId: ids.wBibit, date: todayStr, marketValue: 14533000 },
  ];

  // Partner contributions to Shared Wedding Goal (also investing in Bibit products!)
  const goalContributions: GoalContribution[] = ids.gWedding
    ? [
        {
          id: 'demo_gc_1',
          goalId: ids.gWedding,
          contributorName: 'Pasangan',
          isPartner: true,
          amount: 4500000,
          date: clampDay(y, m - 2, 4),
          productName: 'Pasar Uang (PU) & SBN',
          note: 'Saldo awal tabungan Wedding pasangan',
        },
        {
          id: 'demo_gc_2',
          goalId: ids.gWedding,
          contributorName: 'Pasangan',
          isPartner: true,
          amount: 1250000,
          date: clampDay(y, m - 1, 5),
          productName: 'Obligasi',
          note: 'Setoran rutin Wedding bulan lalu',
        },
        {
          id: 'demo_gc_3',
          goalId: ids.gWedding,
          contributorName: 'Pasangan',
          isPartner: true,
          amount: 1500000,
          date: clampDay(y, m, Math.min(4, todayDay)),
          productName: 'Reksa Saham & PU',
          note: 'Setoran rutin Wedding bulan ini',
        },
      ]
    : [];

  // Recurring Rules
  const nextMonthFirst = clampDay(y, m + 1, 1);
  const dueSoonDay = clampDay(y, m, Math.min(todayDay + 1, 28));
  const recurringRules: RecurringRule[] = [
    {
      id: 'demo_rec_1',
      label: 'Gaji Bulanan',
      type: 'income',
      amount: 6000000,
      subcategoryId: ids.sGaji,
      walletId: ids.wJago,
      toWalletId: null,
      goalId: null,
      note: 'Gaji bulanan otomatis',
      frequency: 'monthly',
      dayOfMonth: 1,
      nextRun: nextMonthFirst,
      active: true,
    },
    {
      id: 'demo_rec_2',
      label: 'Bayar Kos',
      type: 'expense',
      amount: 950000,
      subcategoryId: ids.sKos,
      walletId: ids.wJago,
      toWalletId: null,
      goalId: null,
      note: 'Kos bulanan',
      frequency: 'monthly',
      dayOfMonth: 2,
      nextRun: clampDay(y, m + 1, 2),
      active: true,
    },
    {
      id: 'demo_rec_3',
      label: 'Setoran Wedding (Bibit PU)',
      type: 'saving',
      amount: 850000,
      subcategoryId: ids.sWedding,
      walletId: ids.wJago,
      toWalletId: ids.wBibit,
      goalId: ids.gWedding,
      investmentProductId: prodPuId,
      note: 'Nabung rutin Wedding',
      frequency: 'monthly',
      dayOfMonth: 3,
      nextRun: todayStr, // Due today so user can test 1-click "Catat Sekarang"!
      active: true,
    },
    {
      id: 'demo_rec_4',
      label: 'Internet & Paket Data',
      type: 'expense',
      amount: 165000,
      subcategoryId: ids.sInternet,
      walletId: ids.wJago,
      toWalletId: null,
      goalId: null,
      note: 'Paket data & WiFi',
      frequency: 'monthly',
      dayOfMonth: 5,
      nextRun: dueSoonDay,
      active: true,
    },
    {
      id: 'demo_rec_5',
      label: 'Langganan Spotify & iCloud',
      type: 'expense',
      amount: 75000,
      subcategoryId: ids.sLangganan,
      walletId: ids.wJago,
      toWalletId: null,
      goalId: null,
      note: 'Langganan digital',
      frequency: 'monthly',
      dayOfMonth: 15,
      nextRun: clampDay(y, m + 1, 15),
      active: true,
    },
  ];

  const goalInvites = ids.gWedding
    ? [
        {
          goalId: ids.gWedding,
          code: 'MW-WED-2027',
          partnerName: 'Pasangan',
          partnerEmail: 'pasangan@gmail.com',
          sharePercent: 50,
          status: 'joined' as const,
        },
      ]
    : base.goalInvites;

  return {
    ...base,
    profile: {
      ...base.profile,
      onboardingCompleted: true,
      isDemoData: true,
    },
    wallets,
    transactions,
    valuations,
    investmentProducts,
    goalContributions,
    goalInvites,
    recurringRules,
    aiMemory: {
      patterns: [
        'Rutin menabung Wedding di Bibit terdiversifikasi (PU, Obligasi, Reksa Saham, Saham, SBN)',
        'Pengeluaran kafe cenderung meningkat di akhir pekan',
      ],
      preferences: {
        gayaSaran: 'Ringkas dengan angka Rupiah spesifik',
      },
      feedbackLog: base.aiMemory?.feedbackLog ?? [],
    },
  };
}

/**
 * Cleanly strips all 3-month dummy data back to 0 transactions & 0 balances,
 * preserving user's custom wallets, categories, and goals structure.
 */
export function clearDummyData(current: AppDataset, referenceDate = new Date()): AppDataset {
  const todayStr = toISODate(referenceDate);
  return {
    ...current,
    profile: {
      ...current.profile,
      isDemoData: false,
    },
    wallets: current.wallets.map((w) => ({
      ...w,
      openingBalance: 0,
      openingDate: todayStr,
    })),
    transactions: [],
    valuations: [],
    investmentProducts: current.investmentProducts.map((p) => ({
      ...p,
      investedAmount: 0,
      marketValue: 0,
      updatedAt: todayStr,
    })),
    goalContributions: [],
    recurringRules: [],
    aiMemory: {
      patterns: [],
      preferences: {},
      feedbackLog: [],
    },
  };
}

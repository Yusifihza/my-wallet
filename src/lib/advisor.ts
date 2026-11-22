import {
  calculateCategoryBudgets,
  calculateGoalProgress,
  calculateMoMComparison,
  calculateNetWorth,
  calculatePeriodSummary,
  calculateWalletBalances,
  filterTransactionsByRange,
  formatIDR,
  getPeriodRange,
} from '@/lib/finance';
import type { AppDataset } from '@/types/finance';

export interface AdvisorCard {
  id: string;
  topic: string;
  severity: 'positive' | 'warn' | 'alert' | 'info';
  title: string;
  body: string;
  actionLabel?: string;
}

export interface FinancialInsightsReport {
  score: number;
  scoreLabel: string;
  headline: string;
  cards: AdvisorCard[];
  quickQuestions: string[];
}

export function generateFinancialInsights(
  dataset: AppDataset,
  referenceDate = new Date()
): FinancialInsightsReport {
  const curRange = getPeriodRange('this_month', referenceDate);
  const curTx = filterTransactionsByRange(dataset.transactions, curRange.start, curRange.end);
  const curSum = calculatePeriodSummary(curTx);
  const mom = calculateMoMComparison(
    dataset.transactions,
    dataset.categories,
    dataset.subcategories,
    referenceDate
  );
  const expBudgets = calculateCategoryBudgets(
    dataset.categories,
    dataset.subcategories,
    curTx,
    'expense'
  );
  const balances = calculateWalletBalances(
    dataset.wallets,
    dataset.transactions,
    dataset.valuations,
    dataset.investmentProducts
  );
  const nw = calculateNetWorth(balances);

  // Compute Financial Health Score (0..100)
  let score = 55;
  if (dataset.transactions.length === 0) {
    return {
      score: 0,
      scoreLabel: 'Belum ada data',
      headline:
        'Catat transaksi pertamamu atau aktifkan Data Dummy 3 Bulan di Settings untuk melihat analisis keuangan & saran interaktif.',
      cards: [
        {
          id: 'empty_start',
          topic: 'mulai',
          severity: 'info',
          title: 'Siap belajar dari kebiasaan finansialmu',
          body: 'AI Advisor akan membaca arus kas 3 bulan terakhir, progres budget, performa produk Bibit (PU, Obligasi, Reksa Saham, Saham, SBN), serta target Wedding bersamamu.',
        },
      ],
      quickQuestions: [
        'Bagaimana cara mulai mengatur budget Rp6jt?',
        'Tips alokasi produk Bibit untuk target Wedding',
        'Berapa ideal dana darurat yang harus disiapkan?',
      ],
    };
  }

  if (curSum.savingsRate >= 20) score += 20;
  else if (curSum.savingsRate >= 10) score += 12;
  else if (curSum.savingsRate > 0) score += 5;

  if (curSum.netCashflow > 0) score += 12;
  else if (curSum.netCashflow < 0) score -= 15;

  const overBudgets = expBudgets.items.filter((i) => i.status === 'over');
  const warnBudgets = expBudgets.items.filter((i) => i.status === 'warn');
  score -= overBudgets.length * 8;
  score -= warnBudgets.length * 3;
  if (overBudgets.length === 0 && expBudgets.totalActual > 0) score += 8;

  if (mom.expense.pct !== null && mom.expense.pct < 0) score += 5;

  score = Math.max(15, Math.min(98, Math.round(score)));
  const scoreLabel =
    score >= 80 ? 'Sangat Sehat' : score >= 65 ? 'Sehat & Terkendali' : score >= 45 ? 'Perlu Perhatian' : 'Waspada Defisit';

  const cards: AdvisorCard[] = [];

  // 1. MoM Expense Insight
  if (mom.expense.previous > 0 && mom.expense.pct !== null) {
    const down = mom.expense.diff < 0;
    const topShift = mom.categoryChanges[0];
    cards.push({
      id: 'mom_expense',
      topic: 'tren_bulanan',
      severity: down ? 'positive' : mom.expense.pct > 15 ? 'alert' : 'warn',
      title: down
        ? `Pengeluaran turun ${Math.abs(mom.expense.pct)}% dibanding bulan lalu`
        : `Pengeluaran naik ${mom.expense.pct}% dibanding bulan lalu`,
      body: `Bulan ini tercatat ${formatIDR(mom.expense.current)} vs bulan lalu ${formatIDR(mom.expense.previous)} (${down ? 'hemat ' : 'lebih tinggi '}${formatIDR(Math.abs(mom.expense.diff))}).${
        topShift
          ? ` Perubahan terbesar di kategori ${topShift.categoryName} (${topShift.diff >= 0 ? '+' : ''}${formatIDR(topShift.diff)}).`
          : ''
      }`,
    });
  }

  // 2. Budget Alert / Safe Card
  if (overBudgets.length > 0) {
    const worst = overBudgets.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
    const excess = worst.effectiveBudget ? worst.actual - worst.effectiveBudget : 0;
    cards.push({
      id: 'budget_over',
      topic: 'budget',
      severity: 'alert',
      title: `Plafon ${worst.category.name} sudah lewat (${worst.pct}%)`,
      body: `Terpakai ${formatIDR(worst.actual)} dari plafon ${formatIDR(worst.effectiveBudget ?? 0)} (kelebihan ${formatIDR(excess)}). Rem pengeluaran di kategori ini sampai akhir bulan atau geser alokasi dari sisa surplus.`,
    });
  } else if (warnBudgets.length > 0) {
    const topWarn = warnBudgets[0];
    cards.push({
      id: 'budget_warn',
      topic: 'budget',
      severity: 'warn',
      title: `Kategori ${topWarn.category.name} mendekati batas (${topWarn.pct}%)`,
      body: `Sisa budget ${topWarn.category.name} tinggal ${formatIDR(Math.max(0, (topWarn.effectiveBudget ?? 0) - topWarn.actual))}. Cocok untuk mulai sedikit mengerem hingga gajian berikutnya.`,
    });
  } else {
    cards.push({
      id: 'budget_safe',
      topic: 'budget',
      severity: 'positive',
      title: 'Seluruh plafon kategori masih aman terkendali',
      body: `Total pengeluaran bulan ini ${formatIDR(expBudgets.totalActual)} dari total plafon ${formatIDR(expBudgets.totalEffectiveBudget)}. Savings rate bulan ini ${curSum.savingsRate}%.`,
    });
  }

  // 3. Bibit Multi-Product Portfolio Insight
  const prods = dataset.investmentProducts.filter((p) => p.investedAmount > 0 || p.marketValue > 0);
  if (prods.length > 0) {
    const totalInv = prods.reduce((s, p) => s + p.investedAmount, 0);
    const totalMkt = prods.reduce((s, p) => s + p.marketValue, 0);
    const gain = totalMkt - totalInv;
    const gainPct = totalInv > 0 ? ((gain / totalInv) * 100).toFixed(2).replace('.', ',') : '0';
    const sortedByRet = [...prods]
      .filter((p) => p.investedAmount > 0)
      .sort(
        (a, b) =>
          (b.marketValue - b.investedAmount) / b.investedAmount -
          (a.marketValue - a.investedAmount) / a.investedAmount
      );
    const best = sortedByRet[0];
    const worst = sortedByRet[sortedByRet.length - 1];
    const riskyRatio =
      totalMkt > 0
        ? Math.round(
            (prods
              .filter((p) => p.assetClass === 'saham' || p.assetClass === 'reksa_saham')
              .reduce((s, p) => s + p.marketValue, 0) /
              totalMkt) *
              100
          )
        : 0;

    cards.push({
      id: 'bibit_portfolio',
      topic: 'bibit',
      severity: gain >= 0 ? 'positive' : 'warn',
      title: `Portofolio Bibit ${gain >= 0 ? 'untung' : 'terkoreksi'} ${gain >= 0 ? '+' : ''}${formatIDR(gain)} (${gain >= 0 ? '+' : ''}${gainPct}%)`,
      body: `Total nilai pasar ${formatIDR(totalMkt)} di ${prods.length} produk. Terbaik: ${best?.name ?? '-'}${
        worst && worst.id !== best?.id && worst.marketValue < worst.investedAmount
          ? `, sementara ${worst.name} sedang merah (${formatIDR(worst.marketValue - worst.investedAmount)})`
          : ''
      }. Porsi aset berisiko (Saham + Reksa Saham) saat ini ${riskyRatio}% — pastikan makin mendekati hari-H Wedding, porsi PU/Obligasi/SBN tetap dominan.`,
    });
  }

  // 4. Shared Wedding Goal Pacing Insight
  const weddingGoal = dataset.goals.find((g) => g.isShared || g.name.toLowerCase().includes('wedding'));
  if (weddingGoal) {
    const pr = calculateGoalProgress(
      weddingGoal,
      dataset.transactions,
      referenceDate,
      dataset.goalContributions,
      dataset.investmentProducts
    );
    cards.push({
      id: 'wedding_goal',
      topic: 'wedding',
      severity: pr.pct >= 40 ? 'positive' : 'info',
      title: `Progres ${weddingGoal.name}: ${pr.pct}% (${formatIDR(pr.saved)} / ${formatIDR(weddingGoal.targetAmount)})`,
      body: `Kontribusimu ${formatIDR(pr.mySaved)} + Pasangan ${formatIDR(pr.partnerSaved)}.${
        pr.requiredPerMonth
          ? ` Sisa ${formatIDR(pr.remaining)} butuh rata-rata gabungan ${formatIDR(pr.requiredPerMonth)}/bln (${formatIDR(Math.ceil(pr.requiredPerMonth / 2))}/orang jika 50:50).`
          : ''
      }`,
    });
  }

  const headline = `Net worth saat ini ${formatIDR(nw.netWorth)} (Liquid ${formatIDR(nw.liquid)} · Bibit ${formatIDR(nw.investment)}). Arus kas bersih bulan ini ${curSum.netCashflow >= 0 ? 'surplus' : 'defisit'} ${formatIDR(Math.abs(curSum.netCashflow))}.`;

  return {
    score,
    scoreLabel,
    headline,
    cards,
    quickQuestions: [
      'Kenapa pengeluaranku berubah bulan ini?',
      'Evaluasi portofolio Bibit (PU, Obligasi, Saham, SBN)',
      'Apakah target Wedding bersama pasangan on-track?',
      'Kategori apa yang paling bisa dihemat bulan ini?',
      'Berapa batas belanja aman per hari sampai akhir bulan?',
    ],
  };
}

/**
 * Smart local Indonesian financial analyst fallback (also used directly in offline/preview mode)
 * that computes real numbers from the user's live dataset.
 */
export function answerFinancialQuestion(
  question: string,
  dataset: AppDataset,
  referenceDate = new Date()
): { answer: string; topic: string } {
  const q = question.toLowerCase();
  const curRange = getPeriodRange('this_month', referenceDate);
  const curTx = filterTransactionsByRange(dataset.transactions, curRange.start, curRange.end);
  const curSum = calculatePeriodSummary(curTx);
  const mom = calculateMoMComparison(
    dataset.transactions,
    dataset.categories,
    dataset.subcategories,
    referenceDate
  );
  const expBudgets = calculateCategoryBudgets(
    dataset.categories,
    dataset.subcategories,
    curTx,
    'expense'
  );
  const balances = calculateWalletBalances(
    dataset.wallets,
    dataset.transactions,
    dataset.valuations,
    dataset.investmentProducts
  );
  const nw = calculateNetWorth(balances);

  // 1. Bibit / Investment portfolio question
  if (/bibit|saham|obligasi|sbn|pasar uang|\bpu\b|invest|portofolio|market/.test(q)) {
    const prods = dataset.investmentProducts.filter((p) => p.investedAmount > 0 || p.marketValue > 0);
    if (prods.length === 0) {
      return {
        topic: 'bibit',
        answer:
          'Saat ini nilai produk Bibit-mu masih Rp0. Kamu bisa masuk ke menu **Wallet → Bibit** untuk mengisi modal setor & nilai pasar tiap produk (PU, Obligasi, Reksa Saham, Saham, SBN), atau muat **Data Dummy 3 Bulan** di Settings untuk melihat simulasinya.',
      };
    }
    const totalInv = prods.reduce((s, p) => s + p.investedAmount, 0);
    const totalMkt = prods.reduce((s, p) => s + p.marketValue, 0);
    const gain = totalMkt - totalInv;
    const gainPct = totalInv > 0 ? ((gain / totalInv) * 100).toFixed(2).replace('.', ',') : '0';
    const lines = prods.map((p) => {
      const g = p.marketValue - p.investedAmount;
      const pct = p.investedAmount > 0 ? ((g / p.investedAmount) * 100).toFixed(1).replace('.', ',') : '0';
      const alloc = totalMkt > 0 ? Math.round((p.marketValue / totalMkt) * 100) : 0;
      return `• **${p.name}** (${alloc}%): Pasar ${formatIDR(p.marketValue)} vs Modal ${formatIDR(p.investedAmount)} (${g >= 0 ? '+' : ''}${pct}%)`;
    });
    const stablePct =
      totalMkt > 0
        ? Math.round(
            (prods
              .filter((p) => ['pu', 'obligasi', 'sbn'].includes(p.assetClass))
              .reduce((s, p) => s + p.marketValue, 0) /
              totalMkt) *
              100
          )
        : 0;
    return {
      topic: 'bibit',
      answer: `📊 **Evaluasi Portofolio Bibit-mu:**\nTotal Nilai Pasar **${formatIDR(totalMkt)}** (Modal ${formatIDR(totalInv)}, **${gain >= 0 ? '+' : ''}${formatIDR(gain)} / ${gain >= 0 ? '+' : ''}${gainPct}%**).\n\n${lines.join('\n')}\n\n💡 **Saran:** Porsi instrumen stabil (PU + Obligasi + SBN) saat ini **${stablePct}%**. Untuk target jangka 1–2 tahun seperti Wedding, idealnya jaga aset stabil di kisaran **65%–75%** dan batasi Saham/Reksa Saham maksimal 25%–35% agar nilai dana tidak turun mendadak saat mendekati hari-H.`,
    };
  }

  // 2. Wedding / Goal question
  if (/wedding|nikah|goal|target|pasangan|on-track|nabung/.test(q)) {
    const wedding =
      dataset.goals.find((g) => g.isShared || g.name.toLowerCase().includes('wedding')) ??
      dataset.goals[0];
    if (!wedding) {
      return {
        topic: 'wedding',
        answer: 'Belum ada target tabungan aktif. Tambahkan target baru di menu **Goals** terlebih dahulu.',
      };
    }
    const pr = calculateGoalProgress(
      wedding,
      dataset.transactions,
      referenceDate,
      dataset.goalContributions,
      dataset.investmentProducts
    );
    const halfReq = pr.requiredPerMonth ? Math.ceil(pr.requiredPerMonth / 2) : 0;
    return {
      topic: 'wedding',
      answer: `💍 **Analisis Target ${wedding.name}:**\n• Terkumpul: **${formatIDR(pr.saved)}** dari **${formatIDR(wedding.targetAmount)}** (**${pr.pct}%**)\n• Porsimu: **${formatIDR(pr.mySaved)}**${pr.myMarketGain !== 0 ? ` (termasuk return Bibit ${pr.myMarketGain >= 0 ? '+' : ''}${formatIDR(pr.myMarketGain)})` : ''}\n• Porsi Pasangan: **${formatIDR(pr.partnerSaved)}**\n• Sisa target: **${formatIDR(pr.remaining)}**${
        pr.requiredPerMonth
          ? `\n• Kebutuhan bulanan: **${formatIDR(pr.requiredPerMonth)}/bln** gabungan (± **${formatIDR(halfReq)}/bln** per orang selama ${pr.monthsLeft} bulan).`
          : ''
      }\n\n💡 Dengan sisa alokasi budgetmu saat ini (surplus bulan ini ${formatIDR(Math.max(0, curSum.netCashflow))}), target ini **${pr.requiredPerMonth && halfReq <= Math.max(curSum.savingNet, 1200000) ? 'sangat realistis & on-track' : 'perlu tambahan setoran rutin atau alokasi bonus'}**!`,
    };
  }

  // 3. Safe daily/monthly spending limit
  if (/aman|batas|sisa|per hari|harian|akhir bulan/.test(q)) {
    const daysInMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysInMonth - referenceDate.getDate() + 1);
    const remainingBudget = Math.max(0, expBudgets.totalEffectiveBudget - expBudgets.totalActual);
    const perDay = Math.floor(remainingBudget / daysLeft);
    return {
      topic: 'batas_harian',
      answer: `🛡️ **Batas Belanja Aman Sampai Akhir Bulan:**\n• Pengeluaran bulan ini: **${formatIDR(expBudgets.totalActual)}** dari total budget **${formatIDR(expBudgets.totalEffectiveBudget)}**\n• Sisa ruang budget: **${formatIDR(remainingBudget)}** untuk **${daysLeft} hari** tersisa\n• Rata-rata aman: **${formatIDR(perDay)} / hari**\n\n💡 Tip: Jika ingin menjaga saldo tetap lega tanpa mengganggu tabungan Wedding, usahakan belanja harian di bawah **${formatIDR(Math.floor(perDay * 0.85))}/hari**.`,
    };
  }

  // 4. Category saving / boros
  if (/hemat|boros|kategori|terbesar|potong|kurangi/.test(q)) {
    const topCats = [...expBudgets.items]
      .filter((i) => i.actual > 0)
      .sort((a, b) => b.actual - a.actual)
      .slice(0, 4);
    if (topCats.length === 0) {
      return {
        topic: 'hemat',
        answer: 'Belum ada pengeluaran tercatat di bulan ini untuk dianalisis.',
      };
    }
    const list = topCats
      .map(
        (c, i) =>
          `${i + 1}. **${c.category.name}**: ${formatIDR(c.actual)}${c.effectiveBudget ? ` (${c.pct}% dari plafon ${formatIDR(c.effectiveBudget)})` : ''}`
      )
      .join('\n');
    const discretionary =
      topCats.find((c) => /makan|hiburan|belanja|transport/i.test(c.category.name)) ?? topCats[0];
    const saveIdea = Math.round(discretionary.actual * 0.15);
    return {
      topic: 'hemat',
      answer: `✂️ **Top Pengeluaran Bulan Ini:**\n${list}\n\n💡 **Peluang Hemat Cepat:** Jika kamu memangkas 15% di kategori **${discretionary.category.name}** (sekitar **${formatIDR(saveIdea)}/bln**), dalam setahun kamu bisa menambah **${formatIDR(saveIdea * 12)}** ekstra ke portofolio Bibit Wedding!`,
    };
  }

  // 5. MoM / default holistic summary
  const momLine =
    mom.expense.previous > 0 && mom.expense.pct !== null
      ? `Pengeluaran bulan ini **${formatIDR(mom.expense.current)}** (${mom.expense.diff <= 0 ? 'turun' : 'naik'} **${Math.abs(mom.expense.pct)}%** dibanding ${mom.previousLabel} sebesar ${formatIDR(mom.expense.previous)}).`
      : `Pengeluaran bulan ini tercatat **${formatIDR(curSum.expense)}**.`;

  const topChanges = mom.categoryChanges
    .slice(0, 3)
    .map((c) => `• **${c.categoryName}**: ${formatIDR(c.current)} (${c.diff >= 0 ? '+' : ''}${formatIDR(c.diff)} vs bulan lalu)`)
    .join('\n');

  const memNote =
    dataset.aiMemory.patterns.length > 0
      ? `\n\n🧠 *Catatan AI Memory:* ${dataset.aiMemory.patterns[0]}.`
      : '';

  return {
    topic: 'ringkasan',
    answer: `📈 **Ringkasan Analisis Keuanganmu (${curRange.label}):**\n• Net Worth: **${formatIDR(nw.netWorth)}** (Liquid ${formatIDR(nw.liquid)} · Bibit ${formatIDR(nw.investment)})\n• Income: **${formatIDR(curSum.income)}** · Saving Net: **${formatIDR(curSum.savingNet)}** (Savings Rate **${curSum.savingsRate}%**)\n• ${momLine}${
      topChanges ? `\n\n**Pergerakan Kategori Terbesar:**\n${topChanges}` : ''
    }${memNote}`,
  };
}

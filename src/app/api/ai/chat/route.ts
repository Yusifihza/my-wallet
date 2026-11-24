import { NextResponse } from 'next/server';
import { answerFinancialQuestion, generateFinancialInsights } from '@/lib/advisor';
import type { AppDataset } from '@/types/finance';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: string;
      dataset?: AppDataset;
    };

    const question = (body.question ?? '').trim();
    const dataset = body.dataset;

    if (!question || !dataset) {
      return NextResponse.json(
        { error: 'Pertanyaan dan data keuangan diperlukan.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const localFallback = answerFinancialQuestion(question, dataset);

    if (!apiKey) {
      return NextResponse.json({
        answer: localFallback.answer,
        topic: localFallback.topic,
        engine: 'local',
      });
    }

    // Build concise 3-month context (user explicitly consented to sharing raw transactions + notes + aggregates + AI Memory)
    const insights = generateFinancialInsights(dataset);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const recentTx = dataset.transactions
      .filter((t) => t.date >= cutoffIso)
      .slice(0, 150)
      .map((t) => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
        fee: t.fee,
        note: t.note,
      }));

    const contextPayload = {
      displayName: dataset.profile.displayName,
      healthScore: insights.score,
      headline: insights.headline,
      bibitProducts: dataset.investmentProducts.map((p) => ({
        name: p.name,
        assetClass: p.assetClass,
        invested: p.investedAmount,
        marketValue: p.marketValue,
      })),
      goals: dataset.goals.map((g) => ({
        name: g.name,
        target: g.targetAmount,
        deadline: g.deadline,
        isShared: g.isShared,
      })),
      partnerContributions: dataset.goalContributions,
      aiMemory: dataset.aiMemory,
      recentTransactions3Months: recentTx,
    };

    const prompt = `Kamu adalah My Wallet AI Financial Advisor berbahasa Indonesia yang ramah, ringkas, dan berbasis angka nyata.
Jawab pertanyaan user dengan angka Rupiah (Rp) spesifik dari data berikut. Gunakan bullet point rapi dan saran konkret yang bisa langsung dilakukan.

DATA KEUANGAN USER (JSON):
${JSON.stringify(contextPayload)}

PERTANYAAN USER:
${question}`;

    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    for (const model of models) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 700,
            },
          }),
        }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const geminiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (geminiText) {
        return NextResponse.json({
          answer: geminiText.trim(),
          topic: localFallback.topic,
          engine: 'gemini',
        });
      }
    }

    return NextResponse.json({
      answer: localFallback.answer,
      topic: localFallback.topic,
      engine: 'local_fallback',
    });
  } catch {
    return NextResponse.json(
      { error: 'Gagal memproses pertanyaan AI Advisor.' },
      { status: 500 }
    );
  }
}

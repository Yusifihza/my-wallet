'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Brain,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { answerFinancialQuestion, generateFinancialInsights } from '@/lib/advisor';
import type { AIChatMessage } from '@/types/finance';

export function AdvisorView() {
  const {
    dataset,
    nowDate,
    recordAIFeedback,
    clearAIMemory,
    loadThreeMonthDummyData,
  } = useWallet();

  const report = useMemo(() => generateFinancialInsights(dataset, nowDate), [dataset, nowDate]);
  const msgSeqRef = useRef(1);

  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      topic: 'ringkasan',
      content:
        'Halo! Aku **My Wallet AI Advisor**. Tanyakan apa saja tentang pengeluaranmu, alokasi budget, progres tabungan Wedding bersama pasangan, atau evaluasi produk Bibit (PU, Obligasi, Reksa Saham, Saham, SBN).',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ratedCards, setRatedCards] = useState<Record<string, 'up' | 'down'>>({});

  const askQuestion = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || sending) return;

    const uId = `u_${msgSeqRef.current++}`;
    const userMsg: AIChatMessage = {
      id: uId,
      role: 'user',
      content: q,
      createdAt: nowDate.toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, dataset }),
      });
      if (res.ok) {
        const json = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${msgSeqRef.current++}`,
            role: 'assistant',
            content: json.answer,
            topic: json.topic || 'umum',
            createdAt: nowDate.toISOString(),
          },
        ]);
      } else {
        const local = answerFinancialQuestion(q, dataset, nowDate);
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${msgSeqRef.current++}`,
            role: 'assistant',
            content: local.answer,
            topic: local.topic,
            createdAt: nowDate.toISOString(),
          },
        ]);
      }
    } catch {
      const local = answerFinancialQuestion(q, dataset, nowDate);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${msgSeqRef.current++}`,
          role: 'assistant',
          content: local.answer,
          topic: local.topic,
          createdAt: nowDate.toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleVoteMessage = (msgId: string, topic: string, vote: 'up' | 'down') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback: vote } : m))
    );
    recordAIFeedback(topic, vote);
  };

  const severityStyles = {
    positive: {
      bg: 'var(--mw-income-soft)',
      border: 'rgba(16, 185, 129, 0.35)',
      accent: 'var(--mw-income)',
    },
    warn: {
      bg: 'var(--mw-warn-soft)',
      border: 'rgba(251, 191, 36, 0.35)',
      accent: 'var(--mw-warn)',
    },
    alert: {
      bg: 'var(--mw-expense-soft)',
      border: 'rgba(244, 63, 94, 0.35)',
      accent: 'var(--mw-expense)',
    },
    info: {
      bg: 'var(--mw-saving-soft)',
      border: 'rgba(56, 189, 248, 0.35)',
      accent: 'var(--mw-saving)',
    },
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--mw-text)] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--mw-primary)]" />
            <span>AI Financial Advisor</span>
          </h1>
          <p className="text-xs text-[var(--mw-text-muted)]">
            Saran interaktif berbasis transaksi 3 bulan, budget, portofolio Bibit multi-produk, &amp; AI Memory
          </p>
        </div>

        {dataset.transactions.length === 0 && (
          <button
            type="button"
            onClick={loadThreeMonthDummyData}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
            style={{ background: 'var(--mw-primary)' }}
          >
            🧪 Muat Data Dummy 3 Bulan
          </button>
        )}
      </div>

      {/* Health Score Banner */}
      <div className="mw-hero-gradient rounded-3xl p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-emerald-100/80">
            Skor Kesehatan Keuangan
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-4xl font-extrabold tab-num">
              {report.score > 0 ? report.score : '—'}
            </span>
            <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-white/15">
              {report.scoreLabel}
            </span>
          </div>
          <p className="text-xs text-emerald-50/90 leading-relaxed max-w-2xl pt-1">
            {report.headline}
          </p>
        </div>
      </div>

      {/* Proactive Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {report.cards.map((card) => {
          const st = severityStyles[card.severity];
          const vote = ratedCards[card.id];
          return (
            <div
              key={card.id}
              className="rounded-2xl p-4 border space-y-2.5 text-xs flex flex-col justify-between"
              style={{ background: st.bg, borderColor: st.border }}
            >
              <div className="space-y-1">
                <div className="font-bold text-sm" style={{ color: st.accent }}>
                  {card.title}
                </div>
                <p className="text-[var(--mw-text)] leading-relaxed">{card.body}</p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[var(--mw-text-dim)]">
                  Saran ini membantu?
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRatedCards((prev) => ({ ...prev, [card.id]: 'up' }));
                      recordAIFeedback(card.topic, 'up', card.title);
                    }}
                    className="px-2 py-1 rounded-lg border text-[11px] inline-flex items-center gap-1 cursor-pointer"
                    style={{
                      background: vote === 'up' ? 'var(--mw-primary)' : 'var(--mw-surface)',
                      color: vote === 'up' ? '#fff' : 'var(--mw-text-muted)',
                      borderColor: 'var(--mw-border)',
                    }}
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>Ya</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRatedCards((prev) => ({ ...prev, [card.id]: 'down' }));
                      recordAIFeedback(card.topic, 'down', card.title);
                    }}
                    className="px-2 py-1 rounded-lg border text-[11px] inline-flex items-center gap-1 cursor-pointer"
                    style={{
                      background: vote === 'down' ? 'var(--mw-expense)' : 'var(--mw-surface)',
                      color: vote === 'down' ? '#fff' : 'var(--mw-text-muted)',
                      borderColor: 'var(--mw-border)',
                    }}
                  >
                    <ThumbsDown className="w-3 h-3" />
                    <span>Kurang</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Chat + AI Memory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 mw-card rounded-3xl p-4 sm:p-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--mw-text)]">
              Tanya AI Advisor (Interaktif)
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mw-primary-soft)] text-[var(--mw-primary)] font-semibold">
              Konteks Data Real
            </span>
          </div>

          {/* Quick Question Chips */}
          <div className="flex flex-wrap gap-1.5">
            {report.quickQuestions.map((qq) => (
              <button
                key={qq}
                type="button"
                disabled={sending}
                onClick={() => askQuestion(qq)}
                className="px-3 py-1.5 rounded-xl text-xs bg-[var(--mw-surface-2)] hover:border-[var(--mw-primary)] border border-[var(--mw-border)] text-[var(--mw-text)] text-left cursor-pointer transition"
              >
                {qq}
              </button>
            ))}
          </div>

          {/* Chat Thread */}
          <div className="flex-1 min-h-[240px] max-h-[420px] overflow-y-auto mw-scroll space-y-2.5 pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line space-y-2"
                  style={{
                    background:
                      m.role === 'user' ? 'var(--mw-primary)' : 'var(--mw-surface-2)',
                    color: m.role === 'user' ? '#fff' : 'var(--mw-text)',
                  }}
                >
                  <div>{m.content.replace(/\*\*/g, '')}</div>
                  {m.role === 'assistant' && m.id !== 'welcome' && (
                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-[var(--mw-border)]/50">
                      <button
                        type="button"
                        onClick={() => handleVoteMessage(m.id, m.topic || 'chat', 'up')}
                        className="p-1 rounded hover:bg-[var(--mw-surface)] cursor-pointer"
                        style={{
                          color:
                            m.feedback === 'up'
                              ? 'var(--mw-primary)'
                              : 'var(--mw-text-dim)',
                        }}
                        title="Jawaban membantu"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVoteMessage(m.id, m.topic || 'chat', 'down')}
                        className="p-1 rounded hover:bg-[var(--mw-surface)] cursor-pointer"
                        style={{
                          color:
                            m.feedback === 'down'
                              ? 'var(--mw-expense)'
                              : 'var(--mw-text-dim)',
                        }}
                        title="Kurang relevan"
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="text-xs text-[var(--mw-text-muted)] px-2">
                AI sedang menganalisis data keuanganmu...
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              askQuestion(input);
            }}
            className="flex gap-2 pt-2 border-t border-[var(--mw-border)]"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik pertanyaanmu (mis. evaluasi portofolio Bibit, batas belanja harian)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl text-xs bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)] focus:outline-none focus:border-[var(--mw-primary)]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--mw-primary)' }}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim</span>
            </button>
          </form>
        </div>

        {/* AI Memory Panel */}
        <div className="lg:col-span-4 mw-card rounded-3xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[var(--mw-primary)]" />
                <h2 className="text-sm font-bold text-[var(--mw-text)]">AI Memory</h2>
              </div>
              {dataset.aiMemory.patterns.length > 0 && (
                <button
                  type="button"
                  onClick={clearAIMemory}
                  className="text-xs text-[var(--mw-text-dim)] hover:text-red-400 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--mw-text-muted)]">
              Pola kebiasaan &amp; preferensi saran yang dipelajari dari transaksi dan feedback 👍/👎 kamu.
            </p>

            {dataset.aiMemory.patterns.length === 0 ? (
              <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)] text-xs text-[var(--mw-text-dim)]">
                Belum ada catatan AI Memory. Klik 👍/👎 pada kartu saran atau jawaban chat untuk melatih preferensimu.
              </div>
            ) : (
              <ul className="space-y-2 text-xs">
                {dataset.aiMemory.patterns.map((p, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-xl bg-[var(--mw-surface-2)] border border-[var(--mw-border)] text-[var(--mw-text)]"
                  >
                    • {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-[var(--mw-surface-2)] text-[11px] text-[var(--mw-text-muted)] leading-relaxed">
            Saat <code className="font-mono text-[var(--mw-primary)]">GEMINI_API_KEY</code> dipasang di Vercel, chat ini otomatis ditenagai <b>Gemini 2.5 Flash</b>. Tanpa API key, mesin analitik lokal tetap menjawab dengan angka real dari datamu.
          </div>
        </div>
      </div>
    </div>
  );
}

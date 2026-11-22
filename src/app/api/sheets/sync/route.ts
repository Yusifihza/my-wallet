import { NextResponse } from 'next/server';
import { buildGoogleSheetsPayload } from '@/lib/finance';
import type { AppDataset } from '@/types/finance';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      webhookUrl?: string;
      dataset?: AppDataset;
    };

    if (!body.dataset) {
      return NextResponse.json({ error: 'Dataset diperlukan.' }, { status: 400 });
    }

    const payload = buildGoogleSheetsPayload(body.dataset);
    const targetUrl = (body.webhookUrl || process.env.GOOGLE_SHEETS_WEBHOOK_URL || '').trim();

    if (!targetUrl) {
      return NextResponse.json({
        synced: false,
        mode: 'snapshot_only',
        message: 'Snapshot 5 tab siap diunduh. Isi URL Webhook Google Apps Script untuk sinkronisasi otomatis ke Google Sheets.',
        rowCounts: {
          Transaksi: payload.tabs.Transaksi.length - 1,
          Dompet_Bibit: payload.tabs.Dompet_Bibit.length - 1,
          Budget: payload.tabs.Budget.length - 1,
          Goals_Pasangan: payload.tabs.Goals_Pasangan.length - 1,
          Ringkasan_Bulanan: payload.tabs.Ringkasan_Bulanan.length - 1,
        },
        syncedAt: payload.generatedAt,
      });
    }

    // Validate webhook host is Google Apps Script to avoid SSRF
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Format URL Webhook tidak valid.' }, { status: 400 });
    }

    if (
      parsedUrl.protocol !== 'https:' ||
      !['script.google.com', 'script.googleusercontent.com'].includes(parsedUrl.hostname)
    ) {
      return NextResponse.json(
        { error: 'URL Webhook harus berasal dari https://script.google.com/...' },
        { status: 400 }
      );
    }

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Sheets Webhook merespons HTTP ${res.status}. Pastikan Web App di-deploy dengan akses "Anyone".` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      synced: true,
      mode: 'webhook',
      message: 'Berhasil sinkron 5 tab ke Google Sheets!',
      syncedAt: payload.generatedAt,
    });
  } catch {
    return NextResponse.json(
      { error: 'Gagal menghubungi Google Sheets Webhook.' },
      { status: 500 }
    );
  }
}

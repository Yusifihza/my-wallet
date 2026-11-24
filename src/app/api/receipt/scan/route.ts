import { NextResponse } from 'next/server';

interface InputSubcategory {
  id: string;
  name: string;
  aliases?: string[];
}

interface InputCategory {
  id: string;
  name: string;
  subcategories: InputSubcategory[];
}

interface ScanRequestBody {
  imageBase64?: string;
  mimeType?: string;
  categories?: InputCategory[];
  wallets?: { id: string; name: string }[];
  today?: string;
}

interface RawAiItem {
  name?: unknown;
  qty?: unknown;
  price?: unknown;
  subcategoryId?: unknown;
}

interface RawAiReceipt {
  merchant?: unknown;
  date?: unknown;
  walletHint?: unknown;
  items?: unknown;
  taxOrService?: unknown;
  discount?: unknown;
  reportedTotal?: unknown;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BASE64_BYTES = 6 * 1024 * 1024; // ~4.5 MB image cap
const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
];

function parsePositiveInt(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.max(0, Math.round(val));
  }
  if (typeof val === 'string') {
    const digits = val.replace(/[^\d.-]/g, '');
    const n = Number(digits);
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  return 0;
}

function sanitizeDate(val: unknown, fallback: string): string {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    const t = new Date(`${val.trim()}T00:00:00`);
    if (!Number.isNaN(t.getTime())) return val.trim();
  }
  return fallback;
}

function extractJsonObject(raw: string): RawAiReceipt | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as RawAiReceipt;
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1)) as RawAiReceipt;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ScanRequestBody;
    const imageBase64 = (body.imageBase64 ?? '').trim();
    const mimeType = (body.mimeType ?? 'image/jpeg').trim().toLowerCase();
    const categories = Array.isArray(body.categories) ? body.categories : [];
    const wallets = Array.isArray(body.wallets) ? body.wallets : [];
    const today =
      typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
        ? body.today
        : new Date().toISOString().slice(0, 10);

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Gambar struk tidak ditemukan. Pilih atau foto struk terlebih dahulu.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json(
        { error: 'Format gambar harus JPG, PNG, atau WebP.' },
        { status: 400 }
      );
    }

    if (imageBase64.length > MAX_BASE64_BYTES) {
      return NextResponse.json(
        { error: 'Ukuran gambar terlalu besar. Coba foto ulang dengan resolusi lebih kecil.' },
        { status: 413 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY belum terpasang di Environment Variables Vercel. Tambahkan API key gratis dari aistudio.google.com/apikey lalu redeploy.',
        },
        { status: 503 }
      );
    }

    // Build compact valid subcategory reference for Gemini
    const validSubIds = new Set<string>();
    const catGuideLines: string[] = [];
    for (const c of categories) {
      const subParts = (c.subcategories ?? []).map((s) => {
        validSubIds.add(s.id);
        const al = s.aliases?.length ? ` (${s.aliases.slice(0, 4).join(', ')})` : '';
        return `${s.id}="${s.name}"${al}`;
      });
      if (subParts.length > 0) {
        catGuideLines.push(`- ${c.name}: ${subParts.join(' | ')}`);
      }
    }

    const walletGuide = wallets.map((w) => w.name).join(', ');

    const prompt = `Kamu adalah parser struk belanja Indonesia super akurat untuk aplikasi My Wallet.
Analisis gambar struk / e-receipt (kafe, restoran, Indomaret/Alfamart, supermarket, SPBU, apotek, GoFood, ShopeeFood, GrabFood, Tokopedia, QRIS, dll.) lalu kembalikan HANYA JSON valid dengan struktur PERSIS berikut:

{
  "merchant": "Nama toko/merchant singkat & rapi",
  "date": "YYYY-MM-DD atau null jika tidak terbaca di struk",
  "walletHint": "Nama metode pembayaran yang tercetak di struk (mis. GoPay, QRIS, Tunai, Mandiri, BNI, OVO, DANA, ShopeePay, Kartu Kredit) atau null",
  "items": [
    {
      "name": "Nama item yang mudah dibaca (rapikan singkatan kasir jika jelas)",
      "qty": 1,
      "price": 25000,
      "subcategoryId": "SALAH SATU ID PERSIS DARI DAFTAR SUB-KATEGORI DI BAWAH"
    }
  ],
  "taxOrService": 0,
  "discount": 0,
  "reportedTotal": 25000
}

ATURAN KETAT:
1. Semua nominal dalam INTEGER Rupiah (IDR). Ingat format Indonesia: "25.000" atau "25,000" atau "25.000,00" = 25000 (JANGAN kalikan 100 atau hapus angka nol!).
2. "price" pada tiap item adalah TOTAL HARGA BARIS item tersebut (bukan harga satuan jika qty > 1).
3. Pisahkan pajak (PPN, PB1, Tax), service charge, biaya kirim/ongkir, biaya layanan aplikasi ke dalam "taxOrService" (integer positif). JANGAN masukkan pajak/ongkir ke array "items".
4. Pisahkan diskon/promo/voucher/potongan ke dalam "discount" (integer POSITIF, mis. diskon -5.000 ditulis 5000). JANGAN masukkan baris diskon ke array "items".
5. "reportedTotal" adalah Grand Total / Total Bayar akhir yang tercetak di struk (bukan jumlah uang tunai yang dibayarkan atau kembalian).
6. Jika gambar adalah bukti bayar singkat (seperti QRIS/e-wallet tanpa rincian item), buat 1 item dengan nama merchant atau deskripsi transaksi dan price = reportedTotal.
7. Untuk setiap item, pilih "subcategoryId" PALING COCOK secara ketat HANYA dari daftar ID berikut (JANGAN mengarang ID baru):
${catGuideLines.join('\n')}
8. Daftar dompet user (sebagai konteks walletHint): ${walletGuide || 'Tunai, Bank, E-Wallet'}.`;

    let parsed: RawAiReceipt | null = null;
    let usedModel = '';
    let lastErrorText = '';
    let hitRateLimit = false;

    for (const model of MODEL_FALLBACK_CHAIN) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (res.status === 429) {
        hitRateLimit = true;
        lastErrorText = `Kuota harian/menit model ${model} sedang penuh (429).`;
        continue;
      }

      if (!res.ok) {
        lastErrorText = `Gemini ${model} HTTP ${res.status}`;
        continue;
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const obj = extractJsonObject(text);
      if (obj) {
        parsed = obj;
        usedModel = model;
        break;
      }
      lastErrorText = `Respons JSON dari ${model} tidak lengkap.`;
    }

    if (!parsed) {
      return NextResponse.json(
        {
          error: hitRateLimit
            ? 'Kuota gratis Gemini sedang penuh sementara. Tunggu 1 menit lalu coba scan lagi.'
            : `Gagal membaca struk (${lastErrorText || 'tidak terbaca'}). Pastikan foto struk terang dan tidak buram.`,
        },
        { status: hitRateLimit ? 429 : 502 }
      );
    }

    const merchant =
      typeof parsed.merchant === 'string' && parsed.merchant.trim()
        ? parsed.merchant.trim().slice(0, 80)
        : 'Struk Belanja';
    const date = sanitizeDate(parsed.date, today);
    const walletHint =
      typeof parsed.walletHint === 'string' && parsed.walletHint.trim()
        ? parsed.walletHint.trim().slice(0, 40)
        : null;
    const taxOrService = parsePositiveInt(parsed.taxOrService);
    const discount = parsePositiveInt(parsed.discount);
    const reportedTotalRaw = parsePositiveInt(parsed.reportedTotal);
    const reportedTotal = reportedTotalRaw > 0 ? reportedTotalRaw : null;

    const rawItems = Array.isArray(parsed.items) ? (parsed.items as RawAiItem[]) : [];
    const items = rawItems
      .map((it, idx) => {
        const name =
          typeof it.name === 'string' && it.name.trim()
            ? it.name.trim().slice(0, 80)
            : `Item ${idx + 1}`;
        const qty = Math.max(1, parsePositiveInt(it.qty) || 1);
        const price = parsePositiveInt(it.price);
        const rawSubId = typeof it.subcategoryId === 'string' ? it.subcategoryId.trim() : '';
        const subcategoryId = validSubIds.has(rawSubId) ? rawSubId : '';
        return {
          id: `rcpt_${idx + 1}`,
          name,
          qty,
          price,
          subcategoryId,
        };
      })
      .filter((it) => it.price > 0);

    // Handle non-itemized receipts (e.g. QRIS payment proof) cleanly
    if (items.length === 0 && reportedTotal && reportedTotal > 0) {
      items.push({
        id: 'rcpt_1',
        name: merchant,
        qty: 1,
        price: reportedTotal,
        subcategoryId: '',
      });
    }

    return NextResponse.json({
      merchant,
      date,
      walletHint,
      items,
      taxOrService,
      discount,
      reportedTotal,
      engine: usedModel,
    });
  } catch (err) {
    console.error('Receipt scan route error:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses gambar struk. Coba ulangi.' },
      { status: 500 }
    );
  }
}

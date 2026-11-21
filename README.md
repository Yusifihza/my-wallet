# My Wallet — Personal Budget Tracker PWA

Web app budget tracker personal responsif (**Mobile-first PWA + Desktop Dashboard**), dibangun dengan **Next.js (App Router) + TypeScript + Tailwind CSS + Recharts + Supabase**.

## Fitur Fase 1 (MVP)
- **Logo dompet My Wallet** · Tema default **Dark** (Light mode tersedia) · Aksen **Emerald/Teal** · **Mode Privasi** (`👁️`)
- **Input Transaksi Cepat** (`N` di desktop, tombol `+` di mobile):
  - **Mobile:** Bottom sheet dengan numpad kustom (`000`, `,`, `+`/`−`, `×rb`, `×jt`, `+10rb`/`+50rb`/`+100rb`)
  - **Desktop:** Side panel dengan parser keyboard (`25rb`, `1,5jt`, `45k+12k`) dan `Ctrl+Enter`
  - **Searchable Category Picker** lengkap dengan semua kategori seed, alias pencarian (`ojol`, `kopi`, `kos`, dll.), 5 sering dipakai, sisa budget, dan deteksi pintar *"tarik tunai"* / *"top up"* → Transfer
  - **Grouped Wallet Picker** dengan live preview saldo sesudah transaksi & peringatan saldo minus
  - **Transfer Antar Wallet** (swap `⇄`, biaya admin opsional → dicatat ke *Lainnya › Biaya*, pokok transfer tidak masuk Expense)
  - **Saving & Saving Withdrawal** terhubung ke Target Tabungan (Goals)
- **Live Wallet Balance** (`/wallets`): 12 dompet aktif (Tunai, Jago, Krom, BNI, Mandiri, GoPay, ShopeePay, DANA, LinkAja, OVO, Mandiri e-money, Bibit) + template Kartu Kredit tersembunyi, mutasi per wallet, grafik saldo 30 hari, rekonsiliasi saldo otomatis, dan update nilai pasar Bibit
- **Dashboard & Grafik** (`/`) + **Riwayat Transaksi** (`/transactions`) + **Budget Bulanan Interpretasi B** (`/budget`) + **Goals** (`/goals`) + **Settings & Export CSV** (`/settings`)
- **Installable PWA** (`manifest.webmanifest` + Service Worker offline shell)

## Cara Menjalankan Lokal
```bash
npm install
npm run dev
```
Aplikasi bisa langsung dicoba menggunakan **Mode Lokal (offline)** tanpa konfigurasi apa pun.

## Menghubungkan Supabase (Sinkron HP & Laptop + Login Google)
1. Buat project gratis di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** di dashboard Supabase, lalu jalankan isi file [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql).
3. Buka **Authentication → Providers → Google**, aktifkan Google Sign-In, dan masukkan Redirect URL `https://<domain-vercel-kamu>/auth/callback` (dan `http://localhost:3000/auth/callback` untuk lokal).
4. Salin `.env.example` ke `.env.local` (dan tambahkan juga di Environment Variables Vercel):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

## Deploy ke Vercel
1. Hubungkan repository GitHub `Yusifihza/my-wallet` di [vercel.com](https://vercel.com).
2. Tambahkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di Project Settings → Environment Variables.
3. Deploy — buka URL-nya di HP lalu pilih **Add to Home Screen** untuk meng-install sebagai aplikasi fullscreen.

## Menjalankan Unit Test
```bash
npm test
```

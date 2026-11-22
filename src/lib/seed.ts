import type {
  AppDataset,
  Category,
  Goal,
  InvestmentAssetClass,
  InvestmentProduct,
  QuickTemplate,
  Subcategory,
  Wallet,
  WalletGroup,
} from '@/types/finance';

export const WALLET_GROUP_LABELS: Record<WalletGroup, string> = {
  cash: 'Tunai',
  bank: 'Bank',
  ewallet: 'E-Wallet',
  emoney: 'E-Money',
  investment: 'Investasi',
  credit: 'Kartu Kredit',
};

export const WALLET_GROUP_ORDER: WalletGroup[] = [
  'cash',
  'bank',
  'ewallet',
  'emoney',
  'investment',
  'credit',
];

export const INVESTMENT_ASSET_LABELS: Record<InvestmentAssetClass, string> = {
  pu: 'Pasar Uang (PU)',
  obligasi: 'Obligasi',
  reksa_saham: 'Reksa Saham',
  saham: 'Saham',
  sbn: 'SBN (ORI/SBR/ST)',
  emas: 'Emas',
  campuran: 'Reksa Campuran',
  lainnya: 'Produk Lainnya',
};

export const INVESTMENT_ASSET_COLORS: Record<InvestmentAssetClass, string> = {
  pu: '#10b981',
  obligasi: '#0d9488',
  reksa_saham: '#38bdf8',
  saham: '#f59e0b',
  sbn: '#0284c7',
  emas: '#eab308',
  campuran: '#14b8a6',
  lainnya: '#64748b',
};

export const INVESTMENT_ASSET_ORDER: InvestmentAssetClass[] = [
  'pu',
  'obligasi',
  'reksa_saham',
  'saham',
  'sbn',
  'emas',
  'campuran',
  'lainnya',
];

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createSeedWallets(openingDate = todayISO()): Wallet[] {
  return [
    {
      id: 'w_tunai',
      name: 'Tunai',
      group: 'cash',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'banknote',
      color: '#10b981',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 1,
    },
    {
      id: 'w_jago',
      name: 'Jago',
      group: 'bank',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'landmark',
      color: '#f59e0b',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 2,
    },
    {
      id: 'w_krom',
      name: 'Krom',
      group: 'bank',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'landmark',
      color: '#eab308',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 3,
    },
    {
      id: 'w_bni',
      name: 'BNI',
      group: 'bank',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'landmark',
      color: '#f97316',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 4,
    },
    {
      id: 'w_mandiri',
      name: 'Mandiri',
      group: 'bank',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'landmark',
      color: '#0284c7',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 5,
    },
    {
      id: 'w_gopay',
      name: 'GoPay',
      group: 'ewallet',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'smartphone',
      color: '#06b6d4',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 6,
    },
    {
      id: 'w_shopeepay',
      name: 'ShopeePay',
      group: 'ewallet',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'smartphone',
      color: '#ef4444',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 7,
    },
    {
      id: 'w_dana',
      name: 'DANA',
      group: 'ewallet',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'smartphone',
      color: '#0ea5e9',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 8,
    },
    {
      id: 'w_linkaja',
      name: 'LinkAja',
      group: 'ewallet',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'smartphone',
      color: '#dc2626',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 9,
    },
    {
      id: 'w_ovo',
      name: 'OVO',
      group: 'ewallet',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'smartphone',
      color: '#14b8a6',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 10,
    },
    {
      id: 'w_emoney',
      name: 'Mandiri e-money',
      group: 'emoney',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'credit-card',
      color: '#2563eb',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 11,
    },
    {
      id: 'w_bibit',
      name: 'Bibit',
      group: 'investment',
      kind: 'asset',
      openingBalance: 0,
      openingDate,
      icon: 'trending-up',
      color: '#10b981',
      includeInTotal: true,
      hidden: false,
      archived: false,
      sortOrder: 12,
    },
    {
      id: 'w_cc_template',
      name: 'Kartu Kredit',
      group: 'credit',
      kind: 'liability',
      openingBalance: 0,
      openingDate,
      icon: 'credit-card',
      color: '#64748b',
      includeInTotal: true,
      hidden: true, // Disiapkan, tersembunyi sampai diaktifkan user di Settings
      archived: false,
      sortOrder: 13,
    },
  ];
}

interface RawCategorySeed {
  id: string;
  type: Category['type'];
  name: string;
  budgetCap: number | null;
  icon: string;
  color: string;
  subs: {
    id: string;
    name: string;
    monthlyBudget: number | null;
    aliases?: string[];
    defaultNotes?: string[];
  }[];
}

const RAW_CATEGORIES: RawCategorySeed[] = [
  // ==================== INCOME ====================
  {
    id: 'cat_inc_pemasukan',
    type: 'income',
    name: 'Pemasukan',
    budgetCap: null,
    icon: 'wallet',
    color: '#10b981',
    subs: [
      { id: 'sub_inc_gaji', name: 'Gaji', monthlyBudget: 6000000, aliases: ['salary', 'gajian'], defaultNotes: ['Gaji bulanan'] },
      { id: 'sub_inc_bonus', name: 'Bonus', monthlyBudget: null, aliases: ['thr', 'insentif'], defaultNotes: ['Bonus kerja'] },
      { id: 'sub_inc_tambahan', name: 'Pendapatan tambahan', monthlyBudget: null, aliases: ['freelance', 'side job', 'proyek'], defaultNotes: ['Freelance'] },
      { id: 'sub_inc_tunjangan', name: 'Tunjangan/Uang saku', monthlyBudget: null, aliases: ['reimburse', 'uang makan'], defaultNotes: ['Tunjangan'] },
      { id: 'sub_inc_laba_inv', name: 'Laba atas investasi', monthlyBudget: null, aliases: ['dividen', 'kupon', 'bibit'], defaultNotes: ['Dividen / hasil investasi'] },
      { id: 'sub_inc_laba_usaha', name: 'Laba usaha', monthlyBudget: null, aliases: ['jualan', 'profit'], defaultNotes: ['Laba usaha'] },
      { id: 'sub_inc_uang_masuk', name: 'Uang masuk', monthlyBudget: null, aliases: ['masuk'], defaultNotes: ['Uang masuk'] },
      { id: 'sub_inc_umum', name: 'Umum', monthlyBudget: null, aliases: ['income'], defaultNotes: ['Pemasukan'] },
    ],
  },
  {
    id: 'cat_inc_sosial',
    type: 'income',
    name: 'Acara sosial',
    budgetCap: null,
    icon: 'gift',
    color: '#14b8a6',
    subs: [
      { id: 'sub_inc_sos_umum', name: 'Umum', monthlyBudget: null, aliases: ['sosial'] },
      { id: 'sub_inc_amal', name: 'Amal & donasi', monthlyBudget: null, aliases: ['donasi'] },
      { id: 'sub_inc_hadiah', name: 'Hadiah', monthlyBudget: null, aliases: ['kado', 'angpao', 'gift'], defaultNotes: ['Hadiah'] },
    ],
  },
  {
    id: 'cat_inc_bayar_pinj',
    type: 'income',
    name: 'Pembayaran Pinjaman',
    budgetCap: null,
    icon: 'handshake',
    color: '#0ea5e9',
    subs: [{ id: 'sub_inc_bayar_pinj_umum', name: 'Umum', monthlyBudget: null, aliases: ['piutang', 'teman bayar'], defaultNotes: ['Pelunasan piutang'] }],
  },
  {
    id: 'cat_inc_cair_pinj',
    type: 'income',
    name: 'Pencairan Pinjaman',
    budgetCap: null,
    icon: 'landmark',
    color: '#64748b',
    subs: [{ id: 'sub_inc_cair_pinj_umum', name: 'Umum', monthlyBudget: null, aliases: ['pinjaman'] }],
  },
  {
    id: 'cat_inc_lainnya',
    type: 'income',
    name: 'Lainnya',
    budgetCap: null,
    icon: 'sparkles',
    color: '#22c55e',
    subs: [
      { id: 'sub_inc_lain_umum', name: 'Umum', monthlyBudget: null, aliases: [] },
      { id: 'sub_inc_bunga', name: 'Bunga', monthlyBudget: null, aliases: ['bunga bank', 'jago', 'krom'], defaultNotes: ['Bunga bank bulanan'] },
      { id: 'sub_inc_cashback', name: 'Cashback', monthlyBudget: null, aliases: ['promo', 'reward'], defaultNotes: ['Cashback promo'] },
      { id: 'sub_inc_pelunasan', name: 'Pelunasan', monthlyBudget: null, aliases: ['utang'] },
      { id: 'sub_inc_refund', name: 'Refund', monthlyBudget: null, aliases: ['pengembalian'], defaultNotes: ['Refund pesanan'] },
    ],
  },

  // ==================== SAVING ====================
  {
    id: 'cat_sav_tabungan',
    type: 'saving',
    name: 'Tabungan',
    budgetCap: null,
    icon: 'piggy-bank',
    color: '#38bdf8',
    subs: [
      { id: 'sub_sav_wedding', name: 'Wedding', monthlyBudget: null, aliases: ['nikah', 'kawin', 'pasangan'], defaultNotes: ['Setoran bulanan Wedding'] },
      { id: 'sub_sav_darurat', name: 'Dana darurat', monthlyBudget: 500000, aliases: ['emergency', 'darurat'], defaultNotes: ['Setoran dana darurat'] },
      { id: 'sub_sav_investasi', name: 'Investasi', monthlyBudget: 500000, aliases: ['bibit', 'reksadana', 'rdpu', 'rdpt', 'saham'], defaultNotes: ['Top up Bibit'] },
      { id: 'sub_sav_rumah', name: 'Rumah/Apartemen', monthlyBudget: 100000, aliases: ['dp rumah', 'properti'], defaultNotes: ['Tabungan rumah'] },
      { id: 'sub_sav_liburan', name: 'Liburan', monthlyBudget: null, aliases: ['travel', 'trip', 'healing'], defaultNotes: ['Tabungan liburan'] },
      { id: 'sub_sav_pendidikan', name: 'Pendidikan', monthlyBudget: null, aliases: ['kuliah', 's2', 'kursus'] },
      { id: 'sub_sav_pensiun', name: 'Pensiun', monthlyBudget: null, aliases: ['hari tua', 'dplk'] },
      { id: 'sub_sav_umum', name: 'Umum', monthlyBudget: null, aliases: ['nabung', 'hp', 'sepatu'], defaultNotes: ['Setoran tabungan'] },
    ],
  },

  // ==================== EXPENSE (Interpretasi B, tanpa Tarik tunai / Top up / CC) ====================
  {
    id: 'cat_exp_makan',
    type: 'expense',
    name: 'Makanan & Minuman',
    budgetCap: 500000,
    icon: 'utensils',
    color: '#f97316',
    subs: [
      { id: 'sub_exp_makan_umum', name: 'Umum', monthlyBudget: null, aliases: ['makan', 'minum', 'fnb'], defaultNotes: ['Makan'] },
      { id: 'sub_exp_kafe', name: 'Kafe', monthlyBudget: 100000, aliases: ['kopi', 'coffee', 'ngopi', 'sbux', 'starbucks', 'fore', 'kenangan'], defaultNotes: ['Kopi pagi', 'Es kopi susu', 'WFC kafe'] },
      { id: 'sub_exp_makan_pokok', name: 'Makanan Pokok', monthlyBudget: 300000, aliases: ['nasi', 'warteg', 'makan siang', 'makan malam', 'sarapan', 'gofood', 'grabfood'], defaultNotes: ['Makan siang', 'Makan malam', 'Sarapan'] },
      { id: 'sub_exp_restoran', name: 'Restoran', monthlyBudget: null, aliases: ['resto', 'dinner', 'makan bareng'], defaultNotes: ['Makan di restoran'] },
      { id: 'sub_exp_jajanan', name: 'Jajanan', monthlyBudget: null, aliases: ['snack', 'cemilan', 'boba', 'gorengan', 'es krim'], defaultNotes: ['Jajan sore', 'Snack'] },
    ],
  },
  {
    id: 'cat_exp_transport',
    type: 'expense',
    name: 'Transportasi',
    budgetCap: null,
    icon: 'car',
    color: '#06b6d4',
    subs: [
      { id: 'sub_exp_trans_umum', name: 'Umum', monthlyBudget: null, aliases: ['jalan'] },
      { id: 'sub_exp_bensin', name: 'Bensin', monthlyBudget: 200000, aliases: ['bbm', 'pertamax', 'pertalite', 'spbu', 'shell'], defaultNotes: ['Isi Pertamax', 'Isi Pertalite', 'Full tank'] },
      { id: 'sub_exp_parkir', name: 'Biaya parkir', monthlyBudget: 25000, aliases: ['parkir'], defaultNotes: ['Parkir mall', 'Parkir kantor'] },
      { id: 'sub_exp_servis', name: 'Servis kendaraan', monthlyBudget: 100000, aliases: ['bengkel', 'oli', 'cuci motor', 'ban'], defaultNotes: ['Ganti oli', 'Cuci kendaraan'] },
      { id: 'sub_exp_ojol', name: 'Taksi/Ojol', monthlyBudget: 50000, aliases: ['ojol', 'gojek', 'grab', 'goride', 'gocar', 'bluebird', 'maxim'], defaultNotes: ['GoRide ke kantor', 'Grab pulang'] },
      { id: 'sub_exp_tiket', name: 'Tiket perjalanan', monthlyBudget: 200000, aliases: ['kereta', 'kai', 'pesawat', 'travel', 'bus'], defaultNotes: ['Tiket perjalanan'] },
      { id: 'sub_exp_publik', name: 'Transportasi publik', monthlyBudget: 50000, aliases: ['krl', 'mrt', 'tj', 'transjakarta', 'lrt', 'commuter'], defaultNotes: ['KRL', 'MRT', 'TransJakarta'] },
    ],
  },
  {
    id: 'cat_exp_belanja',
    type: 'expense',
    name: 'Belanja',
    budgetCap: 500000,
    icon: 'shopping-bag',
    color: '#ec4899',
    subs: [
      { id: 'sub_exp_belanja_umum', name: 'Umum', monthlyBudget: null, aliases: ['shopping', 'tokped', 'tokopedia', 'shopee'], defaultNotes: ['Belanja online'] },
      { id: 'sub_exp_belanja_bulanan', name: 'Belanja bulanan', monthlyBudget: 250000, aliases: ['indomaret', 'alfamart', 'supermarket', 'groceries', 'sabun'], defaultNotes: ['Indomaret', 'Alfamart', 'Kebutuhan bulanan'] },
      { id: 'sub_exp_fashion', name: 'Fashion', monthlyBudget: null, aliases: ['baju', 'sepatu', 'celana', 'uniqlo'], defaultNotes: ['Pakaian'] },
      { id: 'sub_exp_gadget', name: 'Gadget & elektronik', monthlyBudget: null, aliases: ['hp', 'charger', 'kabel', 'earphone'], defaultNotes: ['Aksesoris elektronik'] },
    ],
  },
  {
    id: 'cat_exp_tagihan',
    type: 'expense',
    name: 'Tagihan',
    budgetCap: null,
    icon: 'receipt',
    color: '#ef4444',
    subs: [
      { id: 'sub_exp_tagihan_umum', name: 'Umum', monthlyBudget: null, aliases: ['bill'] },
      { id: 'sub_exp_sewa', name: 'Sewa', monthlyBudget: 1000000, aliases: ['kos', 'kost', 'kontrakan', 'rent'], defaultNotes: ['Bayar kos bulanan'] },
      { id: 'sub_exp_listrik', name: 'Listrik', monthlyBudget: null, aliases: ['pln', 'token'], defaultNotes: ['Token listrik PLN'] },
      { id: 'sub_exp_air', name: 'Air', monthlyBudget: null, aliases: ['pdam', 'galon'], defaultNotes: ['Air galon', 'Tagihan air'] },
      { id: 'sub_exp_internet', name: 'Internet', monthlyBudget: null, aliases: ['wifi', 'indihome', 'biznet'], defaultNotes: ['WiFi bulanan'] },
      { id: 'sub_exp_pulsa', name: 'Pulsa & Data', monthlyBudget: null, aliases: ['kuota', 'telkomsel', 'xl', 'byu', 'indosat'], defaultNotes: ['Paket data bulanan'] },
      { id: 'sub_exp_langganan', name: 'Langganan', monthlyBudget: null, aliases: ['subscription', 'icloud', 'google one'], defaultNotes: ['Langganan bulanan'] },
      { id: 'sub_exp_asuransi', name: 'Asuransi', monthlyBudget: null, aliases: ['bpjs', 'prudential'], defaultNotes: ['BPJS Kesehatan'] },
      { id: 'sub_exp_gas', name: 'Gas', monthlyBudget: null, aliases: ['elpiji', 'lpg'], defaultNotes: ['Gas LPG'] },
      { id: 'sub_exp_pemeliharaan', name: 'Biaya pemeliharaan', monthlyBudget: null, aliases: ['ipl', 'servis ac'] },
      { id: 'sub_exp_tv', name: 'TV Kabel', monthlyBudget: null, aliases: ['tv'] },
    ],
  },
  {
    id: 'cat_exp_hiburan',
    type: 'expense',
    name: 'Hiburan',
    budgetCap: null,
    icon: 'gamepad-2',
    color: '#f59e0b',
    subs: [
      { id: 'sub_exp_hib_umum', name: 'Umum', monthlyBudget: null, aliases: ['main'] },
      { id: 'sub_exp_film', name: 'Film/musik', monthlyBudget: null, aliases: ['bioskop', 'xxi', 'cgv', 'spotify'], defaultNotes: ['Nonton bioskop', 'Spotify'] },
      { id: 'sub_exp_games', name: 'Games', monthlyBudget: null, aliases: ['steam', 'topup game', 'ml'], defaultNotes: ['Games'] },
      { id: 'sub_exp_hobi', name: 'Hobi', monthlyBudget: null, aliases: ['koleksi'] },
      { id: 'sub_exp_konser', name: 'Konser', monthlyBudget: null, aliases: ['tiket konser', 'festival'] },
      { id: 'sub_exp_streaming', name: 'Layanan streaming', monthlyBudget: null, aliases: ['netflix', 'youtube', 'disney'], defaultNotes: ['Netflix', 'YouTube Premium'] },
      { id: 'sub_exp_liburan', name: 'Liburan', monthlyBudget: 300000, aliases: ['hotel', 'wisata', 'jalan-jalan'], defaultNotes: ['Liburan'] },
      { id: 'sub_exp_nongkrong', name: 'Nongkrong', monthlyBudget: null, aliases: ['hangout', 'kongkow'], defaultNotes: ['Nongkrong bareng teman'] },
    ],
  },
  {
    id: 'cat_exp_kesehatan',
    type: 'expense',
    name: 'Kesehatan',
    budgetCap: null,
    icon: 'heart-pulse',
    color: '#10b981',
    subs: [
      { id: 'sub_exp_kes_umum', name: 'Umum', monthlyBudget: null, aliases: ['sehat'] },
      { id: 'sub_exp_dokter', name: 'Biaya dokter', monthlyBudget: null, aliases: ['klinik', 'rs', 'rumah sakit', 'gigi'], defaultNotes: ['Kontrol dokter'] },
      { id: 'sub_exp_gym', name: 'Gym/Fitness', monthlyBudget: null, aliases: ['fitness', 'membership'], defaultNotes: ['Member gym'] },
      { id: 'sub_exp_obat', name: 'Obat', monthlyBudget: null, aliases: ['apotek', 'vitamin', 'halodoc'], defaultNotes: ['Apotek / vitamin'] },
      { id: 'sub_exp_olahraga', name: 'Olahraga', monthlyBudget: null, aliases: ['badminton', 'futsal', 'lari', 'padel'], defaultNotes: ['Patungan olahraga'] },
      { id: 'sub_exp_perawatan', name: 'Perawatan diri', monthlyBudget: 250000, aliases: ['skincare', 'potong rambut', 'barbershop', 'salon'], defaultNotes: ['Potong rambut', 'Skincare'] },
    ],
  },
  {
    id: 'cat_exp_keluarga',
    type: 'expense',
    name: 'Keluarga',
    budgetCap: 100000,
    icon: 'home',
    color: '#14b8a6',
    subs: [
      { id: 'sub_exp_kel_umum', name: 'Umum', monthlyBudget: null, aliases: ['rumah'] },
      { id: 'sub_exp_art', name: 'Asisten rumah tangga', monthlyBudget: null, aliases: ['art'] },
      { id: 'sub_exp_ortu', name: 'Kebutuhan orang tua', monthlyBudget: null, aliases: ['ibu', 'ayah', 'mama', 'papa'], defaultNotes: ['Kiriman orang tua'] },
      { id: 'sub_exp_laundry', name: 'Laundry', monthlyBudget: null, aliases: ['cuci baju'], defaultNotes: ['Laundry kiloan'] },
      { id: 'sub_exp_peliharaan', name: 'Peliharaan', monthlyBudget: null, aliases: ['kucing', 'anjing', 'petshop'] },
      { id: 'sub_exp_renovasi', name: 'Renovasi', monthlyBudget: null, aliases: ['perbaikan'] },
    ],
  },
  {
    id: 'cat_exp_sosial',
    type: 'expense',
    name: 'Acara sosial',
    budgetCap: null,
    icon: 'gift',
    color: '#f43f5e',
    subs: [
      { id: 'sub_exp_sos_umum', name: 'Umum', monthlyBudget: null, aliases: ['sosial'] },
      { id: 'sub_exp_amal', name: 'Amal & donasi', monthlyBudget: null, aliases: ['sedekah', 'zakat', 'infak', 'kitabisa'], defaultNotes: ['Donasi / sedekah'] },
      { id: 'sub_exp_hadiah', name: 'Hadiah', monthlyBudget: 100000, aliases: ['kado', 'ultah', 'gift'], defaultNotes: ['Kado'] },
      { id: 'sub_exp_pemakaman', name: 'Pemakaman', monthlyBudget: null, aliases: ['melayat', 'duka'] },
      { id: 'sub_exp_pernikahan', name: 'Pernikahan', monthlyBudget: null, aliases: ['kondangan', 'amplop'], defaultNotes: ['Kondangan'] },
    ],
  },
  {
    id: 'cat_exp_pendidikan',
    type: 'expense',
    name: 'Pendidikan',
    budgetCap: null,
    icon: 'book-open',
    color: '#0284c7',
    subs: [
      { id: 'sub_exp_pend_umum', name: 'Umum', monthlyBudget: null, aliases: ['kursus', 'bootcamp'] },
      { id: 'sub_exp_buku', name: 'Buku', monthlyBudget: null, aliases: ['gramedia', 'ebook'], defaultNotes: ['Beli buku'] },
      { id: 'sub_exp_kuliah', name: 'Uang sekolah/kuliah', monthlyBudget: null, aliases: ['spp', 'ukt'] },
    ],
  },
  {
    id: 'cat_exp_cicilan',
    type: 'expense',
    name: 'Cicilan',
    budgetCap: null,
    icon: 'calendar-clock',
    color: '#fb923c',
    subs: [
      { id: 'sub_exp_cicil_umum', name: 'Umum', monthlyBudget: null, aliases: ['angsuran'] },
      { id: 'sub_exp_cicil_kend', name: 'Kendaraan', monthlyBudget: null, aliases: ['motor', 'mobil'] },
      { id: 'sub_exp_cicil_pinj', name: 'Pinjaman', monthlyBudget: null, aliases: ['hutang'] },
      { id: 'sub_exp_cicil_rumah', name: 'Rumah', monthlyBudget: null, aliases: ['kpr'] },
    ],
  },
  {
    id: 'cat_exp_pinjaman',
    type: 'expense',
    name: 'Pinjaman',
    budgetCap: null,
    icon: 'handshake',
    color: '#94a3b8',
    subs: [{ id: 'sub_exp_pinj_umum', name: 'Umum', monthlyBudget: null, aliases: ['pinjam', 'talangin'] }],
  },
  {
    id: 'cat_exp_lainnya',
    type: 'expense',
    name: 'Lainnya',
    budgetCap: null,
    icon: 'package',
    color: '#64748b',
    subs: [
      { id: 'sub_exp_lain_umum', name: 'Umum', monthlyBudget: null, aliases: ['misc'] },
      { id: 'sub_exp_biaya', name: 'Biaya', monthlyBudget: 50000, aliases: ['admin', 'biaya transfer', 'materai'], defaultNotes: ['Biaya admin'] },
      { id: 'sub_exp_pajak', name: 'Pajak', monthlyBudget: null, aliases: ['pph', 'stnk', 'pbb'] },
      { id: 'sub_exp_pelunasan', name: 'Pelunasan', monthlyBudget: null, aliases: ['bayar hutang'] },
      { id: 'sub_exp_uang_keluar', name: 'Uang keluar', monthlyBudget: null, aliases: ['keluar'] },
    ],
  },
];

export function createSeedCategories(): {
  categories: Category[];
  subcategories: Subcategory[];
} {
  const categories: Category[] = [];
  const subcategories: Subcategory[] = [];

  RAW_CATEGORIES.forEach((raw, idx) => {
    categories.push({
      id: raw.id,
      type: raw.type,
      name: raw.name,
      budgetCap: raw.budgetCap,
      icon: raw.icon,
      color: raw.color,
      archived: false,
      sortOrder: idx + 1,
    });
    raw.subs.forEach((s, sIdx) => {
      subcategories.push({
        id: s.id,
        categoryId: raw.id,
        name: s.name,
        monthlyBudget: s.monthlyBudget,
        aliases: s.aliases ?? [],
        defaultNotes: s.defaultNotes ?? [],
        archived: false,
        sortOrder: sIdx + 1,
      });
    });
  });

  return { categories, subcategories };
}

export function createSeedGoals(): Goal[] {
  return [
    {
      id: 'goal_wedding',
      name: 'Wedding',
      icon: 'heart',
      targetAmount: 50000000,
      deadline: '2027-12-31',
      walletId: 'w_bibit',
      subcategoryId: 'sub_sav_wedding',
      priority: 1,
      color: '#10b981',
      isShared: true,
      status: 'active',
    },
    {
      id: 'goal_darurat',
      name: 'Dana Darurat',
      icon: 'shield',
      targetAmount: 15000000,
      deadline: null,
      walletId: 'w_jago',
      subcategoryId: 'sub_sav_darurat',
      priority: 2,
      color: '#38bdf8',
      isShared: false,
      status: 'active',
    },
  ];
}

export function createSeedTemplates(): QuickTemplate[] {
  return [
    {
      id: 'tpl_kopi',
      label: 'Kopi pagi',
      type: 'expense',
      amount: 25000,
      subcategoryId: 'sub_exp_kafe',
      walletId: 'w_gopay',
      note: 'Kopi pagi',
    },
    {
      id: 'tpl_makan',
      label: 'Makan siang',
      type: 'expense',
      amount: 30000,
      subcategoryId: 'sub_exp_makan_pokok',
      walletId: 'w_gopay',
      note: 'Makan siang',
    },
    {
      id: 'tpl_bensin',
      label: 'Bensin',
      type: 'expense',
      amount: 50000,
      subcategoryId: 'sub_exp_bensin',
      walletId: 'w_tunai',
      note: 'Isi Pertamax',
    },
    {
      id: 'tpl_wedding',
      label: 'Nabung Wedding',
      type: 'saving',
      amount: 500000,
      subcategoryId: 'sub_sav_wedding',
      walletId: 'w_jago',
      toWalletId: 'w_bibit',
      goalId: 'goal_wedding',
      note: 'Setoran Wedding',
    },
  ];
}

export function createSeedInvestmentProducts(openingDate = '2026-01-01'): InvestmentProduct[] {
  return [
    {
      id: 'prod_bibit_pu',
      walletId: 'w_bibit',
      goalId: 'goal_wedding',
      name: 'Pasar Uang (PU)',
      assetClass: 'pu',
      investedAmount: 0,
      marketValue: 0,
      color: INVESTMENT_ASSET_COLORS.pu,
      updatedAt: openingDate,
      sortOrder: 1,
    },
    {
      id: 'prod_bibit_obligasi',
      walletId: 'w_bibit',
      goalId: 'goal_wedding',
      name: 'Obligasi',
      assetClass: 'obligasi',
      investedAmount: 0,
      marketValue: 0,
      color: INVESTMENT_ASSET_COLORS.obligasi,
      updatedAt: openingDate,
      sortOrder: 2,
    },
    {
      id: 'prod_bibit_reksa_saham',
      walletId: 'w_bibit',
      goalId: 'goal_wedding',
      name: 'Reksa Saham',
      assetClass: 'reksa_saham',
      investedAmount: 0,
      marketValue: 0,
      color: INVESTMENT_ASSET_COLORS.reksa_saham,
      updatedAt: openingDate,
      sortOrder: 3,
    },
    {
      id: 'prod_bibit_saham',
      walletId: 'w_bibit',
      goalId: 'goal_wedding',
      name: 'Saham',
      assetClass: 'saham',
      investedAmount: 0,
      marketValue: 0,
      color: INVESTMENT_ASSET_COLORS.saham,
      updatedAt: openingDate,
      sortOrder: 4,
    },
    {
      id: 'prod_bibit_sbn',
      walletId: 'w_bibit',
      goalId: 'goal_wedding',
      name: 'SBN',
      assetClass: 'sbn',
      investedAmount: 0,
      marketValue: 0,
      color: INVESTMENT_ASSET_COLORS.sbn,
      updatedAt: openingDate,
      sortOrder: 5,
    },
  ];
}

export function createInitialDataset(displayName = 'Kamu', openingDate = '2026-01-01'): AppDataset {
  const { categories, subcategories } = createSeedCategories();
  return {
    profile: {
      id: 'local_user',
      displayName,
      cycleStartDay: 1,
      timezone: 'Asia/Jakarta',
      theme: 'dark',
      privacyMode: false,
      onboardingCompleted: false,
      isDemoData: false,
    },
    wallets: createSeedWallets(openingDate),
    categories,
    subcategories,
    goals: createSeedGoals(),
    transactions: [],
    valuations: [],
    investmentProducts: createSeedInvestmentProducts(openingDate),
    goalContributions: [],
    goalInvites: [
      {
        goalId: 'goal_wedding',
        code: 'MW-WED-2027',
        partnerName: 'Pasangan',
        partnerEmail: '',
        sharePercent: 50,
        status: 'pending',
      },
    ],
    recurringRules: [],
    aiMemory: {
      patterns: [],
      preferences: {},
      feedbackLog: [],
    },
    sheetsSync: {
      status: 'disconnected',
      spreadsheetId: '',
      spreadsheetUrl: '',
      autoSync: false,
      lastSyncedAt: null,
    },
    templates: createSeedTemplates(),
  };
}

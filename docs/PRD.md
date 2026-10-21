# PRD & Grand Design – Radix Outdoor

Web App Sistem Penyewaan Alat Outdoor — Single Tenant

**Versi:** 1.1 (draft revisi single tenant) · **Tanggal revisi:** 20 Oktober 2026 · **Brand:** Radix Outdoor · **Status:** Untuk review · **Referensi produk:** kategori aplikasi sewa outdoor ala SewaScale

> **Catatan:** PRD ini disusun dari pola fitur umum aplikasi manajemen rental outdoor (katalog, booking, stok, kasir, laporan, dll). Detail internal SewaScale belum diverifikasi satu per satu, jadi anggap bagian "benchmark" sebagai hipotesis yang perlu dicek dengan trial langsung.

## 1. Ringkasan Produk

Aplikasi web khusus **Radix Outdoor** untuk penyewaan alat outdoor (tenda, carrier, sleeping bag, kompor, matras, dll). Satu instalasi melayani satu bisnis Radix Outdoor, dengan satu storefront publik dan dashboard admin untuk stok, booking, pembayaran, pengembalian, denda, serta laporan keuangan.

**Keputusan arsitektur:** single tenant secara permanen dalam lingkup PRD ini. Database dan konfigurasi hanya untuk Radix Outdoor, tanpa kolom `tenant_id`, resolver tenant, panel platform, pendaftaran toko lain, atau billing langganan SaaS. Multi-outlet tetap didukung sebagai cabang milik Radix Outdoor; setiap outlet bukan tenant terpisah.

**Masalah yang diselesaikan**

- Pencatatan manual (buku/WhatsApp) → stok bentrok, barang "hilang", tanggal kembali lupa.
- Penyewa tidak bisa cek ketersediaan alat secara real-time.
- Owner sulit hitung omzet, denda, dan utilisasi barang.
- Konsinyasi alat dari mitra/pemilik lain sulit dilacak bagi hasilnya.

**Tujuan bisnis**

1. Mengurangi waktu admin per transaksi sewa hingga ≥ 50%.
2. Nol double-booking untuk unit yang sama.
3. Owner bisa lihat omzet, piutang, dan utilisasi alat kapan saja.
4. Memusatkan operasional seluruh outlet Radix Outdoor dalam satu sistem.

## 2. Target Pengguna & Persona

| Persona | Deskripsi | Kebutuhan utama |
| --- | --- | --- |
| **Owner Toko** | Pemilik rental | Laporan, pengaturan harga, kontrol staf, keuangan |
| **Admin/Kasir** | Staf harian | Input booking, serah-terima, pengembalian, pembayaran |
| **Gudang/Petugas** | Cek kondisi alat | Checklist keluar/masuk, status maintenance |
| **Mitra (Konsinyasi)** | Pemilik alat titipan | Lihat alat miliknya, pendapatan, bagi hasil |
| **Penyewa (Customer)** | Pendaki/camper | Cari alat, cek ketersediaan, booking, bayar, riwayat |

## 3. Ruang Lingkup

**In scope (v1):** storefront publik, katalog & paket, booking online, kasir/booking manual, manajemen stok per unit, pembayaran (DP/lunas), pengembalian & denda, laporan, multi-user & role, multi-outlet Radix Outdoor, notifikasi WhatsApp semi-manual dan email, konsinyasi mitra.

**Out of scope (v1):** aplikasi mobile native, integrasi kurir otomatis, pengiriman alat berbasis tracking real-time.

**Di luar lingkup produk:** SaaS untuk toko lain, multi-tenant, marketplace lintas toko, panel platform, paket dan billing langganan, onboarding tenant, serta subdomain per toko.

## 4. Benchmark Fitur (Hipotesis ala SewaScale)

Kategori fitur yang lazim ada di aplikasi sejenis dan harus dicakup:

1. Katalog produk dengan foto, harga per hari/jam, deposit.
2. Kalender ketersediaan & booking.
3. Paket bundling (misal paket Camping 2 orang).
4. Kasir/POS sewa dengan cetak nota/invoice.
5. Manajemen pelanggan + blacklist.
6. Pengingat jatuh tempo & denda keterlambatan.
7. Laporan keuangan & utilisasi.
8. Multi-cabang/outlet.
9. Integrasi pembayaran digital (QRIS, VA, e-wallet).
10. Halaman toko publik dengan branding Radix Outdoor.

## 5. Fitur Detail

### 5.1 Autentikasi & Akses

- Login email/password untuk staf, Owner, dan mitra.
- Penyewa tidak perlu akun: booking sebagai tamu dengan nama, nomor WhatsApp, dan foto KTP (v1).
- Reset password via email/WA.
- Role-Based Access Control (RBAC) untuk akun: Owner, Admin/Kasir, Gudang, dan Mitra. Penyewa mengakses layanan sebagai tamu di v1; akun Customer ditunda.
- Permission granular per modul (lihat, buat, ubah, hapus, ekspor).
- Audit log: siapa mengubah apa, kapan, dari IP mana.
- Sesi aman: rate limiting login, 2FA opsional untuk Owner.

### 5.2 Pengaturan Radix Outdoor & Multi-Outlet

- Profil bisnis tunggal: nama **Radix Outdoor**, logo, banner, alamat, peta, kontak, media sosial, jam operasional, hari libur.
- Pengaturan bisnis: mata uang IDR, zona waktu, format nota, kebijakan jaminan, denda, serta syarat & ketentuan sewa.
- Pengaturan storefront: warna tema, urutan kategori, banner promo; semua outlet memakai identitas Radix Outdoor.
- Setup pertama melalui seed atau skrip yang aman dijalankan ulang untuk profil bisnis dan akun Owner, lalu pengaturan dilengkapi dari dashboard.
- Multi-outlet: stok, booking, kasir, dan laporan per cabang, serta transfer stok antar cabang.
- Owner mengakses semua outlet; staf dengan penugasan outlet hanya mengakses operasional outlet yang diizinkan. Data master bersama mengikuti permission (bagian 20).

### 5.3 Katalog & Manajemen Produk

- **Kategori & subkategori** (Tenda, Carrier, Sleeping Bag, Alat Masak, Aksesori, dll).
- **Produk (model):** nama, deskripsi, spesifikasi, foto (multi), brand, kapasitas, tag.
- **Unit fisik:** tiap barang punya kode unik/QR (misal TND-001), kondisi, tanggal beli, harga beli, status.
- **Status unit:** tersedia, disewa, booking, maintenance, rusak, hilang, nonaktif.
- **Harga:** per hari, per 24 jam, per jam (opsional), harga weekend/high season, harga bertingkat (makin lama makin murah), harga khusus member.
- **Jaminan: identitas (KTP/SIM) ditahan selama sewa, tanpa deposit uang di v1**.
- **Paket bundling:** gabungan beberapa produk dengan harga paket + diskon otomatis.
- **Add-on & aksesori wajib:** misal tenda otomatis menyarankan flysheet/pasak.
- Impor massal produk via CSV/Excel, ekspor katalog.
- Cetak label QR/barcode untuk tiap unit.

### 5.4 Manajemen Stok & Ketersediaan

- Stok dihitung per unit dan per tanggal (bukan sekadar angka total).
- Cek ketersediaan real-time berdasarkan rentang tanggal & jam.
- **Pencegahan double-booking:** reservasi stok bersifat atomik (locking) saat booking dibuat.
- Buffer 1 hari penuh setelah jam kembali (default, bisa diatur untuk Radix Outdoor dan per produk) untuk pembersihan dan cek kondisi.
- Kalender ketersediaan visual per produk/unit.
- Stok minimum & notifikasi stok menipis.
- Riwayat pergerakan unit (keluar, masuk, pindah, perbaikan).
- Penjadwalan maintenance (cuci tenda, servis kompor) yang memblokir unit di kalender.
- Stok opname: hitung fisik vs sistem, catat selisih.

### 5.5 Storefront Publik (Sisi Penyewa)

- Beranda toko: banner, kategori, produk populer, paket, testimoni.
- Pencarian & filter: kategori, harga, kapasitas, ketersediaan pada tanggal tertentu.
- Halaman detail produk: galeri, spesifikasi, harga, kalender ketersediaan, produk terkait.
- Keranjang sewa: pilih tanggal ambil & kembali, tambah beberapa item.
- Checkout: data penyewa, upload KTP/identitas, ambil di toko, metode bayar, setujui S&K.
- Kode promo/voucher.
- Halaman status booking lewat kode booking + nomor WhatsApp (tanpa akun).
- Halaman statis: tentang, cara sewa, S&K, FAQ, kontak.
- SEO: meta tag, sitemap, schema produk, URL ramah.
- Mobile-first, cepat dimuat (target LCP < 2,5 detik).

### 5.6 Booking & Transaksi Sewa

**Alur status:** `Draft → Menunggu Pembayaran → Dikonfirmasi → Sedang Disewa → Dikembalikan → Selesai` (plus `Dibatalkan`, `Kedaluwarsa`, `Terlambat`).

- Booking online (dari storefront) dan booking manual (oleh admin/kasir, termasuk walk-in & pesanan via WhatsApp).
- Auto-expire booking yang belum dibayar dalam X jam (konfigurabel), stok dilepas otomatis.
- Edit booking: ubah tanggal, tambah/kurangi item, dengan hitung ulang harga & cek stok.
- Perpanjangan sewa (extend) dengan cek bentrok dengan booking berikutnya.
- Pembatalan & kebijakan refund (sesuai aturan toko: refund penuh/sebagian/hangus).
- Kode booking unik + QR untuk verifikasi saat pengambilan.
- Catatan internal & catatan pelanggan per transaksi.
- Dokumen: invoice, nota sewa, surat jalan, surat perjanjian sewa (PDF) dengan tanda tangan digital/foto.

### 5.7 Serah-Terima & Pengembalian

- **Pickup:** scan QR unit, checklist kelengkapan (tenda + pasak + flysheet), foto kondisi, tanda tangan penyewa.
- **Return:** scan QR, cek kondisi (baik/lecet/rusak/hilang), foto, bandingkan dengan kondisi awal.
- Pengembalian parsial (sebagian item dulu).
- Hitung otomatis: denda terlambat, biaya kerusakan, biaya kehilangan, biaya kebersihan.
- Pengembalian identitas jaminan setelah pemeriksaan dan pelunasan denda.
- Unit rusak otomatis masuk status maintenance dan keluar dari stok tersedia.

### 5.8 Pembayaran & Keuangan

- Metode v1: tunai, transfer bank, dan QRIS statis yang dibuat dinamis (nominal otomatis, konfirmasi manual + upload bukti, lihat 21.7). Virtual Account dan e-wallet via payment gateway (Midtrans) menyusul di fase lanjut.
- Skema bayar: DP (persentase/nominal), pelunasan, bayar penuh di muka.
- Fase lanjut: webhook payment gateway untuk update status otomatis, aman terhadap duplikasi (idempotent).
- **Ledger pembayaran** sebagai sumber kebenaran tunggal: setiap pemasukan, refund, dan denda tercatat sebagai entri tak-ubah.
- Kas harian & **shift kasir**: buka kas, tutup kas, selisih kas.
- Pencatatan pengeluaran toko (operasional, perbaikan, gaji) dengan kategori.
- Piutang: transaksi yang belum lunas, pengingat penagihan.
- Pajak/biaya layanan (opsional, konfigurabel).
- Voucher & diskon: persentase, nominal, minimal transaksi, kuota, periode berlaku.

### 5.9 Manajemen Pelanggan

- Database pelanggan: nama, WA, email, alamat, dokumen identitas, riwayat sewa.
- Segmentasi: pelanggan baru, loyal, member.
- **Blacklist/catatan risiko** (telat berulang, merusak alat) dengan peringatan saat booking.
- Program loyalitas sederhana (poin atau diskon member).
- Verifikasi identitas sebelum sewa pertama (opsional wajib).
- Ekspor data pelanggan, kepatuhan privasi (hapus/anonimkan data atas permintaan).

### 5.10 Konsinyasi / Mitra

- Mitra mendaftarkan alat titipan; unit ditandai pemilik = mitra.
- Skema bagi hasil: persentase tetap per mitra (sudah diputuskan, rumus di 18.9).
- Perhitungan otomatis pendapatan mitra per periode, dikurangi biaya perbaikan jika ada.
- Portal mitra: lihat alat, status, riwayat sewa, saldo, ajukan penarikan.
- Laporan settlement & bukti pembayaran ke mitra.

### 5.11 Notifikasi & Komunikasi

- Kanal v1: WhatsApp semi-manual (tombol buka WhatsApp dengan pesan terisi dari template), notifikasi di dashboard, dan email bila penyewa mengisinya. Gateway WhatsApp otomatis menyusul setelah rilis awal.
- Template pesan: booking dibuat, pembayaran diterima, pengingat H-1 pengambilan, pengingat jatuh tempo pengembalian, keterlambatan, terima kasih + minta ulasan.
- Pengingat dijadwalkan sebagai daftar tugas harian di dashboard. Pengiriman otomatis (queue + retry) berlaku untuk email, dan untuk gateway WhatsApp di fase lanjut.
- Notifikasi internal untuk staf: booking baru, stok menipis, pembayaran masuk.
- Tombol "hubungi via WhatsApp" dengan pesan terisi otomatis.

### 5.12 Laporan & Dashboard

- **Dashboard Owner:** omzet hari/bulan, booking aktif, alat sedang disewa, jatuh tempo hari ini, piutang, grafik tren.
- Laporan: penjualan/sewa, pendapatan per produk/kategori/cabang, utilisasi unit (% hari tersewa), produk terlaris, pelanggan teratas, denda & kerusakan, kas & shift, laba rugi sederhana, bagi hasil mitra.
- ROI per unit: pendapatan sewa vs harga beli.
- Filter periode, cabang, kategori; ekspor PDF/Excel/CSV.
- Laporan terjadwal dikirim ke email Owner (mingguan/bulanan).

### 5.13 Administrasi Sistem Radix Outdoor

- Owner mengelola pengaturan bisnis, akun staf, peran, dan outlet dalam dashboard yang sama.
- Monitoring internal: error rate, antrian job, kesehatan backup, dan penggunaan resource.
- Audit untuk perubahan sensitif, verifikasi pembayaran, waive denda, dan settlement mitra.
- Akses administrasi dibatasi oleh permission; tidak ada peran Super Admin platform atau impersonasi.

### 5.14 Fitur Tambahan (Nice-to-Have)

- Ulasan & rating produk/toko.
- Fitur pengantaran/pengambilan oleh kurir toko dengan biaya ongkir per zona.
- Rekomendasi paket berdasarkan jumlah orang & lama trip (bisa dibantu AI).
- Asisten AI untuk menjawab pertanyaan penyewa di storefront.
- PWA (bisa dipasang di HP, offline ringan untuk kasir).
- Integrasi Google Calendar, Google Analytics, Meta Pixel.
- API publik & webhook untuk integrasi pihak ketiga.

## 6. User Flow Utama

**A. Penyewa booking online**

1. Buka storefront → cari alat → pilih tanggal.
2. Sistem cek ketersediaan → tambah ke keranjang.
3. Checkout, isi data, upload identitas → pilih bayar DP/lunas.
4. Bayar via transfer/QRIS → unggah bukti → admin memverifikasi DP/lunas → status Dikonfirmasi → staf mengirim pesan WhatsApp semi-manual. Pembayaran tunai dicatat oleh kasir.
5. H-1 pengingat → pengambilan di toko (scan kode booking).

**B. Admin serah-terima & pengembalian**

1. Cari booking via kode/QR → verifikasi identitas → pelunasan.
2. Scan unit, checklist, foto → status Sedang Disewa.
3. Saat kembali: scan unit, cek kondisi, hitung denda/kerusakan.
4. Setelah denda lunas atau di-waive Owner, kembalikan identitas jaminan → status Selesai → kirim notifikasi terima kasih.

**C. Owner menyiapkan Radix Outdoor**

1. Jalankan setup awal profil Radix Outdoor dan akun Owner melalui seed/skrip.
2. Login → lengkapi profil, outlet, jam buka, kebijakan sewa, dan metode pembayaran.
3. Tambah kategori, produk, unit, serta mitra konsinyasi bila ada.
4. Tambah staf, tetapkan role dan outlet → aktifkan penerimaan booking di storefront.

## 7. Aturan Bisnis Kunci

1. Unit hanya boleh di satu booking aktif pada rentang waktu yang sama.
2. Hari sewa dihitung per 24 jam dari jam ambil dengan toleransi default 60 menit (18.1); mode hari kalender dan per jam di luar v1.
3. Denda terlambat = tarif per hari/jam × unit terlambat, dengan batas maksimum opsional.
4. Booking belum bayar kedaluwarsa otomatis sesuai batas waktu toko.
5. Entri ledger tidak boleh diubah/dihapus; koreksi dilakukan dengan entri pembalik.
6. Akses dibatasi berdasarkan peran, penugasan outlet staf, kepemilikan data mitra, dan verifikasi booking penyewa (wajib diuji otomatis).
7. Pelanggan blacklist memunculkan peringatan dan bisa memblokir booking online.
8. Perubahan harga tidak memengaruhi booking yang sudah dikonfirmasi (harga di-snapshot).

## 8. Model Data (Entitas Inti)

`store_profile`, `users`, `roles`, `permissions`, `outlets`, `customers`, `categories`, `products`, `product_units`, `bundles`, `bundle_items`, `price_rules`, `bookings`, `booking_items`, `booking_status_logs`, `payments`, `ledger_entries`, `collateral (kolom di bookings)`, `fines`, `inspections` (checklist + foto), `maintenance_logs`, `stock_movements`, `vouchers`, `partners`, `partner_settlements`, `expenses`, `cash_shifts`, `notifications`, `audit_logs`. Pengaturan bisnis disimpan di `store_profile.settings_json`.

Catatan: seluruh data berada dalam satu database Radix Outdoor. Transaksi dan stok terkait cabang memakai `outlet_id`; data master bersama tidak diduplikasi per cabang. Index mengikuti filter bisnis, misalnya (`outlet_id`, `status`, `start_at`). Soft delete dipakai jika relevan. Kode booking, kode unit, slug produk/kategori, kode voucher, email pengguna, dan idempotency key unik di tingkat bisnis.

## 9. Kebutuhan Non-Fungsional

| Aspek | Target |
| --- | --- |
| Performa | Halaman publik LCP < 2,5 dtk; API p95 < 500 ms |
| Ketersediaan | Uptime ≥ 99,5% |
| Keamanan | HTTPS, hashing password kuat, CSRF/XSS/SQLi protection, enkripsi data identitas, rate limit, audit log |
| Privasi | Dokumen KTP disimpan privat (signed URL), retensi data terdefinisi, patuh UU PDP |
| Skalabilitas | Mendukung pertumbuhan produk, unit, outlet, dan volume booking Radix Outdoor; kapasitas dibuktikan dengan uji beban, job berat lewat queue |
| Backup | Backup database harian + uji restore berkala |
| Observability | Log terpusat, error tracking, health check, alert |
| Aksesibilitas & i18n | Bahasa Indonesia default, siap multi-bahasa, format Rupiah & zona waktu WIB/WITA/WIT |
| Kualitas | Test otomatis untuk alur booking, stok, ledger, RBAC, dan pembatasan akses outlet/mitra/penyewa |

## 10. Rekomendasi Arsitektur (Serverless Cloudflare)

- **Backend:** Cloudflare Workers + Hono (TypeScript), validasi Zod.
- **Database:** satu D1 (SQLite) khusus Radix Outdoor per environment dengan Drizzle ORM. Tidak ada kolom `tenant_id`. Opsi lanjut: Durable Object untuk koordinasi reservasi unit bila hasil uji menunjukkan kebutuhan.
- **Storage:** R2 untuk foto alat dan dokumen identitas (privat, signed URL).
- **Frontend:** Server-rendered dengan Hono JSX + HTMX di Worker yang sama, Tailwind CSS (build ke static assets), JavaScript kecil hanya untuk pemindai QR, tanda tangan, dan kompres foto. PWA untuk kasir di fase lanjut.
- **Job terjadwal:** Cron Triggers + Queues (auto-expire booking, pengingat, laporan).
- **PDF:** Browser Rendering `/pdf` (HTML ke PDF), disimpan ke R2.
- **Pembayaran v1:** manual (transfer + bukti, konfirmasi admin). Midtrans menyusul di fase lanjut.
- **WhatsApp** v1: semi-manual lewat tautan wa.me dengan pesan terisi. Gateway otomatis (dengan abstraksi provider) setelah rilis awal.
- **Domain:** nama Worker `radix-outdoor`, dengan alamat awal `radix-outdoor.<akun>.workers.dev`. Domain milik Radix Outdoor dapat dipasang untuk produksi; hostname final ditentukan Owner, tanpa wildcard atau subdomain per toko.

### 10.1 Kekurangan Serverless & Penanggulangannya

| Kekurangan | Penanggulangan |
| --- | --- |
| PHP/Laravel tidak jalan di Workers | Backend ditulis ulang di TypeScript (Hono + Drizzle + Zod). PRD ini netral stack, jadi fitur tidak berubah. Bagi kode per modul (katalog, booking, stok, ledger) agar dibangun bertahap. |
| D1 tidak punya transaksi interaktif (BEGIN/COMMIT) | Pakai `db.batch()` yang atomik. Syarat bisnis (misal stok bentrok) dijaga lewat constraint atau trigger SQLite `RAISE(ABORT)`, karena batch hanya gagal bila database melempar error. |
| Risiko double-booking | Tabel reservasi per unit dan rentang tanggal, dengan cek overlap di statement yang sama dengan insert booking. Satu database D1 memproses query satu per satu, jadi tidak ada interleaving. Opsi lanjut: Durable Object untuk reservasi Radix Outdoor (SQLite, konsisten kuat) khusus stok dan booking. Batasnya (dicek di dokumentasi Cloudflare, Okt 2026): 10 GB per object di Workers Paid (1 GB di Free), tanpa batas total storage akun di Paid, single-threaded dengan soft limit 1.000 request/detik per object. Cukup lega untuk satu toko; foto dan KTP tetap di R2. |
| Laporan dan ledger kompleks | Ledger append-only. Ringkasan harian (`daily_summary`) diperbarui di batch yang sama dengan transaksi, lalu laporan membaca ringkasan, bukan scan tabel besar. Index mengikuti kolom filter bisnis, termasuk outlet, status, dan waktu. Laporan berat dihitung lewat Queue/Cron. |
| Batas free tier | Workers Free: 100.000 request/hari dan 10 ms CPU per request. D1 Free: 5 juta row read dan 100.000 row write per hari, dan sejak 1 Sep 2026 query gagal bila terlampaui. Mitigasi: index, cache katalog publik di edge, pantau `rows_read` / `rows_written`. Pilih paket infrastruktur berdasarkan beban Radix Outdoor dan evaluasi biaya sebelum produksi; biaya ini merupakan pengeluaran operasional, bukan paket langganan penyewa atau toko lain. |
| Pembuatan PDF (nota, invoice, perjanjian) | Browser Rendering `/pdf` (HTML ke PDF), hasil disimpan di R2. Plan gratis terbatas (sekitar 6 request/menit dan 10 menit/hari), jadi simpan PDF yang sudah jadi dan sediakan fallback halaman cetak (print CSS). |
| Ekspor Excel | CSV langsung dari Worker. XLSX dibuat di browser (SheetJS sisi klien) agar tidak kena batas CPU Worker. |
| Job terjadwal (auto-expire, pengingat) | Cron Triggers + Queues, dengan retry untuk notifikasi WhatsApp. |
| Akses data tanpa izin | Semua query melalui repo dengan cakupan akses dari sesi server. Uji penolakan lintas outlet, data mitra lain, dan booking penyewa lain. |
| Backup | Ekspor terjadwal D1 ke R2 dan uji restore berkala. |

**Keputusan MVP:** satu D1 khusus Radix Outdoor per environment, profil bisnis tunggal, booking via batch + trigger, PDF via Browser Rendering, XLSX di browser, pembayaran manual. Tidak ada control plane SaaS. Paket infrastruktur dan kebutuhan Durable Object dievaluasi dari uji beban sebelum produksi.

## 11. Roadmap & Prioritas

| Fase | Isi | Prioritas |
| --- | --- | --- |
| **Fase 0 – Fondasi** | Skeleton Workers (Hono) + D1, auth, RBAC, profil Radix Outdoor, cakupan akses outlet, audit log, test dasar | Wajib |
| **Fase 1 – MVP** | Katalog, unit & stok, booking manual + online, pembayaran manual (tunai/transfer/QRIS dinamis), pickup/return, nota PDF, dashboard dasar, konsinyasi mitra, multi-outlet | Wajib |
| **Fase 2 – Operasional** | Denda, jaminan identitas, ledger & shift kasir, pelanggan & blacklist, voucher, notifikasi WA, laporan lengkap | Tinggi |
| **Fase 3 – Penguatan Operasional** | Optimasi laporan dan stok lintas outlet, penguatan backup/restore, domain Radix Outdoor, monitoring dan penyempurnaan alur staf | Tinggi |
| **Fase 4 – Pertumbuhan** | Ulasan, akun penyewa (OTP), pengantaran, AI asisten, API publik, Midtrans untuk pembayaran sewa | Sedang |

## 12. Metrik Keberhasilan

- Waktu rata-rata input satu transaksi sewa < 2 menit.
- Insiden double-booking = 0.
- ≥ 60% booking masuk melalui storefront online (setelah 3 bulan).
- Selisih kas harian < 1% rata-rata.
- Seluruh outlet Radix Outdoor memakai sistem untuk pencatatan transaksi pada bulan ke-3 setelah rilis.
- Utilisasi unit tercatat dan dapat dilaporkan untuk 100% produk.

## 13. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Double-booking karena race condition | Tinggi | Batch D1 + trigger overlap, uji konkurensi |
| Kebocoran data pribadi atau akses lintas outlet tanpa izin | Kritis | RBAC, filter outlet di repo, pemeriksaan kepemilikan data, dan test otorisasi wajib |
| Selisih ledger/kas | Tinggi | Ledger immutable, rekonsiliasi harian |
| Penyewa tidak mengembalikan alat | Sedang | Identitas ditahan, verifikasi identitas, blacklist |
| Ketergantungan gateway WA | Sedang | Abstraksi provider, fallback email |
| Scope terlalu besar | Tinggi | Rilis bertahap per fase, MVP dulu |

## 14. Keputusan Lingkup & Pertanyaan Terbuka

1. Single tenant khusus Radix Outdoor, dengan satu database per environment dan profil bisnis tunggal (sudah diputuskan).
2. Multi-outlet tetap didukung; daftar outlet awal, alamat, kontak, serta penugasan staf perlu diisi Owner.
3. Jaminan berupa identitas (KTP/SIM) ditahan, tanpa deposit uang di v1 (sudah diputuskan).
4. Pengantaran alat tidak masuk v1, hanya ambil di outlet (sudah diputuskan).
5. WhatsApp semi-manual di v1 (sudah diputuskan). Gateway otomatis dan payment gateway dievaluasi setelah rilis awal.
6. Penyewa checkout sebagai tamu (nama, WhatsApp, foto KTP), tanpa akun di v1 (sudah diputuskan).
7. Domain produksi, data kontak, logo, dan rekening/QRIS Radix Outdoor ditentukan Owner.

## 15. Kriteria Penerimaan MVP (Ringkas)

- Penyewa dapat melihat ketersediaan alat, membuat booking, melihat instruksi pembayaran, dan mengunggah bukti secara mandiri; admin mengonfirmasi transfer/QRIS secara manual di v1.
- Admin dapat membuat booking manual, melakukan pickup dan return dengan checklist, serta menghitung denda otomatis.
- Dua booking untuk unit yang sama pada rentang tanggal beririsan tidak pernah berhasil bersamaan.
- Owner dapat melihat laporan omzet dan utilisasi per periode serta mengekspornya.
- Staf tidak dapat mengakses transaksi outlet di luar penugasannya, mitra tidak melihat data mitra lain, dan penyewa tidak melihat booking orang lain (lulus test otorisasi).

## 16. Arsitektur Teknis & Struktur Proyek

Bagian 16 sampai 26 adalah grand design teknis: cukup rinci untuk langsung dikerjakan, dan semua angka atau skema yang berupa usulan bisa diubah saat implementasi.

### 16.1 Komponen Sistem

| Komponen | Teknologi | Tugas |
| --- | --- | --- |
| Edge API | Cloudflare Worker + Hono (TypeScript) | Semua endpoint, auth, validasi, aturan bisnis |
| Frontend | Hono JSX (server-rendered) + HTMX + Tailwind (CSS hasil build di static assets), JavaScript kecil per halaman bila perlu | Storefront Radix Outdoor, dashboard staf, portal mitra |
| Database | D1 (SQLite) + Drizzle ORM | Data operasional Radix Outdoor dan profil bisnis tunggal |
| File | R2 (bucket privat + publik) | Foto alat (publik via CDN), KTP dan bukti transfer (privat, signed URL) |
| Cache | Cache API / KV | Katalog publik dan pengaturan Radix Outdoor |
| Job | Cron Triggers + Queues | Auto-expire, daftar tugas pengingat, ringkasan harian, retry email |
| PDF | Browser Rendering `/pdf` | Nota, invoice, surat perjanjian |
| DNS/SSL | Hostname Worker atau domain Radix Outdoor | Satu host utama untuk storefront dan dashboard; staging memakai host terpisah |
| Stok kuat (opsional) | Durable Object untuk reservasi Radix Outdoor | Dipakai bila D1 tidak cukup untuk konflik stok |

### 16.2 Routing Aplikasi Single Tenant

1. Satu Worker melayani Radix Outdoor pada `radix-outdoor.<akun>.workers.dev` atau domain produksi yang dikonfigurasi.
2. Storefront di `/`, dashboard staf di `/admin/...`, portal mitra di `/mitra/...`, dan JSON API di `/api/v1`.
3. Middleware `loadStore` memuat baris tunggal `store_profile` (`id = 1`), termasuk zona waktu dan kebijakan bisnis. Middleware ini tidak memilih bisnis berdasarkan request.
4. Konfigurasi host yang diizinkan ditentukan per environment; header host atau input klien tidak dapat memilih database, bisnis, atau cakupan akses.
5. Sesi server menentukan pengguna, peran, dan outlet yang diizinkan. `outlet_id` pilihan klien tetap divalidasi terhadap cakupan akses pengguna.
6. Local, staging, dan production memakai database, bucket, serta secret terpisah. Tidak diperlukan `TENANT_MODE`, `DEFAULT_TENANT_SLUG`, atau resolver subdomain.

Nama brand yang ditampilkan pada storefront, dashboard, PDF, dan template pesan adalah **Radix Outdoor**. Prefiks contoh kode booking adalah `RX`; slug proyek dan Worker adalah `radix-outdoor`.

### 16.3 Urutan Middleware

1. `requestId` dan logging terstruktur
2. `loadStore` (profil bisnis tunggal)
3. `rateLimit` (per IP dan per rute sensitif seperti login dan OTP)
4. `auth` (membaca sesi, mengisi `user` dan `role`)
5. `authorize(permission)` per rute
6. `validate` (Zod untuk body, query, params)
7. Handler, lalu `errorHandler` yang memetakan error domain ke kode HTTP

### 16.4 Pola Akses Data

- Semua query lewat satu data-access layer (`repo/*`). Handler dan service tidak boleh memanggil `db` langsung. Repo untuk data terbatas wajib menerima `accessScope` dari sesi atau verifikasi server: role, outlet yang diizinkan, serta identitas mitra atau booking penyewa bila relevan. Repo publik hanya mengembalikan kolom katalog yang telah diterbitkan. Cakupan akses tidak diambil langsung dari body, query, atau header klien.
- Operasi yang mengubah beberapa tabel (booking, pembayaran, pengembalian) dibungkus satu `db.batch()`.
- Aturan yang tidak boleh dilanggar (unit tidak boleh dobel, saldo tidak boleh minus) dijaga di database lewat constraint dan trigger, bukan hanya di kode.
- Uang disimpan sebagai integer rupiah (tanpa desimal). Waktu disimpan sebagai epoch milidetik UTC, ditampilkan sesuai zona waktu toko.
- ID memakai ULID atau UUIDv7 (urut waktu, aman dibuat di client maupun server), kecuali singleton `store_profile` yang memakai integer tetap `id = 1`.

### 16.5 Bindings Worker (wrangler)

| Binding | Jenis | Fungsi |
| --- | --- | --- |
| `DB` | D1 | Database utama |
| `FILES_PUBLIC`, `FILES_PRIVATE` | R2 | Foto alat dan dokumen privat |
| `CACHE` | KV | Cache profil Radix Outdoor dan katalog |
| `JOBS` | Queue | Antrian notifikasi dan tugas berat |
| `BROWSER` | Browser Rendering | Pembuatan PDF |
| `ASSETS` | Static assets | Frontend hasil build |
| Secrets | `wrangler secret` | `SESSION_SECRET`, `WA_API_KEY`, kunci enkripsi dokumen |

### 16.6 Struktur Monorepo

```text
radix-outdoor/
  apps/
    api/            Worker + Hono (src/routes, src/views (JSX), src/services, src/middleware, src/repo, src/jobs)
    web/            aset statis (CSS hasil build, JS kecil). Halaman dirender di apps/api/src/views
  packages/
    shared/         tipe, skema Zod, konstanta status, util harga dan tanggal
    db/             skema Drizzle, migrasi SQL, seed
  docs/             PRD ini, ADR (catatan keputusan arsitektur)
  wrangler.jsonc    konfigurasi bindings per environment
```

Aturan harga, denda, dan overlap tanggal ditulis sekali di `packages/shared` agar dipakai backend dan frontend (hitung ulang di keranjang), dan diuji dengan unit test tabel kasus.

### 16.7 Konvensi

- Respons API seragam: `{ ok, data, error: { code, message, fields } }`.
- Kode error domain berupa string tetap (misal `UNIT_NOT_AVAILABLE`, `BOOKING_EXPIRED`) agar frontend bisa menerjemahkannya.
- Idempotency-Key wajib untuk pembuatan booking dan pencatatan pembayaran, supaya klik ganda atau retry tidak membuat data dobel.
- Paginasi berbasis cursor untuk daftar besar (booking, ledger).
- Soft delete (`deleted_at`) untuk data master; data transaksi tidak pernah dihapus.

### 16.8 Keputusan Stack untuk MVP

| Lapisan | Pilihan | Status |
| --- | --- | --- |
| Backend | Cloudflare Workers + Hono (TypeScript) | Diputuskan |
| Frontend | Server-rendered dengan Hono JSX + HTMX, JavaScript minim | Diputuskan |
| Database | D1 (SQLite) + Drizzle ORM | Diputuskan |
| File | R2 | Diputuskan |
| Job | Cron Triggers + Queues | Diputuskan |
| PDF | Browser Rendering `/pdf` | Diputuskan, diuji di sprint 5 |
| Pembayaran | Manual di v1, Midtrans setelah rilis awal | Diputuskan |
| WhatsApp | Semi-manual (wa.me), gateway setelah rilis awal | Diputuskan |

Sprint 0 tetap berfungsi sebagai uji coba stack (lihat 26.4): bila ada hambatan besar, keputusan backend bisa ditinjau ulang sebelum sprint 1 dimulai.

## 17. Skema Database (D1 / SQLite)

DDL di bawah adalah titik awal migrasi untuk satu bisnis Radix Outdoor. Tidak ada kolom `tenant_id` atau tabel control plane SaaS. `store_profile` dibatasi satu baris (`id = 1`); tabel bisnis memakai ID teks ULID, uang integer rupiah, dan waktu epoch milidetik UTC. Index mengikuti kolom filter bisnis. Trigger dan constraint perlu diuji di staging sebelum dianggap final.

### 17.1 Profil Bisnis Tunggal

```sql
CREATE TABLE store_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Radix Outdoor',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  logo_key TEXT, banner_key TEXT, address TEXT, phone TEXT, email TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}', -- jam buka, DP, jaminan, denda, buffer, tema, S&K
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
```

Seed membuat satu profil `id = 1` dengan nama Radix Outdoor. Pengaturan diperbarui pada baris ini; tidak ada endpoint membuat profil bisnis kedua. Data cabang disimpan di `outlets`. Payload QRIS diperlakukan sebagai konfigurasi sensitif: enkripsi bila disimpan di `settings_json`, dengan kunci dari secret; jangan menyertakan payload asli dalam repo, log, atau test.

### 17.2 Identitas & Akses

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT, phone TEXT, name TEXT NOT NULL, password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','warehouse','partner')),
  outlet_id TEXT, is_active INTEGER NOT NULL DEFAULT 1, last_login_at INTEGER, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX ux_users_email ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX ux_users_phone ON users(phone) WHERE phone IS NOT NULL;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, ip TEXT, user_agent TEXT, created_at INTEGER NOT NULL
);

-- Ditunda: dipakai bila login OTP penyewa ditambahkan nanti
CREATE TABLE otp_codes (
  id TEXT PRIMARY KEY, phone TEXT NOT NULL, code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL, used_at INTEGER
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL,
  entity TEXT NOT NULL, entity_id TEXT, before_json TEXT, after_json TEXT, ip TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX ix_audit_time ON audit_logs(created_at DESC);
```

### 17.3 Katalog & Unit

```sql
CREATE TABLE outlets (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, phone TEXT, is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY, parent_id TEXT, name TEXT NOT NULL, slug TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX ux_cat_slug ON categories(slug);

CREATE TABLE products (
  id TEXT PRIMARY KEY, category_id TEXT REFERENCES categories(id),
  name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT, specs_json TEXT, brand TEXT,
  base_price_day INTEGER NOT NULL,
  buffer_hours INTEGER,   -- NULL = pakai default toko
  image_keys_json TEXT NOT NULL DEFAULT '[]', is_published INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX ux_prod_slug ON products(slug);
CREATE INDEX ix_prod_cat ON products(category_id, is_published);

CREATE TABLE price_rules (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
  kind TEXT NOT NULL CHECK (kind IN ('tier','weekend','season','member')),
  min_days INTEGER, starts_on TEXT, ends_on TEXT, price_day INTEGER, percent_adjust REAL, priority INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE product_units (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
  outlet_id TEXT REFERENCES outlets(id), code TEXT NOT NULL,       -- TND-001, dipakai di QR
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','maintenance','broken','lost','retired')),
  condition_note TEXT, purchase_price INTEGER, purchased_on TEXT, owner_partner_id TEXT, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX ux_unit_code ON product_units(code);
CREATE INDEX ix_unit_prod ON product_units(product_id, status);
CREATE INDEX ix_unit_outlet_prod ON product_units(outlet_id, product_id, status);

CREATE TABLE bundles (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, price_day INTEGER NOT NULL, is_published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE bundle_items (
  bundle_id TEXT NOT NULL REFERENCES bundles(id), product_id TEXT NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (bundle_id, product_id)
);
```

Catatan: status `rented` dan `booked` sengaja tidak disimpan di `product_units`. Ketersediaan unit pada suatu tanggal dihitung dari tabel reservasi (17.4), sehingga satu unit bisa punya banyak booking di tanggal berbeda tanpa status yang basi.

### 17.4 Booking, Reservasi, Pembayaran

```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
  address TEXT, id_doc_key TEXT, is_blacklisted INTEGER NOT NULL DEFAULT 0, blacklist_reason TEXT, notes TEXT, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX ux_cust_phone ON customers(phone);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY, outlet_id TEXT, code TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL CHECK (status IN ('pending_payment','confirmed','picked_up','returned','completed','cancelled','expired')),
  channel TEXT NOT NULL CHECK (channel IN ('online','walk_in','whatsapp')),
  start_at INTEGER NOT NULL, end_at INTEGER NOT NULL, returned_at INTEGER,
  subtotal INTEGER NOT NULL, discount_total INTEGER NOT NULL DEFAULT 0, fee_total INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL, paid_total INTEGER NOT NULL DEFAULT 0,
  collateral_type TEXT CHECK (collateral_type IN ('ktp','sim','other')),
  collateral_status TEXT NOT NULL DEFAULT 'none' CHECK (collateral_status IN ('none','held','returned')), collateral_note TEXT,
  voucher_id TEXT, expires_at INTEGER, note TEXT, idempotency_key TEXT, created_by TEXT, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX ux_book_code ON bookings(code);
CREATE UNIQUE INDEX ux_book_idem ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX ix_book_status_time ON bookings(status, start_at);
CREATE INDEX ix_book_outlet_status_time ON bookings(outlet_id, status, start_at);
CREATE INDEX ix_book_customer ON bookings(customer_id);

CREATE TABLE booking_items (
  id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), product_id TEXT NOT NULL, unit_id TEXT REFERENCES product_units(id), bundle_id TEXT,
  qty INTEGER NOT NULL DEFAULT 1, unit_price_day INTEGER NOT NULL,   -- snapshot harga
  days INTEGER NOT NULL, line_total INTEGER NOT NULL, product_name TEXT NOT NULL    -- snapshot nama
);

CREATE TABLE unit_reservations (
  id TEXT PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES product_units(id),
  booking_id TEXT NOT NULL REFERENCES bookings(id), start_at INTEGER NOT NULL, end_at INTEGER NOT NULL,   -- sudah termasuk buffer
  kind TEXT NOT NULL CHECK (kind IN ('booking','maintenance')), released_at INTEGER
);
CREATE INDEX ix_res_unit_time ON unit_reservations(unit_id, start_at, end_at) WHERE released_at IS NULL;

-- Trigger anti double-booking: batch gagal total bila rentang beririsan dengan reservasi aktif lain
CREATE TRIGGER trg_no_overlap BEFORE INSERT ON unit_reservations
WHEN EXISTS (
  SELECT 1 FROM unit_reservations r
  WHERE r.unit_id = NEW.unit_id AND r.released_at IS NULL
    AND r.start_at < NEW.end_at AND NEW.start_at < r.end_at
)
BEGIN SELECT RAISE(ABORT, 'UNIT_NOT_AVAILABLE'); END;

CREATE TABLE booking_status_logs (
  id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, from_status TEXT, to_status TEXT NOT NULL,
  user_id TEXT, note TEXT, created_at INTEGER NOT NULL
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id),
  method TEXT NOT NULL CHECK (method IN ('cash','transfer','qris','va','ewallet')),
  kind TEXT NOT NULL CHECK (kind IN ('dp','settlement','refund','fine')),
  amount INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending','confirmed','rejected')),
  proof_file_key TEXT, gateway_ref TEXT, idempotency_key TEXT, shift_id TEXT, confirmed_by TEXT, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX ux_pay_idem ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
```

Buffer antar sewa ditambahkan saat menghitung `start_at` dan `end_at` reservasi (default 1 hari penuh setelah jam kembali, lihat 18.10), sehingga trigger cukup membandingkan dua rentang.

### 17.5 Operasional & Keuangan

```sql
CREATE TABLE inspections (
  id TEXT PRIMARY KEY, booking_item_id TEXT NOT NULL, unit_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('pickup','return')), condition TEXT NOT NULL CHECK (condition IN ('good','minor','damaged','lost')),
  checklist_json TEXT, photo_keys_json TEXT, signature_key TEXT, note TEXT, user_id TEXT, created_at INTEGER NOT NULL
);

CREATE TABLE fines (
  id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('late','damage','lost','cleaning')),
  amount INTEGER NOT NULL, note TEXT, waived_by TEXT, created_at INTEGER NOT NULL
);

CREATE TABLE ledger_entries (   -- append-only, tidak ada UPDATE atau DELETE
  id TEXT PRIMARY KEY, outlet_id TEXT, occurred_at INTEGER NOT NULL,
  account TEXT NOT NULL CHECK (account IN ('rental_income','fine_income','refund','expense','partner_payable')),
  direction TEXT NOT NULL CHECK (direction IN ('in','out')), amount INTEGER NOT NULL,
  booking_id TEXT, payment_id TEXT, expense_id TEXT, reverses_id TEXT, note TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX ix_ledger_time ON ledger_entries(occurred_at);
CREATE INDEX ix_ledger_outlet_time ON ledger_entries(outlet_id, occurred_at);
CREATE TRIGGER trg_ledger_no_update BEFORE UPDATE ON ledger_entries BEGIN SELECT RAISE(ABORT,'LEDGER_IMMUTABLE'); END;
CREATE TRIGGER trg_ledger_no_delete BEFORE DELETE ON ledger_entries BEGIN SELECT RAISE(ABORT,'LEDGER_IMMUTABLE'); END;

CREATE TABLE expenses (
  id TEXT PRIMARY KEY, outlet_id TEXT, category TEXT NOT NULL, amount INTEGER NOT NULL,
  spent_on TEXT NOT NULL, note TEXT, receipt_key TEXT, created_by TEXT
);

CREATE TABLE cash_shifts (
  id TEXT PRIMARY KEY, outlet_id TEXT, user_id TEXT NOT NULL,
  opened_at INTEGER NOT NULL, opening_cash INTEGER NOT NULL, closed_at INTEGER, closing_cash INTEGER, expected_cash INTEGER, note TEXT
);

CREATE TABLE daily_summary (    -- diperbarui di batch yang sama dengan transaksi
  outlet_id TEXT NOT NULL DEFAULT '', day TEXT NOT NULL,   -- YYYY-MM-DD zona waktu toko
  bookings_count INTEGER NOT NULL DEFAULT 0, rental_income INTEGER NOT NULL DEFAULT 0, fine_income INTEGER NOT NULL DEFAULT 0,
  expense_total INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (outlet_id, day)
);

CREATE TABLE vouchers (
  id TEXT PRIMARY KEY, code TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('percent','amount')),
  value INTEGER NOT NULL, min_total INTEGER NOT NULL DEFAULT 0, quota INTEGER, used_count INTEGER NOT NULL DEFAULT 0,
  starts_at INTEGER, ends_at INTEGER, is_active INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_voucher_code ON vouchers(code);

CREATE TABLE maintenance_logs (
  id TEXT PRIMARY KEY, unit_id TEXT NOT NULL, reason TEXT NOT NULL,
  starts_at INTEGER NOT NULL, ends_at INTEGER, cost INTEGER, done_at INTEGER, note TEXT
);

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY, unit_id TEXT NOT NULL, kind TEXT NOT NULL,   -- out, in, transfer, adjust
  from_outlet_id TEXT, to_outlet_id TEXT, booking_id TEXT, note TEXT, user_id TEXT, created_at INTEGER NOT NULL
);

CREATE TABLE partners (
  id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, phone TEXT,
  share_percent INTEGER NOT NULL CHECK (share_percent BETWEEN 0 AND 100), bank_info TEXT
);
CREATE TABLE partner_settlements (
  id TEXT PRIMARY KEY, partner_id TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
  gross INTEGER NOT NULL, deductions INTEGER NOT NULL DEFAULT 0, net INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('draft','paid')), paid_at INTEGER
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY, channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email','inapp')),
  to_addr TEXT NOT NULL, template TEXT NOT NULL, payload_json TEXT, status TEXT NOT NULL CHECK (status IN ('queued','sent','sent_manual','failed')),
  attempts INTEGER NOT NULL DEFAULT 0, error TEXT, created_at INTEGER NOT NULL, sent_at INTEGER
);
```

### 17.6 Catatan Migrasi dan Performa

- Migrasi berurutan dengan `wrangler d1 migrations`, satu file per perubahan, selalu maju (tanpa edit migrasi lama). Skema Drizzle dijaga sinkron dengan SQL.
- Setiap query daftar wajib memakai index sesuai filter dan urutan data (misal `outlet_id`, `status`, `start_at` atau `occurred_at`). Pantau `rows_read` per endpoint di staging; endpoint yang membaca ribuan baris untuk menampilkan puluhan data harus diperbaiki sebelum rilis, karena baris yang dibaca adalah yang dihitung kuota D1.
- Tabel `daily_summary` memakai upsert (`INSERT ... ON CONFLICT DO UPDATE`) di batch yang sama dengan pencatatan ledger.
- Data identitas (KTP) tidak disimpan di D1, hanya `id_doc_key` yang menunjuk ke R2 privat.

## 18. Aturan Perhitungan

Semua rumus ditulis di `packages/shared/pricing` dan diuji dengan tabel kasus. Nilai pengaturan (jam buka, toleransi, persentase) berasal dari `store_profile.settings_json` dan bisa diubah Owner.

### 18.1 Durasi Sewa

- Durasi dihitung per 24 jam dari jam ambil: `durasi = max(1, ceil((end_at - start_at - toleransi) / 24 jam))`. Toleransi default 60 menit, bisa diatur Owner.
- Contoh: ambil Jumat 09.00, kembali Minggu 09.00 (48 jam) = 2 hari. Kembali Minggu 11.00 (50 jam, lewat toleransi) = 3 hari.
- Harga weekend dan season ditentukan oleh tanggal mulai tiap periode 24 jam.
- Mode hari kalender dan sewa per jam tidak dipakai di v1.

### 18.2 Harga per Item

Urutan penentuan harga per hari untuk satu produk:

1. Harga member (bila pelanggan berstatus member dan ada aturan `member`)
2. Aturan `season` yang berlaku pada tanggal sewa
3. Aturan `weekend` bila rentang mengenai Sabtu atau Minggu (dihitung per hari yang bersangkutan)
4. Aturan `tier` berdasarkan jumlah hari (harga turun bila sewa lebih lama)
5. `base_price_day` produk

Aturan dengan `priority` lebih tinggi menang bila bentrok. `line_total = harga_per_hari × durasi × qty`. Harga disimpan sebagai snapshot di `booking_items`, sehingga perubahan harga tidak memengaruhi booking yang sudah dibuat.

### 18.3 Total Booking

```text
subtotal        = jumlah line_total semua item
discount_total  = diskon voucher (+ diskon paket bila ada)
fee_total       = biaya layanan (bila diaktifkan toko; tidak ada ongkir antar di v1)
total           = subtotal - discount_total + fee_total
jaminan         = identitas KTP/SIM ditahan (bukan uang, tidak masuk total)
```

- Voucher persen dihitung dari `subtotal`, dibatasi `min_total` dan kuota. Satu booking hanya boleh satu voucher.
- Diskon tidak boleh membuat `total` negatif (dibatasi 0).
- Jaminan berupa identitas fisik, bukan uang, sehingga tidak masuk total maupun ledger. Jenis dan status (ditahan atau dikembalikan) dicatat di booking.

### 18.4 DP dan Pelunasan

- DP = persentase dari `total` (default 30%, bisa 0% atau 100% sesuai kebijakan Radix Outdoor), dibulatkan ke atas ke kelipatan Rp1.000.
- Booking online berstatus `pending_payment` sampai DP minimal terkonfirmasi, lalu `confirmed`. Pelunasan paling lambat saat pengambilan.
- Pembayaran lebih dari kekurangan ditolak. Selisih pembulatan dicatat di catatan pembayaran, bukan dibiarkan menggantung.

### 18.5 Denda dan Biaya Tambahan

| Jenis | Rumus default | Catatan |
| --- | --- | --- |
| Terlambat | `ceil((returned_at - end_at - toleransi) / 24 jam) × tarif_denda_per_hari × qty`, atau persentase dari harga per hari | Toleransi default 60 menit. Ada batas maksimum opsional (misal tidak lebih dari nilai harga sewa awal) |
| Rusak ringan | Nominal manual oleh admin, wajib ada catatan dan foto | Dibayar saat pengembalian |
| Rusak berat | Nominal manual hingga nilai perbaikan | Unit pindah ke `maintenance` atau `broken` |
| Hilang | Harga ganti (default `purchase_price` unit atau nominal manual) | Unit pindah ke `lost` |
| Kebersihan | Nominal tetap per item (diatur toko) | Opsional |

Semua denda dicatat di `fines` dan bisa di-waive oleh Owner dengan alasan tertulis (tercatat di audit log).

### 18.6 Perpanjangan dan Pembatalan

- **Perpanjangan:** hanya bila tidak ada reservasi lain pada rentang tambahan (dicek lewat trigger yang sama). Harga tambahan memakai harga snapshot booking, kecuali toko memilih tarif ulang.
- **Pembatalan oleh penyewa** sebelum pengambilan: kebijakan fleksibel, jumlah refund diputuskan Owner per kasus.

Di v1 tidak ada tabel refund otomatis. Saat membatalkan, Owner atau Admin memilih jumlah refund DP (0% sampai 100%) dan mengisi alasan lewat endpoint pembatalan (`refund_amount`, `reason`). Sistem mencatat refund di `payments` (kind `refund`) dan di ledger. Admin boleh memberi refund sampai batas yang ditetapkan Owner di pengaturan, di atas batas itu perlu Owner. Kebijakan umum toko boleh ditulis di S&K, dan aturan refund otomatis per rentang waktu bisa ditambahkan di fase lanjut.

- Pembatalan oleh toko (stok bermasalah) selalu refund 100%.

### 18.7 Pengembalian Identitas Jaminan

```text
total_tagihan = denda terlambat + biaya kerusakan + biaya kehilangan + biaya kebersihan
bila total_tagihan = 0                 : kembalikan identitas, booking boleh diselesaikan
bila total_tagihan > 0 dan sudah lunas : kembalikan identitas
bila total_tagihan > 0 belum lunas     : identitas tetap ditahan sampai lunas atau di-waive Owner (piutang tercatat)
```

Catatan: menahan identitas asli adalah praktik umum di rental, tetapi sering dipertanyakan dari sisi privasi dan hukum. Sebaiknya dikonsultasikan ke ahli hukum, dan pengaturan toko menyediakan opsi deposit uang di fase lanjut sebagai alternatif.

### 18.8 Contoh Perhitungan

Tenda kapasitas 4: Rp40.000/hari. Sleeping bag: Rp15.000/hari × 2. Ambil Jumat 09.00, kembali Senin 09.00 (72 jam, 3 hari), voucher 10%, DP 30%, jaminan KTP ditahan.

| Komponen | Hitungan | Hasil |
| --- | --- | --- |
| Durasi | ceil((72 jam − 1 jam) / 24) | 3 hari |
| Tenda | 40.000 × 3 × 1 | Rp120.000 |
| Sleeping bag | 15.000 × 3 × 2 | Rp90.000 |
| Subtotal | 120.000 + 90.000 | Rp210.000 |
| Voucher 10% | 10% × 210.000 | Rp21.000 |
| Total sewa | 210.000 − 21.000 | Rp189.000 |
| DP 30% | 30% × 189.000 = 56.700, dibulatkan ke atas | Rp57.000 |
| Dibayar saat ambil | 189.000 − 57.000 | Rp132.000 |
| Jaminan | KTP ditahan | Bukan uang |

Bila dikembalikan terlambat 26 jam dengan toleransi 60 menit dan denda Rp20.000/hari per tenda: `ceil((26 − 1) / 24) = 2` hari, denda Rp40.000. Denda dibayar saat pengembalian, lalu KTP dikembalikan. Bila belum dibayar, KTP tetap ditahan sampai lunas atau di-waive Owner.

### 18.9 Bagi Hasil Mitra Konsinyasi

- Persentase tetap per mitra (`partners.share_percent`), berlaku untuk semua unit milik mitra itu.
- Dasar hitung: pendapatan sewa unit milik mitra, yaitu `line_total` item tersebut setelah dikurangi bagian diskon voucher secara proporsional. Biaya layanan dan denda keterlambatan tidak dibagi (milik toko).
- Usulan awal untuk kerusakan atau kehilangan unit mitra: biaya yang dibayar penyewa diteruskan ke mitra sebesar biaya perbaikan atau harga ganti. Aturan ini perlu disepakati dengan mitra dan ditulis di perjanjian konsinyasi.
- Biaya perbaikan unit mitra yang ditanggung toko dikurangkan dari bagian mitra pada periode settlement (`deductions`).
- Bagian mitra dicatat sebagai `partner_payable` di ledger saat booking selesai, dan dilunasi ketika settlement ditandai dibayar.
- Settlement per periode (default bulanan): `net = bagian_mitra - deductions`, status `draft` lalu `paid`.

Contoh: mitra berbagi hasil 70%. Tenda milik mitra disewa 3 hari dengan `line_total` Rp120.000 dan voucher 10%. Pendapatan item = 120.000 − 10% = Rp108.000. Bagian mitra 70% = Rp75.600, bagian toko Rp32.400.

### 18.10 Buffer Antar Sewa

- Reservasi unit mencakup `[start_at, end_at + buffer]`. Default buffer 1 hari penuh (24 jam) setelah jam kembali, disimpan di `settings_json.buffer_hours` dan bisa ditimpa per produk lewat `products.buffer_hours`.
- Akibatnya unit yang dikembalikan Senin 09.00 baru bisa disewa lagi Selasa 09.00. Kalender dan pengecekan ketersediaan di storefront memakai rentang ini.
- Pengembalian lebih awal: saat unit kembali, reservasi dipendekkan menjadi `returned_at + buffer` sehingga unit bisa disewa lagi lebih cepat.
- Perpanjangan: dicek terhadap reservasi lain termasuk buffer, dan buffer dihitung ulang dari `end_at` yang baru.
- Keterlambatan menggeser buffer. Bila booking berikutnya jadi terancam bentrok, staf mendapat peringatan di dashboard. Sistem tidak membatalkan booking apa pun secara otomatis.
- Buffer 0 diperbolehkan untuk produk tertentu (misal aksesori kecil yang tidak perlu dibersihkan).

## 19. State Machine & Alur Status

Setiap perubahan status ditulis ke `booking_status_logs` dalam batch yang sama. Transisi di luar tabel ditolak dengan error `INVALID_TRANSITION`.

### 19.1 Status Booking

| Dari | Ke | Pemicu | Syarat | Efek samping |
| --- | --- | --- | --- | --- |
| (baru) | `pending_payment` | Booking online dibuat | Semua unit lolos trigger overlap, pelanggan tidak diblokir | Reservasi unit dibuat, `expires_at` diisi |
| (baru) | `confirmed` | Booking manual dengan DP lunas atau tanpa DP | Sama seperti di atas | Reservasi dibuat, notifikasi dikirim |
| `pending_payment` | `confirmed` | DP terkonfirmasi | `paid_total >= DP` | Notifikasi konfirmasi |
| `pending_payment` | `expired` | Cron auto-expire | `expires_at` terlewati | Reservasi dilepas (`released_at`) |
| `pending_payment` / `confirmed` | `cancelled` | Penyewa atau staf membatalkan | Sebelum pengambilan | Reservasi dilepas, refund diputuskan Owner per kasus (18.6) |
| `confirmed` | `picked_up` | Serah-terima | Pelunasan selesai, inspeksi `pickup` untuk semua item, identitas jaminan diterima dan jenisnya dicatat | Unit ditandai keluar, `stock_movements` out, `collateral_status` = `held` |
| `picked_up` | `returned` | Pengembalian | Inspeksi `return` untuk semua item | `returned_at` diisi, denda dihitung |
| `returned` | `completed` | Penutupan | Denda lunas atau di-waive, identitas jaminan sudah dikembalikan | Ledger final, `collateral_status` = `returned`, notifikasi terima kasih |

Status terlambat bukan status tersimpan: booking `picked_up` dengan `end_at` terlewati ditampilkan sebagai "Terlambat" (dihitung saat query) dan memicu pengingat.

### 19.2 Pengembalian Parsial

Booking tetap `picked_up` sampai semua item kembali. Setiap item yang kembali mendapat inspeksi `return` sendiri dan reservasinya dilepas. Denda terlambat dihitung per item sesuai waktu kembalinya.

### 19.3 Status Unit

| Dari | Ke | Pemicu |
| --- | --- | --- |
| `available` | `maintenance` | Jadwal servis atau hasil inspeksi rusak ringan |
| `available` | `broken` | Inspeksi rusak berat |
| `available` | `lost` | Inspeksi hilang |
| `maintenance` | `available` | Servis selesai (`maintenance_logs.done_at`) |
| `broken` | `available` / `retired` | Diperbaiki atau dihapus dari inventori |
| semua | `retired` | Owner menonaktifkan unit |

Unit selain `available` tidak ikut perhitungan ketersediaan. Maintenance terjadwal juga membuat reservasi `kind = 'maintenance'` agar memblokir kalender.

### 19.4 Status Pembayaran

- `pending` lalu `confirmed` atau `rejected`. Pembayaran tunai oleh kasir langsung `confirmed`.
- Transfer manual: penyewa mengunggah bukti, status `pending`, admin memeriksa lalu konfirmasi atau tolak dengan alasan.
- Hanya pembayaran `confirmed` yang menambah `paid_total` dan menulis ledger.
- Koreksi dilakukan dengan entri pembalik (`reverses_id`), bukan edit.

### 19.5 Pengaturan Penerimaan Booking

- Radix Outdoor tidak memiliki status trial, grace, suspended, atau penagihan langganan aplikasi.
- Owner dapat mengatur `store_profile.settings_json.accepting_bookings` (default `true`). Saat `false`, katalog tetap dapat dibuka dengan pemberitahuan, sedangkan checkout dan pembuatan booking baru ditolak dengan `STORE_NOT_ACCEPTING_BOOKINGS`. Booking yang sudah ada tetap dapat dilayani staf.
- Perubahan dicatat di audit log. Status aktif/nonaktif outlet memakai `outlets.is_active`; penonaktifan tidak menghapus transaksi atau kewajiban pengembalian yang berjalan.

## 20. Matriks Hak Akses

K = kelola penuh (lihat, buat, ubah, hapus), L = lihat saja, B = buat/ubah terbatas (dijelaskan di catatan), - = tidak ada akses. Izin disimpan sebagai kode permission (misal `booking.create`) yang dipetakan ke peran, sehingga Owner bisa menyesuaikan peran Admin dan Gudang tanpa mengubah kode.

| Modul | Owner | Admin/Kasir | Gudang | Mitra | Penyewa |
| --- | --- | --- | --- | --- | --- |
| Pengaturan toko dan S&K | K | - | - | - | - |
| Pengguna dan peran | K | L | - | - | - |
| Kategori dan produk | K | L | L | L (milik sendiri) | L (publik) |
| Unit dan QR | K | L | B (status dan kondisi) | L (milik sendiri) | - |
| Harga dan aturan harga | K | L | - | - | L (hasil hitung) |
| Booking | K | K | L | - | B (booking sendiri) |
| Serah-terima dan pengembalian | K | K | B (inspeksi) | - | - |
| Pembayaran | K | B (catat, konfirmasi) | - | - | B (unggah bukti) |
| Denda dan waive | K | B (buat, tidak waive) | B (usul kerusakan) | - | L (milik sendiri) |
| Ledger dan shift kasir | K | B (shift sendiri) | - | - | - |
| Pengeluaran | K | B (catat) | - | - | - |
| Pelanggan dan blacklist | K | B (tidak hapus) | - | - | B (profil sendiri) |
| Voucher | K | L | - | - | B (pakai) |
| Konsinyasi dan settlement | K | L | - | L (milik sendiri) | - |
| Laporan | K | L (terbatas harian) | - | L (milik sendiri) | - |
| Notifikasi dan template | K | L | - | - | - |
| Audit log | L (toko sendiri) | - | - | - | - |

### Catatan Aturan Akses

- Peran dengan `outlet_id` hanya melihat data outlet itu. Owner melihat semua outlet.
- Penyewa hanya melihat booking dan pembayaran milik `customer_id` melalui kombinasi kode booking acak + nomor WhatsApp (tanpa akun di v1).
- Mitra hanya melihat unit dengan `owner_partner_id` miliknya dan ringkasan pendapatannya, tanpa data pelanggan.
- Waive denda, ubah harga di booking berjalan, dan pembalikan ledger hanya boleh Owner.
- Aksi tanpa permission mengembalikan 403. Akses ke record di luar cakupan outlet atau kepemilikan mitra/penyewa mengembalikan 404 tanpa membocorkan keberadaan record. Aturan ini berlaku juga untuk PDF, ekspor, dan akses berkas privat.

## 21. Spesifikasi API

Base path `/api/v1`, selalu untuk Radix Outdoor. Kolom Auth: P = publik, C = penyewa login (fase lanjut), S = staf (izin sesuai bagian 20). Penyewa tamu memverifikasi kode booking + nomor WhatsApp atau token akses terbatas yang diterbitkan setelah verifikasi untuk aksi pada booking sendiri; ID booking saja tidak memberikan akses. Input outlet harus divalidasi terhadap cakupan akses. Format respons dan kode error mengikuti 16.7.

### 21.1 Publik dan Penyewa (storefront)

| Method | Path | Auth | Fungsi |
| --- | --- | --- | --- |
| GET | `/store` | P | Profil toko, jam buka, tema, S&K (cache) |
| GET | `/categories` | P | Pohon kategori |
| GET | `/products` | P | Daftar produk, filter `category`, `q`, `price_min`, `price_max`, `available_from`, `available_to` |
| GET | `/products/:slug` | P | Detail produk, galeri, spesifikasi, aturan harga ringkas |
| GET | `/products/:id/availability` | P | Kalender ketersediaan per hari untuk rentang tanggal |
| GET | `/bundles` | P | Daftar paket |
| POST | `/quote` | P | Hitung harga dari keranjang (tanggal, item, voucher), tanpa menyimpan |
| POST | `/bookings` | P/C | Buat booking (wajib `Idempotency-Key`), mengembalikan kode dan batas bayar |
| GET | `/bookings/lookup` | P | Cari booking dengan `code` + `phone` |
| GET | `/me/bookings` | C | Ditunda (penyewa tanpa akun di v1) |
| POST | `/bookings/:id/cancel` | P/C | Batalkan booking milik sendiri |
| POST | `/bookings/:id/payment-proof` | P/C | Unggah bukti transfer (file ke R2) |
| POST | `/auth/otp/request` | P | Ditunda: dipakai bila akun penyewa ditambahkan |
| POST | `/auth/otp/verify` | P | Ditunda: dipakai bila akun penyewa ditambahkan |
| POST | `/uploads/id-document` | P/C | Unggah KTP (URL unggah bertanda tangan, bucket privat) |

### 21.2 Dashboard Toko (staf)

| Method | Path | Fungsi |
| --- | --- | --- |
| POST | `/auth/login`, `/auth/logout` | Login dan logout staf |
| GET/PATCH | `/settings` | Pengaturan toko, kebijakan denda, jaminan identitas, S&K |
| GET/POST/PATCH | `/users`, `/users/:id` | Kelola staf dan peran |
| GET/POST/PATCH/DELETE | `/categories`, `/products`, `/bundles` | CRUD katalog (DELETE = soft delete) |
| POST | `/products/import` | Impor CSV produk dan unit |
| GET/POST/PATCH | `/units`, `/units/:id` | Kelola unit, ubah status |
| GET | `/units/:id/qr` | Label QR/barcode untuk cetak |
| GET/POST | `/price-rules`, `/vouchers` | Aturan harga dan voucher |
| GET | `/bookings` | Daftar booking (filter status, tanggal, kanal, cursor) |
| POST | `/bookings/manual` | Booking oleh kasir (walk-in, WhatsApp) |
| GET/PATCH | `/bookings/:id` | Detail dan ubah (tanggal, item) dengan hitung ulang dan cek stok |
| POST | `/bookings/:id/extend` | Perpanjang sewa |
| POST | `/bookings/:id/cancel` | Batalkan oleh toko |
| POST | `/bookings/:id/pickup` | Serah-terima: pelunasan, terima identitas jaminan, inspeksi per item, tanda tangan |
| POST | `/bookings/:id/return` | Pengembalian (bisa parsial): inspeksi, hitung denda |
| POST | `/bookings/:id/complete` | Tutup booking setelah denda lunas dan identitas dikembalikan |
| POST | `/bookings/:id/payments` | Catat pembayaran (wajib `Idempotency-Key`) |
| POST | `/payments/:id/confirm`, `/payments/:id/reject` | Verifikasi transfer penyewa |
| POST | `/fines`, `/fines/:id/waive` | Buat denda, waive (Owner) |
| GET | `/bookings/:id/documents/:type` | PDF `invoice`, `receipt`, `agreement`, `delivery-note` |
| GET/POST | `/customers`, `/customers/:id` | Pelanggan, blacklist |
| GET/POST | `/shifts/open`, `/shifts/:id/close` | Buka dan tutup kas |
| GET/POST | `/expenses` | Pengeluaran |
| GET/POST | `/maintenance` | Jadwal servis (memblokir kalender) |
| POST | `/stock/opname` | Stok opname dan selisih |
| GET | `/reports/:name` | `sales`, `utilization`, `top-products`, `cashflow`, `receivables`, `partner`, format `json` / `csv` |
| GET | `/dashboard/summary` | Angka dashboard (membaca `daily_summary`) |
| GET | `/audit-logs` | Riwayat perubahan (Owner) |
| GET/POST | `/partners`, `/partners/:id/settlements` | Konsinyasi dan bagi hasil |

### 21.3 Outlet & Portal Mitra

| Method | Path | Auth | Fungsi |
| --- | --- | --- | --- |
| GET/POST/PATCH | `/outlets`, `/outlets/:id` | S | Owner mengelola outlet; staf hanya melihat outlet yang diizinkan |
| POST | `/stock/transfers` | S | Pindahkan unit antar outlet dengan izin untuk outlet sumber dan tujuan; catat pergerakan stok |
| GET | `/partner/units` | Mitra | Unit milik mitra dari sesi terautentikasi |
| GET | `/partner/earnings`, `/partner/settlements` | Mitra | Ringkasan pendapatan dan settlement milik mitra, tanpa data pribadi penyewa |

Portal mitra memakai email/password dan sesi yang sama mekanismenya dengan staf, dengan role `partner`. Endpoint tidak menerima identitas mitra sebagai sumber otorisasi dari klien.

### 21.4 Webhook (fase lanjut)

`POST /webhooks/midtrans` dan `POST /webhooks/whatsapp` dirancang idempotent dan memverifikasi tantangan permintaan. Di v1 tidak ada webhook yang aktif. Pada fase lanjut, Midtrans memproses status pembayaran sewa dan WhatsApp memproses status pengiriman pesan sesuai kemampuan provider.

### 21.5 Contoh Kontrak: Buat Booking

```json
POST /api/v1/bookings
Idempotency-Key: 01J9Z3...
{
  "customer": { "name": "Budi", "phone": "+6281234567890", "id_doc_key": "idc/01J9..." },
  "start_at": "2026-11-06T09:00:00+07:00",
  "end_at":   "2026-11-09T09:00:00+07:00",
  "items": [ { "product_id": "01J...", "qty": 1 }, { "product_id": "01J...", "qty": 2 } ],
  "voucher_code": "NOVEMBER10",
  "channel": "online"
}

201 Created
{ "ok": true, "data": { "id": "01J...", "code": "RX-2611-0042", "status": "pending_payment",
  "total": 189000, "dp_required": 57000, "collateral_required": "ktp_or_sim", "expires_at": "2026-11-04T14:30:00+07:00" } }

409 Conflict
{ "ok": false, "error": { "code": "UNIT_NOT_AVAILABLE", "message": "Tenda kapasitas 4 tidak tersedia pada tanggal tersebut" } }
```

Server memilih unit fisik yang bebas secara otomatis (unit dengan riwayat pakai paling sedikit lebih dulu), lalu membuat booking, item, dan reservasi dalam satu `db.batch()`. Bila trigger overlap menggagalkan batch karena unit terambil bersamaan, server mencoba unit lain sampai tiga kali sebelum mengembalikan `UNIT_NOT_AVAILABLE`.

### 21.6 Hubungan dengan UI Server-Rendered

Karena UI dirender di server (Hono JSX + HTMX), kontrak di 21.1 sampai 21.5 berlaku sebagai kontrak layanan, bukan satu-satunya bentuk akses:

- Semua aturan bisnis ada di service layer (`services/*`). Route HTML dan route JSON sama-sama memanggil service itu, jadi aturan harga, stok, dan status tidak ditulis dua kali.
- Route HTML: storefront di `/`, `/produk/:slug`, `/keranjang`, `/checkout`, `/booking/:kode`; dashboard toko di `/admin/...`; portal mitra di `/mitra/...`.
- Satu URL melayani halaman penuh atau fragmen: bila header `HX-Request` ada, server hanya mengembalikan potongan HTML yang diganti HTMX (hasil filter, ringkasan harga, baris tabel).
- Validasi form: error Zod dirender ulang sebagai fragmen form dengan status 422, tanpa JavaScript tambahan.
- Idempotency-Key untuk form POST berupa token tersembunyi yang dibuat server saat form dirender, sehingga klik ganda tidak membuat data dobel.
- CSRF: token disertakan lewat `hx-headers` dan field tersembunyi di form biasa.
- Endpoint JSON `/api/v1` tetap dipertahankan hanya untuk kebutuhan yang memerlukannya: webhook (fase lanjut), ekspor data, integrasi di masa depan, dan test otomatis.
- Cache: halaman publik (katalog, detail produk) di-cache di edge dengan kunci URL, outlet, dan filter katalog yang relevan dan di-invalidate saat produk berubah. Halaman admin selalu `no-store`.

### 21.7 QRIS Statis yang Dibuat Dinamis

Penyewa membayar DP atau pelunasan sewa melalui QRIS Radix Outdoor dari QRIS statis yang dibuat dinamis oleh aplikasi, dengan verifikasi pembayaran manual.

- Payload QRIS statis disimpan di pengaturan: `store_profile.settings_json.qris_static_payload` (terenkripsi; kunci melalui secret). Pemilik bisa menempel teks payload, atau mengunggah gambar QR yang di-decode sekali di server lalu payload-nya disimpan.
- Saat penyewa membuka halaman Instruksi bayar, server membuat payload dinamis: ubah Point of Initiation Method (tag 01) dari statis ke dinamis, sisipkan Transaction Amount (tag 54) berisi nominal DP, lalu hitung ulang CRC16 (tag 63). Hasilnya dirender sebagai QR (SVG).
- Rute: `GET /booking/:kode/qris` (HTML) dan `GET /api/v1/bookings/:id/qris`.
- Nominal terkunci pada DP atau pelunasan saat QR dibuat. Bila booking berubah, QR dibuat ulang.
- Verifikasi pembayaran tetap manual. Tanpa payment gateway tidak ada callback, jadi penyewa mengunggah bukti, staf mencocokkan dengan mutasi atau notifikasi merchant, lalu mengonfirmasi (lihat 19.4). Payload QR juga tidak punya masa berlaku sungguhan, jadi `expires_at` booking hanya berlaku di sisi aplikasi.
- Opsional (default mati): kode unik tiga digit di nominal agar mudah dicocokkan dengan mutasi. Bila dipakai, selisih kode unik harus punya aturan pencatatan sendiri di ledger.
- Belum diverifikasi: apakah penambahan nominal pada QRIS statis diizinkan oleh ketentuan penyedia atau bank penerbit QRIS toko. Cek dulu ke penyedia. Bila tidak diizinkan, tampilkan QRIS statis apa adanya dan minta penyewa mengetik nominal.
- Uji: unit test untuk penyusunan tag dan CRC16, serta uji scan hasilnya dengan beberapa aplikasi m-banking dan e-wallet sebelum rilis.

## 22. Daftar Layar & Komponen UI

Prinsip: mobile-first (penyewa dan kasir sama-sama memakai HP), tombol utama selalu terjangkau ibu jari, formulir pendek, dan semua daftar punya keadaan kosong, memuat, dan gagal. Prioritas: P1 wajib MVP, P2 fase 2, P3 fase 3 dan seterusnya.

### 22.1 Storefront (penyewa)

| Layar | Isi dan komponen kunci | Prioritas |
| --- | --- | --- |
| Beranda | Banner, kategori, produk populer, paket, tombol WhatsApp melayang | P1 |
| Katalog | Grid produk, filter kategori/harga/kapasitas, pemilih tanggal yang memfilter ketersediaan | P1 |
| Detail produk | Galeri, spesifikasi, harga per hari dan aturan tier, kalender ketersediaan, tombol "Tambah ke sewa" | P1 |
| Keranjang sewa | Tanggal ambil dan kembali, daftar item, ringkasan harga langsung dari `/quote`, kode voucher | P1 |
| Checkout | Data diri, unggah foto KTP untuk verifikasi, ringkasan DP, info jaminan identitas saat ambil, centang S&K | P1 |
| Instruksi bayar | QRIS dinamis (nominal otomatis), nomor rekening toko, jumlah DP, hitung mundur batas bayar, unggah bukti transfer | P1 |
| Status booking | Kode booking, timeline status, tombol batalkan, tombol WhatsApp ke toko | P1 |
| Cari booking | Input kode + nomor WhatsApp | P1 |
| Halaman statis | Cara sewa, S&K, FAQ, kontak dan peta | P1 |
| Akun penyewa (ditunda) | Login OTP, riwayat booking, sewa ulang cepat (setelah evaluasi rilis awal) | P2 |
| Ulasan produk | Rating dan komentar setelah selesai | P3 |

### 22.2 Dashboard Toko

| Layar | Isi dan komponen kunci | Prioritas |
| --- | --- | --- |
| Beranda dashboard | Kartu: booking hari ini, diambil hari ini, jatuh tempo kembali, terlambat, omzet bulan ini; daftar tugas hari ini | P1 |
| Kalender | Tampilan bulan dan minggu per unit/produk, blok booking dan maintenance, klik untuk detail | P1 |
| Daftar booking | Tab per status, pencarian kode/nama/nomor, filter tanggal | P1 |
| Buat booking manual | Pilih tanggal, cari produk, pilih pelanggan atau buat baru, ringkasan harga, bayar DP | P1 |
| Detail booking | Header status, item, pembayaran, denda, riwayat status, tombol aksi sesuai status berikutnya, cetak dokumen | P1 |
| Serah-terima | Pindai QR unit, checklist kelengkapan, foto, tanda tangan layar sentuh, pelunasan, catat identitas jaminan yang diterima | P1 |
| Pengembalian | Pindai QR, pilih kondisi, foto, hitung denda otomatis, kembalikan identitas setelah denda lunas | P1 |
| Produk dan unit | Tabel produk, form produk (multi-foto), daftar unit per produk, tombol cetak label QR | P1 |
| Kategori | Pohon yang bisa diurutkan | P1 |
| Outlet dan transfer stok | Daftar cabang, stok per outlet, pindah unit antar outlet | P1 |
| Mitra dan settlement | Daftar mitra, unit milik mitra, perhitungan periode, tandai dibayar | P1 |
| Pelanggan | Daftar, riwayat sewa, penanda blacklist | P2 |
| Voucher dan aturan harga | Form dan daftar | P2 |
| Kas dan shift | Buka kas, tutup kas, selisih | P2 |
| Pengeluaran | Catat dan kategori | P2 |
| Laporan | Penjualan, utilisasi, terlaris, arus kas, piutang, bagi hasil mitra, ekspor CSV/XLSX | P2 |
| Maintenance dan stok opname | Jadwal servis, hitung fisik | P2 |
| Pengaturan | Profil toko, jam buka, kebijakan denda dan jaminan, rekening bayar, template pesan, pengguna dan peran | P1 |

### 22.3 Portal Mitra

| Layar | Isi | Prioritas |
| --- | --- | --- |
| Login mitra | Email dan kata sandi; akses hanya untuk akun mitra aktif | P1 |
| Unit titipan | Unit milik mitra, lokasi outlet, kondisi, dan ketersediaan | P1 |
| Pendapatan | Ringkasan pendapatan sewa dan bagian mitra per periode | P1 |
| Settlement | Daftar periode, potongan, nilai bersih, status dan bukti pembayaran | P1 |

Mitra tidak dapat melihat dokumen identitas, kontak penyewa, keuangan toko secara keseluruhan, atau data milik mitra lain.

### 22.4 Komponen Bersama

- Pemilih rentang tanggal dan jam (zona waktu toko), dengan tanggal penuh ditandai.
- Badge status berwarna konsisten (satu peta warna untuk booking, unit, pembayaran).
- Pemindai QR (kamera HP lewat `getUserMedia`, dengan input manual sebagai cadangan).
- Unggah foto dengan kompresi di klien sebelum dikirim, pratinjau, dan batas ukuran.
- Papan tanda tangan (canvas) yang menyimpan PNG ke R2.
- Tabel dengan paginasi cursor, pencarian, dan keadaan kosong yang menjelaskan langkah berikutnya.
- Notifikasi toast untuk sukses dan error, dengan pesan dari kode error domain (16.7).
- Mode kasir cepat: layar serah-terima dan pengembalian dirancang bisa diselesaikan dalam maksimal tiga ketukan per item setelah QR terpindai.

### 22.5 Keadaan Khusus yang Harus Ditangani

- Unit tiba-tiba tidak tersedia saat checkout (tampilkan pesan dan tawarkan produk serupa atau tanggal lain).
- Koneksi putus saat unggah foto atau bayar (tombol coba lagi, tanpa membuat data dobel berkat `Idempotency-Key`).
- Penerimaan booking dinonaktifkan Owner: tampilkan pemberitahuan, cegah checkout baru, dan tetap layani booking berjalan (19.5).
- Penyewa diblacklist (staf melihat peringatan; booking online ditolak dengan pesan netral yang mengarahkan ke toko).

### 22.6 Pola Implementasi UI Server-Rendered

- **Progressive enhancement:** storefront berfungsi tanpa JavaScript (bagus untuk SEO dan HP lama). HTMX hanya menambah interaksi mulus.
- **Pola HTMX:** pencarian dan filter katalog dengan `hx-get` yang mengganti daftar produk, ringkasan harga keranjang yang diperbarui lewat `hx-post` ke `/quote`, polling ringan untuk status pembayaran (`hx-trigger="every 15s"`), dan paginasi cursor dengan tombol "muat lagi".
- **Kalender:** tampilan bulan dan minggu dirender sebagai grid HTML di server, navigasi antar bulan lewat HTMX.
- **Laporan:** tabel dan grafik sederhana berupa SVG yang dirender server. Library grafik berat tidak dipakai di v1.
- **Pemilih tanggal dan jam:** input `date` dan `time` bawaan browser, dengan validasi ketersediaan di server.
- **JavaScript kecil yang tetap diperlukan (dibundel ke aset statis):** pemindai QR dengan kamera (`getUserMedia`), papan tanda tangan (canvas), kompres foto sebelum unggah, dan tombol salin ke clipboard. Masing-masing berdiri sendiri per halaman, tanpa framework.
- **Keamanan:** CSP dengan nonce untuk skrip yang dibutuhkan, dan semua output JSX otomatis di-escape.
- **Risiko:** biaya CPU render JSX per request harus diukur di staging, karena batas CPU Worker ketat. Fragmen kecil lebih murah daripada merender halaman penuh, jadi interaksi sering dibuat sebagai fragmen.
- **Testing:** komponen JSX diuji dengan Vitest (render ke string), alur penuh di HP diuji dengan Playwright.

## 23. Keamanan, Auth & Privasi

### 23.1 Autentikasi

| Peran | Metode | Catatan |
| --- | --- | --- |
| Penyewa | Tanpa login (tamu) di v1 | Status booking dibuka lewat kode booking acak (minimal 10 karakter) + nomor WhatsApp, dengan rate limit dan tanpa membocorkan apakah kode ada. OTP (6 digit, 5 menit, 5 percobaan) dipakai saat akun penyewa ditambahkan |
| Owner dan staf Radix Outdoor | Email + kata sandi | Kata sandi di-hash dengan PBKDF2 (Web Crypto) dan salt unik, jumlah iterasi disetel setelah uji CPU. 2FA opsional untuk Owner di fase 2 |
| Mitra | Email + kata sandi | Sama seperti staf, dengan izin terbatas |

Hashing kata sandi memakan CPU dan batas CPU Worker ketat, jadi login staf harus diuji beban di staging dan iterasi disetel sesuai batas paket yang dipakai. Penyewa tidak punya kata sandi (tamu), jadi beban ini hanya berlaku untuk staf dan mitra.

### 23.2 Sesi

- Token sesi acak 32 byte, disimpan di cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Di database hanya hash-nya (`sessions.token_hash`).
- Masa berlaku staf 12 jam dengan perpanjangan saat aktif, penyewa tanpa sesi di v1 (tamu). Logout dan ubah kata sandi mencabut semua sesi.
- Cookie dibatasi pada host aplikasi tanpa atribut `Domain` yang memperluas cakupan. Sesi staging dan produksi terpisah, dengan secret dan database masing-masing.
- Perlindungan CSRF dengan token untuk metode mengubah data dari browser.

### 23.3 Otorisasi & Pembatasan Akses

- `authorize(permission)` di setiap rute terlindungi, default menolak. Endpoint publik hanya membuka katalog terbit dan operasi tamu yang diizinkan.
- Cakupan akses berasal dari sesi server: Owner lintas outlet; staf sesuai penugasan outlet; mitra sesuai kepemilikan; penyewa sesuai booking yang sudah diverifikasi.
- Data-access layer menerapkan `accessScope` pada baca, perubahan, ekspor, PDF, dan berkas privat. Filter klien hanya boleh mempersempit cakupan ini.
- Untuk tabel turunan tanpa `outlet_id`, repo memeriksa cakupan melalui relasi induk (misal pembayaran melalui booking, inspeksi melalui item/unit).
- Test otomatis membuat dua outlet, dua mitra, dan dua penyewa, lalu membuktikan penolakan akses ke record di luar izin. Owner tetap dapat melihat seluruh outlet.
- Satu database per environment hanya menyimpan Radix Outdoor. Tidak ada impersonasi atau akun platform dengan hak akses tersembunyi.

### 23.4 Perlindungan Data dan Berkas

| Data | Perlakuan |
| --- | --- |
| KTP/identitas | R2 bucket privat, akses lewat signed URL berumur pendek (misal 5 menit), hanya Owner dan Admin, setiap akses dicatat di audit log. Pertimbangkan enkripsi sisi aplikasi dengan kunci di secret |
| Bukti transfer | R2 privat, akses oleh Admin/Owner dan penyewa pemilik |
| Foto alat | R2 publik lewat CDN, nama berkas acak |
| Kata sandi dan OTP | Hanya hash, tidak pernah dicatat di log |
| Nomor telepon dan email | Dimasker di log (misal `0812****7890`) |

Pembatasan unggahan: tipe MIME diperiksa di server (bukan hanya ekstensi), ukuran maksimum (misal 5 MB foto, 2 MB tanda tangan), dan nama berkas diganti dengan ID acak.

### 23.5 Perlindungan Aplikasi

- Validasi semua input dengan Zod (body, query, params). Query selalu terparameter lewat Drizzle atau `prepare().bind()`, tanpa string SQL gabungan.
- Output di frontend di-escape oleh framework. Deskripsi produk dan S&K yang berformat dibersihkan (sanitasi HTML) sebelum disimpan.
- Header keamanan: CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS.
- Rate limit: login (per IP dan per akun), OTP, pembuatan booking, unggahan. Respons 429 dengan `Retry-After`.
- Proteksi bot di formulir publik (Turnstile atau sejenisnya) bila terjadi penyalahgunaan.
- Dependensi dipindai berkala dan versi dikunci. Secret hanya lewat `wrangler secret`, tidak pernah di repo.

### 23.6 Privasi dan Kepatuhan

- Persetujuan penyewa untuk penyimpanan data identitas dicatat saat checkout (centang beserta versi S&K).
- Retensi: dokumen identitas dihapus otomatis N hari setelah booking selesai tanpa sengketa (default 90 hari, bisa diatur toko). Data transaksi dan ledger disimpan sesuai kebutuhan akuntansi toko.
- Permintaan hapus atau anonimkan data pelanggan ditangani Owner lewat fitur khusus (nama dan kontak dianonimkan, transaksi tetap ada untuk laporan).
- Kebijakan privasi dan S&K Radix Outdoor tersedia di storefront, termasuk tujuan penyimpanan identitas, retensi, serta kontak pengajuan penghapusan/anonimisasi data.

### 23.7 Backup dan Pemulihan

- Ekspor terjadwal harian D1 ke R2 (bucket terpisah, retensi 30 hari) dan uji restore setiap bulan.
- Rencana pemulihan tertulis: siapa yang menjalankan, langkahnya, target waktu pulih. Target awal: kehilangan data maksimal 24 jam dan pulih dalam beberapa jam.
- Sebelum migrasi skema di produksi, ekspor data dulu.

## 24. Job Terjadwal, Notifikasi & Operasional

### 24.1 Job Terjadwal (Cron Triggers)

| Job | Jadwal (usulan) | Tugas |
| --- | --- | --- |
| `expire-bookings` | Tiap 5 menit | Ubah `pending_payment` yang lewat `expires_at` menjadi `expired`, lepas reservasi |
| `remind-pickup` | Tiap jam | Muncul di daftar tugas pengingat (tombol kirim WhatsApp) H-1 dan 3 jam sebelum `start_at` |
| `remind-return` | Tiap jam | Daftar tugas: pengingat jatuh tempo (3 jam sebelum `end_at`), pesan keterlambatan |
| `daily-report` | Harian | Kirim ringkasan ke Owner (opsional) |
| `purge-id-docs` | Harian | Hapus dokumen identitas yang melewati retensi |
| `backup-d1` | Harian | Ekspor D1 ke R2 |

Cron mengantre pekerjaan Radix Outdoor ke Queue dalam batch terbatas, misalnya per rentang waktu, outlet, atau kelompok booking, agar tidak melewati batas eksekusi Worker. Konsumer menerapkan retry dan pencatatan kegagalan. Setiap job idempotent (aman dijalankan ulang); payload job internal tetap divalidasi dan tidak memberi akses publik.

### 24.2 Template Notifikasi

Semua template bisa disesuaikan Owner dengan variabel `{nama}`, `{kode}`, `{toko}`, `{tanggal_ambil}`, `{tanggal_kembali}`, `{total}`, `{sisa}`, `{link}`.

| Kode template | Penerima | Pemicu |
| --- | --- | --- |
| `booking_created` | Penyewa | Booking online dibuat, berisi instruksi bayar dan batas waktu |
| `booking_new_staff` | Staf | Booking baru masuk |
| `payment_proof_received` | Staf | Bukti transfer diunggah |
| `payment_confirmed` | Penyewa | DP atau pelunasan dikonfirmasi |
| `payment_rejected` | Penyewa | Bukti ditolak, dengan alasan |
| `booking_expired` | Penyewa | Booking kedaluwarsa |
| `pickup_reminder` | Penyewa | H-1 sebelum ambil |
| `return_reminder` | Penyewa | Menjelang jatuh tempo kembali |
| `late_notice` | Penyewa | Lewat jatuh tempo, menyebut denda per hari |
| `booking_cancelled` | Penyewa | Dibatalkan, dengan info refund |
| `thank_you_review` | Penyewa | Setelah selesai |
| `stock_low` | Owner | Stok produk di bawah minimum |

Di v1 pesan WhatsApp dikirim semi-manual: dashboard menampilkan tombol "Kirim WhatsApp" yang membuka `wa.me/<nomor>?text=<pesan>` dengan template yang sudah terisi variabel, lalu staf menekan kirim sendiri. Saat tombol ditekan, `notifications` mencatat status `sent_manual` agar pesan yang sama tidak terkirim dua kali. Email tetap otomatis lewat Queue dengan retry bertahap (misal 1, 5, 30 menit, maksimal 5 kali) bila penyewa mengisinya. Gateway WhatsApp otomatis dipertimbangkan setelah rilis awal. Kegagalan kirim tidak boleh menggagalkan transaksi bisnis.

### 24.3 Environment

| Environment | Fungsi | Data |
| --- | --- | --- |
| local | Pengembangan | D1 lokal (wrangler dev), seed contoh |
| staging | Uji integrasi dan uji beban | D1 terpisah, data dummy, domain `radix-outdoor-staging.<akun>.workers.dev` |
| production | Pengguna nyata | D1 produksi, backup harian |

Setiap environment punya binding dan secret sendiri di `wrangler.jsonc`. Migrasi dijalankan ke staging dulu, lalu produksi.

### 24.4 CI/CD

1. Pull request memicu lint, typecheck, unit test, dan test integrasi API.
2. Test RBAC, cakupan outlet, kepemilikan mitra/penyewa, dan overlap booking wajib hijau.
3. Merge ke `main` otomatis deploy ke staging beserta migrasi.
4. Rilis ke produksi lewat tag atau persetujuan manual, dengan migrasi dijalankan sebelum kode baru aktif. Perubahan skema dibuat kompatibel mundur (tambah kolom dulu, hapus belakangan).
5. Rollback: deploy ulang versi sebelumnya (kode), migrasi tidak di-rollback, diperbaiki dengan migrasi baru.

Repo di GitHub dengan CI/CD GitHub Actions. Deploy memakai `wrangler deploy` dan API token Cloudflare disimpan sebagai GitHub Secret (bukan di repo). Branch `main` diproteksi (wajib PR dan CI hijau), dan GitHub Environments `staging` dan `production` dipakai, dengan persetujuan manual untuk produksi.

### 24.5 Strategi Testing

| Level | Cakupan | Alat usulan |
| --- | --- | --- |
| Unit | Rumus harga, denda, durasi, pembulatan DP, transisi status (tabel kasus dari bagian 18 dan 19) | Vitest |
| Integrasi API | Alur booking sampai selesai terhadap D1 lokal, termasuk Idempotency-Key | Vitest + Miniflare/wrangler |
| Konkurensi | Dua booking bersamaan untuk unit yang sama, hanya satu berhasil | Skrip beban kecil |
| Otorisasi | Dua outlet, dua mitra, dan dua penyewa: akses di luar izin ditolak, Owner dapat mengakses semua outlet | Test otomatis |
| End-to-end | Booking online, serah-terima, pengembalian di HP | Playwright |
| Beban | Rows read per endpoint, waktu respons di bawah target | Pengukuran di staging |

### 24.6 Observability

- Log terstruktur berisi `requestId`, `outletId` (bila relevan), `route`, `status`, `durasi`. Tidak memuat data pribadi.
- Metrik utama: error rate, p95 latensi, `rows_read` dan `rows_written` per endpoint, panjang antrian, tingkat gagal notifikasi.
- Alert: error rate tinggi, antrian menumpuk, kuota D1 mendekati batas, job tidak jalan.
- Halaman status internal khusus Owner: kesehatan job terakhir dan usia ekspor backup terakhir.

## 25. Setup Awal & Konfigurasi Radix Outdoor

### 25.1 Identitas Aplikasi

| Elemen | Nilai |
| --- | --- |
| Brand dan nama toko | Radix Outdoor |
| Model aplikasi | Single tenant, satu bisnis dengan dukungan banyak outlet |
| Nama proyek/Worker | `radix-outdoor` |
| Alamat awal | `radix-outdoor.<akun>.workers.dev` (placeholder akun, bukan domain aktif) |
| Prefiks contoh kode booking | `RX` |
| Mata uang | IDR, integer rupiah |
| Zona waktu default | Asia/Jakarta; konfirmasi sesuai lokasi operasional |

### 25.2 Prosedur Setup Pertama

1. Buat binding D1, R2, KV, Queue, dan Browser Rendering per environment.
2. Jalankan migrasi awal dan seed idempotent untuk satu `store_profile` (`id = 1`, nama Radix Outdoor), akun Owner, serta outlet awal. Seed tidak menimpa pengaturan atau kredensial yang sudah ada.
3. Kredensial awal disuplai melalui mekanisme aman di luar repo; tidak ada password produksi bawaan. Owner mengganti kredensial awal sebelum rilis.
4. Owner melengkapi logo, kontak, alamat outlet, jam buka, S&K, kebijakan privasi, serta rekening/QRIS.
5. Isi kategori, produk, unit, harga, dan mitra konsinyasi. Tetapkan outlet dan peran staf.
6. Jalankan satu transaksi uji dari booking hingga selesai, rekonsiliasi ledger, lalu aktifkan penerimaan booking produksi.

### 25.3 Konfigurasi & Biaya Operasional

- Tidak ada paket Free/Basic/Pro, batas fitur berdasarkan paket, trial, invoice langganan aplikasi, upgrade/downgrade, atau pemblokiran bisnis karena status langganan SaaS.
- Biaya Workers, D1, R2, email, dan domain adalah biaya infrastruktur Radix Outdoor dan dipantau Owner melalui anggaran operasional.
- Pembayaran yang dikelola aplikasi adalah pembayaran sewa, denda, refund, pengeluaran toko, dan settlement mitra.
- Domain produksi dan data merchant harus diisi dengan data resmi Radix Outdoor; contoh di dokumen tidak dianggap sebagai konfigurasi aktif.

### 25.4 Checklist Siap Operasi

- [ ] Profil Radix Outdoor, kontak, outlet, dan jam buka sudah benar.
- [ ] Produk, unit, harga, buffer, dan stok awal sudah diverifikasi.
- [ ] Rekening/QRIS, aturan DP, jaminan, denda, dan refund sudah ditinjau Owner.
- [ ] Akun staf dan mitra hanya memiliki akses yang diperlukan.
- [ ] PDF dan template komunikasi menampilkan brand Radix Outdoor.
- [ ] Backup, restore, monitoring, serta dukungan internal sudah disiapkan.

## 26. Breakdown Pengerjaan per Sprint

Asumsi: satu sprint dua minggu, dikerjakan satu developer dibantu AI coding agent, sehingga satu sprint bisa molor menjadi dua sampai tiga minggu. Total sprint 0 sampai 9 kira-kira 5 sampai 7 bulan (perkiraan kasar, perbaiki setelah sprint 1). Estimasi hanya titik awal perencanaan dan perlu disesuaikan setelah sprint pertama menunjukkan kecepatan nyata. Urutan sengaja menaruh bagian paling berisiko (booking dan stok) lebih awal.

| Sprint | Tujuan | Isi pekerjaan | Definition of Done |
| --- | --- | --- | --- |
| 0 | Fondasi | Monorepo, wrangler dan bindings, Hono skeleton + layout JSX/HTMX + build Tailwind + token CSRF, Drizzle + migrasi awal single tenant, profil bisnis tunggal, CI, staging, middleware dasar, repo dengan accessScope, kerangka test otorisasi | Deploy ke staging, satu profil Radix Outdoor dan dua outlet dummy, kerangka test penolakan akses hijau |
| 1 | Identitas Radix Outdoor | Login staf, sesi, RBAC, pengaturan profil bisnis, kelola pengguna, cakupan akses outlet, audit log. Profil dan Owner awal dibuat lewat seed atau skrip | Owner bisa login, mengatur Radix Outdoor, dan membuat akun staf dengan peran serta outlet berbeda |
| 2 | Katalog dan outlet | Outlet, kategori, produk, unit, upload foto ke R2, label QR, impor CSV, storefront beranda, katalog, dan detail produk (tanpa booking) | Katalog lengkap per outlet dan penyewa bisa melihatnya di HP |
| 3 | Inti booking | Kalender ketersediaan per outlet, tabel reservasi dan trigger overlap, rumus harga dan durasi (`packages/shared`), `/quote`, `POST /bookings`, Idempotency-Key, uji konkurensi | Dua booking bersamaan untuk unit sama: satu berhasil. Contoh hitungan bagian 18.8 lulus unit test |
| 4 | Alur sewa | Booking manual kasir, checkout tamu (nama, WhatsApp, foto KTP), status dan log, pembayaran manual (tunai, transfer, QRIS dinamis dari statis) + unggah bukti, konfirmasi, auto-expire, serah-terima, pengembalian, inspeksi, jaminan identitas | Satu booking bisa dijalankan dari dibuat sampai selesai di HP kasir |
| 5 | Dokumen dan notifikasi | PDF nota dan invoice (Browser Rendering ke R2), perjanjian sewa, tombol kirim WhatsApp semi-manual (wa.me + template), daftar tugas pengingat, email otomatis lewat Queue | Staf bisa mengirim pesan tiap tahap dengan satu ketukan dan PDF bisa diunduh |
| 6 | Operasional | Denda penuh, ledger, shift kasir, pengeluaran, pelanggan dan blacklist, voucher | Kas harian bisa ditutup dengan selisih tercatat |
| 7 | Konsinyasi dan multi-outlet | Mitra, unit milik mitra, bagi hasil dan settlement, portal mitra, transfer stok antar outlet, laporan per outlet | Settlement satu periode cocok dengan ledger dan unit bisa dipindah antar outlet |
| 8 | Laporan dan dashboard | Laporan penjualan, utilisasi, terlaris, arus kas, piutang, bagi hasil, ekspor CSV dan XLSX, dashboard dan ringkasan harian | Angka laporan cocok dengan ledger pada data uji |
| 9 | Rilis Radix Outdoor | Hardening keamanan, uji beban dan optimasi `rows_read`, backup harian, checklist rilis | Operasional Radix Outdoor berjalan dengan data nyata |
| 10+ | Pengembangan lanjutan | Akun penyewa OTP, domain produksi bila belum dipasang, Midtrans untuk sewa, gateway WhatsApp, ulasan, PWA, penyempurnaan lintas outlet | Sesuai prioritas hasil evaluasi operasional Radix Outdoor |

### 26.1 Checklist Rilis MVP

- [ ] Test otorisasi (role, outlet, mitra, penyewa) dan test konkurensi booking hijau di CI
- [ ] Semua rute punya `authorize` dan validasi Zod
- [ ] Rows read per endpoint utama diukur dan tidak membaca baris berlebihan
- [ ] Akun produksi di Workers Paid dan batas anggaran dipantau
- [ ] Backup D1 harian berjalan dan restore sudah diuji sekali
- [ ] Dokumen identitas hanya bisa diakses lewat signed URL
- [ ] Halaman S&K, kebijakan privasi, dan FAQ terisi
- [ ] Radix Outdoor sudah mencoba alur penuh (booking, ambil, kembali) dengan data nyata
- [ ] Rencana dukungan: siapa yang menjawab pertanyaan staf, mitra, dan penyewa Radix Outdoor dan lewat saluran apa

### 26.2 Risiko Teknis yang Harus Dibuktikan Lebih Awal

| Hal yang diuji | Kapan | Bila gagal |
| --- | --- | --- |
| Trigger overlap di D1 benar-benar menggagalkan seluruh batch | Sprint 0 sampai 3, prototipe kecil | Pindahkan reservasi ke Durable Object untuk reservasi Radix Outdoor |
| Kecepatan login staf (PBKDF2) dalam batas CPU Worker | Sprint 1 | Turunkan iterasi, atau pindah ke login tanpa kata sandi untuk staf |
| PDF lewat Browser Rendering cukup cepat dan tampilannya sesuai | Sprint 5 awal | Fallback halaman cetak (print CSS) dan PDF sisi klien |
| Tautan wa.me terbuka benar di HP kasir (Android dan iPhone) dengan pesan terisi dan karakter khusus aman | Sprint 5 awal | Salin pesan ke clipboard sebagai cadangan, siapkan fallback email |
| Pembaca QR kamera berjalan di HP kasir yang dipakai | Sprint 4 | Input kode manual sebagai cadangan |

### 26.3 Keputusan yang Masih Terbuka

1. Domain produksi, logo, kontak, rekening/QRIS, dan daftar outlet resmi Radix Outdoor.
2. Gateway WhatsApp otomatis dievaluasi setelah rilis awal; v1 tetap memakai tautan WhatsApp semi-manual. Pemilihan provider perlu mempertimbangkan dukungan Workers, keandalan, dan ketentuan layanan.
3. Besar toleransi keterlambatan (default 60 menit). Mode durasi tetap per 24 jam dari jam ambil.
4. Masa retensi dokumen identitas (default 90 hari) dan batas refund yang boleh diproses Admin; keputusan refund tetap fleksibel oleh Owner per kasus.
5. Kebutuhan payment gateway, PWA, dan akun penyewa berdasarkan hasil operasional. Single tenant dan brand Radix Outdoor sudah diputuskan, bukan opsi yang menunggu evaluasi.

### 26.4 Cara Kerja Solo dengan AI Coding Agent

- Buat `AGENTS.md` (atau `CLAUDE.md`) di root repo berisi stack, struktur folder (16.6), konvensi (16.4 dan 16.7), aturan wajib (query lewat repo dengan `accessScope` untuk data terbatas, uang integer, waktu epoch UTC, `db.batch()` untuk multi-tabel), dan cara menjalankan test.
- Simpan PRD ini di `docs/` dan berikan hanya bagian yang relevan per tugas (misal sprint 3: bagian 17.4, 18, 19.1, 21.5).
- Kerjakan per irisan vertikal, satu fitur dari migrasi sampai UI, dengan satu PR kecil per irisan.
- Tulis test lebih dulu untuk bagian berisiko: rumus bagian 18, overlap booking, cakupan akses outlet/mitra/penyewa. Agent boleh mengubah kode, tetapi tidak boleh melemahkan test.
- Baca sendiri setiap diff yang menyentuh migrasi, auth, SQL, dan perhitungan uang. Migrasi produksi tidak boleh digabung tanpa dibaca.
- Jalankan CI di setiap PR agar kesalahan agent tertangkap otomatis.
- Catat keputusan teknis di `docs/adr/` supaya konteks tidak hilang antar sesi.
- Risiko: kurva belajar TypeScript dan Workers bila lebih terbiasa dengan Laravel. Jadikan sprint 0 sebagai uji coba. Bila terlalu lambat, evaluasi ulang pindah ke Laravel di VPS, karena PRD ini netral stack.

# Implementasi Radix Outdoor

Aplikasi melayani satu bisnis Radix Outdoor. Cabang adalah outlet bisnis yang sama. UI, routing, API, database akhir, autentikasi, backup, dan deployment tidak memakai pemilihan tenant, registrasi toko, paket, limit langganan, panel platform, atau pembayaran SaaS.

## Cakupan kode yang tersedia

- Storefront publik, katalog, keranjang dengan enhancement JavaScript, formulir checkout server, lookup booking, syarat dan privasi.
- Dashboard, booking manual/online, idempotensi, durasi, DP, harga snapshot, edit/perpanjangan, pembatalan/refund, serta expiry.
- Unit fisik, outlet, transfer, reservasi INSERT/UPDATE anti-overlap, maintenance, opname, dan QR label.
- Pembayaran tunai/transfer/QRIS dengan konfirmasi manual; bukti bayar privat.
- Pickup, inspeksi, foto/tanda tangan, jaminan identitas, pengembalian parsial, denda, dan penutupan.
- Ledger append-only, kas/shift, pengeluaran, pelanggan/blacklist, voucher, konsinyasi, settlement, dan laporan CSV/XLSX.
- Penerimaan tunai terhubung shift aktif kasir; pengeluaran laci dan penutupan dihitung per shift. Settlement mendukung periode, draft yang mengunci payable, dan konfirmasi paid idempotent. Master komponen denda disalin sebagai snapshot per unit saat pengembalian.
- Opname draft dengan versi, snapshot unit, simpan progres dan finalisasi; penyesuaian hilang opsional oleh Owner. Penarikan konsinyasi mencatat bukti serah-terima dan menjaga histori unit. Paket mendukung aktif/nonaktif serta jumlah paket di kasir/checkout server. Kasir mendukung input kode unit ke keranjang dan struk ringkas 58/80 mm.
- Login email/password staf dan mitra, sesi lokal aplikasi, CSRF, rate limit, pencabutan sesi, serta akses outlet/mitra dari sesi server.
- R2 dipisah menjadi binding foto publik dan dokumen privat. Akses dokumen memerlukan izin dan menghasilkan tautan berumur lima menit; akses dicatat.
- Cron → Queue untuk housekeeping dan backup JSON; backup dapat dipulihkan dan diverifikasi secara offline.
- Skema Drizzle mencerminkan struktur database akhir; constraint dan trigger tetap dalam migrasi SQL manual. Folder `packages/db/generated` adalah baseline/diff Drizzle dan tidak dieksekusi Wrangler; baseline awal tidak boleh disalin sebagai migrasi baru ke database yang sudah ada.
- Build Worker mandiri, CI GitHub Actions, dan deploy script untuk Workers Builds dengan migrasi sebelum deployment.

## Pemetaan data

Profil dan konfigurasi berada pada singleton `store_profile.id=1`. Kode yang sudah ada mempertahankan nama tabel operasional ringkas (`units`, `items`, `reservations`, `ledger`, `records`); nama entitas PRD dipetakan melalui repo dan skema Drizzle. Outlet, mitra, voucher, inspeksi, dan beberapa record operasional disimpan sebagai record bertipe. Ini bukan discriminator bisnis dan tidak dapat dipakai untuk membuat toko kedua.

Migrasi lama 0001–0005 dipertahankan sebagai histori. Migrasi 0006 menghapus tabel/kolom SaaS dan mempertahankan data satu toko. Seed contoh adalah perintah lokal terpisah, bukan efek samping request pengunjung. Produksi dimulai dengan profil Radix Outdoor tanpa data pelanggan contoh.

## Batas implementasi yang masih perlu dikembangkan

PRD tetap menjadi target produk; perubahan single tenant ini tidak menyatakan seluruh roadmap telah selesai.

- Form login, checkout dasar, dan lookup dapat dipakai tanpa JavaScript. Ringkasan quote dapat diperbarui lewat HTMX. Sejumlah layar admin dan keranjang yang sudah ada masih memakai enhancement JavaScript untuk formulir/modal, filter, serta grafik; konversi penuh semua layar ke fragmen Hono JSX/HTMX belum selesai.
- Form server untuk shift, settlement, komponen denda dan pengembalian tersedia tanpa JavaScript. Revisi/pembatalan draft settlement dan refund dari laci tunai belum ditambahkan; refund yang tersedia memakai transfer.
- Form opname, paket, penarikan dan kasir juga tersedia tanpa JavaScript. Scan kasir menggunakan kode unit dari input/pemindai keyboard; generator barcode kategori/mitra serta integrasi printer Bluetooth belum tersedia. Pemindai dan printer fisik belum diuji.
- Email otomatis dan reset password lewat email membutuhkan provider email. Saat ini Owner membuat atau mengatur ulang password staf melalui pengaturan akses; pengguna dapat mengganti password sendiri. Tidak ada email palsu yang dinyatakan terkirim.
- PDF remote tersedia bila token Browser Rendering dikonfigurasi; tanpa token, unduhan diarahkan ke halaman cetak browser. Validasi hasil PDF remote perlu dilakukan pada akun Cloudflare nyata.
- Role masih tetap (Owner/Admin/Gudang/Mitra); editor permission granular per pengguna dan 2FA belum tersedia.
- Daftar besar masih memakai batas pembacaan awal; paginasi cursor, ringkasan harian terpisah, dan uji beban produksi perlu dilanjutkan sebelum volume besar.
- QRIS merchant nyata, perangkat kamera Android/iPhone, perjanjian konsinyasi, retensi, serta prosedur dukungan perlu divalidasi Owner sebelum menerima transaksi nyata.
- Gateway WhatsApp otomatis, payment gateway, akun/OTP penyewa, PWA, pengantaran, AI, dan ulasan tetap ditunda sesuai PRD.

## Pengujian

Tes layanan memakai SQLite nyata dengan adapter semantik D1. Tes tambahan memeriksa migrasi singleton, penolakan database multi-bisnis, login mandiri, hash password/token, CSRF, logout, endpoint SaaS yang dihapus, pembatasan outlet pada detail/ekspor/cetak/pembayaran, dan kepemilikan mitra. Playwright menjalankan Worker lokal dengan database serta kredensial uji yang terpisah dari development dan produksi.

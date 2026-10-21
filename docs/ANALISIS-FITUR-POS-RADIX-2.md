# Perbandingan fitur POS VILT dan Radix Outdoor

Tanggal: 21 Oktober 2026.

Tindak lanjut: tiga prioritas awal (kas per shift, settlement periode/draft, master komponen denda) telah diimplementasikan setelah persetujuan pengguna. Rincian keputusan berada di [ADR 0002](adr/0002-kas-settlement-komponen-denda.md) dan cara pakai di [Operasional](OPERATIONS.md). Tabel di bawah mempertahankan kondisi saat analisis awal sebagai pembanding; fitur lain belum dinyatakan selesai.

Tahap berikutnya telah menambahkan opname draft/finalisasi, jumlah dan status aktif paket, scan kode unit ke keranjang, penarikan konsinyasi dengan bukti, serta struk ringkas. Lihat [ADR 0003](adr/0003-opname-paket-kasir-penarikan.md). Generator kode barang terstruktur, editor permission, 2FA, reset email, laporan laba rugi lanjutan, store credit dan perluasan lingkup lainnya tetap belum dinyatakan selesai.

Sumber pembanding: `/home/roofi/Lerd/pos-radix-2` (Laravel/Inertia/Vue/Tailwind).
Target: `/home/roofi/Lerd/radix-outdoor` (Workers/Hono/D1/R2).

## Batas analisis

Analisis ini memeriksa route, controller, service/application, model, beberapa view, konfigurasi autentikasi, dan test yang tersedia. Acuan keputusan produk tetap `docs/PRD.md` dan `AGENTS.md` target. `PRD_SAAS.md` serta instruksi multi-tenancy di folder sumber hanya menjelaskan aplikasi sumber; keduanya tidak mengubah lingkup target.

Status **ada** berarti ditemukan implementasi inti pada kode target, bukan sertifikasi bahwa seluruh detail, perangkat, dan alur produksi sudah diuji. Analisis ini tidak menjalankan aplikasi VILT, mengakses database pelanggan, mengirim WhatsApp, menjalankan test ulang, atau mengubah aplikasi/database/deployment. Hanya dokumen ini yang ditambahkan.

## 1. Fitur inti yang sudah ada: lewati pembuatan ulang

| Fitur pada aplikasi VILT | Implementasi target yang ditemukan | Keputusan |
| --- | --- | --- |
| Dashboard operasional | Dashboard dan bootstrap data sesuai role/outlet | Pertahankan |
| Produk, kategori, foto, inventaris unit | Produk/kategori, unit fisik, foto publik, status dan outlet unit | Pertahankan; format kode dibahas terpisah |
| Kasir dan transaksi sewa | Booking manual, quote, pembayaran awal, detail transaksi | Pertahankan |
| Reservasi dan cek stok | Booking online/manual, reservasi unit dengan buffer dan trigger anti-overlap | Pertahankan aturan PRD |
| Paket sewa | Record bundle, komponen paket, harga paket, quote dan diskon paket | Pertahankan inti; ada detail tambahan pada bagian 2 |
| DP, pelunasan, tunai/transfer/QRIS | Pembayaran idempotent, bukti privat, konfirmasi manual, QRIS dinamis dari statis | Pertahankan |
| Pengembalian dan denda | Pengembalian per unit/parsial, inspeksi, rusak/hilang, denda terlambat, waiver Owner | Pertahankan; master denda belum setara |
| Jaminan identitas | Status ditahan/dikembalikan, pelunasan sebelum penutupan | Pertahankan |
| Shift kasir | Buka/tutup shift, modal, kas fisik, ekspektasi dan selisih | Pertahankan; pengaitan pembayaran perlu diperkuat |
| Mitra konsinyasi dan setoran | Mitra, kepemilikan unit, persentase, partner payable dan settlement | Pertahankan; periode/draft belum setara |
| Portal mitra | Data milik mitra dibatasi scope dan riwayat settlement | Pertahankan; store credit belum ada |
| Mutasi stok dan opname | Record movement serta hasil pemeriksaan fisik per unit | Pertahankan; workflow draft/finalisasi belum ada |
| Pengeluaran, laporan dan audit | Expense masuk ledger, laporan penjualan/piutang/produk/utilisasi/arus kas/mitra, audit, CSV/XLSX | Pertahankan; detail laporan belum seluruhnya setara |
| Pengguna dan role | Owner/Admin/Gudang/Mitra, sesi, akses outlet/mitra, reset password oleh Owner | Pertahankan; editor izin dan MFA belum ada |
| Nota/cetak | Invoice/PDF, nota pembayaran, perjanjian, surat jalan | Pertahankan; tampilan struk kasir sempit dapat ditambah |

Bukti utama target: `apps/api/src/index.ts`, `apps/api/src/services/rental.ts`, `apps/api/src/views/index.ts`, `apps/web/src/client.ts`, `apps/api/src/middleware/auth.ts`, `packages/shared/pricing.ts`, dan `packages/db/schema.ts`.

## 2. Selisih fitur yang layak dipertimbangkan

| No. | Fitur/detail dari VILT | Kondisi target dan usulan adaptasi | Posisi terhadap PRD |
| --- | --- | --- | --- |
| 1 | Master komponen denda | Target menerima nominal kerusakan manual dan denda terlambat, belum daftar komponen kebersihan/kerusakan/kehilangan dengan qty dan nominal snapshot. Tambahkan master aktif/nonaktif dan pilihan komponen saat pengembalian. Cegah penagihan kehilangan dua kali jika harga ganti sudah dikenakan. | Mendukung 18.5, terutama biaya kebersihan |
| 2 | Opname draft → simpan → finalisasi | Target langsung menyimpan checklist hadir/tidak hadir dan jumlah selisih. Tambahkan sesi audit, snapshot unit, catatan per unit, simpan progres, tinjau lalu finalisasi. Penyesuaian harus per unit dan tidak merusak reservasi aktif; jangan menyalin perubahan jumlah agregat VILT. | Penyempurnaan 5.4 dan 21.2 |
| 3 | Settlement per periode dan status belum/sudah disetor | Target mengambil seluruh payable yang belum diselesaikan dan langsung mencatat paid. Tambahkan tanggal periode, draft, tinjau potongan, lalu tandai dibayar; pastikan satu payable hanya masuk satu settlement. | Menutup selisih implementasi terhadap 18.9 |
| 4 | Pembayaran tunai terhubung shift kasir | VILT menyimpan `kas_shift_id` dan mewajibkan shift aktif untuk tunai. Target belum mengaitkan payment ke shift; kas harapan saat tutup dihitung dari pembayaran tunai satu outlet sejak shift dibuka. Ini bisa mencampur kas dua kasir yang shiftnya bersamaan. Tambahkan identitas shift pada penerimaan/pengeluaran/refund sesuai kebijakan kas. | Mendukung 17.4 dan 5.8; kebijakan wajib shift perlu ditetapkan |
| 5 | Editor izin per role dan pengguna | Target masih memakai role tetap. Tambahkan katalog permission dan editor Owner, sambil mempertahankan pembatasan outlet/mitra di repo. Pemberian izin menu tidak boleh memperluas kepemilikan data. | Mendukung 17.2 dan 20 |
| 6 | Jumlah paket dan status paket aktif | VILT punya `qty_paket`, `is_active`, dan pengecekan komponen yang membatasi ketersediaan. Target quote bundle belum memiliki pengali jumlah paket dan skema bundle belum memiliki status aktif. Tambahkan pengali komponen/harga dan aktif/nonaktif tanpa membuat modul paket kedua. | Penyempurnaan paket yang sudah ada |
| 7 | Barcode terstruktur dan scan untuk keranjang kasir | VILT menyarankan kode berdasarkan prefix toko/kategori/barang dan suffix berurutan; input scan menambahkan barang ke keranjang. Target sudah punya kode unit, QR label, pencarian dan kamera QR, tetapi belum alur scan-ke-keranjang dan format kode tersebut. Pertahankan kode unit lama dan UUIDv7 internal. | Penyempurnaan UI inventaris/kasir |
| 8 | Penarikan konsinyasi secara khusus | VILT memiliki aksi tarik dengan jumlah dan alasan. Target dapat menonaktifkan unit menjadi retired, tetapi belum alur khusus penarikan, bukti serah-terima dan riwayat alasan penarikan mitra. Adaptasi harus memilih unit, menolak reservasi aktif, serta mempertahankan histori transaksi. | Penyempurnaan konsinyasi |
| 9 | Laporan laba rugi dan laporan khusus yang lebih rinci | Target berlabel arus kas & laba rugi tetapi perhitungan saat ini berbasis kas masuk/keluar; belum setara rincian hak toko, beban denda, dan transaksi umum VILT. Tambahkan laporan server yang membedakan kas, pendapatan, kewajiban mitra dan beban; perlu definisi pengakuan pendapatan. Laporan mutasi/opname/shift dapat diperdalam. | Mendukung 5.12; rumus perlu ditentukan |
| 10 | Transaksi umum pemasukan dan pengeluaran | Target sudah punya expense dan ledger, tetapi belum form pemasukan non-sewa. Tambahkan jenis pemasukan non-sewa jika dibutuhkan, jangan menggandakan expense. Koreksi harus melalui pembalik, bukan edit/hapus entri ledger seperti pola CRUD sumber. | Perlu perluasan kategori dan aturan keuangan |
| 11 | Store credit mitra | VILT dapat mengubah hak setoran menjadi saldo dan menggunakannya untuk membayar sewa, lengkap riwayat debit/kredit. Target belum memiliki saldo internal atau metode pembayaran store credit. Perlu aturan pemilik saldo, otorisasi penggunaan, pembatalan/refund, settlement, serta debit atomik anti-saldo-negatif. | Fitur baru di luar kontrak pembayaran v1; perlu keputusan lingkup |
| 12 | 2FA, passkey, reset password melalui email | VILT mengaktifkan fitur Fortify beserta layar pengelolaan; target baru email/password, ganti password dan reset oleh Owner. 2FA Owner dapat diprioritaskan sesuai fase PRD; passkey menjadi tambahan terpisah. Reset email memerlukan provider dan token sekali pakai. | 2FA dan reset email sesuai arah PRD; passkey tambahan |
| 13 | Struk kasir ringkas dan dialog cetak otomatis | VILT menyediakan halaman struk font monospace dengan layout sempit dan `window.print()`. Target sudah punya nota/PDF; tambahkan varian struk sempit jika perangkat kasir memerlukan. Tidak ditemukan bukti integrasi printer Bluetooth langsung pada alur ini. | Penyempurnaan tampilan dokumen |

Bukti sumber untuk selisih di atas:

- Denda: `app/Http/Controllers/KomponenDendaController.php`, `app/Modules/Rentals/Application/ProcessRentalReturn.php`.
- Opname: `app/Http/Controllers/StockOpnameController.php`, `app/Modules/Inventory/Application/CompleteStockOpname.php`.
- Settlement/saldo: `app/Http/Controllers/SetoranPemilikController.php`, `app/Http/Controllers/StoreCreditController.php`, `app/Modules/Partners/Application/EloquentStoreCreditDebitor.php`.
- Shift: `app/Services/RentalPaymentService.php`, `app/Http/Controllers/KasShiftController.php`.
- Izin: `app/Http/Controllers/PermissionController.php`, `app/Modules/IdentityAccess/Authorization/PermissionCatalog.php`.
- Paket: `app/Http/Controllers/PaketController.php`, `app/Services/PaketAvailabilityService.php`, `app/Modules/Rentals/Application/CreateRentalCheckout.php`.
- Barcode/penarikan: `app/Http/Controllers/BarangController.php`, `resources/js/pages/barang/Index.vue`, `resources/js/pages/kasir/Index.vue`.
- Keuangan: `app/Http/Controllers/LaporanController.php`, `app/Http/Controllers/TransaksiUmumController.php`.
- Auth: `config/fortify.php`, `app/Http/Controllers/Settings/SecurityController.php`, `routes/settings.php`.
- Struk: `resources/js/pages/kasir/Struk.vue`.

Semua path sumber di atas relatif terhadap `/home/roofi/Lerd/pos-radix-2`; path target relatif terhadap repository ini.

## 3. Perbedaan aturan yang tidak boleh diadopsi otomatis

| Aturan sumber | Aturan target/PRD | Keputusan analisis |
| --- | --- | --- |
| Denda dapat flat per jam atau persentase setengah hari, lalu harian | 18.5 memakai periode 24 jam setelah toleransi | Pertahankan rumus target sampai ada perubahan kebijakan yang disepakati |
| Denda terlambat dapat dibagi ke mitra, termasuk opsi 90% | 18.9 menyatakan denda terlambat milik toko; ganti rugi unit mitra perlu perjanjian | Jangan ikutkan konfigurasi bagi hasil denda lama |
| Persentase komisi dapat disimpan per barang | Persentase tetap per mitra untuk semua unitnya | Pertahankan persentase per mitra |
| Alokasi mendahulukan barang toko, lalu prioritas mitra dan tanggal kerja sama | Target mengurutkan unit menurut jumlah pemakaian dan kode; PRD belum menetapkan prioritas komersial mitra | Prioritas mitra merupakan keputusan bisnis baru |
| Pengembalian paket harus sekaligus | 19.2 dan implementasi target mendukung pengembalian parsial per unit | Jangan menambahkan larangan pengembalian parsial tanpa keputusan baru |
| Diskon otomatis bila subtotal melewati threshold | Target memakai voucher, diskon paket dan aturan harga | Diskon threshold adalah opsi baru; jangan mengubah diskon booking lama |
| Beberapa nominal sumber memakai float/decimal dan transaksi interaktif | Target integer rupiah dan `db.batch()` | Tulis ulang perhitungan dan atomicity untuk D1, bukan menyalin kode PHP |
| Update/delete transaksi umum langsung | Ledger target append-only | Koreksi melalui reversal dan audit |

Catatan istilah: migrasi sumber `2026_06_25_072046_add_deposit_handling_fields_to_sewa_header_and_kas_shift.php` mengganti `jumlah_deposit` menjadi `jumlah_dp`. Ini bukti perubahan nama DP, bukan alasan untuk menambahkan jaminan uang. Target tetap menggunakan identitas sesuai PRD.

## 4. Fitur sumber yang tetap ditunda/dilewati

- Multi-tenant, landlord, subdomain tenant, onboarding toko lain, plan, subscription, invoice SaaS, whitelist tenant dan feature gating: di luar lingkup produk ini.
- Gateway WhatsApp otomatis: sumber menjalankan proses Node/Puppeteer dan menyimpan sesi lokal melalui `WhatsAppService` serta folder `whatsapp-gateway`. Mekanisme tersebut bergantung proses OS dan filesystem persisten; jika kelak diperlukan, desain layanan eksternal/provider dan queue. V1 tetap tombol `wa.me` sesuai PRD.
- Konfirmasi QRIS otomatis: sumber mempunyai webhook notifikasi dengan reference/event id dan parsing nominal. Target v1 tetap konfirmasi manual. Jangan mengaktifkan pembayaran otomatis hanya karena endpoint tersebut ada di sumber; kontrak provider dan kebijakan verifikasi perlu ditentukan terlebih dahulu.
- Kartu debit/kredit sebagai metode pembayaran: ditemukan pada enum/validasi sumber, tetapi itu belum membuktikan integrasi terminal/gateway. Kontrak target saat ini hanya tunai, transfer dan QRIS.
- Registrasi akun publik, verifikasi email dan penghapusan akun dari scaffold VILT tidak berarti penyewa target perlu akun. Checkout tamu tetap berlaku.

## 5. Urutan pekerjaan yang disarankan

1. **Akurasi operasional:** pengaitan kas per shift; settlement periode/draft; komponen denda dengan snapshot. Tulis test uang, konkurensi dan otorisasi sebelum implementasi.
2. **Efisiensi staf:** opname draft/finalisasi, jumlah paket dan aktif/nonaktif, scan barang ke keranjang, penarikan konsinyasi, format struk.
3. **Akses dan laporan:** editor permission; 2FA Owner; laporan laba rugi terdefinisi; reset password via email.
4. **Lingkup tambahan setelah keputusan bisnis:** store credit, pemasukan non-sewa, diskon threshold, prioritas mitra, passkey, gateway WhatsApp dan verifikasi QRIS otomatis.

Sebelum implementasi yang mengubah skema, uraikan migrasi maju yang diperlukan dan minta persetujuan sesuai `AGENTS.md`. Persetujuan membandingkan fitur pada tahap ini tidak dianggap sebagai persetujuan atas rumus bisnis baru. Perubahan PRD dicatat dahulu bila kebijakannya berbeda.

Implementasi tetap dilakukan per fitur dari migrasi, repo dengan accessScope, service, route, view Hono JSX/HTMX sampai test. Jangan memasukkan Laravel/Vue, fondasi tenant, token gateway, data pelanggan, atau salinan database aplikasi sumber ke target.

## 6. Pemeriksaan dokumen

Dokumen dibandingkan dengan route dan implementasi yang disebutkan, termasuk PRD bagian 18–23. Graph digunakan untuk penelusuran dan pengecekan coverage; source dibaca langsung untuk memeriksa hasil dan keterbatasan indeks. Tidak ada klaim bahwa seluruh roadmap PRD sudah selesai atau bahwa fitur sumber sudah lolos uji runtime pada sesi ini.

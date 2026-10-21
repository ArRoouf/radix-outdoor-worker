# 0003 — Opname bertahap, paket, kasir kode unit, dan penarikan konsinyasi

Tanggal: 21 Oktober 2026. Status: diterima; migrasi 0008 disetujui pengguna sebelum dibuat dan diterapkan lokal.

## Konteks

Kelanjutan perbandingan POS VILT memilih lima pekerjaan yang sesuai lingkup PRD: opname draft/finalisasi, jumlah dan status aktif paket, scan-ke-keranjang, penarikan konsinyasi, serta struk ringkas. Implementasi lama menyimpan hasil opname sekali kirim, paket belum memiliki pengali jumlah, dan penarikan hanya dapat dilakukan lewat perubahan status unit umum.

## Keputusan

- Opname memakai record bertipe `opname`, berisi outlet, versi, status draft/final dan snapshot per unit. Snapshot menyimpan kode, produk, status serta apakah unit diharapkan berada di toko saat audit dimulai. Unit yang sedang disewa atau berstatus hilang tidak dianggap harus berada di toko. Pengguna wajib menandai semua unit sebelum finalisasi; selisih membandingkan hasil dengan snapshot.
- Penyimpanan draft dan finalisasi mengonsumsi kunci versi dalam batch yang sama dengan perubahan record. Dua penyimpanan dengan versi sama hanya dapat berhasil satu kali. Finalisasi tidak otomatis mengubah stok. Owner dapat memilih menandai unit yang seharusnya ada tetapi tidak ditemukan menjadi lost; Gudang hanya mencatat hasil. Trigger memeriksa ulang kondisi dan reservasi ketika penyesuaian dibuat. Mutasi dicatat per unit, tanpa mengubah jumlah agregat produk.
- Penarikan hanya oleh Owner untuk unit available milik mitra yang dipilih. Reservasi aktif, maintenance terjadwal dan unit yang masih disewa (termasuk lewat jadwal) menolak penarikan. Satu batch mencatat mutasi, status retired, snapshot bukti penarikan dan audit. Tidak ada penghapusan unit atau perubahan kepemilikan historis.
- Migrasi 0008 hanya menambahkan trigger. Hasil opname final dan bukti penarikan menjadi tetap. Reservasi booking baru memeriksa status unit kembali di database, sehingga hasil quote sebelum penarikan tidak dapat dipakai untuk memesan unit yang telah retired. Trigger mutasi penarikan mencegah dua serah-terima untuk unit yang sama.
- Paket tetap record `bundle`. `active` tidak ada pada data lama berarti aktif. Master baru menolak produk ganda dan produk yang belum diterbitkan. `bundle_qty` (default 1, maksimal 100) mengalikan seluruh komponen dan harga paket pada quote. Batas per komponen produk tetap 100 unit. Harga/diskon booking lama tetap berupa snapshot yang sudah disimpan. Rumus paket yang ada dipertahankan: harga paket menjadi dasar diskon terhadap subtotal katalog, tanpa menambah markup jika nilainya lebih tinggi dari subtotal.
- Paket nonaktif disembunyikan dari storefront dan ditolak untuk quote/booking baru. Checkout server mendukung pemilihan paket dan jumlah paket. Pengembalian parsial tetap diperbolehkan sesuai PRD.
- Halaman kasir baru memakai form server. Kode unit dari keyboard/pemindai menambah kuantitas produk; alokasi unit tetap dilakukan server berdasarkan ketersediaan tanggal dan outlet. Scan tidak menjanjikan unit fisik yang dipindai menjadi unit alokasi. Format kode historis dipertahankan; generator kode kategori/mitra seperti aplikasi VILT belum ditambahkan.
- Varian cetak `type=thermal&width=58|80` menggunakan layout 58/80 mm dan JavaScript kecil untuk membuka dialog cetak. Otorisasi booking berlaku juga untuk struk. Tidak ada integrasi Bluetooth atau pengiriman langsung ke perangkat printer.

## Konsekuensi dan verifikasi

Tidak ada tabel atau dependensi baru. Trigger tetap di SQL manual karena Drizzle tidak memodelkannya. Histori opname lama tetap dapat dibaca sebagai histori dan tidak diubah menjadi draft.

Backup tetap memakai tabel yang sama. Validator restore hanya menangguhkan trigger insert penjagaan historis pada SQLite sementara, lalu memasangnya kembali; kondisi historis tidak dipaksa cocok dengan status unit saat ini. Ledger tidak diedit dan trigger produksi tidak dimatikan.

Tes mencakup konflik versi opname, unit/outlet di luar izin, finalisasi atomik, perlindungan reservasi baru dan sewa terlambat, dua penarikan bersamaan, qty paket, paket nonaktif, snapshot booking, dan restore. Playwright menguji workflow server tanpa JavaScript di viewport HP sampai struk. Perangkat pemindai dan printer fisik belum diuji.

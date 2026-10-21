# Operasional Radix Outdoor

Binding: `DB` (D1), `FILES_PUBLIC` dan `FILES_PRIVATE` (R2), `JOBS` (Queue), serta `ASSETS`. `npm run deploy` menerapkan migrasi maju-saja sebelum kode baru diaktifkan. Jangan mengedit migrasi yang sudah dijalankan.

## Backup dan pemulihan

Owner dapat membuat/mengunduh backup melalui Pengaturan. Housekeeping harian juga membuat snapshot bila belum ada backup dalam 24 jam. Backup berformat `radix-outdoor-backup-v1`, disimpan privat, memuat profil tunggal dan data operasional; sesi aktif tidak dicadangkan.

Validasi offline:

```sh
python3 scripts/validate-backup.py /path/backup.json
```

Alat memulihkan ke SQLite sementara dan memeriksa foreign key, jumlah ledger, serta bentrok reservasi. Validasi tidak menghubungi produksi. Pemulihan nyata dilakukan ke D1 staging kosong terlebih dahulu, diikuti uji transaksi dan berkas R2, sebelum binding produksi dialihkan. Cadangkan objek R2 secara terpisah karena backup JSON hanya berisi metadata/key.

Untuk migrasi dari aplikasi lama, ekspor D1 dan bucket dahulu. Migrasi 0006 menolak database dengan lebih dari satu toko; pemisahan harus dilakukan secara eksplisit. Key R2 lama disimpan pada metadata berkas. Pemindahan bucket memerlukan penyalinan objek, bukan sekadar migrasi SQL.

Ledger tidak boleh diedit/dihapus dan trigger overlap tidak boleh dimatikan untuk memperbaiki transaksi. Koreksi memakai refund/reversal dan audit.

## Kasir, settlement, dan komponen denda

Migrasi `0007_cash_settlements_fines.sql` bersifat tambahan dan mempertahankan pembayaran serta settlement lama. Backup JSON menyertakan `settlement_entries`; validator tetap menerima backup lama dan membentuk kembali klaim dari record settlement.

- Buka **Keuangan → Kas & shift** (`/admin/cash-shifts`) sebelum menerima pembayaran tunai. Kasir hanya memakai shift aktifnya sendiri di outlet transaksi. Dua kasir di outlet yang sama memiliki laci/perhitungan terpisah.
- Pengeluaran dari laci dicatat melalui **Pengeluaran dari laci tunai** di halaman shift. Form pengeluaran umum tetap untuk biaya yang tidak dikaitkan ke laci ini. Saat tutup, masukkan uang fisik; sistem menghitung modal + penerimaan tunai − pengeluaran tunai. Refund saat ini melalui transfer.
- Pembayaran historis tanpa shift tetap ada di ledger dan tidak otomatis masuk shift baru. Rekonsiliasi masa sebelum perubahan dilakukan dari laporan historis. Jika ada dua shift aktif lama untuk pengguna yang sama, migrasi menolak unique index; tinjau/tutup shift yang tepat terlebih dahulu dan jalankan ulang. Jangan mengubah nominal histori untuk memaksa migrasi.
- Owner membuka **Mitra → Buat draft settlement** (`/admin/settlements`), memilih periode tanggal toko dan potongan, lalu memeriksa nilai bersih. Periode memilih hak mitra menurut waktu pencatatan ledger saat booking selesai. Draft mengunci hak tersebut tetapi belum mencatat pengeluaran. Setelah dana diserahkan, centang konfirmasi dan pilih **Tandai sudah dibayar**. Draft saat ini bersifat tetap; belum ada pembatalan/revisi draft.
- Owner mengatur **Serah-terima → Komponen denda** (`/admin/fine-components`). Nama, kategori, tarif dan aktif/nonaktif bisa diubah. Pada **Kembalikan**, isi jumlah komponen per unit; tarif/nama disalin ke transaksi. Biaya kerusakan memerlukan catatan/foto, dan jangan menumpuk biaya manual dengan komponen kerusakan atau harga ganti unit hilang.
- Form shift, settlement, master denda, dan pengembalian server berfungsi tanpa JavaScript. Role serta cakupan outlet/booking tetap diperiksa server.

Migrasi lokal sudah diuji; migrasi produksi dijalankan script deploy saat versi ini dipublikasikan. Persetujuan skema tidak menjalankan deployment produksi dengan sendirinya.

## Stok opname, paket, kasir dan penarikan

- **Opname** (`/admin/opnames`, Owner/Gudang): pilih outlet dan buat draft. Tandai setiap unit ada/tidak ada, isi catatan, lalu simpan progres. Setelah semua diperiksa, finalisasi. Jika ada revisi baru dari pengguna lain, muat ulang sebelum menyimpan. Hasil final tidak dapat diedit.
- Unit yang sedang disewa atau sudah berstatus hilang tidak diharapkan ada di toko. Owner dapat memilih penyesuaian unit yang seharusnya ada tetapi tidak ditemukan menjadi hilang. Jika unit baru dipesan, kondisi berubah atau masih disewa, penyesuaian ditolak dan finalisasi dibatalkan secara utuh. Finalisasi tanpa penyesuaian hanya mencatat hasil audit.
- **Paket** (`/admin/packages`, Owner): isi jumlah setiap produk per satu paket dan harga paket harian. Angka 0 tidak menyertakan produk tersebut. Aktif/nonaktif berlaku untuk pesanan berikutnya; booking lama tetap memakai snapshot. Di checkout publik dan kasir, isi jumlah paket untuk mengalikan seluruh komposisinya. Harga paket mengikuti mekanisme diskon terhadap harga katalog yang sudah ada.
- **Kasir** (`/admin/kasir`, Owner/Admin): pilih outlet, pindai/ketik kode unit lalu pilih **Tambah dari kode**, atau isi jumlah produk langsung. Scan menambah produk, sedangkan unit fisik dipilih server saat booking dibuat. Jika memilih paket, komposisi paket menggantikan keranjang produk. Hitung harga/cek stok, isi penyewa dan pembayaran awal, lalu simpan. Penerimaan tunai memerlukan shift aktif.
- Kasir membuka struk ringkas setelah menyimpan. Pilih lebar **58 mm** atau **80 mm**, sesuaikan ukuran kertas di printer, lalu gunakan **Cetak struk** atau dialog cetak browser. Format ini belum diuji dengan printer/pemindai fisik dan tidak menghubungkan Bluetooth langsung.
- **Mitra → Penarikan barang** (`/admin/withdrawals`, Owner): pilih mitra dan unit miliknya, isi alasan serah-terima, lalu catat. Unit terpesan/disewa ditolak. Unit berhasil ditarik menjadi nonaktif; kode, kepemilikan, transaksi dan hak mitra lama tetap tersimpan. Cetak bukti serah-terima dari riwayat penarikan.

Migrasi `0008_inventory_workflows.sql` hanya menambahkan trigger penjagaan. Histori opname lama tetap tersimpan. Seluruh form baru dapat dipakai tanpa JavaScript; respons HX-Request berupa fragmen.

## Keamanan dan pemeliharaan

- Rahasia berada di runtime secrets atau `.dev.vars.local` untuk development, bukan Git.
- Dokumen identitas/bukti bayar tidak memiliki akses bucket publik. Link privat hanya diterbitkan setelah pengecekan izin, berlaku lima menit, dan setiap akses dicatat.
- Akun staf dinonaktifkan sekaligus mencabut sesinya. Perubahan password mencabut semua sesi pengguna.
- Pantau kegagalan queue, cron, backup, kuota D1/R2, serta latensi dan error Worker pada akun Cloudflare.
- Uji restore, alur sewa, QRIS nyata, dan akses staf sebelum rilis bisnis. Perintah lokal dan dry-run tidak membuktikan resource Cloudflare produksi sudah aktif.

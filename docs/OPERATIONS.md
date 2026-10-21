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

## Keamanan dan pemeliharaan

- Rahasia berada di runtime secrets atau `.dev.vars.local` untuk development, bukan Git.
- Dokumen identitas/bukti bayar tidak memiliki akses bucket publik. Link privat hanya diterbitkan setelah pengecekan izin, berlaku lima menit, dan setiap akses dicatat.
- Akun staf dinonaktifkan sekaligus mencabut sesinya. Perubahan password mencabut semua sesi pengguna.
- Pantau kegagalan queue, cron, backup, kuota D1/R2, serta latensi dan error Worker pada akun Cloudflare.
- Uji restore, alur sewa, QRIS nyata, dan akses staf sebelum rilis bisnis. Perintah lokal dan dry-run tidak membuktikan resource Cloudflare produksi sudah aktif.

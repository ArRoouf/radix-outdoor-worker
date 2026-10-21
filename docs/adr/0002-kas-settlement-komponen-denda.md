# 0002 — Kas per shift, settlement draft, dan komponen denda

Tanggal: 21 Oktober 2026. Status: diterima; perubahan skema disetujui pengguna sebelum implementasi.

## Konteks

Perbandingan dengan POS VILT menemukan tiga prioritas operasional. Penutupan shift sebelumnya menjumlahkan seluruh pembayaran tunai satu outlet sejak shift dibuka, sehingga penerimaan kasir yang berbeda bisa tercampur. Settlement langsung dibayar tanpa periode/draft. Denda kerusakan menerima nominal manual tanpa master komponen.

## Keputusan

- Migrasi maju `0007_cash_settlements_fines.sql` menambah `payments.shift_id` nullable dan foreign key ke record shift. Pembayaran tunai baru wajib memakai shift aktif penerimanya di outlet booking; referensi yang dikirim klien tidak menentukan shift. Pembayaran lama tetap NULL, tidak direkonstruksi berdasarkan waktu.
- Shift tetap berupa record bertipe. Unique partial expression index mengunci satu shift aktif per pengguna. Trigger menolak pembayaran/pengeluaran ke shift tutup atau outlet yang berbeda. Penutupan menghitung ulang penerimaan dan pengeluaran di SQL di dalam batch penutupan, bukan dari jumlah yang dibaca sebelumnya. Owner dapat menutup shift staf; staf hanya shift sendiri.
- Pengeluaran dari laci dibuat lewat form khusus shift dan masuk ledger dengan audit serta token idempotensi. Pengeluaran umum yang lama tidak dianggap memakai laci tunai. Refund yang tersedia tetap transfer dan tidak mengurangi laci; metode refund tunai belum ditambahkan.
- Settlement baru memakai periode `[period_start, period_end)` berdasarkan waktu pencatatan `partner_payable`, bukan tanggal jadwal sewa. UI menerima tanggal awal/akhir inklusif dalam zona waktu toko, kemudian mengubah batasnya ke epoch UTC.
- Draft mengunci setiap payable melalui `settlement_entries.ledger_id` yang unik. Klaim historis dibawa ke tabel baru tanpa pembayaran ulang. Kunci `settled-<ledger_id>` dan pembacaan record settlement lama tetap digunakan untuk menjaga deduplikasi selama pergantian versi Worker.
- Draft belum mengeluarkan uang. Owner menandai paid setelah penyerahan dana; ledger dibuat tepat sekali dalam batch yang sama dengan perubahan status. Nilai draft dan klaim tidak dapat diedit/dihapus. Pembatalan atau revisi draft memerlukan alur koreksi tersendiri di pengembangan berikutnya.
- Master `fine_component` dan snapshot `fine`/`inspection` menggunakan records yang sudah ada. Snapshot menyimpan nama, kategori, tarif integer rupiah, qty, total dan catatan per item. Master dapat dinonaktifkan; transaksi lama tetap memakai snapshot. Biaya manual dan komponen kerusakan/kehilangan tidak boleh ditagih bersama; unit hilang sudah memiliki harga ganti otomatis.
- Rumus denda terlambat, pengembalian parsial dan persentase mitra tetap mengikuti PRD. Denda terlambat tidak dibagi ke mitra.
- Layar baru memakai Hono JSX dan form server dengan CSRF, respons validasi 422, fragmen untuk HX-Request, serta Cache-Control no-store. Pengembalian menyediakan form multipart tanpa JavaScript untuk foto dan komponen.

## Alasan dan konsekuensi

Perubahan mempertahankan data lama dan struktur utama, dengan constraint database untuk klaim unik dan shift aktif. Struktur tidak menambahkan tenant atau stack VILT. Master komponen dapat berubah tanpa mengubah transaksi yang sudah selesai.

`packages/db/generated` tetap artefak pembanding Drizzle, bukan folder migrasi Wrangler. SQL expression index pada diff generated diperiksa/dibetulkan manual dan dicoba pada SQLite; metadata tetap menyimpan ekspresinya. Trigger dan backfill hanya berada di migrasi operasional manual.

Backup menyertakan settlement_entries. Validator restore sementara mendukung backup lama yang belum memiliki tabel itu, memulihkan pembayaran ke shift yang sekarang sudah tutup, lalu mengembalikan trigger penjagaan pada SQLite sementara. Prosedur ini khusus verifikasi restore offline dan tidak menonaktifkan trigger produksi.

Tes mencakup dua kasir satu outlet, dua draft bersamaan, pembayaran settlement berulang, hak akses, snapshot komponen, penolakan komponen nonaktif/biaya ganda, periode zona waktu, migrasi histori, dan restore backup. Browser HP menguji operasi baru termasuk pengembalian tanpa JavaScript.

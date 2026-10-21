# AGENTS.md — Radix Outdoor

Panduan untuk AI coding agent (dan manusia) di repo ini. Baca bagian "Aturan Wajib" sebelum mengubah apa pun.

## 1. Ringkasan Proyek

Web app **single tenant khusus Radix Outdoor** untuk penyewaan alat outdoor: katalog, booking, stok per unit, kasir, pengembalian dan denda, ledger, konsinyasi mitra, serta multi-outlet. Satu instalasi dan database per environment melayani satu bisnis Radix Outdoor. Multi-outlet berarti cabang bisnis yang sama, bukan tenant terpisah.

Tidak ada fondasi multi-tenant: jangan menambah `tenant_id`, `tenantId`, resolver tenant, `TENANT_MODE`, panel platform, onboarding toko lain, atau billing langganan SaaS. Gunakan satu baris `store_profile` (`id = 1`) untuk profil bisnis. Nama brand di UI, PDF, dan template pesan adalah **Radix Outdoor**; slug proyek/Worker `radix-outdoor`, prefiks contoh booking `RX`.

Sumber kebenaran fitur dan aturan bisnis: `docs/PRD.md` (PRD dan grand design). Bila kode dan PRD berbeda, tanyakan dulu, jangan tebak.

## 2. Stack (sudah diputuskan, jangan diganti tanpa diminta)

| Lapisan | Pilihan |
| --- | --- |
| Backend | Cloudflare Workers + Hono (TypeScript) |
| UI | Server-rendered Hono JSX + HTMX, JavaScript minim, Tailwind CSS |
| Database | D1 (SQLite) + Drizzle ORM |
| File | R2 (bucket publik untuk foto alat, privat untuk KTP dan bukti bayar) |
| Job | Cron Triggers + Queues |
| PDF | Browser Rendering `/pdf` |
| Validasi | Zod |
| Test | Vitest, Playwright |
| CI/CD | GitHub Actions + `wrangler deploy` |

Tidak ada React/Vue, tidak ada Laravel, tidak ada ORM lain. Jangan menambah dependensi besar tanpa alasan tertulis.

## 3. Struktur Repo

```text
apps/
  api/                 Worker + Hono
    src/routes/        route HTML dan JSON (tipis, hanya memanggil service)
    src/views/         komponen JSX (halaman dan fragmen HTMX)
    src/services/      aturan bisnis (satu-satunya tempat logika)
    src/repo/          akses data, accessScope wajib untuk data terbatas
    src/middleware/    loadStore, auth, authorize, rateLimit, validate
    src/jobs/          cron dan konsumer queue
  web/                 aset statis: CSS hasil build, JS kecil
packages/
  shared/              tipe, skema Zod, konstanta status, util harga dan tanggal
  db/                  skema Drizzle, migrasi SQL, seed
docs/                  PRD.md, adr/ (catatan keputusan)
```

## 4. Perintah

Sesuaikan bila nama script di `package.json` berbeda.

```bash
pnpm install
pnpm dev                 # wrangler dev (D1 lokal)
pnpm typecheck
pnpm lint
pnpm test                # unit + integrasi (Vitest)
pnpm test:e2e            # Playwright
pnpm db:generate         # buat migrasi dari skema Drizzle
pnpm db:migrate:local    # terapkan migrasi ke D1 lokal
pnpm db:seed             # data contoh Radix Outdoor dan outlet
```

Untuk perubahan kode, jalankan minimal `pnpm typecheck`, `pnpm lint`, dan `pnpm test` sebelum menyatakan tugas selesai. Untuk perubahan dokumentasi saja, periksa konsistensi isi, tautan bagian, dan contoh; bila aplikasi/script belum tersedia, sebutkan bahwa pemeriksaan kode belum dapat dijalankan.

## 5. Aturan Wajib (jangan dilanggar)

1. **Cakupan akses.** Semua query lewat `src/repo/*`; handler dan service tidak boleh memanggil `db` langsung. Repo untuk data terbatas wajib menerima `accessScope` dari sesi atau verifikasi server (role, outlet, kepemilikan mitra atau booking penyewa). Input klien hanya boleh mempersempit cakupan. Owner dapat mengakses seluruh outlet; staf hanya operasional outlet penugasannya; mitra dan penyewa hanya data miliknya. Tabel turunan diperiksa melalui relasi induk. Repo publik hanya membuka katalog yang diterbitkan. Satu profil Radix Outdoor tidak memerlukan ID tenant atau bisnis pada setiap tabel.
2. **Uang** disimpan sebagai integer rupiah, tanpa desimal. Tidak ada `float` untuk uang.
3. **Waktu** disimpan sebagai epoch milidetik UTC. Konversi ke zona waktu toko hanya di lapisan tampilan dan di perhitungan yang memang bergantung tanggal toko.
4. **ID** memakai ULID atau UUIDv7, kecuali singleton `store_profile` yang memakai integer tetap `id = 1`.
5. **Operasi multi-tabel** (booking, pembayaran, pengembalian) dibungkus satu `db.batch()`. D1 tidak punya transaksi interaktif, jadi jangan menulis `BEGIN/COMMIT` manual.
6. **Aturan yang tidak boleh dilanggar dijaga di database** (constraint dan trigger), bukan hanya di kode. Contoh: trigger `trg_no_overlap` mencegah double-booking, trigger pada `ledger_entries` mencegah UPDATE dan DELETE. Trigger ditulis di file migrasi SQL manual, karena Drizzle tidak memodelkan trigger.
7. **Ledger append-only.** Koreksi dengan entri pembalik (`reverses_id`), bukan edit.
8. **Harga di-snapshot** ke `booking_items` saat booking dibuat. Perubahan harga tidak memengaruhi booking yang sudah ada.
9. **Idempotency.** Pembuatan booking dan pencatatan pembayaran wajib idempotent (form memakai token tersembunyi, JSON memakai header `Idempotency-Key`).
10. **Migrasi hanya maju.** Jangan mengedit migrasi lama yang sudah diterapkan. Perubahan skema dibuat kompatibel mundur (tambah kolom dulu, hapus belakangan).
11. **Rumus harga, durasi, denda, dan overlap** hanya ada di `packages/shared` dan diuji dengan tabel kasus dari PRD bagian 18.
12. **Rahasia** hanya lewat `wrangler secret` dan GitHub Secrets. Jangan menulis token, kunci, atau payload QRIS asli ke repo, log, atau test.
13. **Data pribadi** (nomor telepon, KTP) dimasker di log. Dokumen identitas hanya diakses lewat signed URL berumur pendek dan setiap akses dicatat di audit log.

## 6. Konvensi UI (Hono JSX + HTMX)

- Halaman harus berfungsi tanpa JavaScript (progressive enhancement). HTMX hanya menambah interaksi.
- Satu URL melayani halaman penuh atau fragmen: bila header `HX-Request` ada, kembalikan hanya potongan HTML yang diganti.
- Error validasi Zod dirender ulang sebagai fragmen form dengan status 422.
- CSRF: token lewat `hx-headers` dan field tersembunyi di form biasa.
- Halaman admin `Cache-Control: no-store`. Halaman publik (katalog, detail produk) boleh di-cache di edge dengan kunci URL, outlet, dan filter katalog yang relevan dan di-invalidate saat produk berubah.
- JavaScript kecil yang diizinkan: pemindai QR (kamera), papan tanda tangan (canvas), kompres foto, salin ke clipboard. Masing-masing berdiri sendiri per halaman, tanpa framework.
- Respons JSON (`/api/v1`) memakai format `{ ok, data, error: { code, message, fields } }` dengan kode error string tetap (misal `UNIT_NOT_AVAILABLE`).

## 7. Cara Bekerja

- Kerjakan per **irisan vertikal**: satu fitur dari migrasi, repo, service, route, sampai view, dalam satu PR kecil.
- Untuk bagian berisiko (rumus bagian 18, overlap booking, otorisasi outlet/mitra/penyewa, ledger), **tulis test dulu**. Boleh mengubah kode agar test lulus, tetapi **jangan melemahkan atau menghapus test** untuk membuatnya lulus.
- Sebelum mengubah skema database, jelaskan perubahannya dan tunggu persetujuan.
- Baca PRD bagian yang relevan sebelum mulai: skema (17), perhitungan (18), status (19), hak akses (20), API (21), UI (22), keamanan (23).
- Catat keputusan teknis yang penting di `docs/adr/NNNN-judul.md` (konteks, keputusan, alasan).
- Bila instruksi ambigu atau bertentangan dengan PRD, ajukan satu pertanyaan singkat sebelum menulis kode.

## 8. Test

| Level | Cakupan wajib |
| --- | --- |
| Unit | Rumus harga, durasi per 24 jam, denda, pembulatan DP, bagi hasil mitra, transisi status, CRC16 dan tag QRIS |
| Integrasi API | Alur booking sampai selesai terhadap D1 lokal, termasuk Idempotency-Key |
| Konkurensi | Dua booking bersamaan untuk unit yang sama: hanya satu berhasil |
| Otorisasi | Dua outlet, dua mitra, dua penyewa: tolak akses di luar izin, termasuk PDF/ekspor/berkas privat; Owner dapat melihat semua outlet |
| E2E | Booking online, serah-terima, pengembalian di viewport HP |

Test otorisasi dan test konkurensi wajib hijau di CI sebelum merge.

## 9. Keamanan (checklist per PR)

- Setiap route punya `authorize(permission)`, default menolak.
- Semua input divalidasi Zod. Tidak ada SQL hasil gabungan string.
- Unggahan: periksa tipe MIME di server, batasi ukuran, ganti nama berkas dengan ID acak.
- Kata sandi staf di-hash dengan PBKDF2 (Web Crypto) dan iterasi disetel sesuai batas CPU Worker. Ukur di staging.
- Rate limit untuk login, pembuatan booking, unggahan, dan pencarian booking (kode + nomor WhatsApp). Jangan membocorkan apakah kode booking ada.

## 10. Batasan Versi Awal (jangan dikerjakan kecuali diminta)

Di luar lingkup sekarang:

- Midtrans atau payment gateway lain (pembayaran v1: tunai, transfer, QRIS statis yang dibuat dinamis dengan konfirmasi manual)
- Gateway WhatsApp otomatis (v1: semi-manual lewat tautan `wa.me` dengan pesan terisi)
- Akun dan login OTP untuk penyewa (v1: penyewa checkout sebagai tamu)
- Pengantaran alat, sewa per jam, mode hari kalender, deposit uang (jaminan v1: identitas KTP/SIM ditahan)
- Ulasan, PWA, tabel refund otomatis

Di luar lingkup produk: multi-tenant, panel platform, onboarding toko lain, paket dan billing langganan SaaS, serta subdomain per toko. Domain milik Radix Outdoor boleh dikonfigurasi untuk produksi sesuai PRD; tidak memerlukan fondasi SaaS.

Yang wajib ada sejak awal: konsinyasi mitra (persen tetap per mitra) dan multi-outlet.

## 11. Aturan Bisnis Singkat (detail di PRD)

- Durasi: `max(1, ceil((end_at - start_at - toleransi) / 24 jam))`, toleransi default 60 menit.
- Reservasi unit: `[start_at, end_at + buffer]`, buffer default 24 jam.
- DP default 30% dari total, dibulatkan ke atas ke kelipatan Rp1.000.
- Denda terlambat per 24 jam setelah toleransi. Identitas jaminan baru dikembalikan setelah denda lunas atau di-waive Owner.
- Pembatalan: refund diputuskan Owner atau Admin per kasus, dicatat sebagai pembayaran `refund` dan di ledger.
- Bagi hasil mitra: persen tetap per mitra dari pendapatan item setelah diskon proporsional (PRD 18.9).

## 12. Definition of Done per Tugas

- [ ] Sesuai PRD, atau penyimpangan sudah disetujui dan dicatat.
- [ ] `typecheck`, `lint`, `test` hijau.
- [ ] Test baru untuk logika baru, termasuk kasus gagal.
- [ ] Query data terbatas memakai `accessScope` dan lolos pemeriksaan izin, tidak ada rahasia di repo.
- [ ] Migrasi (bila ada) maju-saja dan sudah dicoba di D1 lokal.
- [ ] Ringkasan perubahan singkat di deskripsi PR, termasuk hal yang belum diuji.

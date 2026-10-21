# 0001 — Satu bisnis Radix Outdoor di Cloudflare Workers

Status: diterapkan, 21 Oktober 2026.

Kode awal memakai beberapa tenant, pemilihan workspace, langganan aplikasi, dan identitas hosting. PRD menetapkan satu bisnis dengan outlet dan mitra, serta deployment mandiri di Workers.

Keputusan:

1. Gunakan singleton `store_profile.id=1`; hapus discriminator bisnis dari tabel operasional dan runtime.
2. Pertahankan migrasi historis; tambahkan migrasi 0006 dengan guard jumlah toko maksimal satu. Tidak ada penggabungan data lintas bisnis otomatis.
3. Tentukan cakupan baca/perubahan dari sesi server, dengan filter outlet dan kepemilikan mitra di repo. Owner dapat mengakses semua outlet.
4. Gunakan PBKDF2, token sesi acak yang hanya hash-nya tersimpan, dan CSRF; identitas hosting tidak dipercaya.
5. Pisahkan binding R2 dan pertahankan storage key lama pada metadata migrasi.
6. Gunakan Workers Builds dari root repo dengan build dan deploy terpisah; script deployment menyiapkan resource bernama tetap, memigrasikan D1, kemudian deploy. Deployment tidak menjalankan demo seed.
7. PDF server memakai Browser Rendering REST `/pdf`, sehingga binding `BROWSER` tidak diperlukan; tanpa kredensial, tersedia fallback cetak browser.

Konsekuensi: preview/staging memerlukan resource sendiri; migrasi konversi harus direncanakan sebelum upgrade data nyata. Form login/checkout memakai Hono JSX; layar admin lama diperbarui bertahap tanpa membuang fitur operasional yang sudah tersedia. Batas yang tersisa dicatat dalam IMPLEMENTATION.md, bukan dianggap selesai.

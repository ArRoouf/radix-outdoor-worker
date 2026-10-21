# Radix Outdoor

Aplikasi penyewaan alat outdoor **single tenant** untuk Radix Outdoor. Satu bisnis, banyak outlet, staf dengan akses per outlet, dan konsinyasi mitra. Storefront berada di `/`, dashboard di `/admin/dashboard`, login staf/mitra di `/login`, dan API di `/api/v1`.

## Menjalankan lokal

Gunakan Node.js 22.13+ dan npm. Perintah pnpm yang setara juga dapat dipakai.

```sh
npm ci
cp .dev.vars.example .dev.vars.local
```

Isi `INITIAL_OWNER_EMAIL` dan `INITIAL_OWNER_PASSWORD` di `.dev.vars.local` dengan email dan kata sandi pilihan Anda (minimal 12 karakter). File tersebut diabaikan Git. Tidak ada kata sandi bawaan atau bypass login lokal.

```sh
npm run db:migrate:local
npm run db:seed                 # opsional: data contoh; hanya D1 lokal
npm run dev
```

Buka **http://127.0.0.1:4173**. Login di `/login`. Owner melengkapi profil, rekening, outlet, produk/unit, serta akun staf. Di Pengaturan, centang **Aktifkan penerimaan booking baru** setelah data siap. Data produksi mulai kosong; seed contoh tidak dijalankan saat deployment.

## Pemeriksaan

```sh
npm run check                  # typecheck, lint, unit/integrasi, build
npm run deploy:dry-run         # bundling Worker, tanpa publikasi
npx playwright install chromium
npm run test:e2e               # browser HP, database dan kredensial uji terpisah
```

## Deploy dari GitHub ke Cloudflare

Repo: `git@github.com:ArRoouf/radix-outdoor-worker.git`

| Pengaturan Workers Builds | Isi |
| --- | --- |
| Repository | `ArRoouf/radix-outdoor-worker` |
| Branch | `main` |
| Worker name | `radix-outdoor` |
| Root directory | root repo (`/`) |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Node.js | 22 |

Panduan lengkap aktivasi R2, resource, token deployment, dan secret login ada di **[docs/CLOUDFLARE.md](docs/CLOUDFLARE.md)**. Deploy script menyiapkan resource bernama tetap, menerapkan migrasi, lalu menerbitkan Worker. R2 harus diaktifkan pada akun Cloudflare terlebih dahulu.

## Struktur

```text
apps/api/src/       Hono: route, middleware, repo, service, view, job
apps/web/           aset, CSS, JavaScript enhancement
packages/shared/    rumus harga, durasi, denda, QRIS
packages/db/        skema Drizzle, migrasi SQL maju-saja, seed lokal
scripts/            build, deploy, seed dan validasi backup
```

Skema akhir memakai `store_profile.id = 1` tanpa kolom tenant atau tabel langganan. Migrasi 0001–0005 adalah histori kode lama dan tetap dipertahankan. Migrasi 0006 mengubah satu database lama menjadi single tenant; database dengan lebih dari satu toko ditolak agar data tidak digabung diam-diam.

Fitur dan batas implementasi tercatat di [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md). Aturan produk: [docs/PRD.md](docs/PRD.md). Prosedur backup: [docs/OPERATIONS.md](docs/OPERATIONS.md).

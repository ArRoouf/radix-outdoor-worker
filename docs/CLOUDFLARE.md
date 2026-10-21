# Cloudflare — Radix Outdoor

Panduan ini untuk menghubungkan repository GitHub ke Cloudflare Workers. Kode tidak memerlukan hosting atau identitas dari layanan sebelumnya.

## 1. Persiapan akun

1. Login ke https://dash.cloudflare.com/ dan pilih akun yang akan memiliki aplikasi.
2. Buka **Storage & databases → R2 → Overview**. Selesaikan aktivasi R2 jika belum aktif. R2 memiliki kuota gratis dan penagihan sesuai pemakaian.
3. Buka **Workers & Pages → Create application** dan pilih impor repository GitHub. Izinkan integrasi Cloudflare GitHub mengakses `ArRoouf/radix-outdoor-worker`.

Tidak perlu membuat database, bucket, atau queue kedua secara manual bila memakai deploy script repo ini. Script mencari resource dengan nama di konfigurasi dan menggunakannya kembali.

## 2. Pengaturan build

| Field | Nilai |
| --- | --- |
| Repository | `ArRoouf/radix-outdoor-worker` |
| Production branch | `main` |
| Worker name | `radix-outdoor` |
| Root directory | `/` (root repo) |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Build variable `NODE_VERSION` | `22` |

Biarkan instalasi dependensi mengikuti `package-lock.json` dan npm. Build variables berbeda dengan runtime secrets pada langkah 4.

Script deployment akan:

1. Mencari/membuat D1 `radix-outdoor-db`, dengan location hint Asia-Pacific saat pertama dibuat.
2. Mencari/membuat bucket `radix-outdoor-public` dan `radix-outdoor-private`.
3. Mencari/membuat Queue `radix-outdoor-jobs`.
4. Menulis konfigurasi deployment berisi ID D1 aktual ke `.wrangler/deploy.json` yang diabaikan Git.
5. Menerapkan migrasi D1 remote sebelum kode baru di-deploy.
6. Deploy Worker dengan binding, consumer queue, aset, dan cron lima-menitan dari konfigurasi repo.

Jangan mengganti deploy command dengan `npx wrangler deploy` saja: database juga perlu dimigrasikan. Deploy script tidak menjalankan seed demo atau membuat password bawaan.

Token build memerlukan izin pada akun tujuan untuk **Workers Scripts: Edit, D1: Edit, Workers R2 Storage: Edit, dan Workers Queues: Edit**. Gunakan token otomatis Cloudflare jika cakupannya mencukupi; bila provisioning ditolak, sesuaikan token di **Settings → Build → API token**. Token tidak dimasukkan ke repo.

## 3. Binding yang dihasilkan

| Binding | Layanan | Resource |
| --- | --- | --- |
| `DB` | D1 | `radix-outdoor-db` |
| `FILES_PUBLIC` | R2 | `radix-outdoor-public` |
| `FILES_PRIVATE` | R2 | `radix-outdoor-private` |
| `JOBS` | Queue | `radix-outdoor-jobs` |
| `ASSETS` | Worker static assets | `dist/client` hasil build |

Foto produk diakses publik melalui `/media/:id`; aplikasi memeriksa jenis berkas sebelum menyajikannya. **Bucket private tetap tanpa Public Access/r2.dev/custom domain.** Identitas dan bukti pembayaran disajikan melalui tautan bertoken yang berumur lima menit, setelah pengecekan izin staf.

Untuk database lama, jangan mengubah bucket tanpa menyalin berkas atau mempertahankan binding bucket asal: migrasi database menyimpan key berkas lama, tetapi tidak memindahkan objek antar bucket. Database dengan beberapa toko memerlukan pemisahan data secara eksplisit sebelum migrasi 0006 dapat dijalankan.

## 4. Akun Owner pertama

Setelah Worker dibuat, buka **Workers & Pages → radix-outdoor → Settings → Variables and Secrets → Add**.

Tambahkan dua variabel bertipe **Secret**:

| Secret | Isi |
| --- | --- |
| `INITIAL_OWNER_EMAIL` | Email login Owner |
| `INITIAL_OWNER_PASSWORD` | Kata sandi pilihan Owner, minimal 12 karakter |

Simpan/deploy pengaturan, lalu buka `/login`. Akun Owner dibuat sekali dari konfigurasi ini saat login pertama. Setelah berhasil, ubah password melalui **Ubah kata sandi** dan hapus secret inisialisasi bila tidak diperlukan lagi. Mengganti secret inisialisasi tidak mengganti password akun yang sudah terbentuk.

Kata sandi aplikasi menggunakan PBKDF2 dan salt acak. Token sesi disimpan dalam cookie HttpOnly; database hanya menyimpan hash token. Tidak ada kepercayaan terhadap header identitas hosting atau flag login development.

## 5. Konfigurasi bisnis

Di dashboard aplikasi:

1. Lengkapi kontak, alamat, jam buka, dan zona waktu.
2. Buat outlet, kategori, produk, unit fisik, serta mitra konsinyasi.
3. Masukkan rekening dan kebijakan DP, jaminan identitas, buffer, denda, syarat, dan privasi.
4. Tambahkan staf dengan password awal dan penugasan outlet. Mitra ditautkan ke pemilik unit yang sesuai.
5. Uji satu booking sampai pengembalian, lalu aktifkan penerimaan booking baru di Pengaturan.

Cron dijalankan dalam UTC, sedangkan aplikasi memakai zona waktu bisnis untuk tampilan. Queue menjalankan pemeliharaan, expiry, pengingat dashboard, retensi identitas, dan backup. Tautan WhatsApp di v1 tetap dikirim oleh staf.

## 6. PDF (opsional)

Tanpa konfigurasi tambahan, dokumen dapat dicetak/disimpan sebagai PDF melalui browser.

Untuk PDF server melalui Browser Rendering REST `/pdf`, tambahkan runtime secret:

- `CF_ACCOUNT_ID`: Account ID Cloudflare.
- `BROWSER_RENDERING_API_TOKEN`: token dengan izin **Browser Rendering: Write** pada akun tersebut.

Aplikasi mengirim HTML dokumen yang telah diotorisasi, menyimpan cache PDF di R2 privat, dan melayani unduhan melalui route staf. Implementasi ini memakai REST API, sehingga tidak membutuhkan binding `BROWSER`. Pengujian layanan PDF remote membutuhkan token dan akun Cloudflare; tes lokal memakai fallback cetak.

## 7. Domain, preview, dan deployment alternatif

Alamat Worker awal berbentuk `radix-outdoor.<subdomain-akun>.workers.dev`. Domain sendiri dapat ditambahkan lewat **Settings → Domains & Routes** setelah domain tersedia pada akun Cloudflare.

Aktifkan deployment otomatis hanya untuk `main`. Preview/staging harus memakai database, bucket, queue, dan secret tersendiri sebelum dinyalakan; deploy script utama menargetkan resource produksi bernama tetap.

GitHub Actions juga disiapkan untuk pemeriksaan kode dan browser. Deployment melalui Actions hanya aktif bila repository variable `CLOUDFLARE_DEPLOY_ENABLED=true`, dengan secrets `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID`. Bila memakai Workers Builds, biarkan variable tersebut tidak diaktifkan agar tidak ada dua deployment bersamaan.

## Referensi

- Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- R2: https://developers.cloudflare.com/r2/get-started/
- Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cron: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Browser Rendering PDF: https://developers.cloudflare.com/api/resources/browser_rendering/subresources/pdf/methods/create/

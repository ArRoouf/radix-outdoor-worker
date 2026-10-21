import { workbook } from "./xlsx";
import { esc, money, date, icon, status, shownStatus, renderPage, bookingTable, productCard, productArt, customerTable, empty, section, avatar, } from "../../api/src/views/index";
const $ = (q: string, root: any = document) => root.querySelector(q) as any;
const $$ = (q: string, root: any = document) => Array.from(root.querySelectorAll(q)) as any[];
let d: any;
let store: any;
const appData = $("#app-data"), storeData = $("#store-data");
if (appData)
    d = JSON.parse(appData.textContent);
if (storeData)
    store = JSON.parse(storeData.textContent);
const page = location.pathname.split("/")[2] || "dashboard";
const modalRoot = $("#modal-root");
let lastFocus: HTMLElement | null = null;
let lastBooking: any = null;
let activeStatus = "all";
let productView = "products";
let calendarDate = new Date();
let cart: any[] = [];
let bundleId = "";
let signatureUsed = false;
let idem = crypto.randomUUID();
let selectedQuote: any = null;
let lookupCredentials: any = null;
function toast(message: string, error = false) {
    const t = $("#toast");
    if (!t)
        return;
    t.textContent = message;
    t.className = "show" + (error ? " error" : "");
    setTimeout(() => (t.className = ""), 4000);
}
async function api(path: string, body?: any, method = "POST", key?: string) {
    const headers: Record<string, string> = {};
    if(d?.csrf)headers["X-CSRF-Token"]=d.csrf;
    if (!(body instanceof FormData) && body !== undefined)
        headers["Content-Type"] = "application/json";
    if (key)
        headers["Idempotency-Key"] = key;
    const response = await fetch(path, {
        method: body === undefined && method === "POST" ? "GET" : method,
        headers,
        body: body === undefined
            ? undefined
            : body instanceof FormData
                ? body
                : JSON.stringify(body),
    });
    let j: any;
    try {
        j = await response.json();
    }
    catch {
        throw new Error("Server tidak dapat dihubungi. Coba lagi.");
    }
    if (!response.ok || !j.ok)
        throw new Error(j.error?.message || "Permintaan gagal");
    return j.data;
}
async function refresh() {
    if (!d)
        return;
    d = await api("/api/v1/bootstrap");
    $("#main").innerHTML = renderPage(d, page);
    initPage();
}
function modal(title: string, content: string, wide = false) {
    lastFocus = document.activeElement as HTMLElement;
    modalRoot.innerHTML = `<div class="modal-overlay"><section role="dialog" aria-modal="true" aria-labelledby="modal-title" class="modal ${wide ? "wide" : ""}"><div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-close-modal aria-label="Tutup">${icon("close", 20)}</button></div><div class="modal-body"><div class="modal-error" role="alert"></div>${content}</div></section></div>`;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("input,select,textarea,button:not([data-close-modal])", modalRoot)?.focus(), 40);
}
function closeModal() {
    modalRoot.innerHTML = "";
    document.body.style.overflow = "";
    lastFocus?.focus();
}
function formHtml(id: string, fields: string, label = "Simpan", note = "") {
    return `<form id="${id}">${note ? `<p class="field-hint">${note}</p>` : ""}${fields}<div class="modal-actions"><button class="btn" type="button" data-close-modal>Batal</button><button class="btn primary" type="submit">${icon("check", 16)}${label}</button></div></form>`;
}
const field = (name: string, label: string, type = "text", value: any = "", required = true, extra = "") => `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${extra}></label>`;
const area = (name: string, label: string, value = "") => `<label>${label}<textarea name="${name}" rows="3">${esc(value)}</textarea></label>`;
const select = (name: string, label: string, options: any[], value = "") => `<label>${label}<select name="${name}">${options
    .map((o) => {
    const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
    return `<option value="${esc(v)}" ${value === v ? "selected" : ""}>${esc(l)}</option>`;
})
    .join("")}</select></label>`;
const outlets = () => d.records.outlet || [];
const partners = () => d.records.partner || [];
const dt = (n: number) => {
    const x = new Date(n);
    return new Date(x.getTime() - x.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
};
const epoch = (s: string) => new Date(s).getTime();
function values(form: HTMLFormElement) {
    return Object.fromEntries(new FormData(form).entries()) as any;
}
async function safe(action: () => Promise<any>, button?: HTMLButtonElement) {
    if (button)
        button.disabled = true;
    try {
        await action();
    }
    catch (e) {
        const message = (e as Error).message;
        const error = $(".modal-error");
        if (error) {
            error.textContent = message;
            error.scrollIntoView({ block: "nearest" });
        }
        else
            toast(message, true);
    }
    finally {
        if (button)
            button.disabled = false;
    }
}
async function uploadInput(input: HTMLInputElement, publicPath?: string) {
    const file = input?.files?.[0];
    if (!file)
        return null;
    const body = new FormData();
    body.append("file", file);
    return (await api(publicPath || "/api/v1/uploads", body)).id;
}
function newBooking() {
    idem = crypto.randomUUID();
    selectedQuote = null;
    const start = Date.now() + 3600000;
    modal("Buat booking baru", `<form id="booking-form"><div class="form-grid">${field("name", "Nama pelanggan")}${field("phone", "Nomor WhatsApp", "tel")}${field("start_at", "Tanggal & jam ambil", "datetime-local", dt(start))}${field("end_at", "Tanggal & jam kembali", "datetime-local", dt(start + 2 * 86400000))}${select("outlet_id", "Outlet pengambilan", outlets().map((o: any) => [o.id, o.name]))}${select("channel", "Kanal pesanan", [
        ["walk_in", "Walk-in"],
        ["whatsapp", "WhatsApp"],
        ["online", "Storefront"],
    ])}</div><label>Perlengkapan sewa</label><div class="manual-items">${d.products.map((p: any) => `<div class="manual-item"><span>${esc(p.name)}<small>${money(p.price)} / hari</small></span><input type="number" min="0" max="100" value="0" data-item-qty="${p.id}" aria-label="Jumlah ${esc(p.name)}"></div>`).join("")}</div><div class="form-grid" style="margin-top:20px">${field("voucher_code", "Kode voucher", "text", "", false)}${field("paid", "Pembayaran awal (Rp)", "number", 0, true, 'min="0"')}${select("method", "Metode pembayaran", [
        ["cash", "Tunai"],
        ["transfer", "Transfer"],
        ["qris", "QRIS"],
    ])}</div>${area("note", "Catatan internal")}<div class="actions"><button class="btn" type="button" data-action="quote-manual">${icon("wallet", 16)}Hitung harga & cek stok</button></div><div id="manual-quote"></div><div class="modal-actions"><button type="button" class="btn" data-close-modal>Batal</button><button class="btn primary" type="submit">${icon("plus", 16)}Buat booking</button></div></form>`, true);
}
function manualPayload() {
    const v = values($("#booking-form"));
    return {
        ...v,
        start_at: epoch(v.start_at),
        end_at: epoch(v.end_at),
        paid: Number(v.paid),
        items: $$("[data-item-qty]")
            .filter((i) => Number(i.value) > 0)
            .map((i) => ({ product_id: i.dataset.itemQty, qty: Number(i.value) })),
        customer: { name: v.name, phone: v.phone },
    };
}
const quoteBox = (q: any) => `<div class="quote-summary"><div><span>Durasi sewa</span><span>${q.days} hari</span></div><div><span>Subtotal</span><span>${money(q.subtotal)}</span></div><div><span>Diskon</span><span>− ${money(q.discount)}</span></div><div><span>DP minimum</span><span>${money(q.dp)}</span></div><div><span>Total sewa</span><span>${money(q.total)}</span></div></div>`;
async function openBooking(id: string) {
    lastBooking = await api("/api/v1/bookings/" + id);
    const b = lastBooking, s = shownStatus(b);
    modal("Detail booking", `<div class="booking-detail-summary"><div><h3>${esc(b.code)}</h3><p>${esc(b.customer_name)} · ${esc(b.customer_phone)}</p></div>${status(s)}</div><div class="detail-grid"><div><small>TANGGAL AMBIL</small><strong>${new Date(b.start_at).toLocaleString("id-ID")}</strong></div><div><small>TANGGAL KEMBALI</small><strong>${new Date(b.end_at).toLocaleString("id-ID")}</strong></div><div><small>TOTAL TAGIHAN</small><strong>${d.member.role === "warehouse" ? "Akses kasir" : money(b.total)}</strong></div><div><small>SISA PEMBAYARAN</small><strong class="${b.total > b.paid ? "orange-text" : "green-text"}">${d.member.role === "warehouse" ? "Akses kasir" : money(b.total - b.paid)}</strong></div></div><h3 class="section-subtitle">Perlengkapan sewa</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>Produk / unit</th><th>Durasi</th><th>Harga sewa</th><th>Kondisi</th></tr></thead><tbody>${b.items.map((i: any) => `<tr><td><strong>${esc(i.product_name)}</strong><small>${esc(i.code)}</small></td><td>${i.days} hari</td><td>${money(i.total)}</td><td>${i.returned_at ? '<span class="green-text">Sudah kembali</span>' : "Belum kembali"}</td></tr>`).join("")}</tbody></table></div><div class="notice" style="margin-top:20px">${icon("shield", 20)}<span>Jaminan: ${b.collateral === "held" ? "Identitas sedang ditahan" : b.collateral === "returned" ? "Identitas sudah dikembalikan" : "KTP/SIM diterima saat pengambilan"}</span></div>${b.note ? `<p class="field-hint">Catatan: ${esc(b.note)}</p>` : ""}<div class="detail-actions">${b.total > b.paid && !["expired", "cancelled", "completed"].includes(b.status) && d.member.role !== "warehouse" ? `<button class="btn primary" data-booking-action="pay">${icon("wallet", 16)}Catat pembayaran</button>` : ""}${b.status === "confirmed" ? `<button class="btn primary" data-booking-action="pickup">${icon("products", 16)}Serah-terima</button>` : ""}${b.status === "picked_up" ? `<button class="btn primary" data-booking-action="return">${icon("return", 16)}Proses pengembalian</button>` : ""}${b.status === "returned" && d.member.role !== "warehouse" ? `<button class="btn primary" data-booking-action="complete">${icon("check", 16)}Selesaikan booking</button>` : ""}${["pending_payment", "confirmed"].includes(b.status) && d.member.role !== "warehouse" ? '<button class="btn" data-edit-booking>Ubah booking</button>' : ""}${["confirmed", "picked_up"].includes(b.status) ? '<button class="btn" data-booking-action="extend">Perpanjang</button>' : ""}${d.member.role !== "warehouse" ? `<a class="btn" href="/admin/bookings/${b.id}/pdf" target="_blank">${icon("download", 16)}Invoice / PDF</a><a class="btn" href="/admin/bookings/${b.id}/print?type=agreement" target="_blank">Perjanjian sewa</a><a class="btn" href="/admin/bookings/${b.id}/print?type=delivery" target="_blank">Surat jalan</a><a class="btn" href="/admin/bookings/${b.id}/print?type=receipt" target="_blank">Nota pembayaran</a><a class="btn" href="https://wa.me/${esc(b.customer_phone)}?text=${encodeURIComponent(`Halo ${b.customer_name}, informasi booking ${b.code} di ${d.store.name}. Ambil: ${new Date(b.start_at).toLocaleString("id-ID")}. Kembali: ${new Date(b.end_at).toLocaleString("id-ID")}. Sisa tagihan: ${money(b.total - b.paid)}.`)}" target="_blank">${icon("customers", 16)}WhatsApp</a>` : ""}${["confirmed", "pending_payment"].includes(b.status) && d.member.role !== "warehouse" ? '<button class="btn danger" data-booking-action="cancel">Batalkan</button>' : ""}</div><h3 class="section-subtitle">Denda & biaya tambahan</h3><div class="simple-list">${(d.records.fine || [])
        .filter((f: any) => f.booking_id === b.id)
        .map((f: any) => `<div><span><strong>${esc(f.kind)} · ${money(f.amount)}</strong><small>${esc(f.note || "")}</small></span>${f.waived ? status("cancelled") : d.member.role === "owner" ? `<button class="btn sm" data-waive-fine="${f.id}">Bebaskan denda</button>` : ""}</div>`)
        .join("") || '<p class="field-hint">Tidak ada denda.</p>'}</div><h3 class="section-subtitle">Pembayaran</h3><div class="simple-list">${b.payments.map((p: any) => `<div><span><strong>${money(p.amount)}</strong><small>${esc(p.method)} · ${esc(p.kind)}</small></span>${status(p.status === "confirmed" ? "completed" : p.status)}${p.proof ? `<a href="/api/v1/files/${p.proof}" target="_blank" class="btn sm">Bukti</a>` : ""}</div>`).join("") || '<p class="field-hint">Belum ada pembayaran.</p>'}</div><h3 class="section-subtitle">Riwayat booking</h3><div class="timeline">${b.logs.map((l: any) => `<div>${statusLabelsClient(l.status)}<small>${new Date(l.created_at).toLocaleString("id-ID")} · ${esc(l.note)}</small></div>`).join("")}</div>`, true);
}
function statusLabelsClient(s: string) {
    return status(s).replace(/<[^>]+>/g, "");
}
function bookingActionForm(action: string) {
    const b = lastBooking;
    if (action === "pay") {
        idem = crypto.randomUUID();
        modal("Catat pembayaran", formHtml("payment-form", `<p class="field-hint">${esc(b.code)} · Sisa ${money(b.total - b.paid)}</p>${field("amount", "Nominal pembayaran (Rp)", "number", b.total - b.paid, true, `min="1" max="${b.total - b.paid}"`)}${select("method", "Metode pembayaran", [
            ["cash", "Tunai"],
            ["transfer", "Transfer bank"],
            ["qris", "QRIS"],
        ])}<div class="notice">Catat setelah dana benar-benar diterima. Pembayaran akan masuk ledger.</div>`, "Konfirmasi pembayaran"));
    }
    else if (action === "pickup") {
        modal("Serah-terima alat", formHtml("pickup-form", `<p class="field-hint">${esc(b.code)} · ${esc(b.customer_name)}</p>${b.paid < b.total ? `<div class="notice warning">Lunasi sisa ${money(b.total - b.paid)} sebelum melanjutkan.</div>` : ""}${select("collateral_type", "Identitas fisik yang diterima", [
            ["ktp", "KTP"],
            ["sim", "SIM"],
            ["other", "Identitas lainnya"],
        ])}<label class="checkbox"><input name="checked" type="checkbox" required><span>Semua unit, aksesori wajib, dan kelengkapan telah diperiksa bersama penyewa.</span></label>${b.items.map((i: any) => `<div class="inspection-unit"><strong>${esc(i.code)}</strong> · ${esc(i.product_name)}</div>`).join("")}${field("photo", "Foto kondisi awal (opsional)", "file", "", false, 'accept="image/jpeg,image/png,image/webp"')}<label>Tanda tangan penyewa</label><canvas class="signature-pad" id="signature" width="600" height="180"></canvas><div class="signature-actions"><small>Tanda tangani langsung pada area di atas.</small><button type="button" data-action="clear-signature">Hapus</button></div>`, "Serahkan alat"));
        initSignature();
    }
    else if (action === "return") {
        modal("Pengembalian alat", formHtml("return-form", `<p class="field-hint">Pilih unit yang dikembalikan. Unit lain tetap tercatat sedang disewa.</p>${b.items
            .filter((i: any) => !i.returned_at)
            .map((i: any) => `<div class="inspection-unit"><label class="checkbox"><input type="checkbox" name="item_ids" value="${i.id}" checked><span><strong>${esc(i.code)}</strong> · ${esc(i.product_name)}</span></label><select name="condition_${i.id}" aria-label="Kondisi ${esc(i.code)}"><option value="good">Baik & lengkap</option><option value="minor">Rusak ringan</option><option value="damaged">Rusak berat</option><option value="lost">Hilang</option></select></div>`)
            .join("")}${field("damage", "Biaya kerusakan per unit (Rp)", "number", 0, true, 'min="0"')}${area("note", "Catatan pemeriksaan")}${field("photo", "Foto kondisi (wajib untuk kerusakan / hilang)", "file", "", false, 'accept="image/jpeg,image/png,image/webp"')}<div class="notice">Denda keterlambatan dihitung otomatis. Unit rusak masuk maintenance dan identitas ditahan sampai tagihan lunas.</div>`, "Simpan pengembalian"), true);
    }
    else if (action === "complete") {
        modal("Selesaikan booking", formHtml("complete-form", `<div class="quote-summary"><div><span>Total tagihan</span><span>${money(b.total)}</span></div><div><span>Sudah dibayar</span><span>${money(b.paid)}</span></div><div><span>Sisa tagihan</span><span>${money(b.total - b.paid)}</span></div></div><label class="checkbox" style="margin-top:25px"><input name="identity_returned" type="checkbox" required><span>Seluruh alat sudah diperiksa, tagihan lunas, dan identitas asli telah dikembalikan kepada penyewa.</span></label>`, "Selesaikan booking"));
    }
    else if (action === "cancel") {
        modal("Batalkan booking", formHtml("cancel-form", `${area("reason", "Alasan pembatalan")}${d.member.role === "owner" ? field("refund", "Refund pembayaran (Rp)", "number", 0, true, `min="0" max="${b.paid}"`) : '<p class="field-hint">Refund perlu diproses oleh Owner.</p>'}<div class="notice warning">Reservasi stok akan dilepas. Pembatalan dicatat dalam riwayat.</div>`, "Batalkan booking"));
    }
    else if (action === "extend") {
        modal("Perpanjang sewa", formHtml("extend-form", `${field("end_at", "Tanggal & jam kembali baru", "datetime-local", dt(b.end_at + 86400000))}<div class="notice">Sistem memeriksa reservasi berikutnya termasuk buffer. Harga tambahan menggunakan snapshot booking.</div>`, "Perpanjang sewa"));
    }
}
function initSignature() {
    signatureUsed = false;
    const canvas = $("#signature") as HTMLCanvasElement;
    if (!canvas)
        return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#254f40";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    let down = false;
    const pos = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        return [
            ((e.clientX - r.left) * canvas.width) / r.width,
            ((e.clientY - r.top) * canvas.height) / r.height,
        ];
    };
    canvas.onpointerdown = (e) => {
        down = true;
        signatureUsed = true;
        canvas.setPointerCapture(e.pointerId);
        ctx.beginPath();
        const [x, y] = pos(e);
        ctx.moveTo(x, y);
    };
    canvas.onpointermove = (e) => {
        if (down) {
            const [x, y] = pos(e);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };
    canvas.onpointerup = () => (down = false);
}
function productForm(id?: string) {
    const p = d.products.find((p: any) => p.id === id) || {};
    modal(id ? "Kelola produk" : "Tambah produk", formHtml("product-form", `<input type="hidden" name="id" value="${p.id || ""}"><div class="form-grid">${field("name", "Nama produk", "text", p.name || "")}${select("category", "Kategori", ["Tenda", "Carrier", "Sleeping Bag", "Alat Masak", "Aksesori", ...(d.records.category || []).map((c: any) => c.name)], p.category)}${field("brand", "Merek", "text", p.brand || "", false)}${field("price", "Harga dasar / hari (Rp)", "number", p.price || 0, true, 'min="0"')}${field("capacity", "Kapasitas (orang)", "number", p.capacity || 1, true, 'min="1"')}${field("buffer_hours", "Buffer pembersihan (jam)", "number", p.buffer_hours ?? d.store.settings.buffer_hours, true, 'min="0" max="168"')}${select("image", "Ilustrasi", ["tent", "tent2", "bag", "sleep", "stove", "cook", "mat", "pole"], p.image)}</div>${area("description", "Deskripsi produk", p.description || "")}${field("photos", "Foto produk (maksimal 5)", "file", "", false, 'accept="image/jpeg,image/png,image/webp" multiple')}<input name="existing_images" type="hidden" value="${esc(p.images || "[]")}">${!id
        ? `<h3 class="section-subtitle">Unit fisik awal</h3><div class="form-grid">${field("quantity", "Jumlah unit", "number", 1, true, 'min="1" max="100"')}${field("prefix", "Awalan kode unit", "text", "UNT", true, 'maxlength="6"')}${select("outlet_id", "Outlet", outlets().map((o: any) => [o.id, o.name]))}${field("purchase_price", "Harga beli per unit (Rp)", "number", 0, true, 'min="0"')}${select("partner_id", "Pemilik alat", [["", "Milik toko"], ...partners().map((p: any) => [p.id, p.name])])}</div>`
        : `<div class="notice">Perubahan harga hanya berlaku untuk booking baru.</div><div class="actions"><button class="btn danger" type="button" data-archive-product="${id}">Arsipkan produk</button><button class="btn" type="button" data-product-units="${id}">Kelola unit fisik</button></div>`}`, "Simpan produk"), true);
}
function unitForm(id: string) {
    const u = d.units.find((u: any) => u.id === id);
    modal("Kelola unit " + esc(u.code), formHtml("unit-form", `<input type="hidden" name="id" value="${id}"><p class="field-hint">${esc(d.products.find((p: any) => p.id === u.product_id)?.name)}</p>${select("status", "Status fisik", [
        ["available", "Tersedia"],
        ["maintenance", "Maintenance"],
        ["broken", "Rusak"],
        ["lost", "Hilang"],
        ["retired", "Nonaktif"],
    ], u.status)}${select("outlet_id", "Lokasi outlet", outlets().map((o: any) => [o.id, o.name]), u.outlet_id)}${select("partner_id", "Kepemilikan alat", [["", "Milik toko"], ...partners().map((p: any) => [p.id, p.name])], u.partner_id || "")}${area("condition_note", "Catatan kondisi", u.condition_note || "")}<div class="qr-box"><img src="/api/v1/units/${id}/qr" alt="QR unit ${esc(u.code)}" style="width:100%"></div><a class="btn full" href="/api/v1/units/${id}/qr" target="_blank">${icon("download", 16)}Buka / cetak label QR</a>`));
}
function genericForm(kind: string, id?: string) {
    const common = (title: string, fields: string) => modal(title, formHtml("generic-form", `<input type="hidden" name="_kind" value="${kind}">${fields}`));
    if (kind === "customer")
        common("Tambah pelanggan", `<div class="form-grid">${field("name", "Nama lengkap")}${field("phone", "Nomor WhatsApp", "tel")}${field("email", "Email", "email", "", false)}${select("segment", "Segmentasi", ["baru", "loyal", "member"])}</div>${area("address", "Alamat")}${area("notes", "Catatan")}`);
    if (kind === "partner")
        common("Tambah mitra konsinyasi", `${field("name", "Nama mitra")}${field("phone", "Nomor WhatsApp", "tel")}${field("share_percent", "Bagian mitra (%)", "number", 70, true, 'min="0" max="100"')}${field("bank", "Rekening pembayaran", "text", "", false)}`);
    if (kind === "outlet")
        common("Tambah outlet", `${field("name", "Nama outlet")}${field("address", "Alamat lengkap")}${field("phone", "Nomor WhatsApp", "tel")}`);
    if (kind === "category")
        common("Tambah kategori", field("name", "Nama kategori"));
    if (kind === "voucher")
        common("Tambah voucher", `${field("code", "Kode voucher", "text", "", true, 'style="text-transform:uppercase"')}${select("kind", "Jenis diskon", [
            ["percent", "Persentase (%)"],
            ["amount", "Nominal (Rp)"],
        ])}<div class="form-grid">${field("value", "Nilai diskon", "number", 10, true, 'min="1"')}${field("min_total", "Minimum transaksi (Rp)", "number", 0, true, 'min="0"')}${field("quota", "Kuota (0 = tanpa batas)", "number", 100, true, 'min="0"')}</div>`);
    if (kind === "expense")
        common("Catat pengeluaran", `${select("category", "Kategori", ["Operasional", "Perbaikan", "Gaji", "Pembelian alat", "Lainnya"])}${field("amount", "Nominal (Rp)", "number", "", true, 'min="1"')}${field("spent_on", "Tanggal pengeluaran", "date", new Date().toISOString().slice(0, 10))}${area("note", "Keterangan pengeluaran")}`);
    if (kind === "price_rule")
        common("Aturan harga khusus", `${select("product_id", "Produk", d.products.map((p: any) => [p.id, p.name]))}${select("kind", "Jenis aturan", [
            ["tier", "Sewa panjang (tier)"],
            ["weekend", "Akhir pekan"],
            ["member", "Member"],
            ["season", "Musim / high season"],
        ])}<div class="form-grid">${field("price", "Harga / hari (Rp)", "number", 30000, true, 'min="1"')}${field("min_days", "Minimum durasi (hari)", "number", 3, true, 'min="1"')}${field("priority", "Prioritas", "number", 0)}${field("start_at", "Mulai season", "datetime-local", dt(Date.now()), false)}${field("end_at", "Akhir season", "datetime-local", dt(Date.now() + 30 * 86400000), false)}</div>`);
    if (kind === "bundle")
        common("Tambah paket bundling", `${field("name", "Nama paket")}${field("price", "Harga paket / hari (Rp)", "number", 100000, true, 'min="1"')}${area("description", "Deskripsi paket")}<div class="manual-items">${d.products.map((p: any) => `<div class="manual-item"><span>${esc(p.name)}</span><input type="number" min="0" max="100" value="0" data-bundle-item="${p.id}" aria-label="Jumlah ${esc(p.name)}"></div>`).join("")}</div>`);
    if (kind === "maintenance")
        common("Jadwalkan perawatan", `${select("unit_id", "Unit fisik", d.units.map((u: any) => [
            u.id,
            u.code +
                " · " +
                d.products.find((p: any) => p.id === u.product_id)?.name,
        ]))}${field("reason", "Jenis perawatan / alasan")}<div class="form-grid">${field("start_at", "Mulai", "datetime-local", dt(Date.now()))}${field("end_at", "Selesai", "datetime-local", dt(Date.now() + 86400000))}</div>${field("cost", "Estimasi biaya (Rp)", "number", 0, true, 'min="0"')}`);
    if (kind === "member")
        common("Tambahkan anggota tim", `${field("name", "Nama lengkap")}${field("email", "Email login", "email")}${field("password", "Kata sandi awal (minimal 12 karakter)", "password", "", true, 'minlength="12" autocomplete="new-password"')}${select("role", "Peran", [
            ["admin", "Admin / Kasir"],
            ["warehouse", "Petugas gudang"],
            ["partner", "Mitra konsinyasi"],
        ])}${select("outlet_id", "Outlet akses", [["", "Pilih outlet (wajib untuk staf)"], ...outlets().map((o: any) => [o.id, o.name])])}${select("partner_id", "Mitra terkait (untuk peran Mitra)", [["", "Tidak ada"], ...partners().map((p: any) => [p.id, p.name])])}<div class="notice">Anggota masuk dengan akun ChatGPT sesuai email ini. Akses hanya diberikan pada toko ini.</div>`);
}
function renderProductResults() {
    const products = d.products.filter((p: any) => (!$("#product-search")?.value ||
        p.name
            .toLowerCase()
            .includes($("#product-search").value.toLowerCase())) &&
        (!$("#product-category")?.value ||
            p.category === $("#product-category").value));
    const root = $("#product-results");
    if (!root)
        return;
    if (productView === "products") {
        root.className = "product-grid";
        root.innerHTML =
            products.map((p: any) => productCard(d, p)).join("") ||
                empty("Produk tidak ditemukan");
    }
    else if (productView === "units") {
        const units = d.units.filter((u: any) => products.some((p: any) => p.id === u.product_id));
        root.className = "table-scroll";
        root.innerHTML = `<table class="data-table"><thead><tr><th>Kode unit</th><th>Produk</th><th>Outlet</th><th>Status</th><th>Pemilik</th><th></th></tr></thead><tbody>${units.map((u: any) => `<tr><td><strong>${esc(u.code)}</strong></td><td>${esc(d.products.find((p: any) => p.id === u.product_id)?.name)}</td><td>${esc(outlets().find((o: any) => o.id === u.outlet_id)?.name)}</td><td>${status(u.status)}</td><td>${esc(partners().find((p: any) => p.id === u.partner_id)?.name || "Milik toko")}</td><td><button class="btn sm" data-unit="${u.id}">Kelola</button></td></tr>`).join("")}</tbody></table>`;
    }
    else if (productView === "categories") {
        root.className = "panel-padding";
        root.innerHTML = `<div class="actions">${d.member.role === "owner" ? '<button class="btn primary" data-action="new-category">Tambah kategori</button>' : ""}</div><div class="simple-list">${[...new Set([...d.products.map((p: any) => p.category), ...(d.records.category || []).map((c: any) => c.name)])].map((c) => `<div><strong>${esc(c)}</strong><span>${d.products.filter((p: any) => p.category === c).length} produk</span></div>`).join("")}</div>`;
    }
    else {
        root.className = "panel-padding";
        root.innerHTML = `${d.member.role === "owner" ? '<button class="btn primary" data-action="new-outlet">Tambah outlet</button>' : ""}<div class="simple-list">${outlets()
            .map((o: any) => `<div><span><strong>${esc(o.name)}</strong><small>${esc(o.address)}</small></span><span>${d.units.filter((u: any) => u.outlet_id === o.id).length} unit</span></div>`)
            .join("")}</div>`;
    }
}
function filterBookings() {
    const q = $("#booking-search")?.value.toLowerCase() || "", day = $("#booking-date")?.value;
    const rows = d.bookings.filter((b: any) => (activeStatus === "all" || b.status === activeStatus) &&
        (b.code + " " + b.customer_name + " " + b.customer_phone)
            .toLowerCase()
            .includes(q) &&
        (!day || new Date(b.start_at).toISOString().slice(0, 10) === day));
    $("#booking-results").innerHTML = bookingTable(d, rows);
}
function drawCalendar() {
    const year = calendarDate.getFullYear(), month = calendarDate.getMonth(), first = new Date(year, month, 1), offset = (first.getDay() + 6) % 7;
    $("#calendar-title").textContent = first.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
    });
    const pid = $("#calendar-product")?.value;
    const cells = Array.from({ length: 42 }, (_, i) => {
        const day = new Date(year, month, i - offset + 1), start = day.getTime(), end = start + 86400000;
        const bookings = d.bookings.filter((b: any) => !["cancelled", "expired"].includes(b.status) &&
            b.start_at < end &&
            b.end_at > start &&
            (!pid ||
                d.items?.some((it: any) => it.booking_id === b.id && it.product_id === pid)));
        const maintenance = (d.records.maintenance || []).filter((m: any) => m.status !== "completed" &&
            m.start_at < end &&
            m.end_at > start &&
            (!pid ||
                d.units.find((u: any) => u.id === m.unit_id)?.product_id === pid));
        return `<div class="calendar-cell ${day.getMonth() !== month ? "outside" : ""} ${day.toDateString() === new Date().toDateString() ? "today" : ""}"><span>${day.getDate()}</span>${bookings
            .slice(0, 3)
            .map((b: any) => `<button class="calendar-event" data-booking="${b.id}" title="${esc(b.code)} · ${esc(b.customer_name)}">${esc(b.customer_name)}</button>`)
            .join("")}${maintenance
            .slice(0, 2)
            .map((m: any) => `<span class="calendar-event maintenance">${esc(d.units.find((u: any) => u.id === m.unit_id)?.code)} · Servis</span>`)
            .join("")}${bookings.length > 3 ? `<small>+${bookings.length - 3} lainnya</small>` : ""}</div>`;
    });
    $("#calendar-grid").innerHTML =
        `<div class="calendar-grid">${["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => `<div class="calendar-dayname">${day}</div>`).join("")}${cells.join("")}</div>`;
}
function reports() {
    const root = $("#report-results");
    if (!root)
        return;
    const start = epoch($("#report-from").value), end = epoch($("#report-to").value) + 86400000, kind = $("#report-kind").value;
    const ledger = d.ledger.filter((l: any) => l.created_at >= start && l.created_at < end), bookings = d.bookings.filter((b: any) => b.created_at >= start && b.created_at < end), income = ledger
        .filter((l: any) => l.direction === "in")
        .reduce((s: number, l: any) => s + l.amount, 0), expense = ledger
        .filter((l: any) => l.direction === "out" && l.account !== "partner_payable")
        .reduce((s: number, l: any) => s + l.amount, 0);
    $("#report-export").href =
        `/api/v1/reports/export?kind=ledger&from=${start}&to=${end}`;
    const table = (heads: string[], rows: string[][]) => `<div class="table-scroll"><table class="data-table"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>${!rows.length ? empty("Tidak ada data pada periode ini") : ""}</div>`;
    if (kind === "sales" || kind === "cashflow") {
        root.innerHTML =
            `<div class="report-metrics"><div><span>Pendapatan diterima</span><strong>${money(income)}</strong></div><div><span>Pengeluaran</span><strong>${money(expense)}</strong></div><div><span>${kind === "cashflow" ? "Arus kas bersih" : "Booking periode ini"}</span><strong>${kind === "cashflow" ? money(income - expense) : bookings.length}</strong></div></div>` +
                table(["Tanggal", "Keterangan", "Akun", "Nominal"], ledger.map((l: any) => [
                    date(l.created_at, true),
                    esc(l.note),
                    esc(l.account),
                    `<span class="${l.direction === "in" ? "green-text" : "orange-text"}">${l.direction === "in" ? "+" : "−"} ${money(l.amount)}</span>`,
                ]));
    }
    if (kind === "receivables") {
        const rows = bookings.filter((b: any) => b.total > b.paid && !["expired", "cancelled"].includes(b.status));
        root.innerHTML = table(["Kode booking", "Pelanggan", "Total", "Terbayar", "Sisa"], rows.map((b: any) => [
            esc(b.code),
            esc(b.customer_name),
            money(b.total),
            money(b.paid),
            money(b.total - b.paid),
        ]));
    }
    if (kind === "products") {
        const rows = d.products
            .map((p: any) => {
            const items = (d.items || []).filter((i: any) => i.product_id === p.id &&
                bookings.some((b: any) => b.id === i.booking_id &&
                    !["expired", "cancelled"].includes(b.status)));
            return {
                p,
                qty: items.length,
                revenue: items.reduce((s: number, i: any) => s + i.total, 0),
            };
        })
            .sort((a: any, b: any) => b.revenue - a.revenue);
        root.innerHTML = table(["Produk", "Unit tersewa", "Nilai sewa (sebelum diskon)"], rows.map((r: any) => [esc(r.p.name), String(r.qty), money(r.revenue)]));
    }
    if (kind === "utilization") {
        const periodDays = Math.max(1, Math.ceil((end - start) / 86400000));
        root.innerHTML =
            table(["Unit", "Produk", "Hari tersewa", "Utilisasi", "Pendapatan / modal"], d.units.map((u: any) => {
                const items = (d.items || []).filter((i: any) => i.unit_id === u.id), days = items.reduce((s: number, i: any) => {
                    const b = d.bookings.find((b: any) => b.id === i.booking_id);
                    return b && !["expired", "cancelled"].includes(b.status)
                        ? s +
                            Math.max(0, Math.min(end, b.end_at) - Math.max(start, b.start_at)) /
                                86400000
                        : s;
                }, 0);
                const revenue = items
                    .filter((i: any) => bookings.some((b: any) => b.id === i.booking_id && b.status === "completed"))
                    .reduce((s: number, i: any) => s + i.total, 0);
                return [
                    esc(u.code),
                    esc(d.products.find((p: any) => p.id === u.product_id)?.name),
                    days.toFixed(1),
                    Math.min(100, (days / periodDays) * 100).toFixed(1) + "%",
                    money(revenue) + " / " + money(u.purchase_price),
                ];
            })) +
                `<p class="report-note">Utilisasi dihitung dari jam sewa yang beririsan dengan periode. ROI memakai nilai sewa unit dari booking selesai, sebelum diskon.</p>`;
    }
    if (kind === "partner")
        root.innerHTML = table(["Mitra", "Hak bagi hasil", "Potongan", "Settlement dibayar"], partners().map((p: any) => {
            const s = (d.records.settlement || []).filter((s: any) => s.partner_id === p.id &&
                s.created_at >= start &&
                s.created_at < end);
            return [
                esc(p.name),
                money(s.reduce((n: number, s: any) => n + s.gross, 0)),
                money(s.reduce((n: number, s: any) => n + s.deductions, 0)),
                money(s.reduce((n: number, s: any) => n + s.net, 0)),
            ];
        }));
}
function shifts() {
    const shifts = d.records.shift || [];
    const active = shifts.find((s: any) => !s.closed_at);
    modal("Kas & shift kasir", `${active
        ? `<p class="field-hint">Shift dibuka ${new Date(active.opened_at).toLocaleString("id-ID")} · Modal ${money(active.opening_cash)}</p>${formHtml("close-shift", `<input name="id" type="hidden" value="${active.id}">${field("closing_cash", "Uang tunai fisik (Rp)", "number", active.opening_cash, true, 'min="0"')}${area("note", "Catatan selisih / penutupan")}`, "Tutup shift")}`
        : formHtml("open-shift", `${field("opening_cash", "Modal awal kas (Rp)", "number", 0, true, 'min="0"')}${select("outlet_id", "Outlet", outlets().map((o: any) => [o.id, o.name]))}`, "Buka shift")}<h3 class="section-subtitle">Riwayat shift</h3><div class="simple-list">${shifts
        .filter((s: any) => s.closed_at)
        .map((s: any) => `<div><span><strong>${date(s.opened_at, true)}</strong><small>Ekspektasi ${money(s.expected_cash)} · Fisik ${money(s.closing_cash)}</small></span><span>Selisih ${money(s.difference)}</span></div>`)
        .join("") || '<p class="field-hint">Belum ada shift yang ditutup.</p>'}</div>`);
}
function opname() {
    modal("Stok opname", formHtml("opname-form", `<p class="field-hint">Centang unit yang ditemukan secara fisik. Selisih dicatat dan tidak langsung mengubah status unit.</p><div class="manual-items">${d.units.map((u: any) => `<label class="checkbox"><input name="present" type="checkbox" value="${u.id}" checked><span><strong>${esc(u.code)}</strong> · ${esc(d.products.find((p: any) => p.id === u.product_id)?.name)}</span></label>`).join("")}</div>${area("note", "Catatan hasil opname")}`, "Simpan hasil opname"), true);
}
function customerDetail(id: string) {
    const c = d.customers.find((c: any) => c.id === id);
    const history = d.bookings.filter((b: any) => b.customer_id === id);
    modal("Profil pelanggan", `<div class="booking-detail-summary"><div><h3>${esc(c.name)}</h3><p>${esc(c.phone)} · ${esc(c.email || "Tanpa email")}</p></div>${status(c.blacklisted ? "late" : "active")}</div><p class="field-hint">${esc(c.address || "Alamat belum ditambahkan")}</p><h3 class="section-subtitle">${history.length} transaksi sewa</h3>${bookingTable(d, history)}<h3 class="section-subtitle">Catatan risiko</h3>${formHtml("customer-risk", `<input name="id" type="hidden" value="${id}">${area("notes", "Catatan pelanggan", c.notes || "")}<label class="checkbox"><input name="blacklisted" type="checkbox" ${c.blacklisted ? "checked" : ""}><span>Blokir booking online untuk pelanggan ini (blacklist).</span></label>`, "Simpan catatan")}${d.member.role === "owner" ? `<button class="btn danger full" style="margin-top:20px" data-anonymize="${id}">Anonimkan data atas permintaan pelanggan</button>` : ""}`, true);
}
function saveCart() {
    try {
        sessionStorage.setItem("radix-outdoor-cart", JSON.stringify(cart));
    }
    catch { /* Empty local preferences are safe to ignore. */ }
    const n = $("#cart-count");
    if (n)
        n.textContent = cart.reduce((s, i) => s + i.qty, 0);
}
function publicApi(path: string, body?: any, key?: string) {
    return api("/api/v1/public/" + path, body, "POST", key);
}
function storeDates() {
    return {
        start_at: epoch($("#store-start")?.value || dt(Date.now() + 86400000)),
        end_at: epoch($("#store-end")?.value || dt(Date.now() + 3 * 86400000)),
    };
}
function cartModal() {
    idem = crypto.randomUUID();
    selectedQuote = null;
    modal("Keranjang petualanganmu", `${!cart.length
        ? empty("Keranjang masih kosong", "Pilih alat untuk memulai petualangan.")
        : `<form id="cart-form"><div class="form-grid">${field("start_at", "Tanggal & jam ambil", "datetime-local", dt(storeDates().start_at))}${field("end_at", "Tanggal & jam kembali", "datetime-local", dt(storeDates().end_at))}</div>${cart
            .map((it: any) => {
            const p = store.products.find((p: any) => p.id === it.product_id);
            return `<div class="cart-line">${productArt(p)}<div><h3>${esc(p.name)}</h3><small>${money(p.price)} / hari</small></div><input type="number" min="1" max="100" value="${it.qty}" data-cart-qty="${it.product_id}" aria-label="Jumlah ${esc(p.name)}"><button type="button" class="icon-btn" data-remove-cart="${it.product_id}" aria-label="Hapus">${icon("close", 14)}</button></div>`;
        })
            .join("")}${bundleId ? '<p class="field-hint">Harga paket aktif. Mengubah jumlah item akan memakai harga katalog biasa.</p>' : ""}${field("voucher_code", "Punya kode voucher?", "text", "", false)}<div id="cart-quote"></div><div class="modal-actions"><button class="btn" type="button" data-action="quote-cart">Cek stok & harga</button><button class="btn primary" type="submit">Lanjut checkout ${icon("arrow", 16)}</button></div></form>`}`, true);
    if (cart.length)
        safe(async () => {
            await cartQuote();
        });
}
function cartPayload() {
    const v = values($("#cart-form"));
    return {
        items: cart,
        start_at: epoch(v.start_at),
        end_at: epoch(v.end_at),
        voucher_code: v.voucher_code,
        bundle_id: bundleId || undefined,
    };
}
let checkoutPayload: any = null;
async function cartQuote() {
    const payload = cartPayload();
    selectedQuote = await publicApi("quote", payload);
    checkoutPayload = payload;
    $("#cart-quote").innerHTML = quoteBox(selectedQuote);
    return selectedQuote;
}
function checkout() {
    modal("Satu langkah menuju alam.", `<form id="checkout-form"><div class="notice">${icon("shield", 18)}<span>Foto identitas disimpan privat. Bawa KTP/SIM asli saat mengambil alat. Tanpa deposit uang.</span></div><div class="form-grid">${field("name", "Nama sesuai identitas")}${field("phone", "Nomor WhatsApp", "tel")}${field("email", "Email (opsional)", "email", "", false)}${select("outlet_id", "Outlet pengambilan", store.outlets.map((o: any) => [o.id, o.name]))}</div>${area("address", "Alamat")}${field("identity", "Foto KTP / SIM", "file", "", true, 'accept="image/jpeg,image/png,image/webp"')}<p class="field-hint">Maksimal 5 MB · JPG, PNG, WebP. Akses dokumen hanya untuk admin toko.</p>${quoteBox(selectedQuote)}<label class="checkbox" style="margin-top:20px"><input name="consent" type="checkbox" required><span>Saya menyetujui <a class="text-link" href="/terms" target="_blank">syarat sewa dan kebijakan privasi</a>, termasuk penggunaan identitas untuk verifikasi.</span></label><div class="modal-actions"><button type="button" class="btn" data-action="cart">Kembali</button><button class="btn primary" type="submit">Booking sekarang ${icon("arrow", 16)}</button></div></form>`, true);
}
function publicBooking(b: any, created = false) {
    const target = $("#lookup-results");
    const content = `<div class="booking-detail-summary"><div><h3>${created ? "Booking berhasil!" : esc(b.customer_name || "Status booking")}</h3><p class="booking-code">${esc(b.code)}</p></div>${status(shownStatus(b))}</div><p class="field-hint">Simpan kode booking dan gunakan nomor WhatsApp yang sama untuk melihat status.</p><div class="detail-grid"><div><small>JADWAL AMBIL</small><strong>${new Date(b.start_at).toLocaleString("id-ID")}</strong></div><div><small>JADWAL KEMBALI</small><strong>${new Date(b.end_at).toLocaleString("id-ID")}</strong></div><div><small>TOTAL SEWA</small><strong>${money(b.total)}</strong></div><div><small>DP MINIMUM</small><strong>${money(b.dp)}</strong></div></div>${b.expires_at && b.status === "pending_payment" ? `<div class="notice warning">Bayar sebelum ${new Date(b.expires_at).toLocaleString("id-ID")}. Reservasi dilepas otomatis setelah batas waktu.</div>` : ""}<h3 class="section-subtitle">Instruksi pembayaran</h3><div class="quote-summary"><div><span>${esc(store.store.settings.bank_name)}</span><span>${esc(store.store.settings.bank_account || "Rekening belum dikonfigurasi")}</span></div><div><span>Atas nama</span><span>${esc(store.store.settings.bank_owner || "Hubungi toko")}</span></div><div><span>${b.paid < b.dp ? "DP yang perlu dibayar" : "Sisa tagihan"}</span><span>${money(b.paid < b.dp ? b.dp - b.paid : b.total - b.paid)}</span></div></div>${b.total > b.paid && !["expired", "cancelled"].includes(b.status) ? `<div class="actions" style="margin-top:20px"><button class="btn" data-public-qris>Bayar dengan QRIS</button><button class="btn primary" data-public-proof>Unggah bukti pembayaran</button></div>` : ""}<div id="public-payment-panel"></div><h3 class="section-subtitle">Pembayaran</h3><div class="simple-list">${(b.payments || []).map((p: any) => `<div><span>${money(p.amount)} · ${esc(p.method)}</span>${status(p.status === "confirmed" ? "paid" : p.status)}</div>`).join("") || '<p class="field-hint">Belum ada pembayaran diterima.</p>'}</div><div class="detail-actions"><a class="btn" href="https://wa.me/${esc(store.store.settings.phone)}?text=${encodeURIComponent("Halo, saya ingin menanyakan booking " + b.code)}" target="_blank">Hubungi toko</a><button class="btn" data-public-refresh>Perbarui status</button>${["pending_payment", "confirmed"].includes(b.status) ? '<button class="btn danger" data-public-cancel>Batalkan booking</button>' : ""}</div>`;
    lastBooking = b;
    if (target) {
        target.innerHTML = `<section class="panel form-body">${content}</section>`;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    else
        modal(created ? "Booking kamu siap diproses" : "Status booking", content, true);
}
function storeSearch() {
    const q = $("#store-search")?.value.toLowerCase() || "", category = $("#store-category")?.value;
    const products = store.products.filter((p: any) => p.name.toLowerCase().includes(q) &&
        (!category || p.category === category));
    $("#store-products").innerHTML =
        products.map((p: any) => productCard(store, p, true)).join("") ||
            empty("Perlengkapan tidak ditemukan", "Coba nama atau kategori lain.");
}
function initPage() {
    if (page === "calendar")
        drawCalendar();
    if (page === "reports")
        reports();
    if (page === "products")
        renderProductResults();
}
async function action(name: string) {
    const mapping: Record<string, string> = {
        "new-customer": "customer",
        "new-partner": "partner",
        "new-outlet": "outlet",
        "new-category": "category",
        "new-voucher": "voucher",
        "new-expense": "expense",
        "new-price-rule": "price_rule",
        "new-bundle": "bundle",
        "new-maintenance": "maintenance",
        "new-member": "member",
    };
    if (mapping[name])
        return genericForm(mapping[name]);
    if (name === "new-booking")
        return newBooking();
    if (name === "new-product")
        return productForm();
    if (name === "quote-manual") {
        const q = await api("/api/v1/quote", manualPayload());
        $("#manual-quote").innerHTML = quoteBox(q);
        return;
    }
    if (name === "menu")
        return $(".sidebar").classList.toggle("open");
    if (name === "clear-signature") {
        const c = $("#signature");
        c.getContext("2d").clearRect(0, 0, c.width, c.height);
        signatureUsed = false;
        return;
    }
    if (name === "copy-store") {
        await navigator.clipboard.writeText(location.origin + "/");
        toast("Link toko berhasil disalin");
        return;
    }
    if (name === "notifications") {
        return modal("Notifikasi & tugas harian", `<p class="field-hint">WhatsApp dikirim semi-manual. Buka pesan terisi, lalu kirim dari WhatsApp Anda.</p>${(d.records.notification || []).map((n: any) => `<div class="notification-item"><h3>${esc(n.title)}</h3><p>${esc(n.message)}</p><small>${new Date(n.created_at).toLocaleString("id-ID")}</small>${n.booking_id ? `<button class="btn sm" data-booking="${n.booking_id}" style="margin-top:10px">Lihat booking</button>` : ""}</div>`).join("") || empty("Tidak ada notifikasi baru")}<h3 class="section-subtitle">Pengingat pelanggan</h3><div class="simple-list">${d.bookings
            .filter((b: any) => ["confirmed", "picked_up"].includes(b.status))
            .map((b: any) => `<div><span><strong>${esc(b.customer_name)}</strong><small>${esc(b.code)} · ${statusLabelsClient(shownStatus(b))}</small></span><button class="btn sm" data-booking="${b.id}">Kirim pengingat</button></div>`)
            .join("")}</div>`);
    }
    if (name === "global-search") {
        modal("Cari di Radix Outdoor", `<label class="search-field full">${icon("search", 18)}<input id="global-search-input" placeholder="Nama pelanggan, kode booking, produk..."></label><div id="global-search-results"><p class="field-hint">Ketik untuk mencari booking dan perlengkapan.</p></div>`);
        return;
    }
    if (name === "scan") {
        modal("Cari kode booking / unit", `<form id="scan-form">${field("code", "Kode booking atau kode unit", "text", "", true, 'placeholder="RX-... atau TND-001"')}<p class="field-hint">Gunakan pemindai QR perangkat atau ketik kode secara manual.</p><button class="btn primary full">Cari kode ${icon("scan", 16)}</button></form>`);
        return;
    }
    if (name === "shifts")
        return shifts();
    if (name === "opname")
        return opname();
    if (name === "help")
        return modal("Pusat bantuan", `<div class="notice">Mulai dari katalog → booking → pembayaran → serah-terima → pengembalian → selesai.</div><h3 class="section-subtitle">Panduan cepat</h3><p>1. Atur profil, rekening, dan kebijakan sewa di Pengaturan.<br>2. Tambahkan produk beserta unit fisiknya.<br>3. Bagikan storefront untuk menerima booking online.<br>4. Konfirmasikan pembayaran dan lakukan checklist saat alat diambil serta kembali.</p><h3 class="section-subtitle">Pembayaran & jaminan</h3><p>Pembayaran v1 diverifikasi manual. Jaminan berupa identitas asli, tanpa deposit uang. Ledger disimpan tetap untuk pelacakan keuangan.</p><a class="btn full" style="margin-top:25px" href="/guide" target="_blank">Buka FAQ penyewa ${icon("external", 15)}</a>`);
    if (name === "print-report") {
        window.print();
        return;
    }
    if (name === "cart")
        return cartModal();
    if (name === "quote-cart")
        return cartQuote();
}
document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("button,a,[data-open-booking],[data-product-id]") as HTMLElement;
    if (!el)
        return;
    const ds = el.dataset;
    if (el.hasAttribute("data-close-modal"))
        return closeModal();
    if (el.hasAttribute("data-print"))
        return window.print();
    if (ds.action) {
        e.preventDefault();
        safe(() => action(ds.action!), el.tagName === "BUTTON" ? (el as HTMLButtonElement) : undefined);
        return;
    }
    if (ds.booking || ds.openBooking) {
        e.preventDefault();
        safe(() => openBooking(ds.booking || ds.openBooking!));
        return;
    }
    if (ds.bookingAction) {
        safe(async () => bookingActionForm(ds.bookingAction!));
        return;
    }
    if (ds.product) {
        productForm(ds.product);
        return;
    }
    if (ds.unit) {
        unitForm(ds.unit);
        return;
    }
    if (ds.customer) {
        customerDetail(ds.customer);
        return;
    }
    if (ds.filterStatus) {
        activeStatus = ds.filterStatus;
        $$("[data-filter-status]").forEach((b) => b.classList.toggle("active", b === el));
        filterBookings();
        return;
    }
    if (ds.productView) {
        productView = ds.productView;
        $$("[data-product-view]").forEach((b) => b.classList.toggle("active", b === el));
        renderProductResults();
        return;
    }
    if (ds.productUnits) {
        productView = "units";
        closeModal();
        if (page === "products") {
            $$("[data-product-view]").forEach((b) => b.classList.toggle("active", b.dataset.productView === "units"));
            renderProductResults();
        }
        return;
    }
    if (ds.calendarStep) {
        calendarDate.setMonth(calendarDate.getMonth() + Number(ds.calendarStep));
        drawCalendar();
        return;
    }
    if (el.hasAttribute("data-calendar-today")) {
        calendarDate = new Date();
        drawCalendar();
        return;
    }
    if (ds.archiveProduct) {
        modal("Arsipkan produk?", formHtml("archive-form", `<input name="id" type="hidden" value="${ds.archiveProduct}"><p>Produk akan dihapus dari katalog. Riwayat transaksi tetap tersimpan.</p>`, "Arsipkan produk"));
        return;
    }
    if (ds.anonymize) {
        modal("Anonimkan data pelanggan?", formHtml("anonymize-form", `<input name="id" type="hidden" value="${ds.anonymize}"><p>Nama, nomor telepon, email, dan alamat akan dianonimkan. Riwayat transaksi tetap disimpan untuk laporan.</p><label class="checkbox"><input type="checkbox" required><span>Pelanggan telah meminta penghapusan data pribadi.</span></label>`, "Anonimkan data"));
        return;
    }
    if (ds.confirmPayment) {
        safe(async () => {
            await api("/api/v1/payments/" + ds.confirmPayment + "/confirm", {});
            await refresh();
            toast("Pembayaran dikonfirmasi");
        }, el as HTMLButtonElement);
        return;
    }
    if (ds.rejectPayment) {
        modal("Tolak bukti pembayaran", formHtml("reject-form", `<input name="id" type="hidden" value="${ds.rejectPayment}">${field("reason", "Alasan penolakan")}`, "Tolak bukti"));
        return;
    }
    if (ds.maintenanceComplete) {
        safe(async () => {
            await api("/api/v1/maintenance/" + ds.maintenanceComplete + "/complete", {});
            await refresh();
            toast("Perawatan selesai. Unit tersedia kembali.");
        }, el as HTMLButtonElement);
        return;
    }
    if (ds.settlement) {
        modal("Settlement bagi hasil", formHtml("settlement-form", `<input type="hidden" name="partner_id" value="${ds.settlement}"><p class="field-hint">Bagian mitra dihitung otomatis dari booking selesai yang belum disettlement.</p>${field("deductions", "Potongan perbaikan (Rp)", "number", 0, true, 'min="0"')}${area("note", "Catatan pembayaran")}<label class="checkbox"><input type="checkbox" required><span>Pembayaran ke mitra telah dilakukan dan nominal sesuai kesepakatan.</span></label>`, "Catat settlement"));
        return;
    }
    if(ds.memberEdit) {
        const member=d.members.find((m:any)=>m.id===ds.memberEdit);
        modal('Ubah akses staf',formHtml('member-access-form',`<input name="id" type="hidden" value="${esc(member.id)}"><p>${esc(member.name)} · ${esc(member.email)}</p>${select('role','Peran',[['admin','Admin / Kasir'],['warehouse','Gudang'],['partner','Mitra']],member.role)}${select('outlet_id','Outlet akses',[['','Tidak ada (untuk Mitra)'],...outlets().map((o:any)=>[o.id,o.name])],member.outlet_id||'')}${select('partner_id','Mitra terkait',[['','Tidak ada'],...(d.records.partner||[]).map((p:any)=>[p.id,p.name])],member.partner_id||'')}${field('password','Kata sandi baru (opsional)','password','',false,'minlength="12" autocomplete="new-password"')}<p class="field-hint">Kosongkan kata sandi untuk mempertahankan yang sekarang. Perubahan akses mencabut sesi aktif staf.</p>`));
        return;
    }
    if (ds.memberToggle) {
        safe(async () => {
            await api("/api/v1/users/" + ds.memberToggle, { active: ds.active !== "1" }, "PATCH");
            await refresh();
            toast("Hak akses diperbarui");
        });
        return;
    }
    if (ds.addCart) {
        const old = cart.find((i) => i.product_id === ds.addCart);
        if (old)
            old.qty++;
        else
            cart.push({ product_id: ds.addCart, qty: 1 });
        bundleId = "";
        saveCart();
        toast("Perlengkapan ditambahkan ke keranjang");
        return;
    }
    if (ds.productId && store) {
        const p = store.products.find((p: any) => p.id === ds.productId);
        modal(esc(p.name), `<div class="store-product-detail">${productArt(p)}<div class="gallery-thumbs">${JSON.parse(p.images || "[]")
            .map((src: string) => `<button class="gallery-thumb" data-gallery-image="${esc(src)}"><img src="${esc(src)}" alt="Foto ${esc(p.name)}"></button>`)
            .join("")}</div><span class="tag">${esc(p.category)}</span><h3>${money(p.price)} <small>/ hari</small></h3><p>${esc(p.description)}</p><p>Merek: ${esc(p.brand)}<br>Kapasitas: ${p.capacity} orang<br>Jaminan: identitas fisik KTP/SIM</p><button class="btn primary full" data-add-cart="${p.id}">${icon("plus", 17)}Tambahkan ke keranjang</button></div>`);
        return;
    }
    if (ds.bundle) {
        const b = store.bundles.find((b: any) => b.id === ds.bundle);
        cart = b.items.map((i: any) => ({ ...i }));
        bundleId = b.id;
        saveCart();
        cartModal();
        return;
    }
    if (ds.removeCart) {
        cart = cart.filter((i) => i.product_id !== ds.removeCart);
        bundleId = "";
        saveCart();
        cartModal();
        return;
    }
    if (el.hasAttribute("data-public-proof")) {
        const target = $("#public-payment-panel");
        idem = crypto.randomUUID();
        target.innerHTML = formHtml("proof-form", `${field("amount", "Nominal transfer (Rp)", "number", lastBooking.paid < lastBooking.dp ? lastBooking.dp - lastBooking.paid : lastBooking.total - lastBooking.paid, true, `min="1" max="${lastBooking.total - lastBooking.paid}"`)}${select("method", "Metode", [
            ["transfer", "Transfer bank"],
            ["qris", "QRIS"],
        ])}${field("file", "Foto bukti pembayaran", "file", "", true, 'accept="image/jpeg,image/png,image/webp"')}`, "Kirim bukti");
        return;
    }
    if (el.hasAttribute("data-public-refresh")) {
        safe(async () => publicBooking(await publicApi("lookup", lookupCredentials)));
        return;
    }
    if (el.hasAttribute("data-public-qris")) {
        safe(async () => {
            const qr = await publicApi("qris", lookupCredentials);
            $("#public-payment-panel").innerHTML =
                `<div class="qr-box">${qr.svg}</div><p class="field-hint">QRIS ${money(qr.amount)} · Setelah membayar, unggah bukti untuk verifikasi.</p>`;
        });
        return;
    }
    if (el.hasAttribute("data-public-cancel")) {
        modal("Batalkan booking?", formHtml("public-cancel-form", "<p>Reservasi alat akan dilepas. Untuk refund pembayaran, hubungi toko sesuai kebijakan sewa.</p>", "Batalkan booking"));
        return;
    }
});
document.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "booking-search")
        filterBookings();
    if (t.id === "product-search")
        renderProductResults();
    if (t.id === "customer-search")
        $("#customer-results").innerHTML = customerTable(d, d.customers.filter((c: any) => (c.name + " " + c.phone + " " + c.email)
            .toLowerCase()
            .includes(t.value.toLowerCase())));
    if (t.id === "store-search")
        storeSearch();
    if (t.id === "global-search-input") {
        const q = t.value.toLowerCase();
        const books = d.bookings
            .filter((b: any) => (b.code + " " + b.customer_name).toLowerCase().includes(q))
            .slice(0, 7), products = d.products
            .filter((p: any) => p.name.toLowerCase().includes(q))
            .slice(0, 5);
        $("#global-search-results").innerHTML = q
            ? [
                ...books.map((b: any) => `<button class="global-result full" style="border:0;background:transparent" data-booking="${b.id}"><span>${esc(b.customer_name)}<small style="display:block;margin-top:5px">${esc(b.code)}</small></span>${status(shownStatus(b))}</button>`),
                ...products.map((p: any) => `<button class="global-result full" style="border:0;background:transparent" data-product="${p.id}"><span>${esc(p.name)}</span><small>${money(p.price)} / hari</small></button>`),
            ].join("") || empty("Tidak ada hasil")
            : '<p class="field-hint">Ketik untuk mulai mencari.</p>';
    }
});
document.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "booking-date")
        filterBookings();
    if (t.id === "product-category")
        renderProductResults();
    if (t.id === "calendar-product")
        drawCalendar();
    if (t.id?.startsWith("report-"))
        reports();
    if (t.id === "store-category")
        storeSearch();
    if (t.dataset.cartQty) {
        const it = cart.find((i) => i.product_id === t.dataset.cartQty);
        it.qty = Math.max(1, Number(t.value));
        bundleId = "";
        saveCart();
        safe(cartQuote);
    }
    if (t.id === "chart-period")
        drawRevenueChart(t.value);
});
document.addEventListener("submit", (e) => {
    const form = e.target as HTMLFormElement;
    if (!form.id)
        return;
    e.preventDefault();
    const button = $("button[type=submit],button:not([type])", form);
    safe(async () => {
        const v = values(form);
        const done = async (message = "Data berhasil disimpan") => {
            closeModal();
            await refresh();
            toast(message);
        };
        if (form.id === "booking-form") {
            const b = await api("/api/v1/bookings", manualPayload(), "POST", idem);
            await refresh();
            await openBooking(b.id);
            toast("Booking berhasil dibuat");
        }
        else if (form.id === "payment-form") {
            await api("/api/v1/bookings/" + lastBooking.id + "/payments", { amount: Number(v.amount), method: v.method }, "POST", idem);
            await refresh();
            await openBooking(lastBooking.id);
            toast("Pembayaran dicatat");
        }
        else if ([
            "pickup-form",
            "return-form",
            "complete-form",
            "cancel-form",
            "extend-form",
        ].includes(form.id)) {
            const action = form.id.split("-")[0], body: any = { ...v };
            if (action === "pickup") {
                if (!signatureUsed)
                    throw new Error("Tanda tangan penyewa diperlukan");
                body.checked = !!v.checked;
                body.photo = await uploadInput($("[name=photo]", form));
                const canvas = $("#signature") as HTMLCanvasElement;
                const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
                const f = new FormData();
                f.append("file", blob, "signature.png");
                body.signature = (await api("/api/v1/uploads", f)).id;
            }
            if (action === "return") {
                body.item_ids = new FormData(form).getAll("item_ids");
                body.conditions = {};
                for (const key of Object.keys(v))
                    if (key.startsWith("condition_"))
                        body.conditions[key.slice(10)] = v[key];
                body.damage = Number(v.damage);
                body.photo = await uploadInput($("[name=photo]", form));
            }
            if (action === "complete")
                body.identity_returned = !!v.identity_returned;
            if (action === "cancel")
                body.refund = Number(v.refund) || 0;
            if (action === "extend")
                body.end_at = epoch(v.end_at);
            await api("/api/v1/bookings/" + lastBooking.id + "/" + action, body);
            await refresh();
            await openBooking(lastBooking.id);
            toast("Booking diperbarui");
        }
        else if (form.id === "product-form") {
            const photos = $("[name=photos]", form)?.files;
            let images = JSON.parse(v.existing_images || "[]");
            if (photos?.length) {
                if (photos.length > 5)
                    throw new Error("Maksimal 5 foto produk");
                images = [];
                for (const f of photos) {
                    const fd = new FormData();
                    fd.append("file", f);
                    const u = await api("/api/v1/uploads?kind=product", fd);
                    images.push("/media/" + u.id);
                }
            }
            const body = {
                ...v,
                images: JSON.stringify(images),
                image: images[0] || v.image,
                price: Number(v.price),
                capacity: Number(v.capacity),
                buffer_hours: Number(v.buffer_hours),
                quantity: Number(v.quantity),
                purchase_price: Number(v.purchase_price),
            };
            await api("/api/v1/products" + (v.id ? "/" + v.id : ""), body, v.id ? "PATCH" : "POST");
            await done("Produk berhasil disimpan");
        }
        else if (form.id === "unit-form") {
            await api("/api/v1/units/" + v.id, { ...v, partner_id: v.partner_id || null }, "PATCH");
            await done("Unit berhasil diperbarui");
        }
        else if(form.id==='member-access-form') {
            await api('/api/v1/users/'+v.id,{role:v.role,outlet_id:v.outlet_id||null,partner_id:v.partner_id||null,...(v.password?{password:v.password}:{})},'PATCH');
            await done('Akses staf diperbarui');
        }
        else if (form.id === "generic-form") {
            const kind = v._kind;
            delete v._kind;
            const paths: Record<string, string> = {
                customer: "/api/v1/customers",
                maintenance: "/api/v1/maintenance",
                member: "/api/v1/users",
            };
            if (["maintenance", "price_rule"].includes(kind)) {
                v.start_at = epoch(v.start_at);
                v.end_at = epoch(v.end_at);
            }
            if (kind === "voucher") {
                v.code = v.code.toUpperCase();
                v.active = true;
                v.used = 0;
            }
            if (kind === "bundle")
                v.items = $$("[data-bundle-item]")
                    .filter((i) => Number(i.value) > 0)
                    .map((i) => ({
                    product_id: i.dataset.bundleItem,
                    qty: Number(i.value),
                }));
            if (kind === "member") {
                v.outlet_id = v.outlet_id || null;
                v.partner_id = v.partner_id || null;
            }
            await api(paths[kind] || "/api/v1/records/" + kind, v);
            await done();
        }
        else if (form.id === "settings-form") {
            await api("/api/v1/settings", {...v, accepting_bookings:!!v.accepting_bookings}, "PATCH");
            await done("Pengaturan toko disimpan");
        }
        else if (form.id === "customer-risk") {
            await api("/api/v1/customers/" + v.id, { notes: v.notes, blacklisted: !!v.blacklisted }, "PATCH");
            await done("Catatan risiko diperbarui");
        }
        else if (form.id === "anonymize-form") {
            await api("/api/v1/customers/" + v.id, { anonymize: true }, "PATCH");
            await done("Data pribadi dianonimkan");
        }
        else if (form.id === "archive-form") {
            await api("/api/v1/products/" + v.id, {}, "DELETE");
            await done("Produk diarsipkan");
        }
        else if (form.id === "reject-form") {
            await api("/api/v1/payments/" + v.id + "/reject", { reason: v.reason });
            await done("Bukti pembayaran ditolak");
        }
        else if (form.id === "open-shift") {
            await api("/api/v1/shifts/open", v);
            await done("Shift kasir dibuka");
        }
        else if (form.id === "close-shift") {
            await api("/api/v1/shifts/" + v.id + "/close", v);
            await done("Shift ditutup dan selisih dicatat");
        }
        else if (form.id === "opname-form") {
            const present = new FormData(form).getAll("present");
            await api("/api/v1/stock/opname", {
                note: v.note,
                units: d.units.map((u: any) => ({
                    id: u.id,
                    present: present.includes(u.id),
                })),
            });
            await done("Hasil stok opname tersimpan");
        }
        else if (form.id === "settlement-form") {
            await api("/api/v1/settlements", v);
            await done("Settlement dibayar dan tercatat");
        }
        else if (form.id === "scan-form") {
            const book = d.bookings.find((b: any) => b.code.toLowerCase() === v.code.toLowerCase());
            if (book)
                return openBooking(book.id);
            const unit = d.units.find((u: any) => u.code.toLowerCase() === v.code.toLowerCase());
            if (unit)
                return unitForm(unit.id);
            throw new Error("Kode booking atau unit tidak ditemukan");
        }
        else if (form.id === "cart-form") {
            await cartQuote();
            checkout();
        }
        else if (form.id === "checkout-form") {
            const iddoc = await uploadInput($("[name=identity]", form), "/api/v1/public/uploads");
            const body = {
                ...checkoutPayload,
                outlet_id: v.outlet_id,
                consent: !!v.consent,
                customer: {
                    name: v.name,
                    phone: v.phone,
                    email: v.email,
                    address: v.address,
                    id_doc: iddoc,
                },
            };
            const b = await publicApi("bookings", body, idem);
            lookupCredentials = { code: b.code, phone: v.phone };
            cart = [];
            bundleId = "";
            saveCart();
            publicBooking(b, true);
        }
        else if (form.id === "lookup-form") {
            lookupCredentials = { code: v.code, phone: v.phone };
            const b = await publicApi("lookup", lookupCredentials);
            publicBooking(b);
        }
        else if (form.id === "proof-form") {
            const f = new FormData(form);
            f.append("code", lookupCredentials.code);
            f.append("phone", lookupCredentials.phone);
            await publicApi("proof", f, idem);
            publicBooking(await publicApi("lookup", lookupCredentials));
            toast("Bukti dikirim. Menunggu verifikasi admin.");
        }
        else if (form.id === "public-cancel-form") {
            await publicApi("cancel", lookupCredentials);
            closeModal();
            publicBooking(await publicApi("lookup", lookupCredentials));
            toast("Booking dibatalkan");
        }
    }, button);
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalRoot?.innerHTML)
        closeModal();
    if ((e.metaKey || e.ctrlKey) && e.key === "k" && d) {
        e.preventDefault();
        action("global-search");
    }
    if (e.key === "Tab" && modalRoot?.innerHTML) {
        const focusable = $$("button,a,input,select,textarea,[tabindex]", modalRoot).filter((x) => !x.disabled);
        const first = focusable[0], last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
        }
    }
});
if (d)
    initPage();
if (store) {
    try {
        cart = JSON.parse(sessionStorage.getItem("radix-outdoor-cart") || "[]").filter((i: any) => store.products.some((p: any) => p.id === i.product_id));
    }
    catch { /* Empty local preferences are safe to ignore. */ }
    saveCart();
}
document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("button") as HTMLElement;
    if (!el)
        return;
    const ds = el.dataset;
    if (ds.action === "import-products")
        modal("Impor katalog CSV", formHtml("import-form", `${select("outlet_id", "Outlet", outlets().map((o: any) => [o.id, o.name]))}${field("file", "Berkas CSV", "file", "", true, 'accept=".csv,text/csv"')}<p class="field-hint">Header wajib: name,category,brand,price,capacity,quantity. Maksimal 100 produk. Gunakan ekspor katalog sebagai contoh.</p>`, "Impor produk"));
});
document.addEventListener("submit", (e) => {
    const f = e.target as HTMLFormElement;
    if (![
        "import-form",
    ].includes(f.id))
        return;
    e.preventDefault();
    safe(async () => {
        const v = values(f);
        if (f.id === "import-form") {
            const file = $("[name=file]", f).files[0];
            const text = await file.text();
            const lines = text.trim().split(/\r?\n/), parse = (line: string) => {
                const a: string[] = [];
                let s = "", quoted = false;
                for (let i = 0; i < line.length; i++) {
                    const c = line[i];
                    if (c === '"') {
                        if (quoted && line[i + 1] === '"') {
                            s += '"';
                            i++;
                        }
                        else
                            quoted = !quoted;
                    }
                    else if (c === "," && !quoted) {
                        a.push(s);
                        s = "";
                    }
                    else
                        s += c;
                }
                a.push(s);
                return a;
            };
            const headers = parse(lines.shift()!).map((h) => h.replace(/^\uFEFF/, "").trim());
            const rows = lines.filter(Boolean).map((line: string) => {
                const cells = parse(line), row: any = {};
                headers.forEach((h, i) => (row[h] = cells[i]));
                return {
                    ...row,
                    price: Number(row.price),
                    capacity: Number(row.capacity || 1),
                    quantity: Number(row.quantity || 1),
                    description: row.description || "",
                    image: "tent",
                };
            });
            await api("/api/v1/products/import", { rows, outlet_id: v.outlet_id });
            closeModal();
            await refresh();
            toast(rows.length + " produk berhasil diimpor");
        }
    }, $("button[type=submit]", f));
});
let availabilityTimer: any;
async function updateAvailability() {
    if (!store || !$("#store-start"))
        return;
    const { start_at, end_at } = storeDates();
    const rows = await api(`/api/v1/public/availability?start=${start_at}&end=${end_at}`);
    for (const p of rows) {
        const card = $(`[data-product-id="${p.id}"]`);
        if (!card)
            continue;
        let label = $(".availability-label", card);
        if (!label) {
            label = document.createElement("span");
            $(".product-info", card).append(label);
        }
        label.className =
            "availability-label" + (p.available ? "" : " unavailable");
        label.textContent = p.available
            ? p.available + " unit tersedia pada tanggal ini"
            : "Tidak tersedia pada tanggal ini";
        const button = $("[data-add-cart]", card);
        if (button)
            button.disabled = !p.available;
    }
}
document.addEventListener("change", (e) => {
    const id = (e.target as HTMLElement).id;
    if (id === "store-start" || id === "store-end") {
        clearTimeout(availabilityTimer);
        availabilityTimer = setTimeout(() => safe(updateAvailability), 250);
    }
});
if (store && $("#store-start"))
    safe(updateAvailability);
function drawRevenueChart(period: string) {
    const now = new Date(), count = period === "month"
        ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        : 12;
    const vals = Array(count).fill(0);
    for (const l of d.ledger) {
        const at = new Date(l.created_at);
        if (l.direction !== "in" ||
            at.getFullYear() !== now.getFullYear() ||
            (period === "month" && at.getMonth() !== now.getMonth()))
            continue;
        vals[period === "month" ? at.getDate() - 1 : at.getMonth()] += l.amount;
    }
    const max = Math.max(...vals, 1000), x = (i: number) => 54 + (i * 565) / Math.max(1, count - 1), y = (n: number) => 178 - (n / max) * 125;
    const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    $(".chart-summary strong").textContent = money(vals.reduce((a, b) => a + b, 0));
    $(".chart").innerHTML =
        `<svg viewBox="0 0 650 230" role="img" aria-label="Tren pendapatan ${period === "month" ? "bulan ini" : "tahun ini"}">${[0, 1, 2, 3].map((n) => `<line x1="50" y1="${53 + n * 42}" x2="625" y2="${53 + n * 42}" stroke="#e9ece8" stroke-dasharray="3 4"/><text x="0" y="${57 + n * 42}" fill="#929991" font-size="10">${Math.round((max * (3 - n)) / 3 / 1000)} rb</text>`).join("")}<polyline points="${pts}" fill="none" stroke="#38745a" stroke-width="2.5" stroke-linejoin="round"/>${vals.map((v, i) => (v ? `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="#fff" stroke="#38745a" stroke-width="2"><title>${money(v)}</title></circle>` : "")).join("")}${vals.map((_, i) => (i % (period === "month" ? 3 : 1) === 0 ? `<text x="${x(i)}" y="211" text-anchor="middle" fill="#8b938e" font-size="10">${period === "month" ? i + 1 : ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][i]}</text>` : "")).join("")}</svg>`;
}
let cameraStream: MediaStream | null = null;
let cameraLoop: any;
document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("button") as HTMLElement;
    if (!el)
        return;
    if (el.dataset.galleryImage) {
        $(".store-product-detail .product-art").innerHTML =
            `<img src="${esc(el.dataset.galleryImage)}" alt="Foto produk">`;
    }
    if (el.dataset.action === "scan") {
        const f = $("#scan-form");
        if (f)
            f.insertAdjacentHTML("afterbegin", '<video id="scan-video" class="camera-scan" autoplay playsinline hidden></video><button type="button" class="btn full" style="margin-bottom:20px" data-camera-scan>Buka kamera untuk scan QR</button>');
    }
    if (el.hasAttribute("data-camera-scan"))
        safe(async () => {
            if (!("BarcodeDetector" in window))
                throw new Error("Pemindai kamera belum didukung browser ini. Gunakan input kode manual.");
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            const video = $("#scan-video") as HTMLVideoElement;
            video.hidden = false;
            video.srcObject = cameraStream;
            await video.play();
            const detector = new (window as any).BarcodeDetector({
                formats: ["qr_code"],
            });
            cameraLoop = setInterval(async () => {
                if (!$("#scan-video")) {
                    stopCamera();
                    return;
                }
                const found = await detector.detect(video);
                if (found.length) {
                    $("#scan-form [name=code]").value = found[0].rawValue;
                    stopCamera();
                    $("#scan-form").requestSubmit();
                }
            }, 500);
        });
    if (el.hasAttribute("data-close-modal"))
        stopCamera();
});
function stopCamera() {
    clearInterval(cameraLoop);
    cameraStream?.getTracks().forEach((t) => t.stop());
    cameraStream = null;
}
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
        stopCamera();
});
document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("[data-edit-booking]");
    if (!el)
        return;
    idem = crypto.randomUUID();
    const b = lastBooking;
    modal("Ubah booking", formHtml("edit-booking-form", `<p class="field-hint">${esc(b.code)} · Harga produk yang sudah dikonfirmasi tetap memakai snapshot awal.</p><div class="form-grid">${field("start_at", "Tanggal & jam ambil", "datetime-local", dt(b.start_at))}${field("end_at", "Tanggal & jam kembali", "datetime-local", dt(b.end_at))}</div><label>Item sewa</label><div class="manual-items">${d.products.map((p: any) => `<div class="manual-item"><span>${esc(p.name)}</span><input type="number" min="0" max="100" value="${b.items.filter((i: any) => i.product_id === p.id).length}" data-edit-item="${p.id}" aria-label="Jumlah ${esc(p.name)}"></div>`).join("")}</div>${area("note", "Catatan booking", b.note || "")}`, "Simpan perubahan"), true);
});
document.addEventListener("submit", (e) => {
    const f = e.target as HTMLFormElement;
    if (f.id !== "edit-booking-form")
        return;
    e.preventDefault();
    safe(async () => {
        const v = values(f);
        const b = await api("/api/v1/bookings/" + lastBooking.id, {
            start_at: epoch(v.start_at),
            end_at: epoch(v.end_at),
            note: v.note,
            items: $$("[data-edit-item]")
                .filter((i) => Number(i.value) > 0)
                .map((i) => ({
                product_id: i.dataset.editItem,
                qty: Number(i.value),
            })),
        }, "PATCH", idem);
        await refresh();
        await openBooking(b.id);
        toast("Tanggal dan item booking diperbarui");
    }, $("button[type=submit]", f));
});
document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("button") as HTMLElement;
    if (!el)
        return;
    if (el.hasAttribute("data-export-xlsx")) {
        const table = $("#report-results table");
        if (!table) {
            toast("Tidak ada tabel laporan untuk diekspor", true);
            return;
        }
        const rows = $$("tr", table).map((tr) => $$("th,td", tr).map((cell) => cell.innerText));
        const bytes = workbook(rows);
        const url = URL.createObjectURL(new Blob([bytes as any], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "radix-outdoor-" + $("#report-kind").value + ".xlsx";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    if (el.dataset.waiveFine)
        modal("Bebaskan denda", formHtml("waive-form", `<input name="id" type="hidden" value="${el.dataset.waiveFine}">${area("reason", "Alasan pembebasan denda (minimal 5 karakter)")}`, "Bebaskan denda"));
});
document.addEventListener("submit", (e) => {
    const f = e.target as HTMLFormElement;
    if (f.id !== "waive-form")
        return;
    e.preventDefault();
    safe(async () => {
        const v = values(f);
        await api("/api/v1/fines/" + v.id + "/waive", { reason: v.reason });
        await refresh();
        await openBooking(lastBooking.id);
        toast("Denda dibebaskan dan dicatat dalam audit");
    }, $("button[type=submit]", f));
});
document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("button") as HTMLButtonElement;
    if (!el)
        return;
    if (el.hasAttribute("data-run-housekeeping"))
        safe(async () => {
            const result = await api("/api/v1/operations/maintenance", {});
            await refresh();
            toast(`Housekeeping selesai: ${result.purged} identitas dihapus, ${result.reminders} pengingat dibuat.`);
        }, el);
    if (el.hasAttribute("data-create-backup"))
        safe(async () => {
            await api("/api/v1/backups", {});
            await refresh();
            toast("Backup tersimpan privat dan siap diunduh.");
        }, el);
});

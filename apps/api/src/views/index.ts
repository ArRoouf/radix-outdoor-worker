export const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const money = (n: number) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
}).format(n || 0);
export const date = (n: number, full = false) => new Date(n).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    ...(full ? { year: "numeric" } : {}),
});
export const icon = (name: string, size = 20) => {
    const paths: Record<string, string> = {
        dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        bookings: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4m8-4v4M8 10h8m-8 4h5m-5 4h8"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h.01m4 0h.01m4 0h.01"/>',
        products: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v10l9 5 9-5V8M12 13v10m-5-18 10 6"/>',
        customers: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-18a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 4v3"/>',
        finance: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18m-6 5h3M7 5V3h10"/>',
        reports: '<path d="M4 3v18h17M8 16v-5m5 5V7m5 9v-7"/>',
        partners: '<path d="m3 9 5-5 4 2 4-2 5 5-4 8-4 3-5-3-5-8Zm5-5 4 5 4 2-2 3-5-3m-3 4 4 4"/>',
        settings: '<path d="m10 3-1 3-3 1-3 3v4l3 3 3 1 1 3h4l1-3 3-1 3-3v-4l-3-3-3-1-1-3h-4Z"/><circle cx="12" cy="12" r="3"/>',
        search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
        bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        chevron: '<path d="m9 5 7 7-7 7"/>',
        down: '<path d="m6 9 6 6 6-6"/>',
        arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
        external: '<path d="M14 3h7v7m0-7L10 14m0-11H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
        trend: '<path d="m3 17 6-6 4 4 8-10m-6 0h6v6"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        store: '<path d="m3 9 2-6h14l2 6M4 10v11h16V10M9 21v-7h6v7M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
        wallet: '<path d="M20 8V5H5a3 3 0 0 0 0 6h16v10H5a3 3 0 0 1-3-3V8m14 6h5v4h-5z"/>',
        download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',
        filter: '<path d="M4 7h16M7 12h10m-7 5h4"/>',
        dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
        return: '<path d="M9 4 3 10l6 6m-6-6h12a6 6 0 0 1 0 12"/>',
        maintenance: '<path d="m14 6-2 4 2 2 4-2a6 6 0 0 1-7 7l-6 5-3-3 5-6a6 6 0 0 1 7-7Z"/>',
        mountain: '<path d="m2 20 7-15 5 10 3-6 5 11H2Zm4-9 3 2 2-2"/>',
        logout: '<path d="M9 21H3V3h6m6 5 5 4-5 4m-7-4h12"/>',
        close: '<path d="m6 6 12 12M6 18 18 6"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        shield: '<path d="m12 3 9 4v6c0 5-9 9-9 9s-9-4-9-9V7l9-4Z"/><path d="m8 12 3 3 5-6"/>',
        promotion: '<path d="m3 3 9 0 9 9-9 9-9-9V3Z"/><circle cx="8" cy="8" r="1.5"/>',
        help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3v3m-1 3h.01"/>',
        scan: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M6 12h12M8 8v8m4-8v8m4-8v8"/>',
        copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.products}</svg>`;
};
export const statusLabels: Record<string, string> = {
    pending_payment: "Menunggu bayar",
    confirmed: "Dikonfirmasi",
    picked_up: "Sedang disewa",
    returned: "Dikembalikan",
    completed: "Selesai",
    cancelled: "Dibatalkan",
    expired: "Kedaluwarsa",
    late: "Terlambat",
    available: "Tersedia",
    maintenance: "Maintenance",
    broken: "Rusak",
    lost: "Hilang",
    retired: "Nonaktif",
    pending: "Menunggu verifikasi",
    paid: "Lunas",
    trial: "Masa percobaan",
    active: "Aktif",
    suspended: "Ditangguhkan",
    grace: "Masa tenggang",
};
export const status = (s: string) => `<span class="badge ${esc(s)}"><i></i>${statusLabels[s] || esc(s)}</span>`;
export const shownStatus = (b: any) => b.status === "picked_up" && b.end_at < Date.now() ? "late" : b.status;
const initials = (name: string) => name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
const avatar = (name: string, i = 0) => `<span class="avatar a${i % 5}">${esc(initials(name))}</span>`;
const btn = (label: string, action: string, ico = "plus", style = "primary") => `<button class="btn ${style}" data-action="${action}">${icon(ico, 17)}${label}</button>`;
const empty = (message = "Belum ada data", sub = "Data yang Anda tambahkan akan muncul di sini.") => `<div class="empty">${icon("mountain", 36)}<h3>${message}</h3><p>${sub}</p></div>`;
const heading = (title: string, subtitle: string, actions = "") => `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="actions">${actions}</div></div>`;
const section = (title: string, subtitle: string, content: string, actions = "") => `<section class="panel"><div class="panel-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${actions}</div>${content}</section>`;
const navItems = [
    ["dashboard", "dashboard", "Ringkasan"],
    ["bookings", "bookings", "Booking"],
    ["calendar", "calendar", "Kalender sewa"],
    ["products", "products", "Produk & inventori"],
    ["customers", "customers", "Pelanggan"],
    ["break"],
    ["operations", "return", "Serah-terima"],
    ["maintenance", "maintenance", "Maintenance"],
    ["finance", "finance", "Keuangan"],
    ["reports", "reports", "Laporan"],
    ["partners", "partners", "Mitra konsinyasi"],
    ["promotions", "promotion", "Promo & paket"],
];
export function shell(d:any,page:string,content:string) {
    const role=d.member.role;
    const allowed=role==='partner'?['partners']:role==='warehouse'?['dashboard','bookings','calendar','products','operations','maintenance']:navItems.map(n=>n[0]);
    const pageName=navItems.find(n=>n[0]===page)?.[2]||({settings:'Pengaturan'} as any)[page]||'Ringkasan';
    const json=JSON.stringify(d).replace(/</g,'\\u003c');
    return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(pageName)} · Radix Outdoor</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/utilities.css"></head><body><aside class="sidebar"><a class="brand" href="/admin/dashboard"><span class="brand-mark">${icon('mountain',26)}</span>Radix Outdoor</a><div class="store-identity"><strong>Radix Outdoor</strong><small>${d.store.settings.demo?'Data contoh lokal':'Operasional penyewaan alat outdoor'}</small></div><div class="nav-label">MENU UTAMA</div><nav>${navItems.map(([id,ico,label])=>id==='break'?'<div class="nav-label secondary-label">OPERASIONAL</div>':allowed.includes(id)?`<a class="nav-link ${page===id?'active':''}" href="/admin/${id}">${icon(ico)}<span>${label}</span></a>`:'').join('')}</nav><div class="sidebar-bottom">${role==='owner'?`<a class="nav-link" href="/admin/settings">${icon('settings')}<span>Pengaturan</span></a>`:''}<a class="nav-link" href="/" target="_blank">${icon('store')}<span>Lihat katalog</span></a><a class="nav-link" href="/account/password">${icon('shield')}<span>Ubah kata sandi</span></a><div class="user-profile">${avatar(d.member.name)}<div><strong>${esc(d.member.name)}</strong><small>${esc(role)}</small></div><form method="post" action="/api/v1/auth/logout"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><button class="icon-btn" type="submit" aria-label="Keluar">${icon('logout',17)}</button></form></div></div></aside><div class="app"><header class="topbar"><div class="breadcrumb"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Buka menu">${icon('menu')}</button><span>Radix Outdoor</span>${icon('chevron',13)}<strong>${esc(pageName)}</strong></div><div class="topbar-actions"><button class="global-search" data-action="global-search">${icon('search',17)}<span>Cari sesuatu...</span></button><button class="icon-btn notification-btn" data-action="notifications" aria-label="Notifikasi">${icon('bell')}</button></div></header><main id="main">${content}</main><footer class="app-footer"><span>© ${new Date().getFullYear()} Radix Outdoor</span><span>Perlengkapan siap. Petualangan menanti.</span></footer></div><div id="modal-root"></div><div id="toast" role="status" aria-live="polite"></div><script type="application/json" id="app-data">${json}</script><script src="/htmx.js" defer></script><script src="/app.js" defer></script></body></html>`;
}
function bookingTable(d: any, bookings: any[], compact = false) {
    return `<div class="table-scroll"><table class="data-table bookings-table"><thead><tr><th>Booking / pelanggan</th><th>Periode sewa</th><th>Produk</th><th>Total tagihan</th><th>Status</th><th></th></tr></thead><tbody>${bookings.map((b, i) => `<tr data-open-booking="${b.id}"><td><div class="customer-cell">${avatar(b.customer_name, i)}<div><strong>${esc(b.customer_name)}</strong><small>${esc(b.code)}</small></div></div></td><td><strong class="normal">${date(b.start_at)} <span class="muted">→</span> ${date(b.end_at)}</strong><small>${Math.ceil((b.end_at - b.start_at) / 86400000)} hari sewa</small></td><td><span class="unit-count">${icon("products", 15)} ${b.item_count || 1} unit</span><small>${b.channel === "online" ? "Storefront" : b.channel === "whatsapp" ? "WhatsApp" : "Walk-in"}</small></td><td><strong class="normal">${money(b.total)}</strong><small class="${b.total > b.paid ? "orange-text" : "green-text"}">${b.total > b.paid ? "Sisa " + money(b.total - b.paid) : "Lunas"}</small></td><td>${status(shownStatus(b))}</td><td>${b.status === "picked_up" ? `<a class="btn sm" href="/admin/bookings/${b.id}/return">Kembalikan</a>` : ""}<button class="row-more" data-booking="${b.id}" aria-label="Detail booking">${icon("chevron", 17)}</button></td></tr>`).join("")}</tbody></table>${!bookings.length ? empty("Belum ada booking", "Buat booking pertama atau bagikan link toko Anda.") : ""}</div>`;
}
function dashboard(d: any) {
    const active = d.bookings.filter((b: any) => ["confirmed", "picked_up", "returned"].includes(b.status)), rented = d.bookings
        .filter((b: any) => b.status === "picked_up")
        .reduce((s: number, b: any) => s + (b.item_count || 1), 0), revenue = d.ledger
        .filter((l: any) => l.direction === "in" &&
        new Date(l.created_at).getMonth() === new Date().getMonth() &&
        new Date(l.created_at).getFullYear() === new Date().getFullYear())
        .reduce((s: number, l: any) => s + l.amount, 0), receivables = d.bookings
        .filter((b: any) => !["expired", "cancelled"].includes(b.status))
        .reduce((s: number, b: any) => s + b.total - b.paid, 0);
    const today = new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
    const sameDay = (n: number) => new Date(n).toLocaleDateString("en-CA", {
        timeZone: d.store.settings.timezone,
    }) ===
        new Date().toLocaleDateString("en-CA", {
            timeZone: d.store.settings.timezone,
        });
    const pickup = d.bookings.filter((b: any) => b.status === "confirmed" && sameDay(b.start_at)), returns = d.bookings.filter((b: any) => b.status === "picked_up" &&
        (sameDay(b.end_at) || b.end_at < Date.now())), pending = d.bookings.filter((b: any) => b.status === "pending_payment");
    const metrics = [
        [
            "Pendapatan bulan ini",
            money(revenue),
            "wallet",
            "Pembayaran yang telah diterima",
            "green",
        ],
        [
            "Booking aktif",
            String(active.length),
            "bookings",
            "Siap untuk petualangan berikutnya",
            "blue",
        ],
        [
            "Alat sedang disewa",
            String(rented),
            "products",
            "dari " + d.units.length + " unit inventori",
            "orange",
        ],
        [
            "Total piutang",
            money(receivables),
            "clock",
            "Tagihan yang belum diselesaikan",
            "purple",
        ],
    ];
    const monthly = Array.from({ length: 12 }, (_, i) => {
        const n = d.ledger
            .filter((l: any) => l.direction === "in" && new Date(l.created_at).getMonth() === i)
            .reduce((s: number, l: any) => s + l.amount, 0);
        return n;
    });
    const max = Math.max(...monthly, 100000);
    const points = monthly
        .map((n, i) => `${54 + i * 51},${178 - (n / max) * 125}`)
        .join(" ");
    const activePoints = monthly
        .map((n, i) => `${54 + i * 51},${178 - (n / max) * 125}`)
        .join(" L ");
    return `${heading("Ringkasan dashboard", "Selamat datang kembali. Semua tentang rentalmu, dalam satu tempat.", `<span class="date-label">${icon("calendar", 16)}${today}</span>`)}<section class="welcome-banner"><div><div class="eyebrow"><span class="live-dot"></span> PETUALANGAN DIMULAI DARI SINI</div><h2>Rental lebih rapi.<br>Petualangan tanpa henti.</h2><p>Kelola alat, booking, dan bisnismu bersama Radix Outdoor.</p><div class="banner-actions">${btn("Buat booking", "new-booking", "plus", "white")}<a class="banner-link" href="/" target="_blank">Lihat storefront ${icon("external", 15)}</a></div></div><span class="banner-caption">GUNUNG DI DEPAN.<br>SEMUA SIAP DI BELAKANG.</span><div class="banner-coordinate">7°32′ S &nbsp; 110°26′ E</div></section><div class="metrics">${metrics.map(([label, value, ico, sub, color], i) => `<section class="metric"><div class="metric-top"><span>${label}</span><span class="metric-icon ${color}">${icon(ico, 18)}</span></div><strong>${value}</strong><div class="metric-bottom"><span>${i === 0 ? '<span class="green-text">' + icon("check", 12) + "</span> " : ""}${sub}</span><svg viewBox="0 0 70 24" class="sparkline ${color}"><path d="M1 19 10 15 19 18 28 9 37 12 46 6 55 8 69 2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></div></section>`).join("")}</div><div class="dashboard-charts"><section class="panel revenue-panel"><div class="panel-head"><div><h2>Tren pendapatan</h2><p>Setiap langkah kecil, pertumbuhan besar.</p></div><select id="chart-period" aria-label="Periode grafik"><option value="year">Tahun ini</option><option value="month">Bulan ini</option></select></div><div class="chart-summary"><strong>${money(revenue)}</strong><span><i class="legend-dot"></i> Pendapatan sewa</span></div><div class="chart"><svg viewBox="0 0 650 230" role="img" aria-label="Grafik pendapatan berdasarkan ledger pembayaran"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#5d947b" stop-opacity="0.18"/><stop offset="100%" stop-color="#5d947b" stop-opacity="0"/></linearGradient></defs>${[0, 1, 2, 3].map((n) => `<line x1="50" y1="${53 + n * 42}" x2="625" y2="${53 + n * 42}" stroke="#e9ece8" stroke-dasharray="3 4"/><text x="0" y="${57 + n * 42}" fill="#929991" font-size="10">${Math.round((max * (3 - n)) / 3 / 1000)} rb</text>`).join("")}<path d="M54 179 L ${activePoints} L615 179Z" fill="url(#chartFill)"/><polyline points="${points}" fill="none" stroke="#38745a" stroke-width="2.5" stroke-linejoin="round"/>${monthly.map((n, i) => (n ? `<circle cx="${54 + i * 51}" cy="${178 - (n / max) * 125}" r="4" fill="#fff" stroke="#38745a" stroke-width="2"><title>${money(n)}</title></circle>` : "")).join("")}${["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((m, i) => `<text x="${54 + i * 51}" y="211" text-anchor="middle" fill="#8b938e" font-size="10">${m}</text>`).join("")}</svg></div></section><section class="panel tasks-panel"><div class="panel-head"><div><h2>Agenda hari ini <span class="small-pill">${pickup.length + returns.length + pending.length}</span></h2><p>Siapkan hari yang lebih teratur.</p></div>${icon("clock", 19)}</div><a class="task-row" href="/admin/operations"><span class="task-icon green">${icon("products", 20)}</span><div><strong>Pengambilan alat</strong><small>Booking siap diserahterimakan</small></div><b>${pickup.length}</b>${icon("chevron", 16)}</a><a class="task-row" href="/admin/operations?tab=return"><span class="task-icon orange">${icon("return", 20)}</span><div><strong>Pengembalian alat</strong><small>Periksa kelengkapan & kondisi</small></div><b>${returns.length}</b>${icon("chevron", 16)}</a><a class="task-row" href="/admin/finance"><span class="task-icon blue">${icon("wallet", 20)}</span><div><strong>Menunggu pembayaran</strong><small>Konfirmasi agar alat siap dipesan</small></div><b>${pending.length}</b>${icon("chevron", 16)}</a><div class="task-note">${icon("shield", 17)}<span>Periksa identitas dan kelengkapan<br>sebelum alat memulai perjalanan.</span></div></section></div><section class="panel recent-bookings"><div class="panel-head"><div><h2>Booking terbaru</h2><p>Pantau setiap perjalanan yang akan dimulai.</p></div><a class="text-link" href="/admin/bookings">Lihat semua ${icon("arrow", 16)}</a></div>${bookingTable(d, d.bookings.slice(0, 5), true)}</section><div class="dashboard-bottom"><section class="panel"><div class="panel-head"><div><h2>Kondisi inventori</h2><p>Alat terawat, pelanggan berangkat nyaman.</p></div><a class="text-link" href="/admin/products">Kelola ${icon("arrow", 16)}</a></div><div class="inventory-overview">${[
        [
            "Tersedia",
            d.units.filter((u: any) => u.status === "available").length,
            "green",
        ],
        [
            "Maintenance",
            d.units.filter((u: any) => u.status === "maintenance").length,
            "orange",
        ],
        [
            "Rusak / hilang",
            d.units.filter((u: any) => ["broken", "lost"].includes(u.status)).length,
            "red",
        ],
    ]
        .map(([label, n, color]) => `<div><span class="inventory-dot ${color}"></span><strong>${n}</strong><small>${label}</small></div>`)
        .join("")}</div></section><div class="tip-card"><span class="tip-icon">${icon("store", 25)}</span><div><span class="eyebrow">TOKOMU, SIAP DIJELAJAHI</span><h3>Booking bisa datang dari mana saja.</h3><p>Bagikan katalog online dan biarkan pelanggan memilih petualangannya.</p><button class="text-link" data-action="copy-store">Salin link toko ${icon("copy", 14)}</button></div></div></div>`;
}
function bookingsPage(d: any) {
    return `${heading("Booking", "Atur setiap pesanan, dari rencana sampai kembali pulang.", '<a class="btn primary" href="/admin/kasir">Buat booking</a>')}<div class="mini-stats">${[
        ["Semua booking", d.bookings.length],
        [
            "Menunggu bayar",
            d.bookings.filter((b: any) => b.status === "pending_payment").length,
        ],
        [
            "Sedang disewa",
            d.bookings.filter((b: any) => b.status === "picked_up").length,
        ],
        ["Selesai", d.bookings.filter((b: any) => b.status === "completed").length],
    ]
        .map(([l, n]) => `<div><span>${l}</span><strong>${n}</strong></div>`)
        .join("")}</div><section class="panel"><div class="tabs" data-tab-group="bookings"><button class="active" data-filter-status="all">Semua booking</button><button data-filter-status="pending_payment">Menunggu bayar</button><button data-filter-status="confirmed">Dikonfirmasi</button><button data-filter-status="picked_up">Sedang disewa</button><button data-filter-status="completed">Selesai</button></div><div class="table-toolbar"><label class="search-field">${icon("search", 18)}<input id="booking-search" placeholder="Cari kode booking, nama, atau WhatsApp..."></label><div class="actions"><input type="date" id="booking-date" aria-label="Tanggal pengambilan"><a class="btn" href="/api/v1/reports/export?kind=bookings">${icon("download", 16)}Ekspor</a></div></div><div id="booking-results">${bookingTable(d, d.bookings)}</div><div class="table-footer"><span>${d.bookings.length} booking ditampilkan</span><span>Terbaru terlebih dahulu</span></div></section>`;
}
export const productArt = (p: any) => `<div class="product-art ${esc(p.image || "tent")}">${p.image?.startsWith("http") || p.image?.startsWith("/media/") ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : p.image?.includes("tent") ? `<svg viewBox="0 0 180 120" fill="none"><ellipse cx="90" cy="104" rx="66" ry="7" fill="#000" opacity=".06"/><path d="m19 99 71-80 70 80H19Z" fill="${p.image === "tent2" ? "#d39250" : "#cbbf94"}"/><path d="m90 19 16 80h54L90 19Z" fill="${p.image === "tent2" ? "#a96737" : "#9f9b73"}"/><path d="m90 37-44 62h55L90 37Z" fill="#354f44"/><path d="m90 37 11 62H77l13-62Z" fill="#243d34"/><path d="m19 99-8 7m149-7 9 7M90 19V9" stroke="#6f7666" stroke-width="2"/></svg>` : p.image === "bag" ? `<svg viewBox="0 0 180 120"><path d="M68 25q22-17 44 0l9 67q-31 15-62 0l9-67" fill="#687968"/><rect x="68" y="43" width="44" height="43" rx="10" fill="#8b9b7f"/><path d="M72 25v-8h36v8M61 49l-9 5v32l10 3m57-40 9 5v32l-8 3" fill="none" stroke="#43564a" stroke-width="5"/><path d="M74 55h30m-30 15h30" stroke="#bec4a6" stroke-width="3"/></svg>` : p.image === "sleep" ? `<svg viewBox="0 0 180 120"><rect x="44" y="42" width="95" height="47" rx="22" transform="rotate(-20 90 65)" fill="#8d9b7b"/><ellipse cx="131" cy="51" rx="12" ry="22" transform="rotate(-20 131 51)" fill="#51674d"/><path d="m69 48 13 40m6-46 14 39m4-45 15 39" stroke="#64785b" stroke-width="2"/></svg>` : `<svg viewBox="0 0 180 120" fill="none"><ellipse cx="90" cy="97" rx="45" ry="7" fill="#000" opacity=".06"/>${p.image === "stove" || p.image === "cook" ? '<path d="M57 54h66v26q-33 27-66 0V54Z" fill="#9caaa7"/><ellipse cx="90" cy="54" rx="33" ry="9" fill="#c6cdca"/><path d="M65 91h50M90 37V26m-31 4 8 11m54-11-8 11" stroke="#4c665a" stroke-width="5"/>' : '<path d="m48 87 71-54m-59 63 70-54" stroke="#536b5b" stroke-width="8"/><path d="m46 88-8 7m93-54 8-7m-10-2 10-8" stroke="#a3ac90" stroke-width="5"/>'}</svg>`}</div>`;
function productsPage(d: any) {
    return `${heading("Produk & inventori", "Satu tempat untuk semua perlengkapan petualangan.", `<a class="btn" href="/api/v1/reports/export?kind=products">${icon("download", 16)}Ekspor katalog</a>${d.member.role === "owner" ? btn("Impor CSV", "import-products", "download", "") + btn("Tambah produk", "new-product") : ""}`)}<section class="panel"><div class="tabs" data-tab-group="products"><button class="active" data-product-view="products">Katalog produk <span>${d.products.length}</span></button><button data-product-view="units">Unit fisik <span>${d.units.length}</span></button><button data-product-view="categories">Kategori</button><button data-product-view="outlets">Outlet</button></div><div class="table-toolbar"><label class="search-field">${icon("search", 18)}<input id="product-search" placeholder="Cari nama produk atau kode unit..."></label><select id="product-category"><option value="">Semua kategori</option>${[...new Set(d.products.map((p: any) => p.category))].map((c) => `<option>${esc(c)}</option>`).join("")}</select></div><div id="product-results" class="product-grid">${d.products.map((p: any) => productCard(d, p)).join("")}</div></section>`;
}
export function productCard(d: any, p: any, publicMode = false) {
    const units = d.units?.filter((u: any) => u.product_id === p.id) || [];
    return `<article class="product-card" data-product-id="${p.id}"><div class="product-visual">${productArt(p)}<span class="product-category">${esc(p.category)}</span>${!publicMode ? `<button class="product-edit" data-product="${p.id}" aria-label="Kelola produk">${icon("dots", 18)}</button>` : ""}</div><div class="product-info"><small>${esc(p.brand || "Outdoor gear")}</small><h3>${publicMode?`<a href="/checkout?product=${esc(p.id)}">${esc(p.name)}</a>`:esc(p.name)}</h3><p>${icon("customers", 14)} ${p.capacity} orang <span>·</span> ${publicMode ? "Siap untuk petualangan" : units.length + " unit inventori"}</p><div class="product-price"><span><strong>${money(p.price)}</strong><small>/ hari</small></span>${publicMode ? `<button class="cart-add" data-add-cart="${p.id}" aria-label="Tambah ${esc(p.name)}">${icon("plus", 18)}</button><a class="text-link" href="/checkout?product=${esc(p.id)}">Sewa</a>` : `<span class="stock-label"><i></i>${units.filter((u: any) => u.status === "available" && !d.reservations?.some((r: any) => r.unit_id === u.id && r.start_at <= Date.now() && r.end_at > Date.now())).length} tersedia</span>`}</div></div></article>`;
}
function customersPage(d: any) {
    return `${heading("Pelanggan", "Kenali orang-orang di balik setiap petualangan.", `<a class="btn" href="/api/v1/reports/export?kind=customers">${icon("download", 16)}Ekspor</a>${btn("Tambah pelanggan", "new-customer")}`)}<section class="panel"><div class="table-toolbar"><label class="search-field">${icon("search", 17)}<input id="customer-search" placeholder="Cari nama, WhatsApp, atau email..."></label><span class="muted">${d.customers.length} pelanggan terdaftar</span></div><div id="customer-results">${customerTable(d, d.customers)}</div></section>`;
}
export function customerTable(d: any, customers: any[]) {
    return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Pelanggan</th><th>WhatsApp</th><th>Segmentasi</th><th>Riwayat sewa</th><th>Status</th><th></th></tr></thead><tbody>${customers.map((c, i) => `<tr><td><div class="customer-cell">${avatar(c.name, i)}<div><strong>${esc(c.name)}</strong><small>${esc(c.email || "Email belum ditambahkan")}</small></div></div></td><td>${esc(c.phone)}</td><td><span class="tag">${esc(c.segment)}</span></td><td>${d.bookings.filter((b: any) => b.customer_id === c.id).length} booking</td><td>${c.blacklisted ? '<span class="badge late"><i></i>Blacklist</span>' : '<span class="badge available"><i></i>Aktif</span>'}</td><td><button class="btn sm" data-customer="${c.id}">Detail ${icon("chevron", 14)}</button></td></tr>`).join("")}</tbody></table>${!customers.length ? empty("Pelanggan tidak ditemukan") : ""}</div>`;
}
function operations(d: any) {
    const pick = d.bookings.filter((b: any) => b.status === "confirmed"), ret = d.bookings.filter((b: any) => ["picked_up", "returned"].includes(b.status));
    return `${heading("Serah-terima & pengembalian", "Pastikan setiap alat siap berangkat dan kembali dengan baik.", `${btn("Cari kode booking", "scan", "scan")}${d.member.role === "owner" ? '<a class="btn" href="/admin/fine-components">Komponen denda</a>' : ""}`)}<div class="notice">${icon("shield", 20)}<div><strong>Jaminan berupa identitas, tanpa deposit uang.</strong><br>Terima KTP/SIM saat pengambilan dan kembalikan setelah pemeriksaan serta pelunasan.</div></div>${section("Siap diambil", pick.length + " booking menunggu penyerahan", bookingTable(d, pick))}${section("Menunggu pengembalian", ret.length + " booking sedang berjalan", bookingTable(d, ret))}`;
}
function calendarPage(d: any) {
    return `${heading("Kalender sewa", "Lihat jadwal alat, booking, dan waktu perawatan.", '<a class="btn primary" href="/admin/kasir">Buat booking</a>')}<section class="panel"><div class="panel-head"><div class="actions"><button class="icon-btn" data-calendar-step="-1" aria-label="Bulan sebelumnya">‹</button><h2 id="calendar-title"></h2><button class="icon-btn" data-calendar-step="1" aria-label="Bulan berikutnya">›</button></div><div class="actions"><select id="calendar-product"><option value="">Semua produk</option>${d.products.map((p: any) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select><button class="btn sm" data-calendar-today>Hari ini</button></div></div><div class="calendar-legend"><span><i class="legend-dot"></i>Booking</span><span><i class="legend-dot orange"></i>Maintenance</span><span>Buffer pembersihan ${d.store.settings.buffer_hours} jam setelah kembali</span></div><div id="calendar-grid"></div></section>`;
}
function maintenancePage(d: any) {
    const schedules = d.records.maintenance || [];
    return `${heading("Maintenance & stok opname", "Jaga kondisi alat untuk perjalanan yang lebih aman.", `${'<a class="btn" href="/admin/opnames">Stok opname</a>'}${btn("Jadwalkan servis", "new-maintenance", "plus")}`)}<div class="mini-stats">${[
        [
            "Dalam perawatan",
            d.units.filter((u: any) => u.status === "maintenance").length,
        ],
        [
            "Jadwal maintenance",
            schedules.filter((s: any) => s.status !== "completed").length,
        ],
        [
            "Rusak / hilang",
            d.units.filter((u: any) => ["broken", "lost"].includes(u.status)).length,
        ],
        ["Stok opname", (d.records.opname || []).length],
    ]
        .map(([l, n]) => `<div><span>${l}</span><strong>${n}</strong></div>`)
        .join("")}</div>${section("Jadwal perawatan", "Jadwal memblokir unit agar tidak dapat disewa.", schedules.length ? `<table class="data-table"><thead><tr><th>Unit</th><th>Perawatan</th><th>Jadwal</th><th>Biaya</th><th>Status</th><th></th></tr></thead><tbody>${schedules.map((s: any) => `<tr><td>${esc(d.units.find((u: any) => u.id === s.unit_id)?.code)}</td><td>${esc(s.reason)}</td><td>${date(s.start_at)} – ${date(s.end_at)}</td><td>${money(s.cost)}</td><td>${s.status === "completed" ? status("completed") : status("maintenance")}</td><td>${s.status !== "completed" ? `<button class="btn sm" data-maintenance-complete="${s.id}">Selesai servis</button>` : ""}</td></tr>`).join("")}</tbody></table>` : empty("Belum ada jadwal maintenance", "Tambahkan jadwal cuci, servis, atau perbaikan unit."))}${section("Unit yang perlu perhatian", "Kelola kondisi unit dari inventori.", `<div class="unit-attention">${d.units
        .filter((u: any) => u.status !== "available")
        .map((u: any) => `<div><span class="task-icon orange">${icon("maintenance")}</span><div><strong>${esc(u.code)}</strong><small>${esc(d.products.find((p: any) => p.id === u.product_id)?.name)}</small></div>${status(u.status)}<button class="btn sm" data-unit="${u.id}">Kelola</button></div>`)
        .join("") || empty("Semua unit dalam kondisi baik")}</div>`)}${section("Riwayat stok opname", "Hasil perhitungan fisik dan selisih sistem.", `<div class="simple-list">${(d.records.opname || []).map((o: any) => `<div><span><strong>${date(o.created_at, true)}</strong><small>${esc(o.note)}</small></span><span>${o.units.length} diperiksa · ${o.difference} selisih</span></div>`).join("") || empty("Belum ada stok opname")}</div>`)}`;
}
function financePage(d: any) {
    const pending = d.payments.filter((p: any) => p.status === "pending");
    const income = d.ledger
        .filter((l: any) => l.direction === "in")
        .reduce((s: number, l: any) => s + l.amount, 0), expense = d.ledger
        .filter((l: any) => l.direction === "out" && l.account !== "partner_payable")
        .reduce((s: number, l: any) => s + l.amount, 0);
    return `${heading("Keuangan", "Setiap rupiah tercatat, setiap keputusan lebih tepat.", `<a class="btn" href="/admin/cash-shifts">Kas & shift</a>${btn("Catat pengeluaran", "new-expense")}`)}<div class="mini-stats">${[
        ["Pemasukan", money(income)],
        ["Pengeluaran", money(expense)],
        ["Arus kas bersih", money(income - expense)],
        ["Perlu verifikasi", pending.length + " pembayaran"],
    ]
        .map(([l, n]) => `<div><span>${l}</span><strong>${n}</strong></div>`)
        .join("")}</div>${section("Verifikasi pembayaran", "Cocokkan bukti dengan mutasi rekening sebelum mengonfirmasi.", pending.length ? `<div class="simple-list">${pending.map((p: any) => `<div><span><strong>${esc(d.bookings.find((b: any) => b.id === p.booking_id)?.code)}</strong><small>${esc(p.method)} · ${money(p.amount)}</small></span><div class="actions">${p.proof ? `<a class="btn sm" href="/api/v1/files/${p.proof}" target="_blank">Lihat bukti</a>` : ""}<button class="btn sm" data-reject-payment="${p.id}">Tolak</button><button class="btn primary sm" data-confirm-payment="${p.id}">Konfirmasi</button></div></div>`).join("")}</div>` : empty("Tidak ada pembayaran menunggu", "Semua bukti pembayaran telah diperiksa."))}${section("Buku kas / ledger", "Catatan tetap. Koreksi dicatat melalui transaksi pembalik.", `<div class="table-scroll"><table class="data-table"><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Akun</th><th>Masuk</th><th>Keluar</th></tr></thead><tbody>${d.ledger.map((l: any) => `<tr><td>${date(l.created_at, true)}</td><td>${esc(l.note || "—")}</td><td><span class="tag">${({ rental_income: "Pendapatan sewa", fine_income: "Denda", expense: "Pengeluaran", refund: "Refund", partner_payable: "Utang mitra", partner_settlement: "Settlement" } as any)[l.account] || esc(l.account)}</span></td><td class="green-text">${l.direction === "in" ? money(l.amount) : "—"}</td><td>${l.direction === "out" ? money(l.amount) : "—"}</td></tr>`).join("")}</tbody></table></div>`, `<a class="btn sm" href="/api/v1/reports/export?kind=ledger">${icon("download", 15)}Ekspor CSV</a>`)}`;
}
function reportsPage(d: any) {
    return `${heading("Laporan bisnis", "Pahami pertumbuhan dan temukan peluang berikutnya.", `<a id="report-export" class="btn" href="/api/v1/reports/export?kind=ledger">${icon("download", 17)}Ekspor CSV</a><button class="btn" data-export-xlsx>${icon("download", 17)}Excel</button><button class="btn primary" data-action="print-report">${icon("download", 17)}Cetak / PDF</button>`)}<section class="panel"><div class="table-toolbar"><div class="actions"><label>Dari <input type="date" id="report-from" value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)}"></label><label>Sampai <input type="date" id="report-to" value="${new Date().toISOString().slice(0, 10)}"></label></div><select id="report-kind"><option value="sales">Penjualan / pendapatan</option><option value="receivables">Piutang</option><option value="utilization">Utilisasi & ROI unit</option><option value="products">Produk terlaris</option><option value="cashflow">Arus kas & laba rugi</option><option value="partner">Bagi hasil mitra</option></select></div><div id="report-results"></div></section>`;
}
function partnersPage(d: any) {
    return `${heading("Mitra konsinyasi", "Tumbuh bersama, dengan bagi hasil yang transparan.", d.member.role === "owner" ? `${btn("Tambah mitra", "new-partner")}<a class="btn" href="/admin/withdrawals">Penarikan barang</a>` : "")}<div class="partner-grid">${(d.records.partner || [])
        .map((p: any, i: number) => {
        const units = d.units.filter((u: any) => u.partner_id === p.id);
        return `<article class="panel partner-card"><div class="split">${avatar(p.name, i)}<span class="tag">Mitra konsinyasi</span></div><h2>${esc(p.name)}</h2><p>${esc(p.phone)}</p><div class="partner-numbers"><div><strong>${units.length}</strong><small>Unit titipan</small></div><div><strong>${p.share_percent}%</strong><small>Bagian mitra</small></div></div><div class="subtle-text">${esc(p.bank || "Rekening belum ditambahkan")}</div>${d.member.role === "owner" ? `<a class="btn full" href="/admin/settlements?partner_id=${p.id}">${icon("wallet", 16)}Buat draft settlement</a>` : ""}</article>`;
    })
        .join("")}</div>${section("Riwayat settlement", "Bagian mitra dihitung dari pendapatan unit setelah diskon proporsional.", `<div class="table-scroll"><table class="data-table"><thead><tr><th>Mitra</th><th>Tanggal</th><th>Hak mitra</th><th>Potongan</th><th>Nilai bersih</th><th>Status</th></tr></thead><tbody>${(d.records.settlement || []).map((s: any) => `<tr><td>${esc(d.records.partner.find((p: any) => p.id === s.partner_id)?.name)}</td><td>${date(s.created_at, true)}</td><td>${money(s.gross)}</td><td>${money(s.deductions)}</td><td>${money(s.net)}</td><td>${status(s.status)}${s.status === "draft" && d.member.role === "owner" ? '<a class="btn sm" href="/admin/settlements">Tinjau & bayar</a>' : ""}</td></tr>`).join("")}</tbody></table>${!(d.records.settlement || []).length ? empty("Belum ada settlement", "Pendapatan mitra tercatat setelah booking diselesaikan.") : ""}</div>`)}`;
}
function promotionsPage(d: any) {
    return `${heading("Promo & paket", "Buat petualangan jadi lebih mudah dijangkau.", `${btn("Aturan harga", "new-price-rule", "promotion", "")}${btn("Tambah voucher", "new-voucher")}`)}${section("Voucher", "Kode promo bisa digunakan saat checkout.", `<div class="voucher-grid">${(d.records.voucher || []).map((v: any) => `<article class="voucher-card"><span class="voucher-icon">${icon("promotion", 25)}</span><h3>${esc(v.code)}</h3><strong>${v.kind === "percent" ? v.value + "%" : money(v.value)} OFF</strong><p>Minimum ${money(v.min_total)}</p><div><span>${v.used || 0} / ${v.quota || "∞"} digunakan</span>${status(v.active ? "active" : "expired")}</div></article>`).join("") || empty("Belum ada voucher")}</div>`)}${section("Paket bundling", "Gabungkan produk dengan harga paket per hari.", `<div class="simple-list">${(d.records.bundle || []).map((b: any) => `<div><span><strong>${esc(b.name)}</strong><small>${esc(b.description)}</small></span><strong>${money(b.price)} / hari</strong></div>`).join("") || empty("Belum ada paket")}</div>`, '<a class="btn" href="/admin/packages">Kelola paket</a>')}${section("Aturan harga", "Urutan: member → season → weekend → tier → harga dasar.", `<div class="simple-list">${(d.records.price_rule || []).map((p: any) => `<div><span><strong>${esc(d.products.find((x: any) => x.id === p.product_id)?.name)}</strong><small>${esc(p.kind)} · Minimal ${p.min_days} hari</small></span><strong>${money(p.price)} / hari</strong></div>`).join("") || empty("Gunakan harga dasar", "Tambahkan aturan untuk harga khusus member, akhir pekan, atau sewa panjang.")}</div>`)}`;
}
function settingsPage(d: any) {
    const s = d.store.settings;
    const input = (name: string, label: string, type = "text") => `<label>${label}<input name="${name}" type="${type}" value="${esc(s[name] ?? "")}" ${type === "number" ? 'min="0"' : ""}></label>`;
    return `${heading("Pengaturan toko", "Buat Radix Outdoor bekerja dengan cara rentalmu.", '<a class="btn" href="/account/password">Ubah kata sandi</a>')}<div class="settings-grid"><section class="panel"><div class="panel-head"><div><h2>Profil & operasional</h2><p>Informasi yang tampil di storefront Anda.</p></div></div><form id="settings-form" class="form-body"><div class="form-grid"><label>Nama toko<input name="name" value="${esc(d.store.name)}" readonly required></label>${input("phone", "Nomor WhatsApp")}${input("email", "Email", "email")}${input("hours", "Jam operasional")}<label class="span-2">Alamat toko<input name="address" value="${esc(s.address)}"></label><label>Zona waktu<select name="timezone">${["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"].map((z) => `<option ${s.timezone === z ? "selected" : ""}>${z}</option>`).join("")}</select></label></div><h3 class="form-section-title">Kebijakan sewa</h3><div class="form-grid">${input("dp_percent", "DP minimum (%)", "number")}${input("buffer_hours", "Buffer pembersihan (jam)", "number")}${input("tolerance", "Toleransi sewa (menit)", "number")}${input("late_price", "Denda / unit / hari (Rp)", "number")}${input("expires_hours", "Batas pembayaran (jam)", "number")}</div><h3 class="form-section-title">Pembayaran manual</h3><div class="form-grid">${input("bank_name", "Nama bank")}${input("bank_account", "Nomor rekening")}${input("bank_owner", "Atas nama")}<label class="span-2">Payload QRIS statis<textarea name="qris_payload" rows="3" placeholder="Tempel payload QRIS milik toko Anda">${esc(s.qris_payload)}</textarea></label></div><h3 class="form-section-title">Syarat & privasi</h3><label>Syarat penyewaan<textarea name="terms" rows="4">${esc(s.terms)}</textarea></label><label>Kebijakan privasi<textarea name="privacy" rows="4">${esc(s.privacy)}</textarea></label><label class="checkbox"><input type="checkbox" name="accepting_bookings" ${s.accepting_bookings?"checked":""}><span>Aktifkan penerimaan booking baru</span></label><button class="btn primary" type="submit">${icon("check", 17)}Simpan pengaturan</button></form></section><div>${section("Tim & akses", "Staf dan mitra login dengan email serta kata sandi masing-masing.", `<div class="simple-list">${d.members.map((m: any) => `<div><span><strong>${esc(m.name)}</strong><small>${esc(m.email)} · ${esc(m.role)}</small></span>${m.role !== "owner" ? `<button class="btn sm" data-member-edit="${m.id}">Ubah akses</button><button class="btn sm" data-member-toggle="${m.id}" data-active="${m.active}">${m.active ? "Nonaktifkan" : "Aktifkan"}</button>` : status("active")}</div>`).join("")}</div><div class="panel-padding">${btn("Tambahkan anggota", "new-member", "plus", "full")}</div>`)}${section("Storefront", "Toko online untuk pelanggan Anda.", `<div class="panel-padding"><label class="store-url">${esc("/")}</label><div class="actions"><button class="btn" data-action="copy-store">${icon("copy", 16)}Salin link</button><a class="btn primary" href="/" target="_blank">Lihat toko ${icon("external", 15)}</a></div></div>`)}${section("Pemeliharaan & backup", "Retensi identitas 90 hari dan cadangan JSON privat.", `<div class="panel-padding"><div class="actions"><button class="btn" data-run-housekeeping>Jalankan housekeeping</button><button class="btn primary" data-create-backup>Buat backup</button></div><p class="field-hint" style="margin-top:15px">Cron produksi harus dikonfigurasi agar berjalan saat aplikasi tertutup.</p><div class="simple-list">${(d.records.backup || [])
        .slice(0, 5)
        .map((b: any) => `<div><span><strong>${date(b.created_at, true)}</strong><small>${Math.round(b.size / 1024)} KB · Privat</small></span><a class="btn sm" href="/api/v1/backups/${b.id}">Unduh</a></div>`)
        .join("")}</div></div>`)}${section("Audit log", "Jejak perubahan untuk kontrol toko.", `<div class="audit-list">${d.audit
        .slice(0, 10)
        .map((a: any) => `<div><span class="audit-dot"></span><div><strong>${esc(a.action)}</strong><small>${new Date(a.created_at).toLocaleString("id-ID")}</small></div></div>`)
        .join("")}</div>`)}</div></div>`;
}
export function renderPage(d: any, page: string): string {
    return (({
        dashboard,
        bookings: bookingsPage,
        products: productsPage,
        customers: customersPage,
        calendar: calendarPage,
        operations,
        maintenance: maintenancePage,
        finance: financePage,
        reports: reportsPage,
        partners: partnersPage,
        promotions: promotionsPage,
        settings: settingsPage,
    } as any)[page]?.(d) || empty("Halaman tidak ditemukan"));
}
export { bookingTable, heading, section, empty, avatar };
export function storeShell(d: any, content: string) {
    return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.store.name)} · Sewa Alat Outdoor</title><meta name="description" content="Sewa tenda, carrier, sleeping bag, dan perlengkapan camping. Booking online, ambil di toko."><meta name="theme-color" content="#254f40"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/utilities.css"></head><body class="store-body"><header class="store-header"><a class="brand" href="/"><span class="brand-mark">${icon("mountain", 27)}</span>Radix Outdoor<span class="brand-dot">.</span></a><nav><a href="/">Beranda</a><a href="/catalog">Katalog alat</a><a href="/guide">Cara sewa</a><a href="/lookup">Cek booking</a></nav><button class="btn primary" data-action="cart">${icon("products", 18)}Keranjang <span id="cart-count">0</span></button></header><main class="store-main">${!d.store.settings.accepting_bookings?'<div class="notice">Penerimaan booking baru sedang dinonaktifkan. Hubungi Radix Outdoor untuk informasi.</div>':""}${d.store.settings.demo ? '<div class="store-demo">Data contoh lokal · Lengkapi profil dan metode pembayaran sebelum menerima penyewa.</div>' : ""}${content}</main><footer class="store-footer"><div><a class="brand" href="/">Radix Outdoor<span class="brand-dot">.</span></a><p>Perlengkapan siap. Petualangan menanti.</p></div><div><strong>${esc(d.store.name)}</strong><p>${esc(d.store.settings.address)}</p><small>${esc(d.store.settings.hours)} · ${esc(d.store.settings.phone)}</small></div><div><a href="/terms">Syarat & privasi</a><a href="/guide">FAQ & cara sewa</a><a href="/admin/dashboard">Dashboard toko ${icon("external", 12)}</a></div></footer><a class="wa-float" href="https://wa.me/${esc(d.store.settings.phone)}?text=Halo%2C%20saya%20ingin%20sewa%20alat%20outdoor" target="_blank">${icon("customers", 19)}Tanya via WhatsApp</a><div id="modal-root"></div><div id="toast" role="status"></div><script type="application/json" id="store-data">${JSON.stringify(d).replace(/</g, "\\u003c")}</script><script src="/htmx.js" defer></script><script src="/app.js" defer></script></body></html>`;
}
export function storePage(d: any, page: string) {
    const base = "/";
    if (page === "lookup")
        return `<div class="store-page-title"><span class="eyebrow">PERJALANANMU</span><h1>Cek status booking.</h1><p>Masukkan kode booking dan nomor WhatsApp saat pemesanan.</p></div><form method="post" action="/booking/lookup" id="lookup-form" class="panel form-body lookup-box"><label>Kode booking<input name="code" placeholder="RX-2610-XXXXXXXXXX" required></label><label>Nomor WhatsApp<input name="phone" placeholder="08xxxxxxxxxx" required></label><button class="btn primary full">${icon("search", 17)}Cari booking</button></form><div id="lookup-results"></div>`;
    if (page === "guide")
        return `<div class="store-page-title"><span class="eyebrow">SEMUA DIMULAI DARI RENCANA</span><h1>Ke alam, tanpa ribet.</h1><p>Tiga langkah untuk memulai petualanganmu.</p></div><div class="guide-grid">${[
            [
                "01",
                "Pilih perlengkapan",
                "Tentukan tanggal ambil dan kembali, lalu pilih alat yang kamu butuhkan.",
            ],
            [
                "02",
                "Booking & bayar DP",
                "Isi identitas, setujui syarat sewa, dan unggah bukti pembayaran.",
            ],
            [
                "03",
                "Ambil & jelajahi",
                "Bawa KTP/SIM asli, lunasi sisa tagihan, dan cek kelengkapan bersama petugas.",
            ],
        ]
            .map(([n, h, p]) => `<article class="panel form-body"><span class="guide-number">${n}</span><h2>${h}</h2><p>${p}</p></article>`)
            .join("")}</div><section class="faq"><h2>Pertanyaan yang sering ditanyakan</h2>${[
            [
                "Apakah perlu deposit uang?",
                "Tidak. Jaminan v1 berupa KTP/SIM asli yang ditahan selama sewa dan dikembalikan setelah pemeriksaan serta pelunasan.",
            ],
            [
                "Bagaimana durasi sewa dihitung?",
                "Per 24 jam sejak waktu pengambilan, dengan toleransi " +
                    d.store.settings.tolerance +
                    " menit.",
            ],
            [
                "Bisa perpanjang sewa?",
                "Hubungi toko. Perpanjangan hanya dapat dilakukan jika unit belum dipesan pelanggan lain.",
            ],
            [
                "Bagaimana jika terlambat?",
                "Denda default " +
                    money(d.store.settings.late_price) +
                    " per unit per hari setelah toleransi.",
            ],
            [
                "Bagaimana cara membayar?",
                "Transfer bank atau QRIS toko, lalu unggah bukti. Pembayaran diperiksa manual oleh admin.",
            ],
        ]
            .map(([q, a]) => `<details><summary>${q}${icon("plus", 16)}</summary><p>${a}</p></details>`)
            .join("")}</section>`;
    if (page === "terms")
        return `<div class="store-page-title"><h1>Syarat sewa & privasi.</h1></div><section class="panel form-body"><h2>Syarat penyewaan</h2><p>${esc(d.store.settings.terms)}</p><h2>Kebijakan privasi</h2><p>${esc(d.store.settings.privacy)}</p><h2>Hubungi toko</h2><p>${esc(d.store.settings.address)}<br>${esc(d.store.settings.phone)}<br>${esc(d.store.settings.email)}</p></section>`;
    return `${page === "home" ? `<section class="store-hero"><img src="/images/camp.jpg" alt="Tenda untuk perjalanan berkemah di alam"><div><span class="eyebrow">${esc(d.store.name).toUpperCase()} · OUTDOOR RENTAL</span><h1>Lebih dekat<br>dengan alam.</h1><p>Perlengkapan terbaik untuk cerita berikutnya.<br>Sewa mudah, petualangan lebih leluasa.</p><a class="btn white" href="#catalog">Jelajahi perlengkapan ${icon("arrow", 18)}</a></div><span class="hero-bottom">PACK LIGHT. EXPLORE MORE.</span></section><div class="store-benefits"><span>${icon("shield", 20)}Alat terawat & diperiksa</span><span>${icon("calendar", 20)}Booking sesuai tanggalmu</span><span>${icon("store", 20)}Ambil langsung di toko</span></div>` : `<div class="store-page-title"><span class="eyebrow">PERLENGKAPAN PETUALANGAN</span><h1>Pilih teman perjalananmu.</h1><p>Dari camping pertama hingga puncak berikutnya.</p></div>`}<section id="catalog" class="store-catalog"><div class="store-section-title"><div><span class="eyebrow">SIAP UNTUK BERANGKAT</span><h2>Perlengkapan pilihan.</h2></div><span>${d.products.length} produk untuk dijelajahi</span></div><div class="store-filters"><label class="search-field">${icon("search", 18)}<input id="store-search" placeholder="Cari tenda, carrier, dan lainnya..."></label><select id="store-category"><option value="">Semua kategori</option>${[...new Set(d.products.map((p: any) => p.category))].map((c) => `<option>${esc(c)}</option>`).join("")}</select><label>Ambil<input type="datetime-local" id="store-start" value="${new Date(Date.now() + 86400000).toISOString().slice(0, 16)}"></label><label>Kembali<input type="datetime-local" id="store-end" value="${new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16)}"></label></div><div class="product-grid store-products" id="store-products">${d.products.map((p: any) => productCard(d, p, true)).join("")}</div></section>${d.bundles.length ? `<section class="store-bundles"><div><span class="eyebrow">SATU PAKET, BANYAK CERITA</span><h2>Berkemah jadi lebih simpel.</h2><p>Semua kebutuhan dalam satu paket hemat.</p></div>${d.bundles.map((b: any) => `<article><span class="task-icon green">${icon("mountain", 30)}</span><h3>${esc(b.name)}</h3><p>${esc(b.description)}</p><strong>${money(b.price)} <small>/ hari</small></strong><a class="btn primary" href="/checkout?bundle=${b.id}">Pilih paket ${icon("arrow", 16)}</a></article>`).join("")}</section>` : ""}<section class="store-contact"><div><span class="eyebrow">SAMPAI JUMPA DI TOKO</span><h2>Rencanamu, kami bantu siapkan.</h2><p>${esc(d.store.settings.address)}<br>Buka ${esc(d.store.settings.hours)}</p></div><a class="btn primary" href="https://wa.me/${esc(d.store.settings.phone)}" target="_blank">Hubungi kami ${icon("external", 16)}</a></section>`;
}

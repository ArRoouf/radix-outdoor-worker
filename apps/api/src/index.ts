import {cashierRoutes} from './routes/cashier';
import {receiptData,paperWidth} from './services/cashier';
import {thermalReceipt} from './views/cashier';
import {inventoryRoutes} from './routes/inventory';
import {startOpname,saveOpname,finalizeOpname,getOpname,withdrawUnits,scanCart,saveBundle,bundleSchema} from './services/inventory';
import { openShift, closeShift, cashExpense } from './services/cash';
import { createSettlement, paySettlement } from './services/settlements';
import { saveFineComponent } from './services/fines';
import { operationsRoutes } from './routes/operations';
import {renderPDF} from './services/pdf';
import {checkoutRoutes} from './routes/checkout';
import {authPage} from './views/auth';
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import QRCode from "../../../packages/shared/qr";
import { Repo, uid } from "./repo/index";
import { backup, runJobs } from "./jobs/index";
import { defaultSettings } from "../../../packages/db/seed";
import { authRoutes, requireSession, loadStore, csrfCheck, hashPassword, randomToken, hashToken } from "./middleware/auth";
import { fail, DomainError, quote, createBooking, payment, confirmPayment, bookingAction, editBooking, expire, normalizePhone, } from "./services/rental";
import { qris } from "../../../packages/shared/pricing";
import { shell, renderPage, storeShell, storePage, esc, money } from "./views/index";
type Env = {
    DB: D1Database;
    FILES_PRIVATE: R2Bucket;
    FILES_PUBLIC: R2Bucket;
    INITIAL_OWNER_EMAIL?: string;
    INITIAL_OWNER_PASSWORD?: string;
    ASSETS: Fetcher;
    JOBS: Queue;
    CF_ACCOUNT_ID?: string;
    BROWSER_RENDERING_API_TOKEN?: string;
};
type Vars = {
    repo: Repo;
    store: any;
    member: any;
    user: string;
    email: string;
    csrf: string;
};
const app = new Hono<{
    Bindings: Env;
    Variables: Vars;
}>();
app.use("*", bodyLimit({
    maxSize: 6 * 1024 * 1024,
    onError: (c) => c.json({
        ok: false,
        error: { code: "FILE_TOO_LARGE", message: "Berkas maksimal 5 MB" },
    }, 413),
}));
app.use("*", async (c, next) => {
    const start = Date.now();
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    if (c.req.url.startsWith("https:"))
        c.header("Strict-Transport-Security", "max-age=31536000");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("X-Frame-Options", "SAMEORIGIN");
    c.header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://images.unsplash.com; connect-src 'self'; frame-ancestors 'self'");
    if(!c.res.headers.has("Cache-Control"))c.header("Cache-Control", "no-store");
    if (c.req.path.startsWith("/api") && c.res.status >= 500)
        console.error(JSON.stringify({
            route: c.req.routePath,
            status: c.res.status,
            ms: Date.now() - start,
        }));
});
app.use("*", async (c, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
        const origin = c.req.header("origin");
        if (origin && origin !== new URL(c.req.url).origin)
            fail("CSRF", "Permintaan lintas situs ditolak", 403);
        if (Number(c.req.header("content-length") || 0) > 6 * 1024 * 1024)
            fail("FILE_TOO_LARGE", "Berkas maksimal 5 MB", 413);
    }
    await next();
});
app.onError((e, c) => {
    console.error(JSON.stringify({code:e instanceof DomainError?e.code:"REQUEST_FAILED",route:c.req.routePath}));
    const message = e instanceof DomainError
        ? e.message
        : String(e).includes("UNIT_NOT_AVAILABLE")
            ? "Unit sudah dibooking pada rentang tersebut. Pilih unit atau tanggal lain."
            : String(e).includes("CHECK constraint")
                ? "Perubahan ditolak karena melanggar batas nilai transaksi."
                : e instanceof z.ZodError
                    ? "Periksa kembali data yang diisi."
                    : "Terjadi kesalahan. Coba lagi atau hubungi pengelola.";
    const status = e instanceof DomainError
        ? e.status
        : String(e).includes("UNIT_NOT_AVAILABLE")
            ? 409
            : e instanceof z.ZodError
                ? 422
                : 500;
    return c.json({
        ok: false,
        error: {
            code: e instanceof DomainError
                ? e.code
                : String(e).includes("UNIT_NOT_AVAILABLE")
                    ? "UNIT_NOT_AVAILABLE"
                    : "REQUEST_FAILED",
            message,
        },
    }, status as any);
});
async function rate(c: any, name: string, limit = 30) {
    const ip = c.req.header("cf-connecting-ip") || "local", key = name + ":" + ip + ":" + Math.floor(Date.now() / 60000);
    const r=new Repo(c.env.DB,{role:'system'});
    await r.batch([r.stmt("INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",key,Date.now()+120000)]);
    const n=await r.first("SELECT count FROM rate_limits WHERE key=?",key);
    if (n.count > limit) {
        c.header("Retry-After", "60");
        fail("RATE_LIMITED", "Terlalu banyak permintaan. Tunggu satu menit.", 429);
    }
}
const output = (c: any, data: any) => c.json({ ok: true, data });
function allow(c:any, roles=["owner","admin"]) {
    if(!roles.includes(c.get("member")?.role)) fail("FORBIDDEN","Peran Anda tidak memiliki izin untuk tindakan ini",403);
}
async function context(c:any) {
    await requireSession(c);
}
authRoutes(app, rate);
checkoutRoutes(app, upload, rate);
app.get("/api/v1/health", (c) => output(c, { status: "ok", service: "radix-outdoor" }));
app.use("/api/v1/*", async (c, next) => {
    if (c.req.path.startsWith("/api/v1/public/") || c.req.path === "/api/v1/health" || c.req.path.startsWith("/api/v1/auth/"))
        return next();
    await context(c);
    await csrfCheck(c);
    await next();
});
async function bootstrap(c: any) {
    const r = c.get("repo"), role = c.get("member").role;
    await expire(r);
    const [products, units, bookings, customers, payments, ledger, records, members, audit,] = await Promise.all([
        r.all("SELECT * FROM products WHERE deleted_at IS NULL ORDER BY created_at"),
        r.all("SELECT * FROM units ORDER BY code"),
        r.all("SELECT b.*,c.name AS customer_name,c.phone AS customer_phone,(SELECT COUNT(*) FROM items i WHERE i.booking_id=b.id AND i.voided_at IS NULL) AS item_count FROM bookings b JOIN customers c ON c.id=b.customer_id ORDER BY b.created_at DESC LIMIT 500"),
        r.all("SELECT id,name,phone,email,address,blacklisted,notes,segment,created_at FROM customers ORDER BY created_at DESC"),
        r.all("SELECT * FROM payments ORDER BY created_at DESC LIMIT 500"),
        r.all("SELECT * FROM ledger ORDER BY created_at DESC LIMIT 1000"),
        r.all("SELECT * FROM records WHERE deleted_at IS NULL"),
        r.all("SELECT id,name,email,role,active,outlet_id,partner_id FROM users"),
        role === "owner"
            ? r.all("SELECT * FROM audit ORDER BY created_at DESC LIMIT 100")
            : Promise.resolve([]),
    ]);
    const grouped: any = {};
    for (const row of records) {
        if(row.kind==='file_link')continue;
        (grouped[row.kind] ||= []).push({
            ...JSON.parse(row.data),
            id: row.id,
            created_at: row.created_at,
        });
    }
    const data: any = {
        store: {id:1,name:"Radix Outdoor",timezone:c.get("store").timezone,currency:"IDR",settings:role==="owner"?c.get("store").settings:(( {qris_payload,...safe}:any)=>safe)(c.get("store").settings)},
        csrf: c.get("csrf"),
        member: c.get("member"),
        products,
        units,
        bookings,
        customers,
        payments,
        ledger,
        records: grouped,
        members,
        audit,


        items: await r.all("SELECT * FROM items WHERE voided_at IS NULL"),
        reservations: await r.all("SELECT * FROM reservations WHERE released_at IS NULL"),
    };
    if (c.get("member").outlet_id) {
        const outlet = c.get("member").outlet_id;
        data.units = data.units.filter((u: any) => u.outlet_id === outlet);
        data.bookings = data.bookings.filter((b: any) => b.outlet_id === outlet);
        data.items = data.items.filter((i: any) => data.bookings.some((b: any) => b.id === i.booking_id));
        data.customers = data.customers.filter((cc: any) => data.bookings.some((b: any) => b.customer_id === cc.id));
        data.payments = data.payments.filter((p: any) => data.bookings.some((b: any) => b.id === p.booking_id));
        data.ledger = data.ledger.filter((l: any) => data.bookings.some((b: any) => b.id === l.booking_id));
    }
    if (role === "warehouse") {
        data.customers = [];
        data.payments = [];
        data.ledger = [];
        data.members = [];
        data.items = data.items.map(({ price, total, ...i }: any) => i);
        data.units = data.units.map(({ purchase_price, ...u }: any) => u);
        data.records = {
            outlet: grouped.outlet,
            maintenance: grouped.maintenance,
            movement: grouped.movement,
            opname: grouped.opname,
            fine_component: grouped.fine_component,
        };
        data.bookings = data.bookings.map(({ paid, total, dp, subtotal, discount, customer_phone, ...b }: any) => b);
    }
    if (role === "partner") {
        data.units = units.filter((u: any) => u.partner_id === c.get("member").partner_id);
        data.products = products.filter((p: any) => data.units.some((u: any) => u.product_id === p.id));
        data.bookings = [];
        data.customers = [];
        data.payments = [];
        data.ledger = [];
        data.members = [];
        data.items = [];
        data.reservations = [];
        data.records = {
            outlet: grouped.outlet,
            partner: (grouped.partner || []).filter((p: any) => p.id === c.get("member").partner_id),
            settlement: (grouped.settlement || []).filter((p: any) => p.partner_id === c.get("member").partner_id),
        };
    }
    return data;
}
app.get("/api/v1/bootstrap", async (c) => output(c, await bootstrap(c)));
app.use("/api/v1/bookings/:id/*", async (c, next) => {
    const outlet = c.get("member")?.outlet_id;
    if (outlet) {
        const b = await c
            .get("repo")
            .first("SELECT id FROM bookings WHERE id=? AND outlet_id=?", c.req.param("id"), outlet);
        if (!b)
            fail("NOT_FOUND", "Booking tidak ditemukan", 404);
    }
    await next();
});
app.get("/api/v1/bookings/:id", async (c) => {
    allow(c, ["owner", "admin", "warehouse"]);
    const r = c.get("repo"), id = c.req.param("id"), b = await r.first("SELECT b.*,c.name AS customer_name,c.phone AS customer_phone,c.email AS customer_email FROM bookings b JOIN customers c ON c.id=b.customer_id WHERE b.id=?", id);
    if (!b ||
        (c.get("member").outlet_id && b.outlet_id !== c.get("member").outlet_id))
        fail("NOT_FOUND", "Booking tidak ditemukan", 404);
    const [items, payments, logs, inspections] = await Promise.all([
        r.all("SELECT i.*,u.code FROM items i JOIN units u ON u.id=i.unit_id WHERE i.booking_id=? AND i.voided_at IS NULL", id),
        r.all("SELECT * FROM payments WHERE booking_id=?", id),
        r.all("SELECT * FROM status_logs WHERE booking_id=? ORDER BY created_at", id),
        r.records("inspection"),
    ]);
    const financial = c.get("member").role !== "warehouse";
    return output(c, {
        ...b,
        ...(!financial
            ? { paid: null, total: null, dp: null, subtotal: null, discount: null }
            : {}),
        items: financial ? items : items.map(({ price, total, ...i }) => i),
        payments: financial ? payments : [],
        logs,
        inspections: inspections.filter((i) => i.booking_id === id),
    });
});
app.post("/api/v1/quote", async (c) => {
    allow(c);
    return output(c, await quote(c.get("repo"), c.get("store").settings, {
        ...(await c.req.json()),
        member: false,
        ...(c.get("member").outlet_id
            ? { outlet_id: c.get("member").outlet_id }
            : {}),
    }));
});
app.post("/api/v1/bookings", async (c) => {
    allow(c);
    if(!c.get("store").settings.accepting_bookings)fail("STORE_NOT_ACCEPTING_BOOKINGS","Penerimaan booking baru sedang dinonaktifkan.",409);
    return output(c, await createBooking(c.get("repo"), c.get("store").settings, {
        ...(await c.req.json()),
        ...(c.get("member").outlet_id
            ? { outlet_id: c.get("member").outlet_id }
            : {}),
    }, c.req.header("Idempotency-Key") || "", c.get("user")));
});
app.patch("/api/v1/bookings/:id", async (c) => {
    allow(c);
    const b = await c
        .get("repo")
        .first("SELECT * FROM bookings WHERE id=?", c.req.param("id"));
    if (!b ||
        (c.get("member").outlet_id && b.outlet_id !== c.get("member").outlet_id))
        fail("NOT_FOUND", "Booking tidak ditemukan", 404);
    return output(c, await editBooking(c.get("repo"), c.get("store").settings, c.req.param("id"), await c.req.json(), c.req.header("Idempotency-Key") || "", c.get("user")));
});
app.post("/api/v1/bookings/:id/payments", async (c) => {
    allow(c);
    return output(c, await payment(c.get("repo"), c.req.param("id"), {
        ...(await c.req.json()),
        ...(c.get("member").outlet_id
            ? { outlet_id: c.get("member").outlet_id }
            : {}),
    }, c.req.header("Idempotency-Key") || "", c.get("user")));
});
app.post("/api/v1/payments/:id/:action", async (c) => {
    allow(c);
    const action = c.req.param("action");
    if (!["confirm", "reject"].includes(action))
        fail("INVALID_ACTION", "Aksi tidak valid");
    const b = await c.req.json();
    return output(c, await confirmPayment(c.get("repo"), c.req.param("id"), c.get("user"), action === "reject", b.reason));
});
app.post("/api/v1/bookings/:id/:action", async (c) => {
    const action = c.req.param("action");
    allow(c, ["pickup", "return"].includes(action)
        ? ["owner", "admin", "warehouse"]
        : ["owner", "admin"]);
    return output(c, await bookingAction(c.get("repo"), c.get("store").settings, c.req.param("id"), action, await c.req.json(), c.get("user"), c.get("member").role));
});
const productSchema = z.object({
    name: z.string().min(2).max(150),
    category: z.string().min(1).max(80),
    brand: z.string().max(100).default(""),
    description: z.string().max(3000).default(""),
    price: z.coerce.number().int().min(0),
    capacity: z.coerce.number().int().min(1).max(100),
    image: z.string().max(500).default("tent"),
    buffer_hours: z.coerce.number().int().min(0).max(168).optional(),
    images: z.string().max(5000).default("[]"),
});
app.post("/api/v1/products", async (c) => {
    allow(c, ["owner"]);
    const b = await c.req.json(), p = productSchema.parse(b), r = c.get("repo");
    const qty = Math.min(100, Math.max(1, Number(b.quantity) || 1));
    if (!Number.isInteger(qty))
        fail("INVALID_QTY", "Jumlah unit tidak valid");
    const outlet = (await r.records("outlet")).find((o) => o.id === b.outlet_id);
    if (!outlet)
        fail("NOT_FOUND", "Pilih outlet yang valid");
    const id = uid(), stmts = [r.insert("products", { id, ...p, created_at: Date.now() })];
    for (let n = 0; n < qty; n++)
        stmts.push(r.insert("units", {
            id: uid(),
            product_id: id,
            outlet_id: outlet.id,
            code: (b.prefix || "UNT").slice(0, 6).toUpperCase() +
                "-" +
                uid().slice(-8).toUpperCase(),
            status: "available",
            condition_note: "Baik",
            purchase_price: Number(b.purchase_price) || 0,
            partner_id: b.partner_id || null,
            created_at: Date.now(),
        }));
    stmts.push(r.audit(c.get("user"), "product.created", id));
    await r.batch(stmts);
    return output(c, { id });
});
app.patch("/api/v1/products/:id", async (c) => {
    allow(c, ["owner"]);
    const r = c.get("repo"), b = productSchema.parse(await c.req.json()), id = c.req.param("id");
    if (!(await r.first("SELECT id FROM products WHERE id=?", id)))
        fail("NOT_FOUND", "Produk tidak ditemukan", 404);
    await r.batch([
        r.stmt("UPDATE products SET name=?1,category=?2,brand=?3,description=?4,price=?5,capacity=?6,image=?7,buffer_hours=?8,images=?9 WHERE id=?10", b.name, b.category, b.brand, b.description, b.price, b.capacity, b.image, b.buffer_hours ?? null, b.images, id),
        r.audit(c.get("user"), "product.updated", id),
    ]);
    return output(c, true);
});
app.delete("/api/v1/products/:id", async (c) => {
    allow(c, ["owner"]);
    const r = c.get("repo"), id = c.req.param("id");
    await r.batch([
        r.stmt("UPDATE products SET deleted_at=?1 WHERE id=?2", Date.now(), id),
        r.audit(c.get("user"), "product.archived", id),
    ]);
    return output(c, true);
});
app.patch("/api/v1/units/:id", async (c) => {
    allow(c, ["owner", "warehouse"]);
    const b = z
        .object({
        status: z.enum([
            "available",
            "maintenance",
            "broken",
            "lost",
            "retired",
        ]),
        outlet_id: z.string(),
        condition_note: z.string().max(1000),
        partner_id: z.string().nullable().optional(),
    })
        .parse(await c.req.json()), r = c.get("repo"), id = c.req.param("id");
    if (!(await r.first("SELECT id FROM units WHERE id=?", id)))
        fail("NOT_FOUND", "Unit tidak ditemukan", 404);
    if (!(await r.records("outlet")).some((o) => o.id === b.outlet_id))
        fail("NOT_FOUND", "Outlet tidak ditemukan");
    if (b.partner_id &&
        !(await r.records("partner")).some((p) => p.id === b.partner_id))
        fail("NOT_FOUND", "Mitra tidak ditemukan");
    if (c.get("member").role !== "owner") {
        const unit = await r.first("SELECT * FROM units WHERE id=?", id);
        if (unit.outlet_id !== b.outlet_id ||
            unit.partner_id !== (b.partner_id || null))
            fail("FORBIDDEN", "Hanya Owner dapat mengubah outlet dan kepemilikan", 403);
    }
    const active = await r.first("SELECT r.id FROM reservations r JOIN bookings b ON b.id=r.booking_id WHERE r.unit_id=? AND r.released_at IS NULL AND b.status IN('confirmed','pending_payment','picked_up')", id);
    const currentUnit = await r.first("SELECT * FROM units WHERE id=?", id);
    if (active &&
        (b.status !== "available" || currentUnit.outlet_id !== b.outlet_id))
        fail("UNIT_RESERVED", "Unit masih memiliki reservasi aktif");
    await r.batch([
        r.stmt("UPDATE units SET status=?1,outlet_id=?2,condition_note=?3,partner_id=?4 WHERE id=?5", b.status, b.outlet_id, b.condition_note, b.partner_id || null, id),
        r.record("movement", {
            unit_id: id,
            kind: "adjust",
            status: b.status,
            outlet_id: b.outlet_id,
        }),
        r.audit(c.get("user"), "unit.updated", id),
    ]);
    return output(c, true);
});
app.post("/api/v1/customers", async (c) => {
    allow(c);
    const b = z
        .object({
        name: z.string().min(2).max(120),
        phone: z.string().min(9).max(20),
        email: z.string().max(120).optional(),
        address: z.string().max(500).optional(),
        notes: z.string().max(1000).optional(),
        segment: z.enum(["baru", "loyal", "member"]).default("baru"),
    })
        .parse(await c.req.json()), id = uid();
    await c
        .get("repo")
        .batch([
        c
            .get("repo")
            .insert("customers", {
            id,
            ...b,
            phone: normalizePhone(b.phone),
            created_at: Date.now(),
        }),
        c.get("repo").audit(c.get("user"), "customer.created", id),
    ]);
    return output(c, { id });
});
app.patch("/api/v1/customers/:id", async (c) => {
    allow(c);
    const b = await c.req.json(), r = c.get("repo"), id = c.req.param("id");
    if (!(await r.first("SELECT id FROM customers WHERE id=?", id)))
        fail("NOT_FOUND", "Pelanggan tidak ditemukan", 404);
    if (b.anonymize) {
        allow(c, ["owner"]);
        await r.batch([
            r.stmt("UPDATE customers SET name='Pelanggan anonim',phone=?1,email=NULL,address=NULL,id_doc=NULL,notes='',blacklisted=0 WHERE id=?2", "anon-" + uid(), id),
            r.audit(c.get("user"), "customer.anonymized", id),
        ]);
    }
    else {
        const n = z
            .object({ blacklisted: z.boolean(), notes: z.string().max(1000) })
            .parse(b);
        await r.batch([
            r.stmt("UPDATE customers SET blacklisted=?1,notes=?2 WHERE id=?3", n.blacklisted ? 1 : 0, n.notes, id),
            r.audit(c.get("user"), "customer.risk_updated", id),
        ]);
    }
    return output(c, true);
});
const recordSchemas: Record<string, z.ZodTypeAny> = {
    outlet: z.object({
        name: z.string().min(2),
        address: z.string(),
        phone: z.string(),
    }),
    category: z.object({
        name: z.string().min(2),
        parent: z.string().optional(),
    }),
    partner: z.object({
        name: z.string().min(2),
        phone: z.string(),
        share_percent: z.coerce.number().int().min(0).max(100),
        bank: z.string(),
    }),
    voucher: z.object({
        code: z.string().min(3),
        kind: z.enum(["percent", "amount"]),
        value: z.coerce.number().int().min(1),
        min_total: z.coerce.number().int().min(0),
        quota: z.coerce.number().int().min(0),
        active: z.boolean().default(true),
        used: z.number().default(0),
    }),
    expense: z.object({
        category: z.string(),
        amount: z.coerce.number().int().positive(),
        note: z.string().min(2),
        spent_on: z.string(),
    }),
    price_rule: z.object({
        product_id: z.string(),
        kind: z.enum(["weekend", "season", "tier", "member"]),
        price: z.coerce.number().int().positive(),
        min_days: z.coerce.number().int().min(1).default(1),
        priority: z.coerce.number().int().default(0),
        start_at: z.number().optional(),
        end_at: z.number().optional(),
    }),
    bundle: bundleSchema,
    template: z.object({ name: z.string().min(2), message: z.string().min(5) }),
    ticket: z.object({ subject: z.string().min(3), message: z.string().min(5) }),
};
app.post("/api/v1/records/:kind", async (c) => {
    const kind = c.req.param("kind");
    allow(c, ["expense", "ticket"].includes(kind) ? ["owner", "admin"] : ["owner"]);
    const schema = recordSchemas[kind];
    if (!schema)
        fail("INVALID_ENTITY", "Jenis data tidak valid");
    const b = schema.parse(await c.req.json()), id = uid(), r = c.get("repo");
    if(kind==='bundle')return output(c,await saveBundle(r,b,c.get('user')));
    if(c.get('member').role==='admin')b.outlet_id=c.get('member').outlet_id;
    if (kind === "voucher" && b.kind === "percent" && b.value > 100)
        fail("INVALID_DISCOUNT", "Diskon maksimal 100%");
    const stmts = [
        r.record(kind, b, id),
        r.audit(c.get("user"), kind + ".created", id),
    ];
    if (kind === "expense")
        stmts.push(r.insert("ledger", {
            id: uid(),
            account: "expense",
            direction: "out",
            amount: b.amount,
            reference: id,
            note: b.note,
            created_at: Date.now(),
        }));
    await r.batch(stmts);
    return output(c, { id });
});
app.patch("/api/v1/records/:id", async (c) => {
    allow(c, ["owner"]);
    const r = c.get("repo"), id = c.req.param("id"), row = await r.first("SELECT * FROM records WHERE id=? AND deleted_at IS NULL", id);
    if (!row)
        fail("NOT_FOUND", "Data tidak ditemukan", 404);
    const b = await c.req.json();
    if (row.kind === "notification") {
        const data = { ...JSON.parse(row.data), read: true };
        await r.batch([
            r.stmt("UPDATE records SET data=?1 WHERE id=?2", JSON.stringify(data), id),
        ]);
        return output(c, true);
    }
    const schema = recordSchemas[row.kind];
    if (!schema)
        fail("IMMUTABLE", "Data operasional ini tidak dapat diedit");
    const data = schema.parse(b);
    if(row.kind==='bundle')return output(c,await saveBundle(r,data,c.get('user'),id));
    await r.batch([
        r.stmt("UPDATE records SET data=?1 WHERE id=?2", JSON.stringify(data), id),
        r.audit(c.get("user"), row.kind + ".updated", id),
    ]);
    return output(c, true);
});
app.post("/api/v1/maintenance", async (c) => {
    allow(c, ["owner", "warehouse"]);
    const b = z
        .object({
        unit_id: z.string(),
        reason: z.string().min(3),
        start_at: z.number(),
        end_at: z.number(),
        cost: z.coerce.number().int().min(0),
    })
        .parse(await c.req.json()), r = c.get("repo");
    if (b.end_at <= b.start_at)
        fail("INVALID_RANGE", "Tanggal maintenance tidak valid");
    if (!(await r.first("SELECT id FROM units WHERE id=?", b.unit_id)))
        fail("NOT_FOUND", "Unit tidak ditemukan", 404);
    const id = uid();
    await r.batch([
        r.record("maintenance", { ...b, status: "scheduled" }, id),
        r.insert("reservations", {
            id,
            unit_id: b.unit_id,
            start_at: b.start_at,
            end_at: b.end_at,
            kind: "maintenance",
        }),
        r.audit(c.get("user"), "maintenance.scheduled", id),
    ]);
    return output(c, { id });
});
app.post("/api/v1/maintenance/:id/complete", async (c) => {
    allow(c, ["owner", "warehouse"]);
    const r = c.get("repo"), id = c.req.param("id"), row = await r.first("SELECT * FROM records WHERE id=? AND kind='maintenance'", id);
    if (!row)
        fail("NOT_FOUND", "Jadwal tidak ditemukan", 404);
    const b = JSON.parse(row.data);
    if (b.status === "completed")
        return output(c, true);
    await r.batch([
        r.stmt("UPDATE records SET data=?1 WHERE id=?2", JSON.stringify({ ...b, status: "completed", done_at: Date.now() }), id),
        r.stmt("UPDATE reservations SET released_at=?1 WHERE id=?2", Date.now(), id),
        r.stmt("UPDATE units SET status='available' WHERE id=?", b.unit_id),
        r.audit(c.get("user"), "maintenance.completed", id),
    ]);
    return output(c, true);
});
app.post('/api/v1/stock/opname',async c=>{allow(c,['owner','warehouse']);return output(c,await startOpname(c.get('repo'),await c.req.json(),c.get('user'),c.req.header('Idempotency-Key')||''));});
app.get('/api/v1/stock/opname/:id',async c=>{allow(c,['owner','warehouse']);return output(c,await getOpname(c.get('repo'),c.req.param('id')));});
app.post('/api/v1/stock/opname/:id/save',async c=>{allow(c,['owner','warehouse']);return output(c,await saveOpname(c.get('repo'),c.req.param('id'),await c.req.json(),c.get('user')));});
app.post('/api/v1/stock/opname/:id/finalize',async c=>{allow(c,['owner','warehouse']);return output(c,await finalizeOpname(c.get('repo'),c.req.param('id'),await c.req.json(),c.get('user')));});
app.post('/api/v1/withdrawals',async c=>{allow(c,['owner']);return output(c,await withdrawUnits(c.get('repo'),await c.req.json(),c.get('user'),c.req.header('Idempotency-Key')||''));});
app.post('/api/v1/cashier/scan',async c=>{allow(c);return output(c,await scanCart(c.get('repo'),await c.req.json()));});
app.post('/api/v1/shifts/open', async c => {
    allow(c);return output(c,await openShift(c.get('repo'),await c.req.json(),c.get('user')));
});
app.post('/api/v1/shifts/:id/close', async c => {
    allow(c);return output(c,await closeShift(c.get('repo'),c.req.param('id'),await c.req.json(),c.get('user')));
});
app.post('/api/v1/shifts/:id/expenses', async c => {
    allow(c);return output(c,await cashExpense(c.get('repo'),c.req.param('id'),await c.req.json(),c.get('user'),c.req.header('Idempotency-Key')||''));
});
app.post('/api/v1/settlements', async c => {
    allow(c,['owner']);return output(c,await createSettlement(c.get('repo'),await c.req.json(),c.get('user'),c.req.header('Idempotency-Key')||''));
});
app.post('/api/v1/settlements/:id/pay', async c => {
    allow(c,['owner']);return output(c,await paySettlement(c.get('repo'),c.req.param('id'),c.get('user')));
});
app.get('/api/v1/fine-components', async c => {
    allow(c,['owner','admin','warehouse']);return output(c,await c.get('repo').records('fine_component'));
});
app.post('/api/v1/fine-components', async c => {
    allow(c,['owner']);return output(c,await saveFineComponent(c.get('repo'),await c.req.json(),c.get('user')));
});
app.patch('/api/v1/fine-components/:id', async c => {
    allow(c,['owner']);return output(c,await saveFineComponent(c.get('repo'),await c.req.json(),c.get('user'),c.req.param('id')));
});
app.post("/api/v1/fines/:id/waive", async (c) => {
    allow(c, ["owner"]);
    const b = z.object({ reason: z.string().min(5) }).parse(await c.req.json()), r = c.get("repo"), id = c.req.param("id"), row = await r.first("SELECT * FROM records WHERE id=? AND kind='fine'", id);
    if (!row)
        fail("NOT_FOUND", "Denda tidak ditemukan", 404);
    const f = JSON.parse(row.data);
    if (f.waived)
        fail("ALREADY_WAIVED", "Denda sudah dibebaskan");
    const booking = await r.first("SELECT * FROM bookings WHERE id=?", f.booking_id);
    if (booking.paid > booking.total - f.amount)
        fail("REFUND_REQUIRED", "Denda sudah dibayar, lakukan rekonsiliasi refund");
    await r.batch([
        r.stmt("INSERT INTO operation_keys(key) VALUES(?)", "waive-" + id),
        r.stmt("UPDATE records SET data=?1 WHERE id=?2", JSON.stringify({ ...f, waived: true, reason: b.reason }), id),
        r.stmt("UPDATE bookings SET total=total-?1 WHERE id=?2", f.amount, f.booking_id),
        r.audit(c.get("user"), "fine.waived: " + b.reason, id),
    ]);
    return output(c, true);
});
app.patch("/api/v1/settings", async (c) => {
    allow(c, ["owner"]);
    const b = z
        .object({
        name: z.literal("Radix Outdoor"),
        accepting_bookings: z.boolean().default(false),
        phone: z.string().min(9),
        email: z.string(),
        address: z.string(),
        hours: z.string(),
        buffer_hours: z.coerce.number().int().min(0).max(168),
        dp_percent: z.coerce.number().int().min(0).max(100),
        tolerance: z.coerce.number().int().min(0).max(1440),
        late_price: z.coerce.number().int().min(0),
        expires_hours: z.coerce.number().int().min(1).max(168),
        bank_name: z.string(),
        bank_account: z.string(),
        bank_owner: z.string(),
        qris_payload: z.string(),
        terms: z.string(),
        privacy: z.string(),
        timezone: z.enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]),
    })
        .parse(await c.req.json());
    const r = c.get("repo"), settings = { ...c.get("store").settings, ...b };
    await r.batch([
        r.stmt("UPDATE store_profile SET name=?1,settings_json=?2,updated_at=unixepoch()*1000 WHERE id=1", b.name, JSON.stringify(settings)),
        r.audit(c.get("user"), "settings.updated"),
    ]);
    return output(c, true);
});
app.post("/api/v1/users", async (c) => {
    allow(c, ["owner"]);
    const b = z
        .object({
        name: z.string().min(2),
        email: z.string().email().transform(s=>s.toLowerCase()),
        password: z.string().min(12).max(128),
        role: z.enum(["admin", "warehouse", "partner"]),
        outlet_id: z.string().nullable().optional(),
        partner_id: z.string().nullable().optional(),
    })
        .parse(await c.req.json()), r = c.get("repo");
    if (b.role === "partner" &&
        !(await r.records("partner")).some((p) => p.id === b.partner_id))
        fail("PARTNER_REQUIRED", "Pilih mitra terkait");
    if(b.role!=='partner' && !(await r.records('outlet')).some(o=>o.id===b.outlet_id))fail('OUTLET_REQUIRED','Pilih outlet akses untuk staf.');
    const {password,...profile}=b;
    await r.batch([
        r.insert("users", { id: uid(), ...profile, password_hash:await hashPassword(password) }),
        r.audit(c.get("user"), "member.invited"),
    ]);
    return output(c, true);
});
app.patch("/api/v1/users/:id", async (c) => {
    allow(c, ["owner"]);
    const r = c.get("repo"), id = c.req.param("id"), member = await r.first("SELECT * FROM users WHERE id=?", id);
    if (!member || member.role === "owner")
        fail("FORBIDDEN", "Owner tidak dapat dinonaktifkan", 403);
    const b=z.object({active:z.boolean().optional(),role:z.enum(['admin','warehouse','partner']).optional(),outlet_id:z.string().nullable().optional(),partner_id:z.string().nullable().optional(),password:z.string().min(12).max(128).optional()}).parse(await c.req.json());
    const role=b.role??member.role,outlet=b.outlet_id===undefined?member.outlet_id:b.outlet_id,partner=b.partner_id===undefined?member.partner_id:b.partner_id;
    if(role==='partner' && !(await r.records('partner')).some(p=>p.id===partner))fail('PARTNER_REQUIRED','Pilih mitra terkait.');
    if(role!=='partner' && !(await r.records('outlet')).some(o=>o.id===outlet))fail('OUTLET_REQUIRED','Pilih outlet akses staf.');
    await r.batch([
        r.stmt('UPDATE users SET active=?,role=?,outlet_id=?,partner_id=?,password_hash=? WHERE id=?',b.active===undefined?member.active:(b.active?1:0),role,role==='partner'?null:outlet,role==='partner'?partner:null,b.password?await hashPassword(b.password):member.password_hash,id),
        r.stmt('DELETE FROM sessions WHERE user_id=?',id),
        r.audit(c.get('user'),'member.access_changed',id),
    ]);
    return output(c, true);
});
app.post("/api/v1/operations/maintenance", async (c) => {
    allow(c, ["owner"]);
    return output(c, await runJobs(c.get("repo"), c.env.FILES_PRIVATE, c.get("store").settings));
});
app.post("/api/v1/backups", async (c) => {
    allow(c, ["owner"]);
    return output(c, await backup(c.get("repo"), c.env.FILES_PRIVATE));
});
app.get("/api/v1/backups/:id", async (c) => {
    allow(c, ["owner"]);
    const r = c.get("repo"), record = (await r.records("backup")).find((b) => b.id === c.req.param("id"));
    if (!record)
        fail("NOT_FOUND", "Backup tidak ditemukan", 404);
    const obj = await c.env.FILES_PRIVATE.get(record.key);
    if (!obj)
        fail("NOT_FOUND", "Backup tidak ditemukan", 404);
    await r.batch([r.audit(c.get("user"), "backup.downloaded", record.id)]);
    c.header("Content-Type", "application/json");
    c.header("Content-Disposition", 'attachment; filename="radix-outdoor-backup-' + record.id + '.json"');
    return c.body(obj!.body);
});
app.get("/api/v1/reports/export", async (c) => {
    allow(c, ["owner", "admin"]);
    const r = c.get("repo"), kind = c.req.query("kind") || "bookings", from = Number(c.req.query("from")) || 0, to = Number(c.req.query("to")) || Date.now() + 86400000;
    let rows: any[];
    if (kind === "ledger")
        rows = await r.all("SELECT account,direction,amount,note,created_at FROM ledger WHERE created_at>=? AND created_at<=? ORDER BY created_at", from, to);
    else if (kind === "products")
        rows = await r.all("SELECT name,category,brand,price,capacity FROM products WHERE deleted_at IS NULL");
    else if (kind === "customers")
        rows = await r.all("SELECT name,phone,email,segment FROM customers");
    else
        rows = await r.all("SELECT b.code,c.name,b.status,b.start_at,b.end_at,b.total,b.paid FROM bookings b JOIN customers c ON c.id=b.customer_id WHERE b.created_at>=? AND b.created_at<=?", from, to);
    const columns = rows.length ? Object.keys(rows[0]) : ["Tidak ada data"];
    const cell = (v: any) => '"' +
        String(v ?? "")
            .replace(/^[=+\-@]/, "'$&")
            .replace(/"/g, '""') +
        '"';
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="radix-outdoor-${kind}.csv"`);
    return c.body("\uFEFF" +
        [
            columns.map(cell).join(","),
            ...rows.map((row) => columns.map((k) => cell(row[k])).join(",")),
        ].join("\r\n"));
});
app.get("/api/v1/units/:id/qr", async (c) => {
    allow(c, ["owner", "warehouse", "admin"]);
    const u = await c
        .get("repo")
        .first("SELECT * FROM units WHERE id=?", c.req.param("id"));
    if (!u)
        fail("NOT_FOUND", "Unit tidak ditemukan", 404);
    c.header("Content-Type", "image/svg+xml");
    return c.body(await QRCode.toString(u.code, { type: "svg" }));
});
app.post("/api/v1/uploads", async (c) => {
    allow(c, ["owner", "admin", "warehouse"]);
    const kind = c.req.query("kind") === "product" ? "product" : "inspection";
    if (kind === "product")
        allow(c, ["owner"]);
    return output(c, await upload(c, c.get("repo"), kind, c.get("user")));
});
async function upload(c: any, r: Repo, kind: string, token: string) {
    await rate(c, "upload", 15);
    const data = await c.req.formData(), file = data.get("file");
    if (!file || typeof file === "string")
        fail("FILE_REQUIRED", "Pilih berkas gambar");
    if (file.size > 5 * 1024 * 1024 || file.size < 10)
        fail("INVALID_FILE", "Berkas maksimal 5 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = bytes[0] === 0xff && bytes[1] === 0xd8
        ? "image/jpeg"
        : bytes[0] === 0x89 && bytes[1] === 0x50
            ? "image/png"
            : String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
                ? "image/webp"
                : "";
    if (!mime)
        fail("INVALID_FILE", "Gunakan gambar JPEG, PNG, atau WebP");
    const id = uid();
    await (kind==="product"?c.env.FILES_PUBLIC:c.env.FILES_PRIVATE).put("files/" + id, bytes, {
        httpMetadata: { contentType: mime },
    });
    await r.batch([
        r.insert("uploads", {
            id,
            kind,
            storage_key: "files/"+id,
            storage_bucket: kind==="product"?"public":"private",
            owner_token: token,
            mime,
            created_at: Date.now(),
        }),
    ]);
    return { id };
}
app.get("/api/v1/files/:id", async (c) => {
    allow(c, ["owner", "admin"]);
    const r = c.get("repo"), id = c.req.param("id"), f = await r.first("SELECT * FROM uploads WHERE id=?", id);
    if (!f)
        fail("NOT_FOUND", "Berkas tidak ditemukan", 404);
    const token=randomToken();
    await r.batch([r.record('file_link',{file_id:id,token_hash:await hashToken(token),user_id:c.get('user'),expires_at:Date.now()+300000}),r.audit(c.get('user'),'file.link_issued',id)]);
    return c.redirect('/private-file/'+token,302);

});
app.post("/api/v1/products/import", async (c) => {
    allow(c, ["owner"]);
    const b = z
        .object({
        rows: z
            .array(productSchema.extend({
            quantity: z.coerce.number().int().min(1).max(100).default(1),
        }))
            .min(1)
            .max(100),
        outlet_id: z.string(),
    })
        .parse(await c.req.json()), r = c.get("repo");
    if (!(await r.records("outlet")).some((o) => o.id === b.outlet_id))
        fail("NOT_FOUND", "Outlet tidak ditemukan");
    const stmts: D1PreparedStatement[] = [];
    for (const row of b.rows) {
        const { quantity, ...p } = row, id = uid();
        stmts.push(r.insert("products", { id, ...p, created_at: Date.now() }));
        for (let n = 0; n < quantity; n++)
            stmts.push(r.insert("units", {
                id: uid(),
                product_id: id,
                outlet_id: b.outlet_id,
                code: "IMP-" + uid().slice(0, 8).toUpperCase(),
                status: "available",
                created_at: Date.now(),
            }));
    }
    if (stmts.length > 1000)
        fail("IMPORT_TOO_LARGE", "Impor maksimal 1000 unit per proses");
    stmts.push(r.audit(c.get("user"), "products.imported"));
    await r.batch(stmts);
    return output(c, { count: b.rows.length });
});
app.use("/api/v1/public/*", async (c, next) => {
    const store = await loadStore(c.env.DB);
    c.set("store", store);
    c.set("repo", new Repo(c.env.DB, {role:"guest"}));
    await next();
});
app.get("/api/v1/public/availability", async (c) => {
    const start = Number(c.req.query("start")), end = Number(c.req.query("end"));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        fail("INVALID_RANGE", "Rentang tanggal tidak valid");
    const rows = await c
        .get("repo")
        .all("SELECT p.id,COUNT(u.id) AS available FROM products p LEFT JOIN units u ON u.product_id=p.id AND u.status='available' AND NOT EXISTS(SELECT 1 FROM reservations r WHERE r.unit_id=u.id AND r.released_at IS NULL AND r.start_at<(?1+COALESCE(p.buffer_hours,?3)*3600000) AND ?2<r.end_at) WHERE p.deleted_at IS NULL AND p.published=1 GROUP BY p.id", end, start, c.get("store").settings.buffer_hours);
    return output(c, rows);
});
app.post("/api/v1/public/quote", async (c) => {
    const q = await quote(c.get("repo"), c.get("store").settings, {
        ...(await c.req.json()),
        member: false,
    });
    return output(c, {
        days: q.days,
        subtotal: q.subtotal,
        discount: q.discount,
        total: q.total,
        dp: q.dp,
        lines: q.lines.map((l) => ({
            product_id: l.product.id,
            name: l.product.name,
            qty: l.qty,
            total: l.total,
        })),
    });
});
app.post("/api/v1/public/uploads", async (c) => output(c, await upload(c, c.get("repo"), "identity", uid())));
app.post("/api/v1/public/bookings", async (c) => {
    if(!c.get("store").settings.accepting_bookings)fail("STORE_NOT_ACCEPTING_BOOKINGS","Penerimaan booking baru sedang dinonaktifkan.",409);
    await rate(c, "booking", 10);
    return output(c, await createBooking(c.get("repo"), c.get("store").settings, await c.req.json(), c.req.header("Idempotency-Key") || "", "guest", true));
});
async function lookup(c: any, body: any) {
    await rate(c, "lookup", 30);
    const b = await c
        .get("repo")
        .first("SELECT b.*,c.phone,c.name AS customer_name FROM bookings b JOIN customers c ON c.id=b.customer_id WHERE b.code=? AND c.phone=?", String(body.code).toUpperCase(), normalizePhone(body.phone || ""));
    if (!b)
        fail("NOT_FOUND", "Kode booking atau nomor WhatsApp tidak cocok", 404);
    return b;
}
app.post('/booking/lookup',async(c)=>{
    const store=await loadStore(c.env.DB);c.set('store',store);c.set('repo',new Repo(c.env.DB,{role:'guest'}));
    const body=await c.req.parseBody(),b=await lookup(c,body);
    return c.html(authPage('Status booking',`<h2>${esc(b.code)}</h2><p>Status: ${esc(b.status)}</p><p>Total ${money(b.total)} · Terbayar ${money(b.paid)}</p><p>Hubungi Radix Outdoor untuk verifikasi pembayaran atau perubahan booking.</p><a href="/lookup">Cari booking lain</a>`));
});
app.post("/api/v1/public/lookup", async (c) => {
    const b = await lookup(c, await c.req.json()), r = c.get("repo");
    await expire(r);
    const fresh = await r.first("SELECT * FROM bookings WHERE id=?", b.id);
    return output(c, {
        ...fresh,
        customer_name: b.customer_name,
        items: await r.all("SELECT product_name,days,price,total FROM items WHERE booking_id=? AND voided_at IS NULL", b.id),
        payments: await r.all("SELECT id,amount,method,status FROM payments WHERE booking_id=?", b.id),
    });
});
app.post("/api/v1/public/proof", async (c) => {
    const data = await c.req.formData(), b = await lookup(c, { code: data.get("code"), phone: data.get("phone") });
    if (!["pending_payment", "confirmed", "returned"].includes(b.status))
        fail("INVALID_TRANSITION", "Booking tidak menerima bukti bayar");
    const uploaded = await upload(c, c.get("repo"), "payment", b.id);
    return output(c, await payment(c.get("repo"), b.id, {
        amount: Number(data.get("amount")),
        method: data.get("method") || "transfer",
        proof: uploaded.id,
    }, c.req.header("Idempotency-Key") || "", "guest", false));
});
app.post("/api/v1/public/qris", async (c) => {
    const b = await lookup(c, await c.req.json()), settings = c.get("store").settings;
    const amount = b.paid < b.dp ? b.dp - b.paid : b.total - b.paid;
    if (!settings.qris_payload)
        fail("QRIS_UNCONFIGURED", "Toko belum menambahkan QRIS. Gunakan transfer bank.");
    const payload = qris(settings.qris_payload, amount);
    return output(c, {
        amount,
        svg: await QRCode.toString(payload, { type: "svg" }),
    });
});
app.post("/api/v1/public/cancel", async (c) => {
    const b = await lookup(c, await c.req.json());
    return output(c, await bookingAction(c.get("repo"), c.get("store").settings, b.id, "cancel", { reason: "Dibatalkan penyewa", refund: 0 }, "guest", "customer"));
});
app.get('/admin/bookings/:id/pdf',async(c)=>{
    await context(c);allow(c,['owner','admin']);
    const r=c.get('repo'),id=c.req.param('id'),booking=await r.first('SELECT id FROM bookings WHERE id=?',id);
    if(!booking)fail('NOT_FOUND','Booking tidak ditemukan.',404);
    const type=z.enum(['invoice','receipt','agreement','delivery']).parse(c.req.query('type')||'invoice');
    const path='/admin/bookings/'+id+'/print?type='+type;
    if(!c.env.BROWSER_RENDERING_API_TOKEN||!c.env.CF_ACCOUNT_ID)return c.redirect(path);
    const print=await app.request(new URL(path,c.req.url),{headers:{cookie:c.req.header('cookie')||''}},c.env);
    if(!print.ok)fail('PDF_UNAVAILABLE','Dokumen belum dapat dibuat.',503);
    const style=await c.env.ASSETS.fetch(new Request(new URL('/styles.css',c.req.url)));
    const html=(await print.text()).replace(/<script[\s\S]*?<\/script>/g,'').replace('<link rel="stylesheet" href="/styles.css">','<style>'+await style.text()+'</style>');
    const key='pdf/'+id+'/'+type+'-'+await hashToken(html)+'.pdf';
    const cached=await c.env.FILES_PRIVATE.get(key);
    if(cached){c.header('Content-Type','application/pdf');return c.body(cached.body);}
    const bytes=await renderPDF(html,c.env);
    if(!bytes)return fail('PDF_UNAVAILABLE','Dokumen belum dapat dibuat.',503);
    await c.env.FILES_PRIVATE.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
    await r.batch([r.audit(c.get('user'),'document.pdf_generated',id)]);
    c.header('Content-Type','application/pdf');return c.body(bytes);
});
app.get("/admin/bookings/:id/print", async (c) => {
    await context(c);
    allow(c, ["owner", "admin"]);
    const r = c.get("repo"), b = await r.first("SELECT b.*,c.name AS customer_name,c.phone FROM bookings b JOIN customers c ON c.id=b.customer_id WHERE b.id=?", c.req.param("id"));
    if (!b)
        fail("NOT_FOUND", "Booking tidak ditemukan", 404);
    const items = await r.all("SELECT * FROM items WHERE booking_id=? AND voided_at IS NULL", b.id);
    const type = c.req.query("type") || "invoice";
    if(type==='thermal')return c.html(thermalReceipt(await receiptData(r,b.id),c.get('store'),paperWidth.parse(c.req.query('width')||'58')));
    const title = ({
        invoice: "Invoice Penyewaan",
        receipt: "Nota Pembayaran",
        agreement: "Surat Perjanjian Sewa",
        delivery: "Surat Jalan / Serah-terima",
    } as any)[type] || "Invoice Penyewaan";
    const inspection = (await r.records("inspection")).find((i) => i.booking_id === b.id && i.phase === "pickup");
    return c.html(`<!DOCTYPE html><html lang="id"><head><title>Invoice ${esc(b.code)}</title><link rel="stylesheet" href="/styles.css"></head><body class="invoice"><div class="invoice-head"><h1>radix-outdoor<span>.</span></h1><button class="btn primary" data-print>Cetak / Simpan PDF</button></div><h2>${esc(title)}</h2><p>${esc(c.get("store").name)}<br>${esc(c.get("store").settings.address)}</p><hr><div class="split"><p><b>${esc(b.customer_name)}</b><br>${esc(b.phone)}</p><p>${esc(b.code)}<br>${new Date(b.start_at).toLocaleDateString("id-ID")} – ${new Date(b.end_at).toLocaleDateString("id-ID")}</p></div><table><thead><tr><th>Produk</th><th>Hari</th><th>Total</th></tr></thead><tbody>${items.map((i) => `<tr><td>${esc(i.product_name)}</td><td>${i.days}</td><td>${money(i.total)}</td></tr>`).join("")}</tbody></table><h3>Total ${money(b.total)}</h3><p>Terbayar ${money(b.paid)} · Sisa ${money(b.total - b.paid)}</p><p>Jaminan: identitas fisik KTP/SIM (tanpa deposit uang).</p><p>${esc(c.get("store").settings.terms)}</p>${inspection?.signature ? `<div><p>Tanda tangan penyewa</p><img src="/api/v1/files/${esc(inspection.signature)}" alt="Tanda tangan penyewa" style="max-width:240px;max-height:100px"></div>` : ""}<script src="/app.js" defer></script></body></html>`);
});
app.get('/private-file/:token',async(c)=>{
    const token=c.req.param('token');
    if(!/^[a-f0-9]{64}$/.test(token))fail('NOT_FOUND','Berkas tidak ditemukan.',404);
    const r=new Repo(c.env.DB,{role:'system'});
    const link=await r.first("SELECT data FROM records WHERE kind='file_link' AND json_extract(data,'$.token_hash')=? AND json_extract(data,'$.expires_at')>?",await hashToken(token),Date.now());
    if(!link)fail('NOT_FOUND','Tautan berkas sudah kedaluwarsa.',404);
    const data=JSON.parse(link.data),file=await r.first('SELECT * FROM uploads WHERE id=?',data.file_id);
    if(!file)fail('NOT_FOUND','Berkas tidak ditemukan.',404);
    const object=await (file.storage_bucket==='public'?c.env.FILES_PUBLIC:c.env.FILES_PRIVATE).get(file.storage_key||'files/'+file.id);
    if(!object)fail('NOT_FOUND','Berkas tidak ditemukan.',404);
    await r.batch([r.audit(data.user_id,'file.viewed',file.id)]);
    c.header('Content-Type',file.mime);c.header('Cache-Control','no-store');
    return c.body(object!.body);
});
app.get("/media/:id", async (c) => {
    const r = new Repo(c.env.DB, {role:"guest"});
    const file = await r.first("SELECT * FROM uploads WHERE id=? AND kind='product'", c.req.param("id"));
    if(!file) fail("NOT_FOUND", "Foto tidak ditemukan",404);
    const object = await (file.storage_bucket==='public'?c.env.FILES_PUBLIC:c.env.FILES_PRIVATE).get(file.storage_key || "files/"+file.id);
    if(!object) fail("NOT_FOUND","Foto tidak ditemukan",404);
    c.header("Content-Type",file.mime); c.header("Cache-Control","public,max-age=86400");
    return c.body(object!.body);
});
async function storefront(c:any, page:string) {
    const store=await loadStore(c.env.DB), r=new Repo(c.env.DB,{role:"guest"});
    await expire(r);
    const {qris_payload, ...settings}=store.settings;
    const data={store:{name:store.name,settings},products:await r.all("SELECT id,name,category,brand,description,price,image,images,capacity FROM products WHERE deleted_at IS NULL AND published=1"),bundles:(await r.records("bundle")).filter(b=>b.active!==false),outlets:await r.records("outlet")};
    return c.html(storeShell(data,storePage(data,page)));
}
app.get("/", c=>storefront(c,"home"));
app.get("/catalog", c=>storefront(c,"catalog"));
app.get("/product/:id", c=>storefront(c,"product"));
app.get("/guide", c=>storefront(c,"guide"));
app.get("/terms", c=>storefront(c,"terms"));
app.get("/lookup", c=>storefront(c,"lookup"));
cashierRoutes(app,async(c,content)=>shell(await bootstrap(c),'bookings',content,'Buat booking'));
inventoryRoutes(app);
operationsRoutes(app,upload);
app.get("/admin/*", async (c) => {
    if(!await requireSession(c,false))return c.redirect("/login");
    const data = await bootstrap(c);
    let page = c.req.path.split("/")[2] || "dashboard";
    if(!["dashboard","bookings","calendar","products","customers","operations","maintenance","finance","reports","partners","promotions","settings"].includes(page))return c.notFound();
    if (c.get("member").role === "partner")
        page = "partners";
    if (!["owner", "admin"].includes(c.get("member").role) &&
        [
            "finance",
            "reports",
            "settings",
            "customers",
            "promotions",
        ].includes(page))
        fail("FORBIDDEN", "Akses ditolak", 403);
    return c.html(shell(data, page, renderPage(data, page)));
});
app.get("/admin", (c) => c.redirect("/admin/dashboard"));

app.all('/api/*',c=>c.json({ok:false,error:{code:'NOT_FOUND',message:'Endpoint tidak ditemukan.'}},404));
app.get("*", async (c) => c.env.ASSETS.fetch(c.req.raw));
export { app };
export default {
    fetch: app.fetch,
    async scheduled(_event:any,env:Env,ctx:ExecutionContext) {
        ctx.waitUntil(env.JOBS.send({type:'maintenance'}));
    },
    async queue(batch:MessageBatch<{type:string}>,env:Env) {
        for(const message of batch.messages) {
            if(message.body.type!=='maintenance'){message.ack();continue;}
            try {
                const store=await loadStore(env.DB);
                const r=new Repo(env.DB,{role:'system'});
                await runJobs(r,env.FILES_PRIVATE,store.settings);
                await r.batch([r.stmt('DELETE FROM rate_limits WHERE expires_at<?',Date.now()),r.stmt('DELETE FROM sessions WHERE expires_at<?',Date.now())]);
                message.ack();
            } catch(error) { console.error('MAINTENANCE_FAILED');message.retry(); }
        }
    },
};

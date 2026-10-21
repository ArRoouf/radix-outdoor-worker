import {SQLiteD1} from '../packages/db/local-adapter';
import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { duration, downPayment, lateFee, share, crc16, qris, assertTransition, DAY, } from "../packages/shared/pricing";
import { Repo } from "../apps/api/src/repo/index";
import { createBooking, payment, bookingAction, editBooking, confirmPayment, quote, expire, } from "../apps/api/src/services/rental";
const settings = {
    buffer_hours: 24,
    dp_percent: 30,
    tolerance: 60,
    late_price: 20000,
    expires_hours: 3,
};
let db: SQLiteD1, r: Repo, rb: Repo;
const start = Date.now() + 10 * DAY, end = start + 3 * DAY;
async function fixture() {
    db = new SQLiteD1();
    r = new Repo(db as any, {role:'owner'});
    rb = new Repo(db as any, {role:'admin',outletId:'out-B'});
    for (const label of ["A", "B"]) {
        const rr=r;
        await rr.batch([
            rr.record("outlet", { name: "Pusat" }, "out-" + label),
            rr.insert("products", {
                id: "tent-" + label,
                name: "Tenda 4P",
                category: "Tenda",
                price: 40000,
                created_at: 1,
            }),
            rr.insert("products", {
                id: "bag-" + label,
                name: "Sleeping Bag",
                category: "Sleeping Bag",
                price: 15000,
                created_at: 1,
            }),
        ]);
        for (const [p, n] of [
            ["tent", 1],
            ["bag", 2],
        ] as const)
            for (let i = 0; i < n; i++)
                await rr.batch([
                    rr.insert("units", {
                        id: p + "-" + label + "-" + i,
                        product_id: p + "-" + label,
                        outlet_id: "out-" + label,
                        code: p + "-" + label + "-" + i,
                        status: "available",
                        purchase_price: 500000,
                        created_at: 1,
                    }),
                ]);
    }
}
const payload = (phone = "081234567890") => ({
    start_at: start,
    end_at: end,
    outlet_id: "out-A",
    items: [{ product_id: "tent-A", qty: 1 }],
    customer: { name: "Budi Test", phone },
    paid: 0,
    method: "cash",
});
describe("Rumus PRD", () => {
    it("durasi per 24 jam dan toleransi", () => {
        expect(duration(0, 48 * 3600000)).toBe(2);
        expect(duration(0, 50 * 3600000)).toBe(3);
        expect(duration(0, 49 * 3600000)).toBe(2);
        expect(() => duration(3, 2)).toThrow();
    });
    it("pembulatan DP", () => {
        expect(downPayment(189000)).toBe(57000);
        expect(downPayment(500, 100)).toBe(500);
        expect(downPayment(0)).toBe(0);
    });
    it("denda 26 jam dengan toleransi 1 jam", () => {
        expect(lateFee(0, 26 * 3600000, 20000)).toBe(40000);
        expect(lateFee(0, 3600000, 20000)).toBe(0);
    });
    it("bagi hasil sesudah diskon proporsional", () => expect(share(120000, 210000, 21000, 70)).toBe(75600));
    it("transisi ilegal ditolak", () => expect(() => assertTransition("pending_payment", "completed")).toThrow("INVALID_TRANSITION"));
    it("CRC16 dan payload QRIS dinamis", () => {
        expect(crc16("123456789")).toBe("29B1");
        const base = "0002010102115802ID6304";
        const staticQR = base + crc16(base);
        const dynamic = qris(staticQR, 57000);
        expect(dynamic).toContain("010212");
        expect(dynamic).toContain("540557000");
        expect(dynamic.slice(-4)).toBe(crc16(dynamic.slice(0, -4)));
        expect(() => qris("invalid", 50000)).toThrow();
    });
});
describe("Database & service invariants", () => {
    beforeEach(fixture);
    it("contoh harga bagian 18.8", async () => {
        await r.batch([
            r.record("voucher", {
                code: "NOV10",
                kind: "percent",
                value: 10,
                min_total: 0,
                quota: 100,
                used: 0,
                active: true,
            }),
        ]);
        const q = await quote(r, settings, {
            ...payload(),
            items: [
                { product_id: "tent-A", qty: 1 },
                { product_id: "bag-A", qty: 2 },
            ],
            voucher_code: "NOV10",
        });
        expect(q.subtotal).toBe(210000);
        expect(q.discount).toBe(21000);
        expect(q.total).toBe(189000);
        expect(q.dp).toBe(57000);
    });
    it("dua permintaan bersamaan hanya satu berhasil", async () => {
        const attempts = await Promise.allSettled([
            createBooking(r, settings, payload(), "race-1", "owner"),
            createBooking(r, settings, payload("081234567891"), "race-2", "owner"),
        ]);
        expect(attempts.filter((x) => x.status === "fulfilled")).toHaveLength(1);
        expect(await r.all("SELECT * FROM bookings")).toHaveLength(1);
        expect(await r.all("SELECT * FROM customers")).toHaveLength(1);
    });
    it("retry dengan Idempotency-Key mengembalikan booking yang sama", async () => {
        const a = await createBooking(r, settings, payload(), "same", "owner");
        const b = await createBooking(r, settings, payload(), "same", "owner");
        expect(a.id).toBe(b.id);
        expect(await r.all("SELECT * FROM bookings")).toHaveLength(1);
    });
    it("buffer 24 jam memblokir booking berikutnya", async () => {
        await createBooking(r, settings, payload(), "buffer", "owner");
        await expect(quote(r, settings, {
            ...payload(),
            start_at: end + 23 * 3600000,
            end_at: end + 2 * DAY,
        })).rejects.toThrow();
        const q = await quote(r, settings, {
            ...payload(),
            start_at: end + DAY,
            end_at: end + 2 * DAY,
        });
        expect(q.total).toBe(40000);
    });
    it("ledger menolak update dan delete", async () => {
        await r.batch([
            r.insert("ledger", {
                id: "l",
                account: "rental_income",
                direction: "in",
                amount: 1000,
                created_at: 1,
            }),
        ]);
        await expect(r.batch([r.stmt("UPDATE ledger SET amount=1")])).rejects.toThrow("LEDGER_IMMUTABLE");
        await expect(r.batch([r.stmt("DELETE FROM ledger")])).rejects.toThrow("LEDGER_IMMUTABLE");
    });
    it("staf outlet lain tidak dapat membaca atau mengubah booking dan pembayaran", async () => {
        const b = await createBooking(r, settings, payload(), "isolation", "owner");
        await expect(quote(rb, settings, payload())).rejects.toThrow("hanya tersedia 0 unit");
        for (const table of [
            "bookings",
            "payments",
            "customers",
            "ledger",
            "items",
            "reservations",
        ])
            expect(await rb.all(`SELECT * FROM ${table}`)).toHaveLength(0);
        await expect(payment(rb, b.id, { amount: 1000, method: "cash" }, "foreign", "owner")).rejects.toThrow("Booking tidak ditemukan");
        await expect(bookingAction(rb, settings, b.id, "cancel", { reason: "Test" }, "owner", "owner")).rejects.toThrow("Booking tidak ditemukan");
        expect(() => new Repo(db as any, null as any)).toThrow("ACCESS_SCOPE_REQUIRED");
    });
    it("pembayaran menolak overpayment dan aman untuk retry", async () => {
        const b = await createBooking(r, settings, payload(), "pay", "owner");
        await expect(payment(r, b.id, { amount: 120001, method: "cash" }, "over", "owner")).rejects.toThrow("Nominal");
        const p = await payment(r, b.id, { amount: 40000, method: "cash" }, "pay1", "owner");
        const p2 = await payment(r, b.id, { amount: 40000, method: "cash" }, "pay1", "owner");
        expect(p.id).toBe(p2.id);
        const fresh = await r.first("SELECT * FROM bookings WHERE id=?", b.id);
        expect(fresh.paid).toBe(40000);
        expect(fresh.status).toBe("confirmed");
        expect(await r.all("SELECT * FROM ledger")).toHaveLength(1);
    });
    it("booking → bayar → pickup → return → selesai", async () => {
        const b = await createBooking(r, settings, { ...payload(), paid: 120000 }, "lifecycle", "owner");
        await bookingAction(r, settings, b.id, "pickup", { checked: true, signature: "signature-file", collateral_type: "ktp" }, "owner", "owner");
        let fresh = await r.first("SELECT * FROM bookings WHERE id=?", b.id);
        expect(fresh.collateral).toBe("held");
        await bookingAction(r, settings, b.id, "return", {}, "owner", "owner");
        fresh = await r.first("SELECT * FROM bookings WHERE id=?", b.id);
        expect(fresh.status).toBe("returned");
        await bookingAction(r, settings, b.id, "complete", { identity_returned: true }, "owner", "owner");
        fresh = await r.first("SELECT * FROM bookings WHERE id=?", b.id);
        expect(fresh.status).toBe("completed");
        expect(fresh.collateral).toBe("returned");
    });
    it("pending kadaluwarsa melepaskan stok", async () => {
        const b = await createBooking(r, settings, payload(), "expire", "owner");
        await r.batch([
            r.stmt("UPDATE bookings SET expires_at=1 WHERE id=?", b.id),
        ]);
        await expire(r);
        expect((await r.first("SELECT * FROM bookings WHERE id=?", b.id))
            .status).toBe("expired");
        expect((await quote(r, settings, payload())).lines[0].units).toHaveLength(1);
    });
    it("pembayaran pending tidak masuk ledger sebelum konfirmasi dan konfirmasi idempotent", async () => {
        const b = await createBooking(r, settings, payload(), "proof", "owner");
        const p = await payment(r, b.id, { amount: 40000, method: "transfer", proof: "file" }, "proof1", "guest", false);
        expect((await r.all("SELECT * FROM ledger")).length).toBe(0);
        await confirmPayment(r, p.id, "owner");
        await confirmPayment(r, p.id, "owner");
        expect((await r.all("SELECT * FROM ledger")).length).toBe(1);
    });
});
describe("Edits, partial returns and quota atomicity", () => {
    beforeEach(fixture);
    it("edit preserves confirmed price snapshots and keeps revisions", async () => {
        const b = await createBooking(r, settings, { ...payload(), paid: 40000 }, "edit-base", "owner");
        await r.batch([
            r.stmt("UPDATE products SET price=50000 WHERE id=?", "tent-A"),
        ]);
        const updated = await editBooking(r, settings, b.id, { ...payload(), end_at: end + DAY }, "edit-key", "owner");
        expect(updated.total).toBe(160000);
        expect(await r.all("SELECT * FROM items WHERE voided_at IS NULL")).toHaveLength(1);
        expect(await r.records("booking_revision")).toHaveLength(1);
        expect(await r.all("SELECT * FROM reservations WHERE released_at IS NULL")).toHaveLength(1);
    });
    it("partial returns keep booking rented until all items return", async () => {
        const b = await createBooking(r, settings, { ...payload(), items: [{ product_id: "bag-A", qty: 2 }], paid: 90000 }, "partial", "owner");
        await bookingAction(r, settings, b.id, "pickup", { checked: true, signature: "sig", collateral_type: "sim" }, "owner", "owner");
        const items = await r.all("SELECT * FROM items WHERE booking_id=?", b.id);
        await bookingAction(r, settings, b.id, "return", { item_ids: [items[0].id] }, "owner", "owner");
        expect((await r.first("SELECT * FROM bookings WHERE id=?", b.id))
            .status).toBe("picked_up");
        await bookingAction(r, settings, b.id, "return", { item_ids: [items[1].id] }, "owner", "owner");
        expect((await r.first("SELECT * FROM bookings WHERE id=?", b.id))
            .status).toBe("returned");
    });
    it("voucher quota cannot be exceeded by concurrent bookings", async () => {
        await r.batch([
            r.record("voucher", {
                code: "LAST",
                kind: "percent",
                value: 10,
                min_total: 0,
                quota: 1,
                used: 0,
                active: true,
            }, "last-voucher"),
        ]);
        const a = { ...payload(), voucher_code: "LAST" }, b = {
            ...payload("081234567899"),
            voucher_code: "LAST",
            items: [{ product_id: "bag-A", qty: 1 }],
        };
        const results = await Promise.allSettled([
            createBooking(r, settings, a, "quota1", "owner"),
            createBooking(r, settings, b, "quota2", "owner"),
        ]);
        expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
        expect((await r.records("voucher"))[0].used).toBe(1);
        expect(await r.all("SELECT * FROM bookings")).toHaveLength(1);
    });
    it("blacklist blocks guest and manual booking without consuming units", async () => {
        await r.batch([
            r.insert("customers", {
                id: "blacklisted",
                name: "Risk",
                phone: "6281234567890",
                blacklisted: 1,
                created_at: 1,
            }),
        ]);
        await expect(createBooking(r, settings, payload(), "blocked", "owner")).rejects.toThrow("hubungi toko");
        expect(await r.all("SELECT * FROM reservations")).toHaveLength(0);
    });
});

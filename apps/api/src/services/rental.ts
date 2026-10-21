import { Repo, uid } from "../repo/index";
import { DAY, bundleSelection, duration, downPayment, priceLine, lateFee, assertTransition, share, } from "../../../../packages/shared/pricing";
import { fail } from './errors';
import { activeCashShift } from './cash';
import { snapshotComponents } from './fines';
export { DomainError, fail } from './errors';
export async function expire(r: Repo) {
    const now = Date.now();
    await r.batch([
        r.stmt("UPDATE reservations SET released_at=?1 WHERE booking_id IN(SELECT id FROM bookings WHERE status='pending_payment' AND expires_at<?1)", now),
        r.stmt("INSERT INTO status_logs(id,booking_id,status,note,created_at) SELECT lower(hex(randomblob(16))),id,'expired','Batas pembayaran berakhir',?1 FROM bookings WHERE status='pending_payment' AND expires_at<?1", now),
        r.stmt("UPDATE bookings SET status='expired' WHERE status='pending_payment' AND expires_at<?", now),
    ]);
}
export async function quote(r: Repo, settings: any, body: any, excludeBookingId: string | null = null) {
    const start = Number(body.start_at), end = Number(body.end_at), days = duration(start, end, settings.tolerance);
    if (days > 365)
        fail("INVALID_RANGE", "Durasi maksimal 365 hari");
    let requested = body.items || [];
    if (body.bundle_id) {
        const bundle = (await r.records("bundle")).find((b) => b.id === body.bundle_id);
        if (!bundle || bundle.active === false)
            fail("NOT_FOUND", "Paket tidak aktif atau tidak ditemukan", 404);
        try { requested = bundleSelection(bundle.items, body.bundle_qty ?? 1); }
        catch(e) { fail('INVALID_QTY',(e as Error).message,422); }
    }
    if (!Array.isArray(requested) || !requested.length || requested.length > 50)
        fail("EMPTY_CART", "Pilih setidaknya satu produk");
    const lines: any[] = [];
    const rules = await r.records("price_rule");
    for (const item of requested) {
        const qty = Number(item.qty);
        if (!Number.isInteger(qty) || qty < 1 || qty > 100)
            fail("INVALID_QTY", "Jumlah produk tidak valid");
        const p = await r.first("SELECT * FROM products WHERE id=? AND deleted_at IS NULL AND published=1", item.product_id);
        if (!p)
            fail("NOT_FOUND", "Produk tidak ditemukan", 404);
        const units = await r.all("SELECT u.* FROM units u WHERE u.product_id=? AND u.status='available' AND (? IS NULL OR u.outlet_id=?) AND NOT EXISTS(SELECT 1 FROM reservations rr WHERE rr.unit_id=u.id AND rr.released_at IS NULL AND rr.start_at<? AND ?<rr.end_at AND (? IS NULL OR rr.booking_id IS NULL OR rr.booking_id<>?)) ORDER BY (SELECT COUNT(*) FROM items i WHERE i.unit_id=u.id),u.code", p.id, body.outlet_id || null, body.outlet_id || null, end + (p.buffer_hours ?? settings.buffer_hours) * 3600000, start, excludeBookingId, excludeBookingId);
        const used = lines
            .filter((x) => x.product.id === p.id)
            .flatMap((x) => x.units.map((u: any) => u.id));
        const free = units.filter((u) => !used.includes(u.id));
        if (free.length < qty)
            fail("UNIT_NOT_AVAILABLE", `${p.name} hanya tersedia ${free.length} unit pada tanggal tersebut`, 409);
        const pricing = priceLine(p, start, end, rules, body.member);
        lines.push({
            product: p,
            qty,
            units: free.slice(0, qty),
            ...pricing,
            total: pricing.total * qty,
        });
    }
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    let discount = 0;
    let voucher: any = null;
    if (body.bundle_id) {
        const b = (await r.records("bundle")).find((b) => b.id === body.bundle_id);
        const packageTotal=b.price*days*Number(body.bundle_qty??1);
        if(!Number.isSafeInteger(packageTotal))fail("INVALID_AMOUNT","Harga paket melebihi batas rupiah");
        discount = Math.max(0, subtotal - packageTotal);
    }
    if (body.voucher_code) {
        voucher = (await r.records("voucher")).find((v) => v.code.toUpperCase() === String(body.voucher_code).toUpperCase() &&
            v.active);
        if (!voucher ||
            subtotal < voucher.min_total ||
            (voucher.quota && voucher.used >= voucher.quota) ||
            (voucher.end_at && Date.now() > voucher.end_at))
            fail("INVALID_VOUCHER", "Voucher tidak berlaku atau minimum transaksi belum terpenuhi");
        discount +=
            voucher.kind === "percent"
                ? Math.round((subtotal * voucher.value) / 100)
                : voucher.value;
    }
    const total = Math.max(0, subtotal - discount);
    return {
        start,
        end,
        days,
        lines,
        subtotal,
        discount: Math.min(subtotal, discount),
        total,
        dp: downPayment(total, settings.dp_percent),
        voucher,
    };
}
export async function createBooking(r: Repo, settings: any, body: any, idem: string, user: string, publicBooking = false) {
    if (!idem)
        fail("IDEMPOTENCY_REQUIRED", "Token transaksi diperlukan");
    const old = await r.first("SELECT * FROM bookings WHERE idem=?", idem);
    if (old)
        return old;
    await expire(r);
    const c = body.customer;
    if (!c?.name?.trim() || !/^\+?\d[\d\s-]{8,18}$/.test(c.phone || ""))
        fail("INVALID_CUSTOMER", "Isi nama dan nomor WhatsApp yang valid");
    const phone = normalizePhone(c.phone);
    const customer = await r.first("SELECT * FROM customers WHERE phone=?", phone);
    if (customer?.blacklisted)
        fail("BOOKING_UNAVAILABLE", "Silakan hubungi toko untuk melanjutkan penyewaan", 403);
    if (publicBooking && Number(body.start_at) < Date.now() - 3600000)
        fail("INVALID_RANGE", "Tanggal pengambilan tidak boleh di masa lalu");
    if (publicBooking && !body.consent)
        fail("CONSENT_REQUIRED", "Setujui syarat sewa dan kebijakan privasi");
    if (publicBooking && !c.id_doc)
        fail("IDENTITY_REQUIRED", "Unggah foto identitas untuk verifikasi");
    if (c.id_doc) {
        const doc = await r.first("SELECT * FROM uploads WHERE id=? AND kind='identity'", c.id_doc);
        if (!doc)
            fail("INVALID_DOCUMENT", "Dokumen identitas tidak valid");
    }
    body.member = customer?.segment === "member";
    for (let attempt = 0; attempt < 3; attempt++) {
        const q = await quote(r, settings, body);
        const id = uid(), cid = customer?.id || uid(), now = Date.now(), code = "RX-" +
            new Date().toISOString().slice(2, 7).replace("-", "") +
            "-" +
            uid().replace(/-/g, "").slice(-12).toUpperCase();
        const dp = q.dp;
        const amount = publicBooking ? 0 : Number(body.paid) || 0;
        if (amount > q.total)
            fail("INVALID_AMOUNT", "Pembayaran melebihi total tagihan");
        if (!Number.isSafeInteger(amount) || amount < 0)
            fail("INVALID_AMOUNT", "Nominal pembayaran tidak valid");
        const status = amount >= dp ? "confirmed" : "pending_payment";
        const b = {
            id,
            outlet_id: body.outlet_id || q.lines[0].units[0].outlet_id,
            customer_id: cid,
            code,
            status,
            channel: publicBooking ? "online" : body.channel || "walk_in",
            start_at: q.start,
            end_at: q.end,
            subtotal: q.subtotal,
            discount: q.discount,
            total: q.total,
            paid: amount,
            dp,
            expires_at: status === "pending_payment"
                ? now + settings.expires_hours * 3600000
                : null,
            collateral: "none",
            note: body.note || "",
            idem,
            created_at: now,
        };
        const statements: D1PreparedStatement[] = [];
        if (!customer)
            statements.push(r.insert("customers", {
                id: cid,
                name: c.name.trim(),
                phone,
                email: c.email || null,
                address: c.address || "",
                id_doc: c.id_doc || null,
                created_at: now,
            }));
        statements.push(r.insert("bookings", b));
        for (const l of q.lines) {
            for (const unit of l.units) {
                statements.push(r.insert("items", {
                    id: uid(),
                    booking_id: id,
                    product_id: l.product.id,
                    unit_id: unit.id,
                    product_name: l.product.name,
                    price: l.price,
                    days: l.days,
                    total: Math.round(l.total / l.qty),
                }), r.insert("reservations", {
                    id: uid(),
                    unit_id: unit.id,
                    booking_id: id,
                    start_at: q.start,
                    end_at: q.end +
                        (l.product.buffer_hours ?? settings.buffer_hours) * 3600000,
                    kind: "booking",
                }));
            }
        }
        if (amount) {
            const pid = uid();
            if(!['cash','transfer','qris'].includes(body.method || 'cash'))fail('INVALID_METHOD','Metode pembayaran tidak valid');
            const shift = (body.method || 'cash') === 'cash' ? await activeCashShift(r,b.outlet_id,user) : null;
            statements.push(r.insert("payments", {
                id: pid,
                booking_id: id,
                shift_id: shift?.id || null,
                amount,
                method: body.method || "cash",
                status: "confirmed",
                idem: idem + "-pay",
                created_at: now,
            }), r.insert("ledger", {
                id: uid(),
                booking_id: id,
                account: "rental_income",
                direction: "in",
                amount,
                reference: pid,
                note: "Pembayaran " + code,
                created_at: now,
            }));
        }
        if (q.voucher) {
            statements.push(r.stmt("UPDATE records SET data=json_set(data,'$.used',COALESCE(json_extract(data,'$.used'),0)+1) WHERE id=? ", q.voucher.id));
        }
        if (publicBooking)
            statements.push(r.record("consent", {
                booking_id: id,
                customer_id: cid,
                terms: settings.terms,
                privacy: settings.privacy,
                version: "2026-10-v1",
                accepted_at: now,
            }));
        statements.push(r.log(id, status, "Booking dibuat"), r.audit(user, "booking.created", id), r.record("notification", {
            title: "Booking baru " + code,
            message: c.name + " • " + q.total,
            booking_id: id,
            read: false,
        }));
        try {
            await r.batch(statements);
            return b;
        }
        catch (e) {
            const existing = await r.first("SELECT * FROM bookings WHERE idem=?", idem);
            if (existing)
                return existing;
            if (!String(e).includes("UNIT_NOT_AVAILABLE") || attempt === 2)
                throw e;
        }
    }
}
export function normalizePhone(v: string) {
    let n = v.replace(/[^0-9]/g, "");
    if (n.startsWith("0"))
        n = "62" + n.slice(1);
    return n;
}
export async function payment(r: Repo, bid: string, body: any, idem: string, user: string, confirm = true) {
    if (!idem)
        fail("IDEMPOTENCY_REQUIRED", "Token pembayaran diperlukan");
    const old = await r.first("SELECT * FROM payments WHERE idem=?", idem);
    if (old)
        return old;
    const b = await r.first("SELECT * FROM bookings WHERE id=?", bid);
    if (!b)
        fail("NOT_FOUND", "Booking tidak ditemukan", 404);
    if (["cancelled", "expired", "completed"].includes(b.status))
        fail("INVALID_TRANSITION", "Booking sudah ditutup");
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > b.total - b.paid)
        fail("INVALID_AMOUNT", "Nominal harus lebih dari 0 dan tidak melebihi sisa tagihan");
    if (!["cash", "transfer", "qris"].includes(body.method))
        fail("INVALID_METHOD", "Metode pembayaran tidak valid");
    const id = uid(), now = Date.now();
    const shift = confirm && body.method === "cash" ? await activeCashShift(r,b.outlet_id,user) : null;
    const p = {
        id,
        booking_id: bid,
        shift_id: shift?.id || null,
        amount,
        method: body.method,
        status: confirm ? "confirmed" : "pending",
        proof: body.proof || null,
        idem,
        created_at: now,
    };
    const stmts = [r.insert("payments", p)];
    if (confirm) {
        stmts.push(r.stmt("UPDATE bookings SET paid=paid+?1,status=CASE WHEN status='pending_payment' AND paid+?1>=dp THEN 'confirmed' ELSE status END WHERE id=?2", amount, bid), r.insert("ledger", {
            id: uid(),
            booking_id: bid,
            account: b.status === "returned" ? "fine_income" : "rental_income",
            direction: "in",
            amount,
            reference: id,
            note: "Pembayaran " + b.code,
            created_at: now,
        }), r.log(bid, b.status === "pending_payment" && b.paid + amount >= b.dp
            ? "confirmed"
            : b.status, "Pembayaran " + amount));
    }
    stmts.push(r.audit(user, "payment." + (confirm ? "confirmed" : "submitted"), id));
    await r.batch(stmts);
    return p;
}
export async function confirmPayment(r: Repo, id: string, user: string, reject = false, reason = "") {
    const p = await r.first("SELECT * FROM payments WHERE id=?", id);
    if (!p)
        fail("NOT_FOUND", "Pembayaran tidak ditemukan", 404);
    if (p.status !== "pending")
        return p;
    const b = await r.first("SELECT * FROM bookings WHERE id=?", p.booking_id);
    if (!b || ["expired", "cancelled", "completed"].includes(b.status))
        fail("INVALID_TRANSITION", "Booking sudah ditutup; lakukan rekonsiliasi manual");
    if (reject) {
        await r.batch([
            r.stmt("UPDATE payments SET status='rejected' WHERE id=? AND status='pending'", id),
            r.audit(user, "payment.rejected: " + reason, id),
        ]);
        return;
    }
    const shift = p.method === "cash" ? await activeCashShift(r,b.outlet_id,user) : null;
    const stmts = [
        r.stmt("INSERT INTO operation_keys(key) VALUES(?)", "confirm-" + id),
        r.stmt("UPDATE bookings SET paid=paid+?1,status=CASE WHEN status='pending_payment' AND paid+?1>=dp THEN 'confirmed' ELSE status END WHERE id=?2", p.amount, b.id),
        r.stmt("UPDATE payments SET status='confirmed',shift_id=?1 WHERE id=?2", shift?.id || null, id),
        r.insert("ledger", {
            id: uid(),
            booking_id: b.id,
            account: "rental_income",
            direction: "in",
            amount: p.amount,
            reference: p.id,
            note: "Verifikasi pembayaran " + b.code,
            created_at: Date.now(),
        }),
        r.audit(user, "payment.confirmed", id),
        r.log(b.id, b.paid + p.amount >= b.dp ? "confirmed" : b.status, "Pembayaran diverifikasi"),
    ];
    try {
        await r.batch(stmts);
    }
    catch (e) {
        if (String(e).includes("operation_keys") ||
            String(e).includes("ledger.reference"))
            return;
        throw e;
    }
}
export async function bookingAction(r: Repo, settings: any, bid: string, action: string, body: any, user: string, role: string) {
    const b = await r.first("SELECT * FROM bookings WHERE id=?", bid);
    if (!b)
        fail("NOT_FOUND", "Booking tidak ditemukan", 404);
    const items = await r.all("SELECT i.*,u.code,u.partner_id,u.purchase_price FROM items i JOIN units u ON u.id=i.unit_id WHERE i.booking_id=? AND i.voided_at IS NULL", bid);
    const now = Date.now(), stmts: D1PreparedStatement[] = [];
    let next = "";
    if (action === "cancel") {
        stmts.push(r.stmt("INSERT INTO operation_keys(key) VALUES(?)", "cancel-" + bid));
        assertTransition(b.status, "cancelled");
        const refund = Number(body.refund) || 0;
        if (!Number.isSafeInteger(refund) || refund < 0 || refund > b.paid)
            fail("INVALID_REFUND", "Nominal refund tidak valid");
        if (refund && role !== "owner")
            fail("FORBIDDEN", "Refund memerlukan Owner", 403);
        if (!body.reason?.trim())
            fail("REASON_REQUIRED", "Isi alasan pembatalan");
        next = "cancelled";
        stmts.push(r.stmt("UPDATE reservations SET released_at=?1 WHERE booking_id=?2", now, bid));
        if (refund) {
            stmts.push(r.insert("payments", {
                id: uid(),
                booking_id: bid,
                amount: refund,
                method: "transfer",
                kind: "refund",
                status: "confirmed",
                idem: "refund-" + bid,
                created_at: now,
            }), r.insert("ledger", {
                id: uid(),
                booking_id: bid,
                account: "refund",
                direction: "out",
                amount: refund,
                reference: "refund-" + bid,
                note: body.reason,
                created_at: now,
            }));
        }
    }
    else if (action === "pickup") {
        stmts.push(r.stmt("INSERT INTO operation_keys(key) VALUES(?)", "pickup-" + bid));
        assertTransition(b.status, "picked_up");
        if (b.paid < b.total)
            fail("UNPAID", "Lunasi pembayaran sebelum pengambilan");
        if (!body.checked ||
            !["ktp", "sim", "other"].includes(body.collateral_type))
            fail("CHECKLIST_REQUIRED", "Verifikasi kelengkapan dan terima identitas jaminan");
        if (!body.signature)
            fail("SIGNATURE_REQUIRED", "Tanda tangan penyewa diperlukan");
        for (const i of items) {
            stmts.push(r.record("inspection", {
                booking_id: bid,
                item_id: i.id,
                unit_id: i.unit_id,
                phase: "pickup",
                condition: "good",
                checklist: body.checklist || "Lengkap",
                photo: body.photo || null,
                signature: body.signature,
            }), r.record("movement", {
                unit_id: i.unit_id,
                kind: "out",
                booking_id: bid,
            }));
        }
        stmts.push(r.stmt("UPDATE bookings SET collateral='held',collateral_type=?1 WHERE id=?2", body.collateral_type, bid));
        next = "picked_up";
    }
    else if (action === "return") {
        assertTransition(b.status, "returned");
        const selected = Array.isArray(body.item_ids)
            ? body.item_ids
            : items.filter((i) => !i.returned_at).map((i) => i.id);
        if (!selected.length)
            fail("NO_ITEMS", "Pilih unit yang dikembalikan");
        const returned = items.filter((i) => selected.includes(i.id) && !i.returned_at);
        if (!returned.length)
            fail("NO_ITEMS", "Unit tersebut sudah dikembalikan");
        let fines = 0;
        for (const i of returned) {
            stmts.push(r.stmt("INSERT INTO operation_keys(key) VALUES(?)", "return-" + i.id));
            const condition = body.conditions?.[i.id] || body.condition || "good";
            if (!["good", "minor", "damaged", "lost"].includes(condition))
                fail("INVALID_CONDITION", "Kondisi tidak valid");
            const damage = condition === "lost"
                ? i.purchase_price
                : condition !== "good"
                    ? Number(body.damage) || 0
                    : 0;
            if (damage < 0 || !Number.isSafeInteger(damage))
                fail("INVALID_AMOUNT", "Biaya kerusakan tidak valid");
            if (condition !== "good" && (!body.note || !body.photo))
                fail("EVIDENCE_REQUIRED", "Kondisi rusak/hilang memerlukan catatan dan foto");
            const component = await snapshotComponents(r,body.components?.[i.id],condition,condition === 'lost' ? 0 : damage);
            for(const f of component.snapshots) if(f.amount)stmts.push(r.record('fine',{...f,booking_id:bid,item_id:i.id}));
            const late = lateFee(b.end_at, now, settings.late_price, 1, settings.tolerance);
            fines += late + damage + component.total;
            if(!Number.isSafeInteger(fines)||!Number.isSafeInteger(b.total+fines))fail('INVALID_AMOUNT','Total denda melebihi batas rupiah');
            stmts.push(r.stmt("UPDATE items SET returned_at=?1,condition=?2 WHERE id=?3", now, condition, i.id), r.record("inspection", {
                booking_id: bid,
                item_id: i.id,
                unit_id: i.unit_id,
                phase: "return",
                condition,
                note: body.note || "",
                photo: body.photo || null,
                late,
                damage,
                components: component.snapshots,
            }), r.record("movement", {
                unit_id: i.unit_id,
                kind: "in",
                booking_id: bid,
            }));
            if (late)
                stmts.push(r.record("fine", {
                    booking_id: bid,
                    item_id: i.id,
                    kind: "late",
                    amount: late,
                    note: "Keterlambatan pengembalian",
                }));
            if (damage)
                stmts.push(r.record("fine", {
                    booking_id: bid,
                    item_id: i.id,
                    kind: condition === "lost" ? "lost" : "damage",
                    amount: damage,
                    note: body.note,
                }));
            if (condition !== "good") {
                stmts.push(r.stmt("UPDATE units SET status=?1 WHERE id=?2", condition === "lost" ? "lost" : "maintenance", i.unit_id));
            }
            const product = await r.first("SELECT buffer_hours FROM products WHERE id=?", i.product_id);
            const buffer = (product?.buffer_hours ?? settings.buffer_hours) * 3600000;
            const newEnd = now + buffer;
            const conflict = await r.first("SELECT id FROM reservations WHERE unit_id=? AND booking_id<>? AND released_at IS NULL AND start_at<? AND ?<end_at", i.unit_id, bid, newEnd, now);
            if (conflict) {
                stmts.push(r.record("notification", {
                    title: "Periksa bentrok stok",
                    message: "Keterlambatan " + b.code + " mengganggu jadwal unit " + i.code,
                    read: false,
                }));
            }
            else
                stmts.push(r.stmt("UPDATE reservations SET end_at=?1 WHERE booking_id=?2 AND unit_id=?3", Math.max(newEnd, b.start_at + 1), bid, i.unit_id));
        }
        if (fines)
            stmts.push(r.stmt("UPDATE bookings SET total=total+?1 WHERE id=?2", fines, bid));
        next = items.every((i) => i.returned_at || selected.includes(i.id))
            ? "returned"
            : "picked_up";
    }
    else if (action === "complete") {
        stmts.push(r.stmt("INSERT INTO operation_keys(key) VALUES(?)", "complete-" + bid));
        assertTransition(b.status, "completed");
        if (b.paid < b.total)
            fail("UNPAID", "Lunasi seluruh tagihan sebelum mengembalikan identitas");
        if (!body.identity_returned)
            fail("COLLATERAL_REQUIRED", "Konfirmasi identitas sudah dikembalikan");
        next = "completed";
        stmts.push(r.stmt("UPDATE bookings SET collateral='returned' WHERE id=?", bid));
        const partners = await r.records("partner");
        for (const i of items.filter((i) => i.partner_id)) {
            const partner = partners.find((p) => p.id === i.partner_id);
            const amount = share(i.total, b.subtotal, b.discount, partner?.share_percent || 0);
            if (amount)
                stmts.push(r.insert("ledger", {
                    id: uid(),
                    booking_id: bid,
                    account: "partner_payable",
                    direction: "out",
                    amount,
                    reference: "partner-" + i.id,
                    note: "Hak mitra " + (partner?.name || ""),
                    created_at: now,
                }));
        }
    }
    else if (action === "extend") {
        stmts.push(r.stmt("INSERT INTO operation_keys(key) VALUES(?)", "extend-" + bid + "-" + body.end_at));
        if (!["confirmed", "picked_up"].includes(b.status))
            fail("INVALID_TRANSITION", "Booking tidak dapat diperpanjang");
        const end = Number(body.end_at);
        if (end <= b.end_at)
            fail("INVALID_RANGE", "Tanggal baru harus setelah tanggal kembali");
        const days = duration(b.start_at, end, settings.tolerance);
        let additional = 0;
        for (const i of items) {
            if (i.returned_at)
                continue;
            const p = await r.first("SELECT * FROM products WHERE id=?", i.product_id);
            stmts.push(r.stmt("UPDATE reservations SET end_at=?1 WHERE booking_id=?2 AND unit_id=?3", end + (p.buffer_hours ?? settings.buffer_hours) * 3600000, bid, i.unit_id), r.stmt("UPDATE items SET days=?1,total=?2 WHERE id=?3", days, i.price * days, i.id));
            additional += Math.max(0, days - i.days) * i.price;
        }
        stmts.push(r.stmt("UPDATE bookings SET end_at=?1,subtotal=subtotal+?2,total=total+?2 WHERE id=?3", end, additional, bid));
        next = b.status;
    }
    else
        fail("INVALID_ACTION", "Aksi tidak dikenal");
    stmts.push(r.stmt("UPDATE bookings SET status=?1 WHERE id=?2", next, bid), r.log(bid, next, body.note || body.reason || action), r.audit(user, "booking." + action, bid));
    await r.batch(stmts);
    return { id: bid, status: next };
}
export async function editBooking(r: Repo, settings: any, id: string, body: any, key: string, user: string) {
    if (!key)
        fail("IDEMPOTENCY_REQUIRED", "Token perubahan diperlukan");
    const old = await r.first("SELECT * FROM bookings WHERE id=?", id);
    if (!old)
        fail("NOT_FOUND", "Booking tidak ditemukan", 404);
    if (!["pending_payment", "confirmed"].includes(old.status))
        fail("INVALID_TRANSITION", "Hanya booking sebelum pengambilan yang dapat diubah");
    if (await r.first("SELECT key FROM operation_keys WHERE key=?", "edit-" + key))
        return old;
    const existing = await r.all("SELECT * FROM items WHERE booking_id=? AND voided_at IS NULL", id);
    const q = await quote(r, settings, { ...body, outlet_id: old.outlet_id }, id);
    if (old.status === "confirmed")
        for (const line of q.lines) {
            const snapshot = existing.find((i) => i.product_id === line.product.id);
            if (snapshot) {
                line.price = snapshot.price;
                line.total = snapshot.price * q.days * line.qty;
            }
        }
    const subtotal = q.lines.reduce((n, l) => n + l.total, 0), discount = old.subtotal
        ? Math.round((subtotal * old.discount) / old.subtotal)
        : 0, total = Math.max(0, subtotal - discount);
    if (old.paid > total)
        fail("REFUND_REQUIRED", "Total baru lebih kecil dari pembayaran diterima. Proses refund melalui Owner terlebih dahulu.");
    const now = Date.now();
    const statements = [
        r.stmt("INSERT INTO operation_keys(key) VALUES(?)", "edit-" + key),
        r.record("booking_revision", {
            booking_id: id,
            before: old,
            items: existing,
        }),
        r.stmt("UPDATE reservations SET released_at=?1 WHERE booking_id=?2 AND released_at IS NULL", now, id),
        r.stmt("UPDATE items SET voided_at=?1 WHERE booking_id=?2 AND voided_at IS NULL", now, id),
    ];
    for (const l of q.lines)
        for (const u of l.units)
            statements.push(r.insert("items", {
                id: uid(),
                booking_id: id,
                product_id: l.product.id,
                unit_id: u.id,
                product_name: l.product.name,
                price: l.price,
                days: q.days,
                total: l.total / l.qty,
            }), r.insert("reservations", {
                id: uid(),
                unit_id: u.id,
                booking_id: id,
                start_at: q.start,
                end_at: q.end + (l.product.buffer_hours ?? settings.buffer_hours) * 3600000,
                kind: "booking",
            }));
    statements.push(r.stmt("UPDATE bookings SET start_at=?1,end_at=?2,subtotal=?3,discount=?4,total=?5,dp=?6,note=?7 WHERE id=?8", q.start, q.end, subtotal, discount, total, downPayment(total, settings.dp_percent), body.note || old.note, id), r.log(id, old.status, "Tanggal / item booking diubah"), r.audit(user, "booking.edited", id));
    await r.batch(statements);
    return { ...old, start_at: q.start, end_at: q.end, total };
}

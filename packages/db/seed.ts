import { Repo, uid } from "../../apps/api/src/repo/index";
import { DAY, downPayment } from "../shared/pricing";
export const defaultSettings = {
    phone: "",
    email: "",
    address: "",
    timezone: "Asia/Jakarta",
    buffer_hours: 24,
    dp_percent: 30,
    tolerance: 60,
    late_price: 20000,
    expires_hours: 3,
    bank_name: "",
    bank_account: "",
    bank_owner: "",
    qris_payload: "",
    hours: "08.00 – 20.00",
    theme: "#254f40",
    terms: "Bawa KTP/SIM asli saat pengambilan. Alat wajib dikembalikan lengkap dan bersih. Kerusakan dan keterlambatan dikenakan biaya sesuai pemeriksaan.",
    privacy: "Identitas hanya digunakan untuk verifikasi sewa. Dokumen disimpan privat dan dihapus setelah 90 hari dari penyelesaian transaksi.",
    demo: false,
    accepting_bookings: false,
};
export async function seedDemo(db:D1Database) {
    const id=1, user='local-seed', r=new Repo(db,{role:'system'}), now=Date.now();
    if(await r.first('SELECT id FROM products LIMIT 1'))throw new Error('SEED_REQUIRES_EMPTY_CATALOG');
    const statements = [r.stmt("UPDATE store_profile SET settings_json=? WHERE id=1",JSON.stringify({...defaultSettings,demo:true}))];
    const outlet = uid(), outlet2 = uid();
    statements.push(r.record("outlet", {
        name: "Yogyakarta · Pusat",
        address: "Jl. Kaliurang KM 5, Yogyakarta",
        phone: "6281234567890",
    }, outlet), r.record("outlet", {
        name: "Sleman · Cabang",
        address: "Jl. Magelang KM 8, Sleman",
        phone: "6281234567891",
    }, outlet2));
    const partner = uid();
    statements.push(r.record("partner", {
        name: "Andi Pratama",
        phone: "628125552000",
        share_percent: 70,
        bank: "BCA • 1234567890",
    }, partner));
    const products = [
        [
            "Tenda Naturehike Cloud Up 2",
            "Tenda",
            "Naturehike",
            45000,
            2,
            "tent",
            8,
            850000,
        ],
        [
            "Carrier Eiger Equator 60L",
            "Carrier",
            "Eiger",
            30000,
            1,
            "bag",
            6,
            950000,
        ],
        [
            "Sleeping Bag Polar Bulu",
            "Sleeping Bag",
            "Consina",
            15000,
            1,
            "sleep",
            10,
            180000,
        ],
        [
            "Kompor Portable Kovea",
            "Alat Masak",
            "Kovea",
            20000,
            1,
            "stove",
            6,
            350000,
        ],
        [
            "Matras Camping Foil",
            "Aksesori",
            "Naturehike",
            10000,
            1,
            "mat",
            10,
            120000,
        ],
        ["Tenda Arei Outdoor 4P", "Tenda", "Arei", 60000, 4, "tent2", 5, 1200000],
        [
            "Cooking Set DS-308",
            "Alat Masak",
            "DS Outdoor",
            20000,
            3,
            "cook",
            5,
            290000,
        ],
        [
            "Trekking Pole Ultralight",
            "Aksesori",
            "Naturehike",
            15000,
            1,
            "pole",
            8,
            250000,
        ],
    ];
    const prodIds: string[] = [], unitIds: string[][] = [];
    for (let i = 0; i < products.length; i++) {
        const [pname, category, brand, price, capacity, img, qty, buy] = products[i] as any[];
        const pid = uid();
        prodIds.push(pid);
        unitIds[i] = [];
        statements.push(r.insert("products", {
            id: pid,
            name: pname,
            category,
            brand,
            price,
            capacity,
            image: img,
            description: `${pname} siap menemani petualanganmu. Ringan, tangguh, terawat, dan diperiksa sebelum setiap penyewaan.`,
            created_at: now,
        }));
        for (let n = 0; n < qty; n++) {
            const unit = uid();
            unitIds[i].push(unit);
            statements.push(r.insert("units", {
                id: unit,
                product_id: pid,
                outlet_id: n === qty - 1 ? outlet2 : outlet,
                code: ["TND", "CRR", "SLB", "KMP", "MTR", "TRE", "CKS", "TRP"][i] +
                    "-" +
                    String(n + 1).padStart(3, "0"),
                status: i === 0 && n === qty - 2 ? "maintenance" : "available",
                condition_note: "Baik, lengkap",
                purchase_price: buy,
                partner_id: i === 0 ? partner : null,
                created_at: now,
            }));
        }
    }
    statements.push(r.record("bundle", {
        name: "Paket Camping Berdua",
        price: 70000,
        description: "Tenda, 2 sleeping bag, dan matras untuk dua orang.",
        items: [
            { product_id: prodIds[0], qty: 1 },
            { product_id: prodIds[2], qty: 2 },
            { product_id: prodIds[4], qty: 2 },
        ],
    }));
    statements.push(r.record("voucher", {
        code: "CAMPING10",
        kind: "percent",
        value: 10,
        min_total: 100000,
        quota: 100,
        used: 0,
        active: true,
    }));
    const names = [
        "Aditya Pratama",
        "Nadia Putri",
        "Fajar Ramadhan",
        "Dinda Maharani",
        "Rizky Firmansyah",
        "Sarah Amelia",
        "Bagas Saputra",
        "Alif Hidayat",
        "Citra Lestari",
        "Yoga Permana",
    ];
    const statuses = [
        "confirmed",
        "picked_up",
        "picked_up",
        "pending_payment",
        "completed",
        "confirmed",
        "completed",
        "returned",
        "confirmed",
        "completed",
    ];
    const base = new Date();
    base.setUTCHours(2, 0, 0, 0);
    const today = base.getTime();
    for (let i = 0; i < names.length; i++) {
        const cid = uid(), bid = uid(), status = statuses[i], pi = i % products.length, p = products[pi], price = p[3] as number;
        const start = today +
            (status === "completed"
                ? -8 - i
                : status === "picked_up"
                    ? -2
                    : status === "returned"
                        ? -5
                        : 0) *
                DAY;
        const end = start + 3 * DAY;
        const total = price * 3;
        const paid = status === "pending_payment"
            ? 0
            : status === "confirmed"
                ? downPayment(total)
                : total;
        statements.push(r.insert("customers", {
            id: cid,
            name: names[i],
            phone: "62812345000" + String(i).padStart(2, "0"),
            email: names[i].split(" ")[0].toLowerCase() + "@example.com",
            segment: i % 3 === 0 ? "member" : "baru",
            created_at: now - i * DAY,
        }), r.insert("bookings", {
            id: bid,
            outlet_id: outlet,
            customer_id: cid,
            code: "RX-2610-" + String(1001 + i),
            status,
            channel: i % 2 ? "online" : "whatsapp",
            start_at: start,
            end_at: end,
            subtotal: total,
            total,
            paid,
            dp: downPayment(total),
            expires_at: status === "pending_payment" ? now + 3 * 3600000 : null,
            collateral: ["picked_up", "returned"].includes(status)
                ? "held"
                : status === "completed"
                    ? "returned"
                    : "none",
            idem: "seed-" + i,
            created_at: now - i * 4 * 3600000,
        }), r.insert("items", {
            id: uid(),
            booking_id: bid,
            product_id: prodIds[pi],
            unit_id: unitIds[pi][i >= 8 ? 1 : 0],
            product_name: p[0],
            price,
            days: 3,
            total,
            returned_at: ["completed", "returned"].includes(status) ? end : null,
        }));
        if (!["completed", "returned"].includes(status))
            statements.push(r.insert("reservations", {
                id: uid(),
                unit_id: unitIds[pi][i >= 8 ? 1 : 0],
                booking_id: bid,
                start_at: start,
                end_at: end + DAY,
                kind: "booking",
            }));
        if (paid)
            statements.push(r.insert("payments", {
                id: uid(),
                booking_id: bid,
                amount: paid,
                method: i % 2 ? "transfer" : "cash",
                status: "confirmed",
                idem: "seedpay-" + i,
                created_at: now - i * 4 * 3600000,
            }), r.insert("ledger", {
                id: uid(),
                booking_id: bid,
                account: "rental_income",
                direction: "in",
                amount: paid,
                reference: "seed-" + bid,
                note: "Pembayaran " + names[i],
                created_at: now - i * DAY,
            }));
        statements.push(r.log(bid, status, "Data contoh untuk menjelajahi aplikasi"));
    }
    statements.push(r.record("expense", {
        category: "Operasional",
        amount: 85000,
        note: "Perlengkapan kebersihan alat",
        spent_on: new Date().toISOString().slice(0, 10),
    }), r.insert("ledger", {
        id: uid(),
        account: "expense",
        direction: "out",
        amount: 85000,
        reference: uid(),
        note: "Perlengkapan kebersihan alat",
        created_at: now,
    }), r.record("notification", {
        title: "Selamat datang di Radix Outdoor",
        message: "Ruang kerja ini berisi data contoh. Atur profil toko dan rekening sebelum menerima transaksi nyata.",
        read: false,
    }), r.audit(user, "demo.seeded", "1"));
    await db.batch(statements);
    return id;
}

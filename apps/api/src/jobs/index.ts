import { Repo, uid } from "../repo/index";
import { expire } from "../services/rental";
import { DAY } from "../../../../packages/shared/pricing";
const tables = [
    "products",
    "units",
    "customers",
    "bookings",
    "items",
    "reservations",
    "payments",
    "ledger",
    "status_logs",
    "records",
    "audit",
    "uploads",
    "operation_keys",
    "users",
];
export async function backup(r: Repo, bucket: R2Bucket) {
    const data: Record<string, any> = {
        format: "radix-outdoor-backup-v1",
        created_at: Date.now(),
        tables: {},
    };
    for (const table of tables)
        data.tables[table] = await r.all(`SELECT * FROM ${table}`);
    const store = await r.first("SELECT * FROM store_profile WHERE id=1");
    data.store = store;
    const text = JSON.stringify(data);
    if (text.length > 25 * 1024 * 1024)
        throw new Error("Backup di atas 25 MB memerlukan ekspor database melalui provider D1.");
    const id = uid(), key = "backup/" + id + ".json";
    await bucket.put(key, text, {
        httpMetadata: { contentType: "application/json" },
    });
    await r.batch([
        r.record("backup", { key, size: text.length, status: "completed" }, id),
        r.audit("system", "backup.created", id),
    ]);
    return { id, size: text.length };
}
export async function runJobs(r: Repo, bucket: R2Bucket, settings: any) {
    await expire(r);
    const now = Date.now(), threshold = now - 90 * DAY;
    const docs = await r.all("SELECT u.id,u.storage_key FROM uploads u WHERE u.kind='identity' AND u.created_at<? AND NOT EXISTS(SELECT 1 FROM customers c JOIN bookings b ON b.customer_id=c.id WHERE c.id_doc=u.id AND (b.status IN('pending_payment','confirmed','picked_up','returned') OR COALESCE((SELECT MAX(created_at) FROM status_logs WHERE booking_id=b.id),b.created_at)>=?))", threshold, threshold);
    for (const file of docs) {
        await bucket.delete(file.storage_key || "files/" + file.id);
        await r.batch([
            r.stmt("UPDATE customers SET id_doc=NULL WHERE id_doc=?", file.id),
            r.stmt("DELETE FROM uploads WHERE id=?", file.id),
            r.audit("system", "identity.purged", file.id),
        ]);
    }
    const bookings = await r.all("SELECT b.*,c.name AS customer_name,c.phone FROM bookings b JOIN customers c ON c.id=b.customer_id WHERE b.status IN('confirmed','picked_up')");
    let reminders = 0;
    const day = new Date().toISOString().slice(0, 10);
    for (const b of bookings) {
        const type = b.status === "confirmed" && b.start_at - now < DAY && b.start_at >= now
            ? "pickup_reminder"
            : b.status === "picked_up" && b.end_at - now < 3 * 3600000
                ? b.end_at < now
                    ? "late_notice"
                    : "return_reminder"
                : null;
        if (!type)
            continue;
        const key = "reminder-" + type + "-" + b.id + "-" + day;
        if (await r.first("SELECT key FROM operation_keys WHERE key=?", key))
            continue;
        try {
            await r.batch([
                r.stmt("INSERT INTO operation_keys(key) VALUES(?)", key),
                r.record("notification", {
                    title: type === "pickup_reminder"
                        ? "Pengingat pengambilan"
                        : type === "late_notice"
                            ? "Booking terlambat"
                            : "Pengingat pengembalian",
                    message: b.customer_name + " · " + b.code,
                    booking_id: b.id,
                    template: type,
                    read: false,
                }),
            ]);
            reminders++;
        }
        catch (e) {
            if (!String(e).includes("operation_keys"))
                throw e;
        }
    }
    const oldBackups = (await r.records("backup")).filter((b) => b.created_at < now - 30 * DAY);
    for (const b of oldBackups) {
        await bucket.delete(b.key);
        await r.batch([
            r.stmt("UPDATE records SET deleted_at=?1 WHERE id=?2", now, b.id),
        ]);
    }
    const recent = (await r.records("backup")).some((b) => b.created_at > now - DAY);
    if (!recent)
        await backup(r, bucket);
    await r.batch([
        r.record("job_run", {
            expired_checked: true,
            purged: docs.length,
            reminders,
            status: "completed",
            finished_at: now,
        }),
    ]);
    return {
        purged: docs.length,
        reminders,
        backup: recent ? "existing" : "created",
        finished_at: now,
    };
}

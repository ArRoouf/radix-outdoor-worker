export const DAY = 86400000;
export function duration(start: number, end: number, tolerance = 60) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new Error("Rentang tanggal tidak valid");
  return Math.max(1, Math.ceil((end - start - tolerance * 60000) / DAY));
}
export function downPayment(total: number, percent = 30) {
  return Math.min(total, Math.ceil((total * percent) / 100 / 1000) * 1000);
}
export function lateFee(
  end: number,
  returned: number,
  price: number,
  qty = 1,
  tolerance = 60,
  cap?: number,
) {
  const n =
    Math.max(0, Math.ceil((returned - end - tolerance * 60000) / DAY)) *
    price *
    qty;
  return cap === undefined ? n : Math.min(n, cap);
}
export function share(
  line: number,
  subtotal: number,
  discount: number,
  percent: number,
) {
  return Math.round(
    ((line - (subtotal ? (discount * line) / subtotal : 0)) * percent) / 100,
  );
}
export const transitions: Record<string, string[]> = {
  pending_payment: ["confirmed", "cancelled", "expired"],
  confirmed: ["picked_up", "cancelled"],
  picked_up: ["returned"],
  returned: ["completed"],
};
export function assertTransition(from: string, to: string) {
  if (!transitions[from]?.includes(to)) throw new Error("INVALID_TRANSITION");
}
export function overlap(a: number, b: number, c: number, d: number) {
  return a < d && c < b;
}
export function priceLine(
  p: any,
  start: number,
  end: number,
  rules: any[] = [],
  member = false,
) {
  const days = duration(start, end);
  let sum = 0;
  for (let i = 0; i < days; i++) {
    const at = start + i * DAY,
      date = new Date(at + 7 * 3600000);
    const eligible = rules.filter(
      (r) =>
        r.product_id === p.id &&
        ((r.kind === "member" && member) ||
          (r.kind === "season" && at >= r.start_at && at <= r.end_at) ||
          (r.kind === "weekend" && [0, 6].includes(date.getUTCDay())) ||
          (r.kind === "tier" && days >= r.min_days)),
    );
    const order = ["member", "season", "weekend", "tier"];
    eligible.sort(
      (a, b) =>
        order.indexOf(a.kind) - order.indexOf(b.kind) ||
        (b.priority || 0) - (a.priority || 0),
    );
    sum += eligible[0]?.price || p.price;
  }
  return { days, total: sum, price: Math.round(sum / days) };
}
export function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++)
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
export function qris(payload: string, amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("Nominal QRIS tidak valid");
  const tags: any[] = [];
  for (let i = 0; i < payload.length; ) {
    const tag = payload.slice(i, i + 2),
      n = Number(payload.slice(i + 2, i + 4));
    if (
      !/^\d{2}$/.test(tag) ||
      !Number.isInteger(n) ||
      i + 4 + n > payload.length
    )
      throw new Error("Payload QRIS tidak valid");
    tags.push([tag, payload.slice(i + 4, i + 4 + n)]);
    i += 4 + n;
  }
  if (!tags.some((t) => t[0] === "00") || !tags.some((t) => t[0] === "63"))
    throw new Error("Payload QRIS tidak lengkap");
  const original = payload.slice(0, -4);
  if (crc16(original) !== payload.slice(-4).toUpperCase())
    throw new Error("CRC QRIS tidak valid");
  let out = "";
  for (const [tag, v] of tags) {
    if (tag === "54" || tag === "63") continue;
    const value = tag === "01" ? "12" : v;
    if (tag === "58")
      out += "54" + String(String(amount).length).padStart(2, "0") + amount;
    out += tag + String(value.length).padStart(2, "0") + value;
  }
  out += "6304";
  return out + crc16(out);
}

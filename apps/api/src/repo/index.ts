import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { storeProfile } from '../../../../packages/db/schema';
export const uid = () => {
  // UUIDv7: millisecond timestamp plus cryptographically random remaining bits.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let time = Date.now();
  for (let i = 5; i >= 0; i--) { bytes[i] = time % 256; time = Math.floor(time / 256); }
  bytes[6] = (bytes[6] & 15) | 112; bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
export type AccessScope = { role: 'system'|'owner'|'admin'|'warehouse'|'partner'|'guest'; outletId?: string|null; partnerId?: string|null };
const allowedTables = new Set(['store_profile','users','sessions','records','products','units','customers','bookings','items','reservations','payments','ledger','status_logs','audit','uploads','operation_keys','rate_limits']);
export class Repo {
  getStoreProfile() {
    const query=drizzle(this.db).select().from(storeProfile).where(eq(storeProfile.id,1)).toSQL();
    return this.first(query.sql,...query.params);
  }
  constructor(public db: D1Database, public accessScope: AccessScope, public requestIP = '') {
    if (!accessScope || !['system','owner','admin','warehouse','partner','guest'].includes(accessScope.role)) throw new Error('ACCESS_SCOPE_REQUIRED');
    if (['admin','warehouse'].includes(accessScope.role) && !accessScope.outletId) throw new Error('OUTLET_REQUIRED');
    if (accessScope.role === 'partner' && !accessScope.partnerId) throw new Error('PARTNER_REQUIRED');
  }
  private scoped(sql: string, args: any[]) {
    let index=0;
    sql=sql.replace(/\?(\d+)?/g,(_,n)=>{index=n?Math.max(index,Number(n)):index+1;return '?'+(n||index);});
    const s = this.accessScope;
    if (!['admin','warehouse','partner'].includes(s.role)) return {sql,args};
    const param = '?' + (args.length + 1);
    const unitFilter = s.role === 'partner' ? `partner_id=${param}` : `outlet_id=${param}`;
    const ctes = [
      `units AS (SELECT * FROM main.units WHERE ${unitFilter})`,
      `bookings AS (SELECT * FROM main.bookings WHERE ${s.role === 'partner' ? '0' : `outlet_id=${param}`})`,
      'items AS (SELECT * FROM main.items WHERE booking_id IN(SELECT id FROM bookings))',
      'reservations AS (SELECT * FROM main.reservations WHERE unit_id IN(SELECT id FROM units))',
      'customers AS (SELECT * FROM main.customers WHERE id IN(SELECT customer_id FROM bookings))',
      `payments AS (SELECT * FROM main.payments WHERE ${s.role==='warehouse'?'0':'booking_id IN(SELECT id FROM bookings)'})`,
      `ledger AS (SELECT * FROM main.ledger WHERE ${s.role==='admin'?`booking_id IN(SELECT id FROM bookings) OR reference IN(SELECT id FROM main.records WHERE kind='expense' AND json_extract(data,'$.outlet_id')=${param})`:'0'})`,
      'status_logs AS (SELECT * FROM main.status_logs WHERE booking_id IN(SELECT id FROM bookings))',
      'users AS (SELECT * FROM main.users WHERE 0)', 'sessions AS (SELECT * FROM main.sessions WHERE 0)',
      'audit AS (SELECT * FROM main.audit WHERE 0)',
      `products AS (SELECT * FROM main.products${s.role==='partner'?' WHERE id IN(SELECT product_id FROM units)':''})`,
      `records AS (SELECT * FROM main.records WHERE ${s.role==='partner'
        ? `(kind='partner' AND id=${param}) OR (kind='settlement' AND json_extract(data,'$.partner_id')=${param}) OR kind='outlet'`
        : `kind IN('category','bundle','price_rule','voucher') OR (kind='outlet' AND id=${param}) OR json_extract(data,'$.outlet_id')=${param} OR json_extract(data,'$.booking_id') IN(SELECT id FROM bookings) OR json_extract(data,'$.unit_id') IN(SELECT id FROM units)`})`,
      `uploads AS (SELECT * FROM main.uploads WHERE kind='product' OR owner_token IN(SELECT id FROM bookings) OR id IN(SELECT id_doc FROM customers) OR id IN(SELECT json_extract(data,'$.signature') FROM records WHERE kind='inspection') OR id IN(SELECT json_extract(data,'$.photo') FROM records WHERE kind='inspection'))`,
    ];
    // UPDATE targets use the real table; the subquery uses the scoped CTE.
    const target = /^\s*(?:UPDATE|DELETE FROM)\s+(\w+)/i.exec(sql)?.[1];
    if (target && ['bookings','units','customers','items','payments','reservations','records','users','uploads'].includes(target))
      sql += `${/\bWHERE\b/i.test(sql)?' AND ':' WHERE '}id IN(SELECT id FROM ${target})`;
    return {sql:'WITH '+ctes.join(',')+' '+sql,args:[...args,s.role==='partner'?s.partnerId:s.outletId]};
  }
  private prepare(sql: string, args: any[], scope = true) {
    const q = scope ? this.scoped(sql,args) : {sql,args};
    return this.db.prepare(q.sql).bind(...q.args);
  }
  all(sql: string,...args:any[]) { return this.prepare(sql,args).all<any>().then(r=>r.results); }
  first(sql: string,...args:any[]) { return this.prepare(sql,args).first<any>(); }
  stmt(sql: string,...args:any[]) { return this.prepare(sql,args); }
  insert(table:string,data:Record<string,any>) {
    if (!allowedTables.has(table)) throw new Error('INVALID_TABLE');
    if (table==='bookings' || table==='units') this.assertOutlet(data.outlet_id);
    const keys=Object.keys(data);
    if(keys.some(k=>!/^[a-z_]+$/.test(k))) throw new Error('INVALID_COLUMN');
    return this.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,Object.values(data),false);
  }
  assertOutlet(outlet:string) {
    if(['admin','warehouse'].includes(this.accessScope.role) && outlet!==this.accessScope.outletId) throw new Error('OUTLET_FORBIDDEN');
  }
  record(kind:string,data:any,id=uid()) {
    if(data.outlet_id)this.assertOutlet(data.outlet_id);
    return this.insert('records',{id,kind,data:JSON.stringify(data),created_at:Date.now()});
  }
  records(kind:string) { return this.all('SELECT id,data,created_at FROM records WHERE kind=? AND deleted_at IS NULL ORDER BY created_at DESC',kind).then(rows=>rows.map(r=>({...JSON.parse(r.data),id:r.id,created_at:r.created_at}))); }
  audit(user:string,action:string,id='',ip=this.requestIP) { return this.insert('audit',{id:uid(),user_id:user,action,entity_id:id,ip,created_at:Date.now()}); }
  log(booking_id:string,status:string,note='') { return this.insert('status_logs',{id:uid(),booking_id,status,note,created_at:Date.now()}); }
  batch(stmts:D1PreparedStatement[]) { return this.db.batch(stmts); }
}

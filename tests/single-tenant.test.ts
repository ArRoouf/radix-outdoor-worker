import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = readdirSync('packages/db/migrations').filter(f => f.endsWith('.sql')).sort();
const legacy = files.filter(f => f < '0006');
function migrate(db: DatabaseSync, names = files) {
  for (const file of names) db.exec(readFileSync('packages/db/migrations/' + file, 'utf8'));
}
describe('Migrasi single tenant Radix Outdoor', () => {
  it('migrasi operasional mempertahankan pembayaran lama dan klaim settlement yang sudah dibayar',()=>{
    const db=new DatabaseSync(':memory:');migrate(db,files.filter(f=>f<'0007'));
    db.exec("INSERT INTO customers(id,name,phone,created_at) VALUES('c','Penyewa','628123450001',1); INSERT INTO bookings(id,outlet_id,customer_id,code,channel,start_at,end_at,subtotal,total,idem,created_at) VALUES('b','out','c','RX-LEGACY','online',1,2,40000,40000,'old',1); INSERT INTO payments(id,booking_id,amount,method,status,idem,created_at) VALUES('p','b',40000,'cash','confirmed','old-pay',1); INSERT INTO ledger(id,booking_id,account,direction,amount,reference,created_at) VALUES('l','b','partner_payable','out',28000,'legacy-entry',1); INSERT INTO records(id,kind,data,created_at) VALUES('s','settlement','{\"partner_id\":\"mitra\",\"status\":\"paid\",\"entries\":[\"l\"],\"gross\":28000,\"net\":28000,\"deductions\":0}',1)");
    migrate(db,files.filter(f=>f.startsWith('0007')));
    expect(db.prepare('SELECT amount,shift_id FROM payments').get()).toEqual({amount:40000,shift_id:null});
    expect(db.prepare('SELECT * FROM settlement_entries').get()).toEqual({ledger_id:'l',settlement_id:'s'});
    expect(db.prepare('SELECT COUNT(*) AS n FROM ledger').get()).toEqual({n:1});
    expect(db.prepare('PRAGMA foreign_key_check').all()).toHaveLength(0);
  });
  it('hanya satu profil dan tidak menyimpan discriminator atau billing SaaS', () => {
    const db = new DatabaseSync(':memory:'); migrate(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    expect(tables.map(t => t.name)).not.toEqual(expect.arrayContaining(['tenants', 'plans', 'billing_invoices']));
    for (const {name} of tables) {
      expect((db.prepare(`PRAGMA table_info(${name})`).all() as any[]).map(c => c.name)).not.toContain('tenant_id');
    }
    expect(db.prepare('SELECT name FROM store_profile WHERE id=1').get()).toEqual(expect.objectContaining({name: 'Radix Outdoor'}));
    expect(() => db.exec("INSERT INTO store_profile(id,name,settings_json,created_at,updated_at) VALUES(2,'Lain','{}',0,0)")).toThrow();
  });
  it('mempertahankan data operasional dari satu toko lama', () => {
    const db = new DatabaseSync(':memory:'); migrate(db, legacy);
    db.exec("INSERT INTO tenants(id,slug,name,owner_id,settings,created_at) VALUES('old','old','Lama','owner','{\"dp_percent\":30}',1)");
    db.exec("INSERT INTO products(id,tenant_id,name,category,price,created_at) VALUES('p','old','Tenda','Tenda',40000,1)");
    db.exec("INSERT INTO units(id,tenant_id,product_id,outlet_id,code,created_at) VALUES('u','old','p','out','TND-1',1); INSERT INTO customers(id,tenant_id,name,phone,created_at) VALUES('c','old','Penyewa','628123450000',1); INSERT INTO bookings(id,tenant_id,outlet_id,customer_id,code,channel,start_at,end_at,subtotal,total,idem,created_at) VALUES('b','old','out','c','RX-OLD','online',1,2,40000,40000,'legacy',1); INSERT INTO ledger(id,tenant_id,booking_id,account,direction,amount,created_at) VALUES('l','old','b','rental_income','in',40000,1); INSERT INTO uploads(id,tenant_id,kind,owner_token,mime,created_at) VALUES('doc','old','identity','c','image/png',1)");
    migrate(db, files.filter(f => f.startsWith('0006')));
    expect(db.prepare('SELECT amount FROM ledger WHERE id=?').get('l')).toEqual({amount:40000});
    expect(db.prepare('SELECT storage_key FROM uploads WHERE id=?').get('doc')).toEqual({storage_key:'old/doc'});
    expect(()=>db.exec("DELETE FROM ledger WHERE id='l'")).toThrow('LEDGER_IMMUTABLE');
    expect(db.prepare('SELECT name,price FROM products WHERE id=?').get('p')).toEqual({name:'Tenda',price:40000});
    expect(db.prepare('PRAGMA foreign_key_check').all()).toHaveLength(0);
  });
  it('menolak menggabungkan database yang berisi lebih dari satu toko', () => {
    const db = new DatabaseSync(':memory:'); migrate(db, legacy);
    db.exec("INSERT INTO tenants(id,slug,name,owner_id,created_at) VALUES('a','a','A','owner',1),('b','b','B','owner',1)");
    expect(() => migrate(db, files.filter(f => f.startsWith('0006')))).toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM tenants').get()).toEqual({n:2});
  });
});

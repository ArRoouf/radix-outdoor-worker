import { beforeEach, describe, expect, it } from 'vitest';
import { SQLiteD1 } from '../packages/db/local-adapter';
import { Repo } from '../apps/api/src/repo';
import { createBooking, payment, bookingAction } from '../apps/api/src/services/rental';
import { openShift, closeShift, cashExpense } from '../apps/api/src/services/cash';
import { createSettlement, paySettlement } from '../apps/api/src/services/settlements';
import { saveFineComponent } from '../apps/api/src/services/fines';
import { componentCharges } from '../packages/shared/pricing';
import { storeMidnight } from '../packages/shared/dates';
import { backup } from '../apps/api/src/jobs';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { defaultSettings as settings } from '../packages/db/seed';
let db: SQLiteD1, r: Repo;
beforeEach(async () => {
  db = new SQLiteD1(); r = new Repo(db as any, { role: 'owner' });
  await r.batch([
    r.record('outlet', { name: 'Pusat' }, 'a'), r.record('outlet', { name: 'Cabang' }, 'b'),
    r.record('partner', { name: 'Mitra', share_percent: 70 }, 'partner'),
    r.insert('products', { id: 'p', name: 'Tenda', category: 'Tenda', price: 40000, created_at: 1 }),
    ...['u1','u2','u3'].map(id => r.insert('units', { id, product_id: 'p', outlet_id: 'a', code: id, partner_id: 'partner', purchase_price: 500000, created_at: 1 })),
  ]);
});
async function booking(key: string, paid = 0, method = 'transfer') {
  const start = Date.now() + 86400000;
  return (await createBooking(r, settings, { outlet_id: 'a', start_at: start, end_at: start + 86400000, items: [{ product_id: 'p', qty: 1 }], customer: { name: 'Penyewa', phone: '081234567890' }, paid, method }, key, 'kasir1'))!;
}
describe('Kas per shift', () => {
  it('kasir outlet dapat menerima tunai, mencatat pengeluaran dan menutup shift sendiri',async()=>{
    const admin=new Repo(db as any,{role:'admin',outletId:'a'}),b=await booking('staff');
    const s=await openShift(admin,{outlet_id:'a',opening_cash:10000},'staff');
    await payment(admin,b.id,{amount:10000,method:'cash'},'staff-pay','staff');
    await cashExpense(admin,s.id,{amount:5000,category:'Kas',note:'Beli kantong'},'staff','staff-expense');
    const closed=await closeShift(admin,s.id,{closing_cash:15000,note:''},'staff');
    expect(closed.expected_cash).toBe(15000);
    expect(await admin.all("SELECT * FROM ledger WHERE account='expense'")).toHaveLength(1);
  });
  it('backup shift tutup dan settlement paid dapat dipulihkan ke database kosong',async()=>{
    const shift=await openShift(r,{outlet_id:'a',opening_cash:10000},'kasir1');
    const b=await booking('backup',40000,'cash');
    await cashExpense(r,shift.id,{amount:5000,category:'Kas',note:'Beli kantong'},'kasir1','backup-expense');
    await closeShift(r,shift.id,{closing_cash:45000,note:''},'kasir1');
    const item=await r.first('SELECT id FROM items WHERE booking_id=?',b.id);
    await r.batch([r.insert('ledger',{id:'backup-payable',booking_id:b.id,account:'partner_payable',direction:'out',amount:28000,reference:'partner-'+item.id,created_at:100})]);
    const draft=await createSettlement(r,{partner_id:'partner',period_start:0,period_end:200,deductions:0,note:''},'owner','backup-settlement');
    await paySettlement(r,draft.id,'owner');
    let json='';
    await backup(r,{put:async(_key:string,value:string)=>{json=value;}} as any);
    const dir=mkdtempSync(join(tmpdir(),'radix-restore-'));
    try {
      const path=join(dir,'backup.json');writeFileSync(path,json);
      expect(execFileSync('python3',['scripts/validate-backup.py',path],{encoding:'utf8'})).toContain('"restore": "passed"');
    }finally{rmSync(dir,{recursive:true,force:true});}
  });
  it('mewajibkan shift tunai, memisahkan dua kasir, dan mengurangi pengeluaran tunai', async () => {
    const b = await booking('b');
    await expect(payment(r, b.id, { amount: 10000, method: 'cash' }, 'no-shift', 'kasir1')).rejects.toThrow('shift');
    const s1 = await openShift(r, { outlet_id: 'a', opening_cash: 100000 }, 'kasir1');
    const s2 = await openShift(r, { outlet_id: 'a', opening_cash: 50000 }, 'kasir2');
    const p = await payment(r, b.id, { amount: 10000, method: 'cash', shift_id: s2.id }, 'cash1', 'kasir1');
    expect(p.shift_id).toBe(s1.id);
    await payment(r, b.id, { amount: 5000, method: 'cash' }, 'cash2', 'kasir2');
    await cashExpense(r, s1.id, { amount: 2000, category: 'Operasional', note: 'Beli kantong' }, 'kasir1', 'expense-1');
    const closed1 = await closeShift(r, s1.id, { closing_cash: 108000, note: '' }, 'kasir1');
    const closed2 = await closeShift(r, s2.id, { closing_cash: 55000, note: '' }, 'kasir2');
    expect(closed1.expected_cash).toBe(108000); expect(closed1.difference).toBe(0);
    expect(closed2.expected_cash).toBe(55000);
    expect((await payment(r, b.id, { amount: 10000, method: 'cash' }, 'cash1', 'kasir1')).id).toBe(p.id);
    await expect(payment(r, b.id, { amount: 1000, method: 'cash' }, 'closed', 'kasir1')).rejects.toThrow('shift');
  });
  it('database menolak dua shift aktif sekaligus dan pembayaran ke shift tutup', async () => {
    const results = await Promise.allSettled([openShift(r, {outlet_id:'a',opening_cash:0}, 'kasir1'),openShift(r, {outlet_id:'a',opening_cash:0}, 'kasir1')]);
    expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    const s = (await r.records('shift'))[0], b = await booking('b');
    await closeShift(r, s.id, { closing_cash: 0, note: '' }, 'kasir1');
    await expect(r.batch([r.insert('payments', {id:'forged',booking_id:b.id,amount:1,method:'cash',status:'confirmed',idem:'forged',created_at:Date.now(),shift_id:s.id})])).rejects.toThrow('SHIFT_CLOSED');
  });
  it('membatasi outlet dan kepemilikan shift termasuk pengeluaran', async () => {
    const s = await openShift(r, {outlet_id:'a',opening_cash:0}, 'kasir1');
    const admin = new Repo(db as any, {role:'admin',outletId:'a'});
    await expect(closeShift(admin,s.id,{closing_cash:0,note:''},'kasir2')).rejects.toThrow('kasir lain');
    await expect(cashExpense(admin,s.id,{amount:1,category:'Kas',note:'Test'},'kasir2','other')).rejects.toThrow('kasir lain');
    const foreign = new Repo(db as any, {role:'admin',outletId:'b'});
    await expect(closeShift(foreign,s.id,{closing_cash:0,note:''},'kasir1')).rejects.toThrow('ditemukan');
    await expect(openShift(foreign,{outlet_id:'a',opening_cash:0},'kasir1')).rejects.toThrow();
  });
  it('tutup shift menghitung ulang di database saat pembayaran berlomba', async () => {
    const s = await openShift(r,{outlet_id:'a',opening_cash:0},'kasir1'), b = await booking('race');
    await Promise.allSettled([payment(r,b.id,{amount:1000,method:'cash'},'race-pay','kasir1'),closeShift(r,s.id,{closing_cash:0,note:''},'kasir1')]);
    const fresh = (await r.records('shift'))[0];
    const total = await r.first("SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE shift_id=? AND status='confirmed'",s.id);
    expect(fresh.expected_cash).toBe(total.n);
  });
});
describe('Settlement draft per periode', () => {
  it('melewati settlement dari Worker lama selama pergantian deployment',async()=>{
    const b=await booking('rollout',40000),item=await r.first('SELECT id FROM items WHERE booking_id=?',b.id);
    await r.batch([r.insert('ledger',{id:'old-payable',booking_id:b.id,account:'partner_payable',direction:'out',amount:28000,reference:'partner-'+item.id,created_at:100}),r.record('settlement',{partner_id:'partner',status:'paid',entries:['old-payable'],gross:28000,net:28000,deductions:0},'old-worker-settlement')]);
    await expect(createSettlement(r,{partner_id:'partner',period_start:0,period_end:200,deductions:0,note:''},'owner','rollout')).rejects.toThrow('saldo');
  });
  it('mengubah tanggal toko ke batas UTC, termasuk tanggal akhir dan pergantian offset', () => {
    expect(storeMidnight('2026-10-01','Asia/Jakarta')).toBe(Date.parse('2026-09-30T17:00:00Z'));
    expect(storeMidnight('2026-10-31','Asia/Jakarta',true)).toBe(Date.parse('2026-10-31T17:00:00Z'));
    expect(storeMidnight('2026-03-08','America/New_York',true)-storeMidnight('2026-03-08','America/New_York')).toBe(23*3600000);
    expect(()=>storeMidnight('2026-02-30','Asia/Jakarta')).toThrow();
  });
  async function payable(id:string,at:number) {
    const b=await booking('booking-'+id,40000);
    const item=await r.first('SELECT id FROM items WHERE booking_id=?',b.id);
    await r.batch([r.insert('ledger',{id,booking_id:b.id,account:'partner_payable',direction:'out',amount:28000,reference:'partner-'+item.id,created_at:at})]);
  }
  it('memilih periode, mengunci entri saat draft, dan membayar tepat sekali', async () => {
    await payable('l1',100);await payable('l2',300);
    const draft=await createSettlement(r,{partner_id:'partner',period_start:50,period_end:200,deductions:1000,note:'Perbaikan'},'owner','draft1');
    expect(draft.status).toBe('draft');expect(draft.gross).toBe(28000);expect(draft.net).toBe(27000);
    expect(await r.all("SELECT * FROM ledger WHERE account='partner_settlement'")).toHaveLength(0);
    await expect(createSettlement(r,{partner_id:'partner',period_start:50,period_end:200,deductions:0,note:''},'owner','draft2')).rejects.toThrow('saldo');
    const results=await Promise.all([paySettlement(r,draft.id,'owner'),paySettlement(r,draft.id,'owner')]);
    expect(results.every(s=>s.status==='paid')).toBe(true);
    expect(await r.all("SELECT * FROM ledger WHERE account='partner_settlement'")).toHaveLength(1);
    expect((await createSettlement(r,{partner_id:'partner',period_start:50,period_end:200,deductions:1000,note:'Perbaikan'},'owner','draft1')).id).toBe(draft.id);
  });
  it('dua draft bersamaan tidak dapat memakai payable yang sama', async () => {
    await payable('l',100);
    const body={partner_id:'partner',period_start:0,period_end:200,deductions:0,note:''};
    const results=await Promise.allSettled([createSettlement(r,body,'owner','a'),createSettlement(r,body,'owner','b')]);
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect(await r.all('SELECT * FROM settlement_entries')).toHaveLength(1);
    expect(await r.records('settlement')).toHaveLength(1);
    await expect(r.batch([r.stmt('DELETE FROM settlement_entries')])).rejects.toThrow('SETTLEMENT_IMMUTABLE');
  });
  it('menolak role non-owner serta periode/potongan yang tidak valid', async () => {
    await payable('l',100);
    const body={partner_id:'partner',period_start:0,period_end:200,deductions:0,note:''};
    await expect(createSettlement(new Repo(db as any,{role:'partner',partnerId:'partner'}),body,'partner','x')).rejects.toThrow('Owner');
    await expect(createSettlement(r,{...body,period_end:-1},'owner','x')).rejects.toThrow();
    await expect(createSettlement(r,{...body,deductions:28001},'owner','x')).rejects.toThrow('potongan');
  });
});
describe('Komponen denda dengan snapshot', () => {
  it('menghitung rupiah integer dan menolak nominal atau qty yang tidak aman', () => {
    expect(componentCharges([{amount:15000,qty:2},{amount:5000,qty:1}])).toBe(35000);
    expect(()=>componentCharges([{amount:1.5,qty:1}])).toThrow();
    expect(()=>componentCharges([{amount:100,qty:0}])).toThrow();
    expect(()=>componentCharges([{amount:Number.MAX_SAFE_INTEGER,qty:2}])).toThrow();
  });
  it('snapshot per unit tetap setelah master berubah dan pengembalian retry ditolak', async () => {
    const component=await saveFineComponent(r,{name:'Cuci tenda',category:'cleaning',amount:15000,active:true},'owner');
    const b=await booking('fines',40000);
    await bookingAction(r,settings,b.id,'pickup',{checked:true,signature:'sig',collateral_type:'ktp'},'owner','owner');
    const item=await r.first('SELECT id FROM items WHERE booking_id=?',b.id);
    const body={item_ids:[item.id],components:{[item.id]:[{component_id:component.id,qty:2}]}};
    await bookingAction(r,settings,b.id,'return',body,'owner','owner');
    await saveFineComponent(r,{name:'Harga baru',category:'cleaning',amount:20000,active:true},'owner',component.id);
    const fine=(await r.records('fine'))[0];
    expect(fine.name).toBe('Cuci tenda');expect(fine.unit_amount).toBe(15000);expect(fine.qty).toBe(2);expect(fine.amount).toBe(30000);
    expect((await r.first('SELECT total FROM bookings WHERE id=?',b.id)).total).toBe(70000);
    await expect(bookingAction(r,settings,b.id,'return',body,'owner','owner')).rejects.toThrow();
    expect(await r.records('fine')).toHaveLength(1);
  });
  it('menolak komponen nonaktif dan biaya kehilangan ganda tanpa menulis pengembalian', async () => {
    const component=await saveFineComponent(r,{name:'Hilang patok',category:'loss',amount:20000,active:true},'owner');
    const b=await booking('loss',40000);
    await bookingAction(r,settings,b.id,'pickup',{checked:true,signature:'sig',collateral_type:'ktp'},'owner','owner');
    const item=await r.first('SELECT id FROM items WHERE booking_id=?',b.id);
    const body={condition:'lost',note:'Alat hilang',photo:'photo',components:{[item.id]:[{component_id:component.id,qty:1}]}};
    await expect(bookingAction(r,settings,b.id,'return',body,'owner','owner')).rejects.toThrow('kehilangan');
    await saveFineComponent(r,{name:'Hilang patok',category:'loss',amount:20000,active:false},'owner',component.id);
    await expect(bookingAction(r,settings,b.id,'return',{...body,condition:'good'},'owner','owner')).rejects.toThrow('aktif');
    expect((await r.first('SELECT returned_at FROM items WHERE id=?',item.id)).returned_at).toBeNull();
  });
});

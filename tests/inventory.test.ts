import {beforeEach,describe,it,expect} from 'vitest';
import {SQLiteD1} from '../packages/db/local-adapter';
import {Repo} from '../apps/api/src/repo';
import {startOpname,saveOpname,finalizeOpname,withdrawUnits,scanCart,saveBundle} from '../apps/api/src/services/inventory';
import {createBooking,quote,bookingAction} from '../apps/api/src/services/rental';
import {defaultSettings as settings} from '../packages/db/seed';
import {backup} from '../apps/api/src/jobs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
let db:SQLiteD1,r:Repo,warehouse:Repo;
beforeEach(async()=>{
 db=new SQLiteD1();r=new Repo(db as any,{role:'owner'});warehouse=new Repo(db as any,{role:'warehouse',outletId:'a'});
 await r.batch([r.record('outlet',{name:'Pusat'},'a'),r.record('outlet',{name:'Cabang'},'b'),r.record('partner',{name:'Mitra',share_percent:70},'partner'),r.insert('products',{id:'p',name:'Tenda',category:'Tenda',price:40000,created_at:1}),...['1','2','3','4'].map(n=>r.insert('units',{id:'u'+n,product_id:'p',outlet_id:n==='4'?'b':'a',partner_id:'partner',code:'TND-00'+n,created_at:1}))]);
});
const payload=(phone='081234567890')=>({outlet_id:'a',start_at:Date.now()+86400000,end_at:Date.now()+172800000,items:[{product_id:'p',qty:1}],customer:{name:'Penyewa',phone},paid:0});
describe('Opname bertahap',()=>{
 it('backup hasil opname dan penarikan dapat dipulihkan tanpa mengubah histori',async()=>{
  const s=await startOpname(r,{outlet_id:'a',note:'Audit'},'owner','start');
  const saved=await saveOpname(r,s.id,{version:0,note:'Satu tidak ditemukan',units:s.units.map((u:any)=>({id:u.id,present:u.id!=='u1',note:''}))},'owner');
  await finalizeOpname(r,s.id,{version:saved.version,adjust_missing:true},'owner');
  await withdrawUnits(r,{partner_id:'partner',unit_ids:['u2'],note:'Kembali ke mitra'},'owner','withdraw');
  let json='';await backup(r,{put:async(_key:string,value:string)=>{json=value;}} as any);
  const dir=mkdtempSync(join(tmpdir(),'radix-inventory-'));
  try{const file=join(dir,'backup.json');writeFileSync(file,json);expect(execFileSync('python3',['scripts/validate-backup.py',file],{encoding:'utf8'})).toContain('"restore": "passed"');}finally{rmSync(dir,{recursive:true,force:true});}
 });
 it('menyimpan draft, mewajibkan semua unit diperiksa, lalu mengunci hasil final',async()=>{
  const draft=await startOpname(warehouse,{outlet_id:'a',note:'Audit mingguan'},'staff','start');
  expect(draft.units).toHaveLength(3);expect(draft.units.every((u:any)=>u.present===null)).toBe(true);
  await expect(finalizeOpname(warehouse,draft.id,{version:0,adjust_missing:false},'staff')).rejects.toThrow('periksa');
  const saved=await saveOpname(warehouse,draft.id,{version:0,note:'Sudah diperiksa',units:draft.units.map((u:any)=>({id:u.id,present:u.id!=='u1',note:'Periksa fisik'}))},'staff');
  const final=await finalizeOpname(warehouse,draft.id,{version:saved.version,adjust_missing:false},'staff');
  expect(final.status).toBe('final');expect(final.difference).toBe(1);
  expect((await r.first('SELECT status FROM units WHERE id=?','u1')).status).toBe('available');
  await expect(saveOpname(warehouse,draft.id,{version:final.version,note:'Ubah',units:[]},'staff')).rejects.toThrow('final');
  await expect(r.batch([r.stmt("UPDATE records SET data=json_set(data,'$.note','ubah') WHERE id=?",draft.id)])).rejects.toThrow('OPNAME_FINAL');
 });
 it('menolak unit luar outlet, revisi basi, dan dua penyimpanan bersamaan',async()=>{
  const draft=await startOpname(warehouse,{outlet_id:'a',note:'Audit'},'staff','start');
  await expect(saveOpname(warehouse,draft.id,{version:0,note:'Test',units:[{id:'u4',present:true}]},'staff')).rejects.toThrow('unit');
  const body={version:0,note:'Audit',units:draft.units.map((u:any)=>({id:u.id,present:true,note:''}))};
  const results=await Promise.allSettled([saveOpname(warehouse,draft.id,body,'staff'),saveOpname(warehouse,draft.id,body,'staff')]);
  expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  await expect(saveOpname(warehouse,draft.id,body,'staff')).rejects.toThrow('revisi');
 });
 it('Owner dapat menandai unit hilang tetapi reservasi baru membatalkan seluruh finalisasi',async()=>{
  const draft=await startOpname(r,{outlet_id:'a',note:'Audit'},'owner','start');
  const saved=await saveOpname(r,draft.id,{version:0,note:'Tenda tidak ditemukan',units:draft.units.map((u:any)=>({id:u.id,present:u.id!=='u1',note:''}))},'owner');
  const booking=await createBooking(r,settings,payload(),'new-reservation','owner');
  const item=await r.first('SELECT unit_id FROM items WHERE booking_id=?',booking.id);expect(item.unit_id).toBe('u1');
  await expect(finalizeOpname(r,draft.id,{version:saved.version,adjust_missing:true},'owner')).rejects.toThrow();
  expect((await r.records('opname'))[0].status).toBe('draft');
  expect((await r.first('SELECT status FROM units WHERE id=?','u1')).status).toBe('available');
 });
 it('finalisasi penyesuaian mencatat mutasi per unit tepat sekali',async()=>{
  const draft=await startOpname(r,{outlet_id:'a',note:'Audit'},'owner','start');
  const saved=await saveOpname(r,draft.id,{version:0,note:'Hilang satu',units:draft.units.map((u:any)=>({id:u.id,present:u.id!=='u1',note:''}))},'owner');
  const final=await finalizeOpname(r,draft.id,{version:saved.version,adjust_missing:true},'owner');
  expect(final.status).toBe('final');expect((await r.first('SELECT status FROM units WHERE id=?','u1')).status).toBe('lost');
  expect((await r.records('movement')).filter(m=>m.opname_id===draft.id&&m.adjusted)).toHaveLength(1);
  await expect(finalizeOpname(r,draft.id,{version:saved.version,adjust_missing:true},'owner')).rejects.toThrow();
 });
});
describe('Penarikan konsinyasi dan scan',()=>{
 it('dua permintaan penarikan bersamaan hanya mencatat satu serah-terima',async()=>{
  const body={partner_id:'partner',unit_ids:['u1'],note:'Serah-terima ke mitra'};
  const results=await Promise.allSettled([withdrawUnits(r,body,'owner','w1'),withdrawUnits(r,body,'owner','w2')]);
  expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  expect(await r.records('withdrawal')).toHaveLength(1);
 });
 it('menarik unit tanpa menghapus histori dan aman saat dicoba ulang',async()=>{
  const record=await withdrawUnits(r,{partner_id:'partner',unit_ids:['u1'],note:'Diserahkan kepada mitra'},'owner','withdraw');
  expect((await r.first('SELECT status,partner_id FROM units WHERE id=?','u1'))).toEqual({status:'retired',partner_id:'partner'});
  expect((await withdrawUnits(r,{partner_id:'partner',unit_ids:['u1'],note:'Diserahkan kepada mitra'},'owner','withdraw')).id).toBe(record.id);
  await expect(scanCart(r,{code:'TND-001',outlet_id:'a',items:[]})).rejects.toThrow('tersedia');
  expect(await r.all('SELECT * FROM units')).toHaveLength(4);
 });
 it('menolak penarikan unit terpesan, disewa melewati jadwal, dan peran bukan Owner',async()=>{
  const b=await createBooking(r,settings,{...payload(),paid:40000,method:'transfer'},'book','owner');
  await expect(withdrawUnits(r,{partner_id:'partner',unit_ids:['u1'],note:'Tarik mitra'},'owner','w1')).rejects.toThrow('reservasi');
  await bookingAction(r,settings,b.id,'pickup',{checked:true,signature:'sig',collateral_type:'ktp'},'owner','owner');
  await r.batch([r.stmt('UPDATE reservations SET start_at=?1,end_at=?2 WHERE booking_id=?3',Date.now()-86400000,Date.now()-1000,b.id)]);
  await expect(withdrawUnits(r,{partner_id:'partner',unit_ids:['u1'],note:'Tarik terlambat'},'owner','overdue')).rejects.toThrow('reservasi');
  await expect(withdrawUnits(warehouse,{partner_id:'partner',unit_ids:['u2'],note:'Tarik mitra'},'staff','w2')).rejects.toThrow('Owner');
  await expect(r.batch([r.stmt("UPDATE units SET status='retired' WHERE id='u1'")])).rejects.toThrow('UNIT_RESERVED');
 });
 it('scan menambah produk, membatasi outlet dan jumlah keranjang',async()=>{
  const admin=new Repo(db as any,{role:'admin',outletId:'a'});
  expect((await scanCart(admin,{code:'tnd-001',outlet_id:'a',items:[{product_id:'p',qty:1}]})).items).toEqual([{product_id:'p',qty:2}]);
  await expect(scanCart(admin,{code:'TND-004',outlet_id:'a',items:[]})).rejects.toThrow('ditemukan');
  await expect(scanCart(admin,{code:'TND-001',outlet_id:'b',items:[]})).rejects.toThrow();
  await expect(scanCart(admin,{code:'TND-001',outlet_id:'a',items:[{product_id:'p',qty:100}]})).rejects.toThrow('100');
 });
 it('reservasi tidak dapat masuk ke unit yang telah ditarik meskipun quote sebelumnya tersedia',async()=>{
  await withdrawUnits(r,{partner_id:'partner',unit_ids:['u1'],note:'Kembali ke mitra'},'owner','w');
  await expect(r.batch([r.insert('reservations',{id:'forged',unit_id:'u1',start_at:Date.now()+86400000,end_at:Date.now()+172800000,kind:'booking'})])).rejects.toThrow('UNIT_NOT_AVAILABLE');
 });
});
describe('Paket sewa aktif dan jumlah paket',()=>{
 it('mengalikan stok dan harga paket serta mempertahankan snapshot booking lama',async()=>{
  const bundle=await saveBundle(r,{name:'Paket tenda',price:35000,description:'Satu tenda',active:true,items:[{product_id:'p',qty:1}]},'owner');
  const q=await quote(r,settings,{...payload(),bundle_id:bundle.id,bundle_qty:2});
  expect(q.lines[0].qty).toBe(2);expect(q.total).toBe(70000);expect(q.discount).toBe(10000);
  const b=await createBooking(r,settings,{...payload(),bundle_id:bundle.id,bundle_qty:2},'bundle','owner');
  await saveBundle(r,{...bundle,price:50000,active:false},'owner',bundle.id);
  expect((await r.first('SELECT total FROM bookings WHERE id=?',b.id)).total).toBe(70000);
  await expect(quote(r,settings,{...payload(),bundle_id:bundle.id})).rejects.toThrow('aktif');
 });
 it('menolak komponen ganda, jumlah pecahan, paket nonaktif, dan stok tidak cukup',async()=>{
  await expect(saveBundle(r,{name:'Ganda',price:10000,description:'',active:true,items:[{product_id:'p',qty:1},{product_id:'p',qty:1}]},'owner')).rejects.toThrow('ganda');
  const b=await saveBundle(r,{name:'Paket',price:35000,description:'',active:true,items:[{product_id:'p',qty:1}]},'owner');
  await expect(quote(r,settings,{...payload(),bundle_id:b.id,bundle_qty:1.5})).rejects.toThrow();
  await expect(quote(r,settings,{...payload(),bundle_id:b.id,bundle_qty:4})).rejects.toThrow('tersedia');
 });
});

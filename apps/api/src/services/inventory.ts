import {z} from 'zod';
import {Repo,uid} from '../repo';
import {fail} from './errors';
const note=z.string().trim().min(2).max(1000);
const ids=z.array(z.string().min(1)).min(1).max(100).refine(v=>new Set(v).size===v.length,'Kode unit ganda');
function inventoryStaff(r:Repo){if(!['owner','warehouse'].includes(r.accessScope.role))fail('FORBIDDEN','Hanya Owner atau Gudang dapat melakukan opname',403);}
function owner(r:Repo){if(r.accessScope.role!=='owner')fail('FORBIDDEN','Tindakan memerlukan Owner',403);}
export async function getOpname(r:Repo,id:string){
 inventoryStaff(r);const row=await r.first("SELECT id,data,created_at FROM records WHERE id=? AND kind='opname' AND deleted_at IS NULL",id);
 if(!row)fail('NOT_FOUND','Opname tidak ditemukan',404);
 return {...JSON.parse(row.data),id:row.id,created_at:row.created_at};
}
export async function startOpname(r:Repo,input:unknown,user:string,key:string){
 inventoryStaff(r);const b=z.object({outlet_id:z.string().min(1),note}).parse(input);r.assertOutlet(b.outlet_id);
 if(!key)fail('IDEMPOTENCY_REQUIRED','Token opname diperlukan');
 const old=(await r.records('opname')).find(s=>s.idempotency_key===key);if(old)return old;
 if(!(await r.records('outlet')).some(o=>o.id===b.outlet_id))fail('NOT_FOUND','Outlet tidak ditemukan',404);
 const units=await r.all("SELECT u.id,u.code,u.status,u.partner_id,p.name AS product_name,NOT EXISTS(SELECT 1 FROM items i JOIN bookings b ON b.id=i.booking_id WHERE i.unit_id=u.id AND i.voided_at IS NULL AND i.returned_at IS NULL AND b.status='picked_up') AND u.status<>'lost' AS expected_present FROM units u JOIN products p ON p.id=u.product_id WHERE u.outlet_id=? AND u.status<>'retired' ORDER BY u.code",b.outlet_id);
 if(!units.length)fail('NO_UNITS','Tidak ada unit untuk diperiksa');
 const id=uid(),data={...b,status:'draft',version:0,user,idempotency_key:key,units:units.map(u=>({...u,expected_present:!!u.expected_present,present:null,note:''}))};
 try{await r.batch([r.stmt('INSERT INTO operation_keys(key) VALUES(?)','opname-start-'+key),r.record('opname',data,id),r.audit(user,'opname.started',id)]);}
 catch(e){const old=(await r.records('opname')).find(s=>s.idempotency_key===key);if(old)return old;throw e;}
 return {...data,id};
}
export async function saveOpname(r:Repo,id:string,input:unknown,user:string){
 const s=await getOpname(r,id);
 if(s.status!=='draft')fail('OPNAME_FINAL','Opname sudah final atau merupakan histori lama',409);
 const b=z.object({version:z.coerce.number().int().min(0),note,units:z.array(z.object({id:z.string(),present:z.boolean().nullable(),note:z.string().max(500).default('')})).min(1).max(5000)}).parse(input);
 if(b.version!==s.version)fail('STALE_VERSION','Ada revisi baru. Muat ulang opname.',409);
 if(new Set(b.units.map(u=>u.id)).size!==b.units.length||b.units.some(u=>!s.units.some((x:any)=>x.id===u.id)))fail('INVALID_UNIT','Daftar unit tidak sesuai snapshot opname');
 const data={...s,note:b.note,version:s.version+1,units:s.units.map((u:any)=>({...u,...b.units.find(row=>row.id===u.id)}))};
 try{await r.batch([r.stmt('INSERT INTO operation_keys(key) VALUES(?)','opname-version-'+id+'-'+s.version),r.stmt('UPDATE records SET data=?1 WHERE id=?2',JSON.stringify(data),id),r.audit(user,'opname.saved',id)]);}
 catch(e){if(String(e).includes('operation_keys'))fail('STALE_VERSION','Ada revisi baru. Muat ulang opname.',409);throw e;}
 return data;
}
export async function finalizeOpname(r:Repo,id:string,input:unknown,user:string){
 const s=await getOpname(r,id),b=z.object({version:z.coerce.number().int().min(0),adjust_missing:z.boolean().default(false)}).parse(input);
 if(s.status!=='draft')fail('OPNAME_FINAL','Opname sudah final',409);
 if(s.version!==b.version)fail('STALE_VERSION','Ada revisi baru. Muat ulang opname.',409);
 if(s.units.some((u:any)=>typeof u.present!=='boolean'))fail('INCOMPLETE_OPNAME','Silakan periksa semua unit sebelum finalisasi');
 if(b.adjust_missing)owner(r);
 const different=s.units.filter((u:any)=>u.present!==u.expected_present),now=Date.now();
 const data={...s,status:'final',version:s.version+1,difference:different.length,finalized_at:now,finalized_by:user,adjust_missing:b.adjust_missing};
 const statements=[r.stmt('INSERT INTO operation_keys(key) VALUES(?)','opname-version-'+id+'-'+s.version)];
 for(const u of different){
  const adjusted=b.adjust_missing&&u.expected_present&&!u.present;
  statements.push(r.record('movement',{unit_id:u.id,outlet_id:s.outlet_id,kind:'opname',opname_id:id,adjusted,source:'opname',expected_status:u.status,note:u.note||s.note,present:u.present}));
  if(adjusted)statements.push(r.stmt("UPDATE units SET status='lost' WHERE id=?",u.id));
 }
 statements.push(r.stmt('UPDATE records SET data=?1 WHERE id=?2',JSON.stringify(data),id),r.audit(user,'opname.finalized',id));
 try{await r.batch(statements);}catch(e){if(/OPNAME_|operation_keys/.test(String(e)))fail('OPNAME_CONFLICT','Unit atau revisi opname berubah; periksa reservasi dan muat ulang.',409);throw e;}return data;
}
export async function withdrawUnits(r:Repo,input:unknown,user:string,key:string){
 owner(r);const b=z.object({partner_id:z.string().min(1),unit_ids:ids,note:z.string().trim().min(5).max(1000)}).parse(input);
 if(!key)fail('IDEMPOTENCY_REQUIRED','Token penarikan diperlukan');
 const old=(await r.records('withdrawal')).find(w=>w.idempotency_key===key);if(old)return old;
 const partner=(await r.records('partner')).find(p=>p.id===b.partner_id);if(!partner)fail('NOT_FOUND','Mitra tidak ditemukan',404);
 const units=[];
 for(const id of b.unit_ids){
  const u=await r.first('SELECT u.*,p.name AS product_name FROM units u JOIN products p ON p.id=u.product_id WHERE u.id=?',id);
  if(!u||u.partner_id!==b.partner_id)fail('INVALID_UNIT','Pilih unit milik mitra yang sesuai');
  if(u.status!=='available')fail('UNIT_NOT_AVAILABLE','Unit tidak tersedia untuk ditarik',409);
  if(await r.first("SELECT rr.id FROM reservations rr LEFT JOIN bookings b ON b.id=rr.booking_id WHERE rr.unit_id=? AND rr.released_at IS NULL AND (rr.end_at>? OR (b.status='picked_up' AND EXISTS(SELECT 1 FROM items i WHERE i.booking_id=b.id AND i.unit_id=rr.unit_id AND i.returned_at IS NULL AND i.voided_at IS NULL)))",id,Date.now()))fail('UNIT_RESERVED','Unit masih memiliki reservasi atau sedang disewa',409);
  units.push({id:u.id,code:u.code,product_name:u.product_name,outlet_id:u.outlet_id});
 }
 const id=uid(),data={...b,units,partner_name:partner.name,status:'completed',user,idempotency_key:key,withdrawn_at:Date.now()};
 try{await r.batch([r.stmt('INSERT INTO operation_keys(key) VALUES(?)','withdrawal-'+key),...units.flatMap(u=>[r.record('movement',{unit_id:u.id,outlet_id:u.outlet_id,kind:'withdrawal',partner_id:b.partner_id,withdrawal_id:id,note:b.note}),r.stmt("UPDATE units SET status='retired' WHERE id=?",u.id)]),r.record('withdrawal',data,id),r.audit(user,'consignment.withdrawn',id)]);}
 catch(e){const old=(await r.records('withdrawal')).find(w=>w.idempotency_key===key);if(old)return old;if(/WITHDRAWAL_|UNIT_RESERVED|UNIT_NOT_AVAILABLE/.test(String(e)))fail('WITHDRAWAL_CONFLICT','Unit berubah atau masih memiliki reservasi. Muat ulang sebelum menarik.',409);throw e;}
 return {...data,id};
}
export const bundleSchema=z.object({name:z.string().trim().min(2).max(100),price:z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),description:z.string().max(2000).default(''),active:z.boolean().default(true),items:z.array(z.object({product_id:z.string().min(1),qty:z.coerce.number().int().min(1).max(100)})).min(1).max(50)});
export async function saveBundle(r:Repo,input:unknown,user:string,id?:string){
 owner(r);const b=bundleSchema.parse(input);
 if(new Set(b.items.map(i=>i.product_id)).size!==b.items.length)fail('INVALID_BUNDLE','Komponen produk ganda tidak diperbolehkan');
 for(const item of b.items)if(!await r.first('SELECT id FROM products WHERE id=? AND published=1 AND deleted_at IS NULL',item.product_id))fail('INVALID_PRODUCT','Produk paket tidak ditemukan atau belum diterbitkan');
 if(id&&!await r.first("SELECT id FROM records WHERE kind='bundle' AND id=? AND deleted_at IS NULL",id))fail('NOT_FOUND','Paket tidak ditemukan',404);
 const bid=id||uid();await r.batch([id?r.stmt('UPDATE records SET data=?1 WHERE id=?2',JSON.stringify(b),id):r.record('bundle',b,bid),r.audit(user,id?'bundle.updated':'bundle.created',bid)]);return {...b,id:bid};
}
export const cartItems=z.array(z.object({product_id:z.string().min(1),qty:z.coerce.number().int().min(1).max(100)})).max(50);
export async function scanCart(r:Repo,input:unknown){
 if(!['owner','admin'].includes(r.accessScope.role))fail('FORBIDDEN','Akses kasir ditolak',403);
 const b=z.object({code:z.string().trim().min(1).max(100),outlet_id:z.string().min(1),items:cartItems}).parse(input);r.assertOutlet(b.outlet_id);
 const unit=await r.first("SELECT u.product_id,u.status FROM units u JOIN products p ON p.id=u.product_id WHERE upper(u.code)=upper(?) AND u.outlet_id=? AND p.published=1 AND p.deleted_at IS NULL",b.code,b.outlet_id);
 if(!unit)fail('NOT_FOUND','Kode unit tidak ditemukan di outlet ini',404);
 if(unit.status!=='available')fail('UNIT_NOT_AVAILABLE','Unit tidak tersedia',409);
 if(new Set(b.items.map(i=>i.product_id)).size!==b.items.length)fail('INVALID_CART','Produk keranjang ganda');
 const items=b.items.map(i=>({...i})),line=items.find(i=>i.product_id===unit.product_id);
 if(line){if(line.qty>=100)fail('INVALID_QTY','Maksimal 100 unit per produk');line.qty++;}else items.push({product_id:unit.product_id,qty:1});
 return {items:cartItems.parse(items)};
}

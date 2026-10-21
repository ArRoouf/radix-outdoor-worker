import { z } from 'zod';
import { Repo, uid } from '../repo';
import { fail } from './errors';
const rupiah = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const staff = (r:Repo) => { if (!['owner','admin'].includes(r.accessScope.role)) fail('FORBIDDEN','Hanya Owner dan kasir dapat mengelola kas',403); };
export async function activeCashShift(r:Repo,outlet:string,user:string) {
  staff(r); r.assertOutlet(outlet);
  const row = await r.first("SELECT id,data FROM records WHERE kind='shift' AND deleted_at IS NULL AND json_extract(data,'$.user')=? AND json_extract(data,'$.outlet_id')=? AND json_extract(data,'$.closed_at') IS NULL",user,outlet);
  if (!row) fail('SHIFT_REQUIRED','Buka shift kasir di outlet ini sebelum menerima pembayaran tunai');
  return { ...JSON.parse(row.data), id:row.id };
}
export async function openShift(r:Repo,input:unknown,user:string) {
  staff(r);
  const body=z.object({outlet_id:z.string().min(1),opening_cash:rupiah}).parse(input);
  r.assertOutlet(body.outlet_id);
  if (!(await r.records('outlet')).some(o=>o.id===body.outlet_id)) fail('NOT_FOUND','Outlet tidak ditemukan',404);
  const id=uid(),data={...body,user,opened_at:Date.now()};
  try { await r.batch([r.record('shift',data,id),r.audit(user,'shift.opened',id)]); }
  catch(e) { if(String(e).includes('shift_active_user')) fail('SHIFT_OPEN','Tutup shift sebelumnya terlebih dahulu',409); throw e; }
  return {...data,id};
}
async function ownedShift(r:Repo,id:string,user:string) {
  staff(r);
  const row=await r.first("SELECT id,data FROM records WHERE id=? AND kind='shift' AND deleted_at IS NULL",id);
  if(!row)fail('NOT_FOUND','Shift tidak ditemukan',404);
  const shift={...JSON.parse(row.data),id};
  if(r.accessScope.role!=='owner' && shift.user!==user)fail('FORBIDDEN','Shift dimiliki kasir lain',403);
  return shift;
}
export async function closeShift(r:Repo,id:string,input:unknown,user:string) {
  const b=z.object({closing_cash:rupiah,note:z.string().max(1000).default('')}).parse(input);
  const s=await ownedShift(r,id,user);
  if(s.closed_at)fail('SHIFT_CLOSED','Shift sudah ditutup',409);
  // Calculate inside the closing statement, so concurrent receipts cannot race a stale JS sum.
  const expected="CAST(json_extract(data,'$.opening_cash') AS INTEGER)+(SELECT COALESCE(SUM(CASE WHEN kind='refund' THEN -amount ELSE amount END),0) FROM payments WHERE shift_id=?1 AND status='confirmed')-(SELECT COALESCE(SUM(json_extract(e.data,'$.amount')),0) FROM records e WHERE e.kind='expense' AND json_extract(e.data,'$.shift_id')=?1)";
  await r.batch([
    r.stmt('INSERT INTO operation_keys(key) VALUES(?)','close-shift-'+id),
    r.stmt(`UPDATE records SET data=json_set(data,'$.expected_cash',${expected},'$.difference',?2-(${expected}),'$.closing_cash',?2,'$.note',?3,'$.closed_at',?4) WHERE id=?1 AND kind='shift' AND json_extract(data,'$.closed_at') IS NULL`,id,b.closing_cash,b.note,Date.now()),
    r.audit(user,'shift.closed',id),
  ]);
  return (await r.records('shift')).find(s=>s.id===id);
}
export async function cashExpense(r:Repo,id:string,input:unknown,user:string,key:string) {
  const b=z.object({amount:rupiah.refine(n=>n>0),category:z.string().min(1).max(100),note:z.string().min(2).max(1000)}).parse(input);
  if(!key)fail('IDEMPOTENCY_REQUIRED','Token pengeluaran diperlukan');
  const s=await ownedShift(r,id,user);
  const reference='cash-expense-'+id+'-'+key;
  if(await r.first("SELECT id FROM records WHERE kind='expense' AND json_extract(data,'$.idempotency_key')=?",reference))return;
  if(s.closed_at)fail('SHIFT_CLOSED','Shift sudah ditutup',409);
  const eid=uid();
  try { await r.batch([
    r.stmt('INSERT INTO operation_keys(key) VALUES(?)',reference),
    r.record('expense',{...b,shift_id:id,outlet_id:s.outlet_id,idempotency_key:reference,spent_on:new Date().toISOString().slice(0,10)},eid),
    r.insert('ledger',{id:uid(),account:'expense',direction:'out',amount:b.amount,reference:eid,note:b.note,booking_id:null,created_at:Date.now()}),
    r.audit(user,'shift.cash_expense',eid),
  ]); } catch(e) {
    if(await r.first("SELECT id FROM records WHERE kind='expense' AND json_extract(data,'$.idempotency_key')=?",reference))return;
    if(String(e).includes('SHIFT_CLOSED'))fail('SHIFT_CLOSED','Shift sudah ditutup',409);
    throw e;
  }
}

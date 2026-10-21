import { z } from 'zod';
import { Repo,uid } from '../repo';
import { fail } from './errors';
function owner(r:Repo) { if(r.accessScope.role!=='owner')fail('FORBIDDEN','Settlement memerlukan Owner',403); }
export const settlementInput=z.object({partner_id:z.string().min(1),period_start:z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),period_end:z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER),deductions:z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),note:z.string().max(1000).default('')}).refine(b=>b.period_end>b.period_start,{message:'Periode akhir harus setelah awal',path:['period_end']});
export async function createSettlement(r:Repo,input:unknown,user:string,key:string) {
  owner(r);const b=settlementInput.parse(input);
  if(!key)fail('IDEMPOTENCY_REQUIRED','Token settlement diperlukan');
  const previous=await r.first("SELECT id,data,created_at FROM records WHERE kind='settlement' AND json_extract(data,'$.idempotency_key')=?",key);
  if(previous)return {...JSON.parse(previous.data),id:previous.id,created_at:previous.created_at};
  if(!(await r.records('partner')).some(p=>p.id===b.partner_id))fail('NOT_FOUND','Mitra tidak ditemukan',404);
  const due=await r.all("SELECT l.* FROM ledger l WHERE l.account='partner_payable' AND l.direction='out' AND l.created_at>=? AND l.created_at<? AND EXISTS(SELECT 1 FROM items i JOIN units u ON u.id=i.unit_id WHERE i.booking_id=l.booking_id AND u.partner_id=? AND l.reference='partner-'||i.id) AND NOT EXISTS(SELECT 1 FROM settlement_entries se WHERE se.ledger_id=l.id) AND NOT EXISTS(SELECT 1 FROM records old,json_each(json_extract(old.data,'$.entries')) j WHERE old.kind='settlement' AND j.value=l.id)",b.period_start,b.period_end,b.partner_id);
  const gross=due.reduce((n,l)=>n+l.amount,0);
  if(!Number.isSafeInteger(gross)||!gross||b.deductions>gross)fail('INVALID_SETTLEMENT','Tidak ada saldo tersedia atau potongan melebihi saldo');
  const id=uid(),data={...b,gross,net:gross-b.deductions,status:'draft',entries:due.map(l=>l.id),idempotency_key:key};
  try {
    await r.batch([r.stmt('INSERT INTO operation_keys(key) VALUES(?)','settlement-draft-'+key),r.record('settlement',data,id),...due.map(l=>r.stmt('INSERT INTO operation_keys(key) VALUES(?)','settled-'+l.id)),...due.map(l=>r.insert('settlement_entries',{ledger_id:l.id,settlement_id:id})),r.audit(user,'settlement.drafted',id)]);
  }catch(e){
    const retry=await r.first("SELECT id,data FROM records WHERE kind='settlement' AND json_extract(data,'$.idempotency_key')=?",key);
    if(retry)return {...JSON.parse(retry.data),id:retry.id};
    if(String(e).includes('settlement_entries')||String(e).includes('operation_keys'))fail('SETTLEMENT_CONFLICT','Hak mitra sudah masuk draft lain. Muat ulang dan periksa saldo.',409);
    throw e;
  }
  return {...data,id};
}
export async function paySettlement(r:Repo,id:string,user:string) {
  owner(r);
  const row=await r.first("SELECT id,data FROM records WHERE id=? AND kind='settlement' AND deleted_at IS NULL",id);
  if(!row)fail('NOT_FOUND','Settlement tidak ditemukan',404);
  const data=JSON.parse(row.data);
  if(data.status==='paid')return {...data,id};
  if(data.status!=='draft')fail('INVALID_TRANSITION','Settlement bukan draft');
  const total=await r.first('SELECT COALESCE(SUM(l.amount),0) AS gross FROM settlement_entries se JOIN ledger l ON l.id=se.ledger_id WHERE se.settlement_id=?',id);
  if(total.gross!==data.gross)fail('INVALID_SETTLEMENT','Rincian hak mitra tidak sesuai');
  const paid_at=Date.now();
  try{
    await r.batch([
      r.stmt('INSERT INTO operation_keys(key) VALUES(?)','settlement-paid-'+id),
      r.stmt("UPDATE records SET data=json_set(data,'$.status','paid','$.paid_at',?1,'$.paid_by',?2) WHERE id=?3 AND json_extract(data,'$.status')='draft'",paid_at,user,id),
      ...(data.net?[r.insert('ledger',{id:uid(),account:'partner_settlement',direction:'out',amount:data.net,reference:id,note:'Settlement mitra '+data.partner_id,created_at:paid_at})]:[]),
      r.audit(user,'settlement.paid',id),
    ]);
  }catch(e){
    const fresh=await r.first("SELECT data FROM records WHERE id=? AND kind='settlement'",id);
    if(fresh&&JSON.parse(fresh.data).status==='paid')return {...JSON.parse(fresh.data),id};
    throw e;
  }
  return {...data,id,status:'paid',paid_at};
}

import { z } from 'zod';
import { Repo,uid } from '../repo';
import { fail } from './errors';
import { componentCharges } from '../../../../packages/shared/pricing';
export const fineComponentInput=z.object({name:z.string().trim().min(2).max(100),category:z.enum(['cleaning','damage','loss']),amount:z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),active:z.boolean().default(true)});
export async function returnFormData(r:Repo,id:string) {
  const booking=await r.first('SELECT id,code,status FROM bookings WHERE id=?',id);
  if(!booking)fail('NOT_FOUND','Booking tidak ditemukan',404);
  return {booking,items:await r.all('SELECT i.id,i.product_name,i.returned_at,u.code FROM items i JOIN units u ON u.id=i.unit_id WHERE i.booking_id=? AND i.voided_at IS NULL',id),components:(await r.records('fine_component')).filter(c=>c.active)};
}
export async function saveFineComponent(r:Repo,input:unknown,user:string,id?:string) {
  if(r.accessScope.role!=='owner')fail('FORBIDDEN','Master denda memerlukan Owner',403);
  const b=fineComponentInput.parse(input);
  if(id&&!(await r.first("SELECT id FROM records WHERE id=? AND kind='fine_component' AND deleted_at IS NULL",id)))fail('NOT_FOUND','Komponen tidak ditemukan',404);
  const key=id||uid();
  await r.batch([id?r.stmt('UPDATE records SET data=?1 WHERE id=?2',JSON.stringify(b),id):r.record('fine_component',b,key),r.audit(user,id?'fine_component.updated':'fine_component.created',key)]);
  return {...b,id:key};
}
export async function snapshotComponents(r:Repo,input:unknown,condition:string,manualDamage:number) {
  const rows=z.array(z.object({component_id:z.string().min(1),qty:z.coerce.number().int().min(1).max(100),note:z.string().max(500).default('')})).max(20).parse(input??[]);
  if(new Set(rows.map(row=>row.component_id)).size!==rows.length)fail('INVALID_COMPONENT','Komponen yang sama hanya boleh dipilih sekali per unit');
  const master=await r.records('fine_component');
  const snapshots=rows.map(row=>{
    const component=master.find(c=>c.id===row.component_id&&c.active);
    if(!component)fail('INVALID_COMPONENT','Komponen denda tidak aktif atau tidak ditemukan');
    if(condition==='lost'&&component.category!=='cleaning')fail('DUPLICATE_LOSS','Harga ganti kehilangan sudah dikenakan; jangan tambahkan komponen kerusakan/kehilangan');
    if(manualDamage>0&&['damage','loss'].includes(component.category))fail('DUPLICATE_DAMAGE','Pilih biaya manual atau komponen kerusakan/kehilangan');
    if(['damage','loss'].includes(component.category)&&condition==='good')fail('INVALID_CONDITION','Komponen kerusakan/kehilangan memerlukan kondisi dan bukti yang sesuai');
    const amount=componentCharges([{amount:component.amount,qty:row.qty}]);
    return {component_id:component.id,name:component.name,kind:component.category,unit_amount:component.amount,qty:row.qty,amount,note:row.note};
  });
  return {snapshots,total:componentCharges(snapshots.map(s=>({amount:s.unit_amount,qty:s.qty})))};
}

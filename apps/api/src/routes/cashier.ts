import {z} from 'zod';
import {requireSession,csrfCheck} from '../middleware/auth';
import {cashierData,cartForm,paperWidth} from '../services/cashier';
import {scanCart} from '../services/inventory';
import {DomainError,fail} from '../services/errors';
import {quote,createBooking} from '../services/rental';
import {cashierView} from '../views/cashier';
import {storeMidnight} from '../../../../packages/shared/dates';
function time(value:any,timezone:string){const text=String(value);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text))fail('INVALID_RANGE','Isi tanggal dan jam sewa');const hours=Number(text.slice(11,13)),minutes=Number(text.slice(14,16));if(hours>23||minutes>59)fail('INVALID_RANGE','Jam sewa tidak valid');return storeMidnight(text.slice(0,10),timezone)+(hours*60+minutes)*60000;}
export function cashierRoutes(app:any,layout:(c:any,content:string)=>Promise<string>){
 async function authorize(c:any){if(!await requireSession(c,false))return false;if(!['owner','admin'].includes(c.get('member').role))fail('FORBIDDEN','Akses kasir ditolak',403);c.header('Cache-Control','no-store');return true;}
 async function render(c:any,values:any={},price:any=null,error='',status=200){
  const data={...await cashierData(c.get('repo')),timezone:c.get('store').timezone,role:c.get('member').role};
  const content=cashierView(data,c.get('csrf'),values,price,error).toString();
  return c.html(c.req.header('HX-Request')?content:await layout(c,content),status);
 }
 app.get('/admin/kasir',async(c:any)=>{if(!await authorize(c))return c.redirect('/login');return render(c);});
 app.post('/admin/kasir/:action',async(c:any)=>{
  if(!await authorize(c))return c.redirect('/login');await csrfCheck(c);const b=await c.req.parseBody(),r=c.get('repo'),action=c.req.param('action');
  try{
   const outlet_id=z.string().min(1).parse(b.outlet_id);r.assertOutlet(outlet_id);
   if(!(await r.records('outlet')).some((o:any)=>o.id===outlet_id))fail('NOT_FOUND','Outlet tidak ditemukan',404);
   const items=cartForm(b);
   if(action==='scan'){if(b.bundle_id)fail('INVALID_CART','Kosongkan pilihan paket sebelum menambah produk dari scan');const scanned=await scanCart(r,{items,code:b.code,outlet_id});return render(c,{...b,...Object.fromEntries(scanned.items.map(i=>['qty_'+i.product_id,i.qty]))});}
   const payload={items,bundle_id:b.bundle_id||undefined,bundle_qty:Number(b.bundle_qty??1),outlet_id,start_at:time(b.start_at,c.get('store').timezone),end_at:time(b.end_at,c.get('store').timezone),voucher_code:b.voucher_code||'',paid:Number(b.paid||0),method:b.method||'cash',customer:{name:String(b.name||''),phone:String(b.phone||'')},note:b.note||''};
   if(action==='quote')return render(c,b,await quote(r,c.get('store').settings,payload));
   if(action!=='create')fail('NOT_FOUND','Tindakan tidak ditemukan',404);
   const paper=paperWidth.parse(b.paper||'58');
   const booking=await createBooking(r,c.get('store').settings,payload,String(b.idempotency_key||''),c.get('user'));
   return c.redirect('/admin/bookings/'+booking.id+'/print?type=thermal&width='+paper,303);
  }catch(e){if(e instanceof z.ZodError)return render(c,b,null,e.issues.map(i=>i.message).join('; '),422);if(e instanceof DomainError)return render(c,b,null,e.message,e.status===400?422:e.status);if(/Jumlah paket|Maksimal 100|Tanggal periode/.test(String(e)))return render(c,b,null,(e as Error).message,422);throw e;}
 });
}

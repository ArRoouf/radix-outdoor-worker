import {z} from 'zod';
import {requireSession,csrfCheck} from '../middleware/auth';
import {DomainError,fail} from '../services/errors';
import {startOpname,saveOpname,finalizeOpname,getOpname,withdrawUnits,saveBundle} from '../services/inventory';
import {operationsPage} from '../views/operations';
import {opnamesView,opnameView,packagesView,withdrawalsView,withdrawalPrint} from '../views/inventory';
export function inventoryRoutes(app:any){
 for(const section of ['opnames','packages','withdrawals']){
  const base='/admin/'+section;
  async function authorize(c:any){if(!await requireSession(c,false))return false;if(!(section==='opnames'?['owner','warehouse']:['owner']).includes(c.get('member').role))fail('FORBIDDEN','Akses ditolak',403);c.header('Cache-Control','no-store');return true;}
  async function render(c:any,error='',status=200){
   const r=c.get('repo'),csrf=c.get('csrf'),role=c.get('member').role,id=c.req.param('id');let body,title;
   if(section==='opnames'){title='Stok opname';body=id?opnameView(await getOpname(r,id),csrf,role):opnamesView({outlets:await r.records('outlet'),opnames:await r.records('opname')},csrf);}
   else if(section==='packages'){title='Paket sewa';body=packagesView({bundles:await r.records('bundle'),products:await r.all('SELECT id,name FROM products WHERE published=1 AND deleted_at IS NULL')},csrf);}
   else {title='Penarikan konsinyasi';body=withdrawalsView({partners:await r.records('partner'),withdrawals:await r.records('withdrawal'),units:await r.all("SELECT u.id,u.code,u.partner_id,p.name AS product_name FROM units u JOIN products p ON p.id=u.product_id WHERE u.partner_id IS NOT NULL AND u.status='available' ORDER BY u.code")},csrf);}
   return c.html(operationsPage(title,body,error,!!c.req.header('HX-Request'),role),status);
  }
  app.get(base,async(c:any)=>{if(!await authorize(c))return c.redirect('/login');return render(c);});
  if(section==='opnames')app.get(base+'/:id',async(c:any)=>{if(!await authorize(c))return c.redirect('/login');return render(c);});
  if(section==='withdrawals')app.get(base+'/:id/print',async(c:any)=>{if(!await authorize(c))return c.redirect('/login');const w=(await c.get('repo').records('withdrawal')).find((w:any)=>w.id===c.req.param('id'));if(!w)fail('NOT_FOUND','Penarikan tidak ditemukan',404);return c.html(withdrawalPrint(w,c.get('store').timezone));});
  async function mutate(c:any){
   if(!await authorize(c))return c.redirect('/login');await csrfCheck(c);const f=await c.req.formData(),r=c.get('repo'),user=c.get('user'),id=c.req.param('id'),action=c.req.param('action');
   const b=Object.fromEntries(f),key=String(b.idempotency_key||'');
   try{
    if(section==='opnames'){
     if(!id){const s=await startOpname(r,b,user,key);return c.redirect(base+'/'+s.id,303);}
     const s=await getOpname(r,id);
     if(action==='save')await saveOpname(r,id,{version:b.version,note:b.note,units:s.units.map((u:any)=>({id:u.id,present:b['present_'+u.id]==='present'?true:b['present_'+u.id]==='absent'?false:null,note:b['note_'+u.id]||''}))},user);
     else if(action==='finalize')await finalizeOpname(r,id,{version:b.version,adjust_missing:b.adjust_missing==='yes'},user);
     else fail('NOT_FOUND','Tindakan tidak ditemukan',404);
     return c.redirect(base+'/'+id,303);
    }
    if(section==='packages'){
     const items=Object.entries(b).filter(([k,v])=>k.startsWith('qty_')&&Number(v)!==0).map(([k,v])=>({product_id:k.slice(4),qty:Number(v)}));
     await saveBundle(r,{...b,active:b.active==='yes',items},user,id);
    }else await withdrawUnits(r,{...b,unit_ids:f.getAll('unit_ids').map(String)},user,key);
    return c.redirect(base,303);
   }catch(e){
    if(e instanceof z.ZodError)return render(c,e.issues.map(i=>i.message).join('; '),422);
    if(e instanceof DomainError)return render(c,e.message,e.status===400?422:e.status);
    if(/OPNAME_|UNIT_RESERVED|WITHDRAWAL_|operation_keys/.test(String(e)))return render(c,'Data unit atau opname telah berubah. Muat ulang dan periksa reservasi.',409);
    throw e;
   }
  }
  app.post(base,mutate);if(section==='opnames')app.post(base+'/:id/:action',mutate);if(section==='packages')app.post(base+'/:id',mutate);
 }
}

import { z } from 'zod';
import { requireSession,csrfCheck } from '../middleware/auth';
import { DomainError,fail } from '../services/errors';
import { openShift,closeShift,cashExpense } from '../services/cash';
import { createSettlement,paySettlement } from '../services/settlements';
import { saveFineComponent,returnFormData } from '../services/fines';
import { bookingAction } from '../services/rental';
import { operationsPage,shiftsView,settlementsView,componentsView,returnView } from '../views/operations';
import { storeMidnight } from '../../../../packages/shared/dates';
export function operationsRoutes(app:any,upload:any) {
  const returnPath='/admin/bookings/:id/return';
  async function returnContext(c:any) {
    if(!await requireSession(c,false))return false;
    if(!['owner','admin','warehouse'].includes(c.get('member').role))fail('FORBIDDEN','Akses ditolak',403);
    c.header('Cache-Control','no-store');return true;
  }
  async function renderReturn(c:any,error='',status=200) {
    const data=await returnFormData(c.get('repo'),c.req.param('id'));
    return c.html(operationsPage('Pengembalian alat',returnView(data,c.get('csrf')),error,!!c.req.header('HX-Request'),c.get('member').role),status);
  }
  app.get(returnPath,async(c:any)=>{if(!await returnContext(c))return c.redirect('/login');return renderReturn(c);});
  app.post(returnPath,async(c:any)=>{
    if(!await returnContext(c))return c.redirect('/login');
    await csrfCheck(c);
    const r=c.get('repo'),id=c.req.param('id'),data=await returnFormData(r,id),form=await c.req.formData();
    try {
      const components:any={},conditions:any={};
      const selected=form.getAll('item_ids').map(String);
      for(const item of data.items) {
        conditions[item.id]=form.get('condition_'+item.id)||'good';
        if(selected.includes(item.id))for(const f of data.components) {
          const qty=Number(form.get('component_'+item.id+'_'+f.id)||0);
          if(!Number.isInteger(qty)||qty<0||qty>100)fail('INVALID_COMPONENT','Jumlah komponen harus antara 0 dan 100');
          if(qty>0)(components[item.id]||=[]).push({component_id:f.id,qty});
        }
      }
      const file=form.get('file');
      const photo=file&&typeof file!=='string'&&file.size?(await upload(c,r,'inspection',id)).id:null;
      await bookingAction(r,c.get('store').settings,id,'return',{item_ids:selected,conditions,components,damage:Number(form.get('damage')||0),note:String(form.get('note')||''),photo},c.get('user'),c.get('member').role);
      return c.redirect('/admin/bookings/'+id+'/return',303);
    }catch(e){
      if(e instanceof z.ZodError)return renderReturn(c,'Periksa kembali komponen yang diisi',422);
      if(e instanceof DomainError&&e.status<500)return renderReturn(c,e.message,e.status===400?422:e.status);
      throw e;
    }
  });
  for(const section of ['cash-shifts','settlements','fine-components']) {
    const base='/admin/'+section;
    async function authorize(c:any) {
      if(!await requireSession(c,false))return false;
      const role=c.get('member').role;
      if(!(section==='cash-shifts'?['owner','admin']:['owner']).includes(role))fail('FORBIDDEN','Akses ditolak',403);
      c.header('Cache-Control','no-store');return true;
    }
    async function render(c:any,error='',status=200,values:any={}) {
      const r=c.get('repo'),csrf=c.get('csrf');
      let body,title;
      if(section==='cash-shifts') {
        title='Kas & shift kasir';body=shiftsView({shifts:await r.records('shift'),outlets:await r.records('outlet'),user:c.get('user'),role:c.get('member').role,users:await r.all('SELECT id,name FROM users')},csrf,values);
      }else if(section==='settlements'){
        title='Settlement mitra';body=settlementsView({partners:await r.records('partner'),settlements:await r.records('settlement'),timezone:c.get('store').timezone},csrf,values);
      }else{title='Komponen denda';body=componentsView(await r.records('fine_component'),csrf,values);}
      return c.html(operationsPage(title,body,error,!!c.req.header('HX-Request'),c.get('member').role),status);
    }
    app.get(base,async(c:any)=>{
      if(!await authorize(c))return c.redirect('/login');
      return render(c,'',200,{partner_id:c.req.query('partner_id')});
    });
    async function mutate(c:any) {
      if(!await authorize(c))return c.redirect('/login');
      await csrfCheck(c);
      const b=await c.req.parseBody(),id=c.req.param('id'),action=c.req.param('action'),r=c.get('repo'),user=c.get('user');
      try {
        if(section==='cash-shifts'){
          if(action==='open'&&!id)await openShift(r,b,user);
          else if(action==='close'&&id)await closeShift(r,id,b,user);
          else if(action==='expense'&&id)await cashExpense(r,id,b,user,String(b.idempotency_key||''));
          else fail('NOT_FOUND','Tindakan tidak ditemukan',404);
        }else if(section==='settlements'){
          if(id&&action==='pay') {
            if(b.confirmed!=='yes')fail('CONFIRMATION_REQUIRED','Konfirmasi dana sudah diserahkan');
            await paySettlement(r,id,user);
          }else if(!id&&!action){
            let start,end;
            try {start=storeMidnight(String(b.period_from),c.get('store').timezone);end=storeMidnight(String(b.period_to),c.get('store').timezone,true);}
            catch {fail('INVALID_PERIOD','Isi tanggal periode yang valid');}
            await createSettlement(r,{...b,period_start:start,period_end:end},user,String(b.idempotency_key||''));
          }else fail('NOT_FOUND','Tindakan tidak ditemukan',404);
        }else await saveFineComponent(r,{...b,active:b.active==='yes'},user,id);
        return c.redirect(base,303);
      }catch(e){
        if(e instanceof z.ZodError)return render(c,e.issues.map(i=>i.message).join('; '),422,{...b,id});
        if(e instanceof DomainError&&e.status<500)return render(c,e.message,e.status===400?422:e.status,{...b,id});
        throw e;
      }
    }
    if(section==='cash-shifts') {app.post(base+'/:action',mutate);app.post(base+'/:id/:action',mutate);}
    else if(section==='settlements') {app.post(base,mutate);app.post(base+'/:id/:action',mutate);}
    else {app.post(base,mutate);app.post(base+'/:id',mutate);}
  }
}

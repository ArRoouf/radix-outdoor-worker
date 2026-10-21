import { beforeEach, describe, expect, it } from 'vitest';
import { SQLiteD1 } from '../packages/db/local-adapter';
import { Repo } from '../apps/api/src/repo';
import { app } from '../apps/api/src';
import { hashPassword, verifyPassword } from '../apps/api/src/middleware/auth';
import { createBooking } from '../apps/api/src/services/rental';
import { defaultSettings } from '../packages/db/seed';
let db:SQLiteD1,env:any;
const password='Test-only-password-4819';
const request=(path:string,init:RequestInit={})=>app.request('https://radix.test'+path,init,env);
async function login(email='owner@example.test') {
  const form=await request('/login');
  const csrf=/name="csrf" value="([a-f\d]+)"/.exec(await form.text())![1];
  const response=await request('/api/v1/auth/login',{method:'POST',headers:{cookie:form.headers.get('set-cookie')!.split(';')[0],'content-type':'application/x-www-form-urlencoded',origin:'https://radix.test'},body:new URLSearchParams({email,password,csrf})});
  expect(response.status).toBe(303);
  const cookie=response.headers.get('set-cookie')!.split(';')[0];
  const bootstrap=await request('/api/v1/bootstrap',{headers:{cookie}});
  const data=(await bootstrap.json() as any).data;
  return {cookie,csrf:data.csrf,data};
}
beforeEach(()=>{db=new SQLiteD1();env={DB:db,ASSETS:{fetch:()=>new Response('not found',{status:404})},FILES_PRIVATE:{},FILES_PUBLIC:{},INITIAL_OWNER_EMAIL:'owner@example.test',INITIAL_OWNER_PASSWORD:password};});
describe('Login mandiri dan keamanan sesi',()=>{
  it('form booking memakai dashboard dan menjelaskan data awal yang belum tersedia',async()=>{
    const owner=await login(),headers={cookie:owner.cookie};
    const response=await request('/admin/kasir',{headers});
    const html=await response.text();
    expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
    expect(html).toContain('<title>Buat booking · Radix Outdoor</title>');
    expect(html).toContain('class="sidebar"');expect(html).toContain('nav-link active" href="/admin/bookings"');
    expect(html).toContain('Belum ada outlet pengambilan');expect(html).toContain('Belum ada produk yang diterbitkan');
    expect(html).toContain('href="/admin/products"');expect(html).not.toContain('action="/admin/kasir/create"');
    const r=new Repo(db as any,{role:'owner'});
    await r.batch([r.record('outlet',{name:'Pusat'},'cashier-outlet'),r.insert('products',{id:'cashier-product',name:'Tenda Kasir',category:'Tenda',price:40000,published:1,created_at:1})]);
    const ready=await request('/admin/kasir',{headers});const readyHtml=await ready.text();
    expect(readyHtml).toContain('action="/admin/kasir/create"');expect(readyHtml).toContain('Tenda Kasir');
    const invalid=await request('/admin/kasir/quote',{method:'POST',headers:{...headers,'content-type':'application/x-www-form-urlencoded',origin:'https://radix.test'},body:new URLSearchParams({csrf:owner.csrf,outlet_id:'cashier-outlet',name:'Nama tersimpan',idempotency_key:'retained-token'})});
    expect(invalid.status).toBe(422);const invalidHtml=await invalid.text();
    expect(invalidHtml).toContain('class="sidebar"');expect(invalidHtml).toContain('role="alert"');expect(invalidHtml).toContain('value="Nama tersimpan"');expect(invalidHtml).toContain('value="retained-token"');
    const fragment=await request('/admin/kasir',{headers:{...headers,'HX-Request':'true'}});const fragmentHtml=await fragment.text();
    expect(fragmentHtml).toContain('id="cashier-content"');expect(fragmentHtml).not.toContain('<!doctype');expect(fragmentHtml).not.toContain('class="sidebar"');
  });
  it('hash memakai salt unik dan menolak kata sandi salah',async()=>{
    const a=await hashPassword(password),b=await hashPassword(password);
    expect(a).not.toBe(b);expect(await verifyPassword(password,a)).toBe(true);expect(await verifyPassword('salah',a)).toBe(false);
  });
  it('header identitas hosting dan LOCAL_DEV tidak dapat melewati login',async()=>{
    env.LOCAL_DEV='true';
    const r=await request('/api/v1/bootstrap',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'owner@example.test'}});
    expect(r.status).toBe(401);expect(db.db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({n:0});
  });
  it('storefront publik, dashboard membutuhkan login, dan tidak ada UI SaaS',async()=>{
    const r=await request('/');expect(r.status).toBe(200);expect(await r.text()).toContain('Radix Outdoor');
    expect((await request('/admin/dashboard')).status).toBe(302);
    const user=await login();
    const page=await request('/admin/dashboard',{headers:{cookie:user.cookie}});
    const html=await page.text();expect(html).not.toMatch(/langganan|Pilih workspace|Panel platform|signout-with-chatgpt/i);
    const token=user.cookie.split('=')[1];
    const session=db.db.prepare('SELECT * FROM sessions').get() as any;
    expect(session.token_hash).not.toBe(token);expect(session.token_hash).toHaveLength(64);
  });
  it('menolak mutasi tanpa CSRF dan menghapus sesi setelah logout',async()=>{
    const {cookie,csrf}=await login();
    expect((await request('/api/v1/records/outlet',{method:'POST',headers:{cookie,'content-type':'application/json'},body:'{"name":"Baru"}'})).status).toBe(403);
    const logout=await request('/api/v1/auth/logout',{method:'POST',headers:{cookie,'x-csrf-token':csrf}});expect(logout.status).toBe(303);
    expect((await request('/api/v1/bootstrap',{headers:{cookie}})).status).toBe(401);
  });
  it('dokumen privat memerlukan izin dan link kedaluwarsa, tanpa token di log atau database',async()=>{
    const user=await login(),r=new Repo(db as any,{role:'owner'});
    await r.batch([r.insert('uploads',{id:'doc',kind:'identity',owner_token:'customer',mime:'image/png',storage_key:'files/doc',created_at:Date.now()})]);
    env.FILES_PRIVATE.get=async()=>({body:new Uint8Array([1,2,3])});
    expect((await request('/api/v1/files/doc')).status).toBe(401);
    const issued=await request('/api/v1/files/doc',{headers:{cookie:user.cookie}});
    expect(issued.status).toBe(302);const url=issued.headers.get('location')!;
    expect((await request(url)).status).toBe(200);
    const link=await r.first("SELECT id,data FROM records WHERE kind='file_link'");
    expect(link.data).not.toContain(url.split('/').pop());
    await r.batch([r.stmt("UPDATE records SET data=json_set(data,'$.expires_at',0) WHERE id=?",link.id)]);
    expect((await request(url)).status).toBe(404);
  });
  it('endpoint pendaftaran toko, paket dan billing sudah tidak tersedia',async()=>{
    const {cookie,csrf}=await login();
    for(const path of ['/api/v1/workspaces','/api/v1/workspaces/switch','/api/v1/platform','/api/v1/platform/billing','/api/v1/billing']) {
      expect((await request(path,{headers:{cookie}})).status).toBe(404);
      expect((await request(path,{method:'POST',headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},body:'{}'})).status).toBe(404);
    }
  });
});
describe('Akses satu bisnis dengan banyak outlet dan mitra',()=>{
  it('membuat beberapa unit sekaligus dengan kode yang berbeda',async()=>{
    const owner=await login(),r=new Repo(db as any,{role:'owner'});
    await r.batch([r.record('outlet',{name:'Pusat'},'out-A')]);
    const response=await request('/api/v1/products',{method:'POST',headers:{cookie:owner.cookie,'x-csrf-token':owner.csrf,'content-type':'application/json'},body:JSON.stringify({name:'Tenda Baru',category:'Tenda',price:40000,capacity:1,outlet_id:'out-A',quantity:3})});
    expect(response.status).toBe(200);
    const units=await r.all('SELECT code FROM units');expect(units).toHaveLength(3);expect(new Set(units.map(u=>u.code)).size).toBe(3);
  });
  it('form operasional server, CSRF, validasi 422, serta larangan akses staf ke master dan settlement',async()=>{
    const owner=await login(),r=new Repo(db as any,{role:'owner'});
    await r.batch([r.record('outlet',{name:'Outlet A'},'out-A')]);
    const headers={cookie:owner.cookie,'content-type':'application/x-www-form-urlencoded',origin:'https://radix.test'};
    const form=(path:string,body:Record<string,string>)=>request(path,{method:'POST',headers,body:new URLSearchParams({...body,csrf:owner.csrf})});
    expect((await request('/admin/cash-shifts')).status).toBe(302);
    const page=await request('/admin/fine-components',{headers:{cookie:owner.cookie}});
    expect(page.status).toBe(200);expect(page.headers.get('cache-control')).toBe('no-store');
    expect((await form('/admin/fine-components',{name:'',category:'cleaning',amount:'-1'})).status).toBe(422);
    const valid=await form('/admin/fine-components',{name:'Cuci tenda',category:'cleaning',amount:'15000',active:'yes'});
    expect(valid.status).toBe(303);expect((await r.records('fine_component'))[0].amount).toBe(15000);
    expect((await form('/admin/cash-shifts/open',{outlet_id:'out-A',opening_cash:'100000'})).status).toBe(303);
    const s=(await r.records('shift'))[0];
    expect((await form('/admin/cash-shifts/'+s.id+'/expense',{amount:'5000',category:'Kas',note:'Beli kantong',idempotency_key:'expense'})).status).toBe(303);
    expect((await form('/admin/cash-shifts/'+s.id+'/close',{closing_cash:'95000',note:'Sesuai'})).status).toBe(303);
    expect((await r.records('shift'))[0].difference).toBe(0);
    const fragment=await request('/admin/fine-components',{headers:{cookie:owner.cookie,'HX-Request':'true'}});
    expect(await fragment.text()).not.toContain('<!doctype');
    const staffId='ops-admin';
    await r.batch([r.insert('users',{id:staffId,name:'Kasir A',email:'ops-admin@example.test',role:'admin',outlet_id:'out-A',password_hash:await hashPassword(password),active:1})]);
    const staff=await login('ops-admin@example.test');
    for(const path of ['/admin/fine-components','/admin/settlements'])expect((await request(path,{headers:{cookie:staff.cookie}})).status).toBe(403);
    const mutation=await request('/api/v1/fine-components',{method:'POST',headers:{cookie:staff.cookie,'x-csrf-token':staff.csrf,'content-type':'application/json'},body:JSON.stringify({name:'Test',amount:1,category:'cleaning'})});
    expect(mutation.status).toBe(403);
    expect((await request('/admin/cash-shifts/open',{method:'POST',headers:{cookie:staff.cookie,'content-type':'application/x-www-form-urlencoded'},body:'outlet_id=out-A&opening_cash=0'})).status).toBe(403);
  });
  it('membatasi bootstrap, detail, ekspor, PDF dan pembayaran berdasarkan outlet',async()=>{
    const owner=await login(),r=new Repo(db as any,{role:'owner'});
    await r.batch([r.record('outlet',{name:'A'},'out-A'),r.record('outlet',{name:'B'},'out-B'),r.insert('products',{id:'p',name:'Tenda',category:'Tenda',price:40000,created_at:1}),r.insert('units',{id:'ua',product_id:'p',outlet_id:'out-A',code:'A-1',created_at:1}),r.insert('units',{id:'ub',product_id:'p',outlet_id:'out-B',code:'B-1',created_at:1})]);
    const booking=await createBooking(r,defaultSettings,{start_at:Date.now()+86400000,end_at:Date.now()+172800000,outlet_id:'out-A',items:[{product_id:'p',qty:1}],customer:{name:'Penyewa A',phone:'081234567890'},paid:0},'isolation','owner');
    await r.batch([r.insert('users',{id:'admin-B',name:'Kasir B',email:'b@example.test',role:'admin',outlet_id:'out-B',password_hash:await hashPassword(password)})]);
    const staff=await login('b@example.test');
    expect(staff.data.bookings).toHaveLength(0);expect(staff.data.customers).toHaveLength(0);expect(staff.data.units.map((u:any)=>u.id)).toEqual(['ub']);
    expect(staff.data.store.settings).not.toHaveProperty('qris_payload');
    expect((await request('/api/v1/bookings/'+booking.id,{headers:{cookie:staff.cookie}})).status).toBe(404);
    expect((await request('/admin/bookings/'+booking.id+'/print',{headers:{cookie:staff.cookie}})).status).toBe(404);
    expect((await request('/admin/bookings/'+booking.id+'/print?type=thermal&width=58',{headers:{cookie:staff.cookie}})).status).toBe(404);
    for(const path of ['/admin/opnames','/admin/withdrawals','/admin/packages'])expect((await request(path,{headers:{cookie:staff.cookie}})).status).toBe(403);
    const csv=await request('/api/v1/reports/export',{headers:{cookie:staff.cookie}});expect(await csv.text()).not.toContain(booking.code);
    expect((await request('/api/v1/bookings/'+booking.id+'/payments',{method:'POST',headers:{cookie:staff.cookie,'x-csrf-token':staff.csrf,'content-type':'application/json','Idempotency-Key':'bad'},body:'{"amount":1000,"method":"cash"}'})).status).toBe(404);
    const all=await request('/api/v1/bootstrap',{headers:{cookie:owner.cookie}});expect((await all.json() as any).data.bookings).toHaveLength(1);
  });
  it('mitra hanya melihat unit dan settlement miliknya tanpa data penyewa',async()=>{
    await login();const r=new Repo(db as any,{role:'owner'});
    await r.batch([r.record('partner',{name:'A'},'pa'),r.record('partner',{name:'B'},'pb'),r.record('settlement',{partner_id:'pa',net:10000},'sa'),r.record('settlement',{partner_id:'pb',net:20000},'sb'),r.insert('products',{id:'p',name:'Tenda',category:'Tenda',price:10000,created_at:1}),r.insert('units',{id:'ua',product_id:'p',outlet_id:'o',code:'A',partner_id:'pa',created_at:1}),r.insert('units',{id:'ub',product_id:'p',outlet_id:'o',code:'B',partner_id:'pb',created_at:1}),r.insert('users',{id:'partner-a',name:'A',email:'a@example.test',role:'partner',partner_id:'pa',password_hash:await hashPassword(password)})]);
    const {data}=await login('a@example.test');expect(data.units.map((u:any)=>u.id)).toEqual(['ua']);expect(data.records.settlement.map((s:any)=>s.id)).toEqual(['sa']);expect(data.customers).toEqual([]);expect(data.members).toEqual([]);
  });
});

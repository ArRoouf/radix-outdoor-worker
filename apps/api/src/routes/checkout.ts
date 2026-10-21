import { getCookie, setCookie } from 'hono/cookie';
import { Repo, uid } from '../repo';
import { loadStore, randomToken } from '../middleware/auth';
import { quote, createBooking, fail } from '../services/rental';
import { authPage } from '../views/auth';
import { esc, money } from '../views';
function at(value:any,timezone:string) {
  const offset=timezone==='Asia/Jayapura'?'+09:00':timezone==='Asia/Makassar'?'+08:00':'+07:00';
  return Date.parse(String(value)+offset);
}
function payload(body:any,timezone:string) {return {start_at:at(body.start_at,timezone),end_at:at(body.end_at,timezone),outlet_id:String(body.outlet_id||''),items:[{product_id:String(body.product_id||''),qty:Number(body.qty??1)}],bundle_id:body.bundle_id||undefined,bundle_qty:Number(body.qty??1),voucher_code:String(body.voucher_code||'')};}
export function checkoutRoutes(app:any,upload:any,rate:any) {
  async function form(c:any,body:any={},price='') {
    const store=await loadStore(c.env.DB),r=new Repo(c.env.DB,{role:'guest'}),csrf=randomToken();
    setCookie(c,'radix_booking_csrf',csrf,{httpOnly:true,secure:new URL(c.req.url).protocol==='https:',sameSite:'Lax',path:'/',maxAge:3600});
    const products=await r.all('SELECT id,name FROM products WHERE published=1 AND deleted_at IS NULL'),outlets=await r.records('outlet'),bundles=(await r.records('bundle')).filter(b=>b.active!==false);
    const requestedBundle=body.bundle_id||c.req.query('bundle');if(requestedBundle&&!bundles.some(b=>b.id===requestedBundle))fail('NOT_FOUND','Paket tidak aktif atau tidak ditemukan',404);
    return authPage('Booking alat outdoor',`<p>Harga dan ketersediaan diperiksa kembali saat booking dibuat.</p><form method="post" action="/booking/create" enctype="multipart/form-data" id="booking-basic"><input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="idempotency" value="${esc(body.idempotency||uid())}"><label>Produk<select name="product_id" required>${products.map(p=>`<option value="${esc(p.id)}" ${p.id===(body.product_id||c.req.query('product'))?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>Paket sewa (opsional)<select name="bundle_id" aria-label="Paket sewa (opsional)"><option value="">Gunakan produk di atas</option>${bundles.map(b=>`<option value="${esc(b.id)}" ${b.id===(body.bundle_id||c.req.query('bundle'))?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label><p>Jika paket dipilih, jumlah di bawah adalah jumlah paket.</p><label>Jumlah<input name="qty" type="number" min="1" max="100" value="${esc(body.qty||1)}" required></label><label>Outlet pengambilan<select name="outlet_id" required>${outlets.map(o=>`<option value="${esc(o.id)}" ${o.id===body.outlet_id?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label><label>Ambil (${esc(store.settings.timezone)})<input type="datetime-local" name="start_at" value="${esc(body.start_at||'')}" required></label><label>Kembali<input type="datetime-local" name="end_at" value="${esc(body.end_at||'')}" required></label><label>Kode voucher<input name="voucher_code" value="${esc(body.voucher_code||'')}"></label><button class="btn" type="submit" formaction="/checkout/quote" formnovalidate hx-post="/checkout/quote" hx-target="#checkout-quote" hx-swap="innerHTML">Periksa harga</button><div id="checkout-quote" role="status">${price}</div><label>Nama penyewa<input name="name" value="${esc(body.name||'')}" required maxlength="100" autocomplete="name"></label><label>Nomor WhatsApp<input name="phone" value="${esc(body.phone||'')}" required autocomplete="tel"></label><label>Email (opsional)<input name="email" type="email" value="${esc(body.email||'')}" autocomplete="email"></label><label>Alamat<input name="address" value="${esc(body.address||'')}" maxlength="500"></label><label>Foto identitas<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required></label><label><input name="consent" type="checkbox" required> Saya menyetujui <a href="/terms" target="_blank">syarat sewa dan kebijakan privasi</a>.</label><button class="btn primary" type="submit" ${store.settings.accepting_bookings?'':'disabled'}>Buat booking</button></form><p><a href="/catalog">Kembali ke katalog</a></p><script src="/htmx.js" defer></script>`);
  }
  app.get('/checkout',async(c:any)=>c.html(await form(c)));
  app.post('/checkout/quote',async(c:any)=>{
    const body=await c.req.parseBody(),store=await loadStore(c.env.DB);
    try {
      const result=await quote(new Repo(c.env.DB,{role:'guest'}),store.settings,payload(body,store.settings.timezone));
      const price=`<p><strong>Total ${money(result.total)}</strong><br>Durasi ${result.days} hari · DP ${money(result.dp)}</p>`;
      return c.html(c.req.header('HX-Request')?price:await form(c,body,price));
    }catch(error){
      const price='<p role="alert">'+esc((error as Error).message)+'</p>';
      return c.html(c.req.header('HX-Request')?price:await form(c,body,price),422);
    }
  });
  app.post('/booking/create',async(c:any)=>{
    await rate(c,'booking',10);const body=await c.req.parseBody();
    if(!body.csrf||body.csrf!==getCookie(c,'radix_booking_csrf'))fail('CSRF','Muat ulang halaman booking.',403);
    if(body.consent!=='on')fail('CONSENT_REQUIRED','Persetujuan penyimpanan identitas diperlukan.',422);
    const store=await loadStore(c.env.DB);
    if(!store.settings.accepting_bookings)fail('STORE_NOT_ACCEPTING_BOOKINGS','Penerimaan booking sedang dinonaktifkan.',409);
    const r=new Repo(c.env.DB,{role:'guest'}),idem=String(body.idempotency||'');
    if(!/^[a-f\d-]{36}$/.test(idem))fail('IDEMPOTENCY_REQUIRED','Token booking tidak valid.',422);
    const existing=await r.first('SELECT * FROM bookings WHERE idem=?',idem);
    const file=existing?null:await upload(c,r,'identity',uid());
    const booking=existing||await createBooking(r,store.settings,{...payload(body,store.settings.timezone),customer:{name:String(body.name||''),phone:String(body.phone||''),email:String(body.email||''),address:String(body.address||''),id_doc:file.id},consent:true},idem,'guest',true);
    return c.html(authPage('Booking berhasil',`<p>Simpan kode booking berikut:</p><h2>${esc(booking.code)}</h2><p>Total ${money(booking.total)} · DP ${money(booking.dp)}</p><p>Transfer ke ${esc(store.settings.bank_name)} ${esc(store.settings.bank_account)} atas nama ${esc(store.settings.bank_owner)}. Pembayaran diperiksa staf secara manual.</p><p><a href="/lookup">Cek status dan instruksi berikutnya</a></p>`),201);
  });
}

import { authPage as page } from '../views/auth';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { Repo, uid } from '../repo/index';
import { defaultSettings } from '../../../../packages/db/seed';
import { fail } from '../services/rental';
import { esc } from '../views/index';
import { z } from 'zod';
const encoder = new TextEncoder();
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export async function hashToken(token:string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token))),b=>b.toString(16).padStart(2,'0')).join(''); }
export async function hashPassword(password:string,salt=randomToken().slice(0,32)) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256);
  return `pbkdf2$100000$${salt}$${Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('')}`;
}
function equal(a:string,b:string) { let diff=a.length^b.length; for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0); return diff===0; }
export async function verifyPassword(password:string,stored:string) {
  const parts=stored.split('$');
  if(parts.length!==4||parts[0]!=='pbkdf2'||parts[1]!=='100000')return false;
  return equal(await hashPassword(password,parts[2]),stored);
}
export async function loadStore(db:D1Database) {
  const row=await new Repo(db,{role:'system'}).getStoreProfile();
  if(!row)fail('STORE_NOT_CONFIGURED','Jalankan migrasi database terlebih dahulu.',503);
  return {...row,settings:{...defaultSettings,...JSON.parse(row.settings_json)}};
}
const cookieOptions=(c:any,maxAge=43200)=>({httpOnly:true,secure:new URL(c.req.url).protocol==='https:',sameSite:'Lax' as const,path:'/',maxAge});
export async function requireSession(c:any,required=true) {
  const token=getCookie(c,'radix_session');
  const r=new Repo(c.env.DB,{role:'system'});
  const session=token?await r.first('SELECT s.id AS session_id,s.csrf_token,u.id,u.name,u.email,u.role,u.outlet_id,u.partner_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1',await hashToken(token),Date.now()):null;
  if(!session) { if(!required)return null; fail('UNAUTHORIZED','Silakan login untuk mengakses dashboard.',401); }
  if(['admin','warehouse'].includes(session.role)&&!session.outlet_id)fail('FORBIDDEN','Outlet staf belum ditetapkan. Hubungi Owner.',403);
  c.set('repo',new Repo(c.env.DB,{role:session.role,outletId:session.outlet_id,partnerId:session.partner_id},c.req.header('cf-connecting-ip')||''));
  c.set('member',{id:session.id,name:session.name,email:session.email,role:session.role,outlet_id:session.outlet_id,partner_id:session.partner_id});
  c.set('user',session.id); c.set('email',session.email);c.set('csrf',session.csrf_token);
  c.set('store',await loadStore(c.env.DB));
  await r.batch([r.stmt('UPDATE sessions SET expires_at=? WHERE id=?',Date.now()+43200000,session.session_id)]);
  setCookie(c,'radix_session',token!,cookieOptions(c));
  return session;
}
export async function csrfCheck(c:any) {
  if(['GET','HEAD','OPTIONS'].includes(c.req.method))return;
  let token=c.req.header('x-csrf-token');
  if(!token&&/application\/x-www-form-urlencoded|multipart\/form-data/.test(c.req.header('content-type')||''))token=(await c.req.parseBody()).csrf;
  if(!token||!equal(String(token),String(c.get('csrf')||'')))fail('CSRF','Formulir kedaluwarsa. Muat ulang halaman.',403);
}
const credentials=z.object({email:z.string().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(12).max(128)});
async function ensureOwner(c:any) {
  if(!c.env.INITIAL_OWNER_EMAIL||!c.env.INITIAL_OWNER_PASSWORD)return;
  const config=credentials.safeParse({email:c.env.INITIAL_OWNER_EMAIL,password:c.env.INITIAL_OWNER_PASSWORD});
  if(!config.success || config.data.password.startsWith('REPLACE_'))return fail('OWNER_CONFIG','Konfigurasi akun Owner belum valid (password minimal 12 karakter).',503);
  const r=new Repo(c.env.DB,{role:'system'});
  const existing=await r.first("SELECT id,password_hash FROM users WHERE role='owner' LIMIT 1");
  if(existing?.password_hash)return;
  const hashed=await hashPassword(config.data.password);
  // Legacy accounts have no application password; only the configured Owner can claim this account.
  if(existing)await r.batch([r.stmt("UPDATE users SET email=?,password_hash=? WHERE id=? AND password_hash IS NULL",config.data.email,hashed,existing.id)]);
  else await r.batch([r.stmt("INSERT OR IGNORE INTO users(id,email,name,role,active,password_hash) VALUES(?,?,'Owner Radix Outdoor','owner',1,?)",uid(),config.data.email,hashed)]);
}
export function authRoutes(app:any,rate:any) {
  app.get('/login',async(c:any)=>{
    const csrf=randomToken();setCookie(c,'radix_login_csrf',csrf,cookieOptions(c,900));
    return c.html(page('Login staf',`<p>Masuk sebagai Owner, staf, atau mitra Radix Outdoor.</p>${c.req.query('error')?'<p role="alert">Email atau kata sandi tidak cocok. Coba lagi.</p>':''}<form method="post" action="/api/v1/auth/login"><input type="hidden" name="csrf" value="${csrf}"><label>Email<input type="email" name="email" autocomplete="username" required></label><label>Kata sandi<input type="password" name="password" autocomplete="current-password" minlength="12" required></label><button class="btn primary full" type="submit">Masuk</button></form><p><a href="/">Kembali ke katalog</a></p>`));
  });
  app.post('/api/v1/auth/login',async(c:any)=>{
    await rate(c,'login',10);
    const body=await c.req.parseBody();
    if(!body.csrf||!equal(String(body.csrf),getCookie(c,'radix_login_csrf')||''))fail('CSRF','Muat ulang halaman login.',403);
    const parsed=credentials.safeParse(body);if(!parsed.success)return c.redirect('/login?error=1',303);
    await rate(c,'login-account-'+(await hashToken(parsed.data.email)).slice(0,16),5);
    await ensureOwner(c);
    const r=new Repo(c.env.DB,{role:'system'}), user=await r.first('SELECT * FROM users WHERE lower(email)=? AND active=1',parsed.data.email);
    // Equalize hashing work even for unknown accounts.
    const valid=user?.password_hash?await verifyPassword(parsed.data.password,user.password_hash):!!(await hashPassword(parsed.data.password))&&false;
    if(!valid)return c.redirect('/login?error=1',303);
    const token=randomToken();
    await r.batch([r.insert('sessions',{id:uid(),user_id:user.id,token_hash:await hashToken(token),csrf_token:randomToken(),expires_at:Date.now()+43200000,created_at:Date.now()}),r.stmt('UPDATE users SET last_login_at=? WHERE id=?',Date.now(),user.id),r.audit(user.id,'auth.login')]);
    setCookie(c,'radix_session',token,cookieOptions(c));deleteCookie(c,'radix_login_csrf',{path:'/'});
    return c.redirect('/admin/dashboard',303);
  });
  app.post('/api/v1/auth/logout',async(c:any)=>{
    const session=await requireSession(c);await csrfCheck(c);
    const r=new Repo(c.env.DB,{role:'system'});await r.batch([r.stmt('DELETE FROM sessions WHERE id=?',session.session_id),r.audit(session.id,'auth.logout')]);
    deleteCookie(c,'radix_session',{path:'/'});return c.redirect('/login',303);
  });
  app.get('/account/password',async(c:any)=>{
    if(!await requireSession(c,false))return c.redirect('/login');
    return c.html(page('Ubah kata sandi',`<form method="post" action="/api/v1/auth/password"><input type="hidden" name="csrf" value="${esc(c.get('csrf'))}"><label>Kata sandi saat ini<input type="password" name="current" autocomplete="current-password" required></label><label>Kata sandi baru<input type="password" name="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><button class="btn primary" type="submit">Simpan dan login ulang</button></form>`));
  });
  app.post('/api/v1/auth/password',async(c:any)=>{
    const session=await requireSession(c);await csrfCheck(c);await rate(c,'change-password',5);
    const body=z.object({current:z.string(),password:z.string().min(12).max(128)}).parse(await c.req.parseBody());
    const r=new Repo(c.env.DB,{role:'system'}),user=await r.first('SELECT password_hash FROM users WHERE id=?',session.id);
    if(!await verifyPassword(body.current,user.password_hash))fail('INVALID_PASSWORD','Kata sandi saat ini tidak cocok.',422);
    await r.batch([r.stmt('UPDATE users SET password_hash=? WHERE id=?',await hashPassword(body.password),session.id),r.stmt('DELETE FROM sessions WHERE user_id=?',session.id),r.audit(session.id,'auth.password_changed')]);
    deleteCookie(c,'radix_session',{path:'/'});return c.redirect('/login',303);
  });
}

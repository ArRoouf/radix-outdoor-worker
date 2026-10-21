import {z} from 'zod';
import {Repo} from '../repo';
import {fail} from './errors';
import {cartItems} from './inventory';
export async function cashierData(r:Repo){
 if(!['owner','admin'].includes(r.accessScope.role))fail('FORBIDDEN','Akses kasir ditolak',403);
 return {products:await r.all('SELECT id,name,price FROM products WHERE published=1 AND deleted_at IS NULL ORDER BY name'),outlets:await r.records('outlet'),bundles:(await r.records('bundle')).filter(b=>b.active!==false)};
}
export function cartForm(body:Record<string,any>){
 const items=Object.entries(body).filter(([k,v])=>k.startsWith('qty_')&&Number(v)!==0).map(([k,v])=>({product_id:k.slice(4),qty:Number(v)}));
 return cartItems.parse(items);
}
export async function receiptData(r:Repo,id:string){
 if(!['owner','admin'].includes(r.accessScope.role))fail('FORBIDDEN','Akses struk ditolak',403);
 const booking=await r.first('SELECT b.*,c.name AS customer_name FROM bookings b JOIN customers c ON c.id=b.customer_id WHERE b.id=?',id);
 if(!booking)fail('NOT_FOUND','Booking tidak ditemukan',404);
 return {booking,items:await r.all('SELECT product_name,days,total FROM items WHERE booking_id=? AND voided_at IS NULL',id),payments:await r.all("SELECT amount,method,kind FROM payments WHERE booking_id=? AND status='confirmed' ORDER BY created_at",id)};
}
export const paperWidth=z.enum(['58','80']);

// Mirrors the schema after the forward-only SQL migrations. Triggers remain in SQL.

import { sqliteTable, text, integer, index, uniqueIndex, primaryKey, check } from 'drizzle-orm/sqlite-core';

import { sql } from 'drizzle-orm';

export const storeProfile=sqliteTable('store_profile',{
  id: integer('id').primaryKey(),
  name: text('name').notNull().default('Radix Outdoor'),
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  currency: text('currency').notNull().default('IDR'),
  settings_json: text('settings_json').notNull().default('{}'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
},t=>[check('store_profile_constraint_0',sql`currency='IDR'`),check('store_profile_singleton',sql`${t.id}=1`)]);

export const users=sqliteTable('users',{
  id: text('id').primaryKey(),
  password_hash: text('password_hash'),
  last_login_at: integer('last_login_at'),
  user_id: text('user_id'),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  outlet_id: text('outlet_id'),
  partner_id: text('partner_id'),
  active: integer('active').notNull().default(1),
},t=>[check('users_constraint_0',sql`role IN('owner','admin','warehouse','partner')`),uniqueIndex('users_email_nocase').on(sql`lower(${t.email})`),uniqueIndex('ux_users_email').on(t.email)]);

export const records=sqliteTable('records',{
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  data: text('data').notNull(),
  deleted_at: integer('deleted_at'),
  created_at: integer('created_at').notNull(),
},t=>[index('records_business').on(t.kind,t.deleted_at),
  uniqueIndex('shift_active_user').on(sql`json_extract(${t.data},'$.user')`).where(sql`kind='shift' AND deleted_at IS NULL AND json_extract(data,'$.closed_at') IS NULL`),
  uniqueIndex('settlement_idempotency').on(sql`json_extract(${t.data},'$.idempotency_key')`).where(sql`kind='settlement'`),
]);

export const products=sqliteTable('products',{
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  brand: text('brand'),
  description: text('description'),
  price: integer('price').notNull(),
  image: text('image'),
  capacity: integer('capacity').notNull().default(1),
  buffer_hours: integer('buffer_hours'),
  published: integer('published').notNull().default(1),
  deleted_at: integer('deleted_at'),
  created_at: integer('created_at').notNull(),
  images: text('images').notNull().default('[]'),
},t=>[check('products_constraint_0',sql`price>=0`),index('products_business').on(t.deleted_at,t.category)]);

export const units=sqliteTable('units',{
  id: text('id').primaryKey(),
  product_id: text('product_id').notNull().references(()=>products.id),
  outlet_id: text('outlet_id').notNull(),
  code: text('code').notNull(),
  status: text('status').notNull().default('available'),
  condition_note: text('condition_note'),
  purchase_price: integer('purchase_price').notNull().default(0),
  partner_id: text('partner_id'),
  created_at: integer('created_at').notNull(),
},t=>[index('units_outlet_product').on(t.outlet_id,t.product_id,t.status),index('units_business').on(t.product_id,t.outlet_id,t.status),uniqueIndex('ux_units_code').on(t.code)]);

export const customers=sqliteTable('customers',{
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  address: text('address'),
  id_doc: text('id_doc'),
  blacklisted: integer('blacklisted').notNull().default(0),
  notes: text('notes'),
  segment: text('segment').notNull().default('baru'),
  created_at: integer('created_at').notNull(),
},t=>[index('customers_business').on(t.name),uniqueIndex('ux_customers_phone').on(t.phone)]);

export const bookings=sqliteTable('bookings',{
  id: text('id').primaryKey(),
  outlet_id: text('outlet_id').notNull(),
  customer_id: text('customer_id').notNull().references(()=>customers.id),
  code: text('code').notNull(),
  status: text('status').notNull().default('pending_payment'),
  channel: text('channel').notNull(),
  start_at: integer('start_at').notNull(),
  end_at: integer('end_at').notNull(),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  total: integer('total').notNull(),
  paid: integer('paid').notNull().default(0),
  dp: integer('dp').notNull().default(0),
  expires_at: integer('expires_at'),
  collateral: text('collateral').notNull().default('none'),
  collateral_type: text('collateral_type'),
  note: text('note'),
  idem: text('idem').notNull(),
  created_at: integer('created_at').notNull(),
},t=>[check('bookings_constraint_0',sql`total>=0`),check('bookings_constraint_1',sql`paid>=0 AND paid<=total`),index('bookings_outlet_status').on(t.outlet_id,t.status,t.start_at),index('bookings_business').on(t.status,t.start_at),uniqueIndex('ux_bookings_idem').on(t.idem),uniqueIndex('ux_bookings_code').on(t.code)]);

export const items=sqliteTable('items',{
  id: text('id').primaryKey(),
  booking_id: text('booking_id').notNull().references(()=>bookings.id),
  product_id: text('product_id').notNull(),
  unit_id: text('unit_id').notNull().references(()=>units.id),
  product_name: text('product_name').notNull(),
  price: integer('price').notNull(),
  days: integer('days').notNull(),
  total: integer('total').notNull(),
  returned_at: integer('returned_at'),
  condition: text('condition'),
  voided_at: integer('voided_at'),
},t=>[index('items_active').on(t.booking_id,t.voided_at),index('items_business').on(t.booking_id)]);

export const reservations=sqliteTable('reservations',{
  id: text('id').primaryKey(),
  unit_id: text('unit_id').notNull().references(()=>units.id),
  booking_id: text('booking_id'),
  start_at: integer('start_at').notNull(),
  end_at: integer('end_at').notNull(),
  kind: text('kind').notNull().default('booking'),
  released_at: integer('released_at'),
},t=>[check('reservations_constraint_0',sql`end_at>start_at`),index('reservations_business').on(t.unit_id,t.start_at,t.end_at).where(sql`released_at IS NULL`)]);

export const payments=sqliteTable('payments',{
  id: text('id').primaryKey(),
  booking_id: text('booking_id').notNull().references(()=>bookings.id),
  shift_id: text('shift_id').references(()=>records.id),
  amount: integer('amount').notNull(),
  method: text('method').notNull(),
  kind: text('kind').notNull().default('rental'),
  status: text('status').notNull().default('pending'),
  proof: text('proof'),
  idem: text('idem').notNull(),
  created_at: integer('created_at').notNull(),
},t=>[check('payments_constraint_0',sql`amount>0`),index('payments_shift').on(t.shift_id,t.status),index('payments_business').on(t.status,t.booking_id),uniqueIndex('ux_payments_idem').on(t.idem)]);

export const ledger=sqliteTable('ledger',{
  id: text('id').primaryKey(),
  booking_id: text('booking_id'),
  account: text('account').notNull(),
  direction: text('direction').notNull(),
  amount: integer('amount').notNull(),
  reference: text('reference'),
  note: text('note'),
  created_at: integer('created_at').notNull(),
},t=>[check('ledger_constraint_0',sql`direction IN('in','out')`),check('ledger_constraint_1',sql`amount>0`),index('ledger_business').on(t.created_at),uniqueIndex('ux_ledger_reference').on(t.reference)]);

export const settlementEntries=sqliteTable('settlement_entries',{
  ledger_id:text('ledger_id').primaryKey().references(()=>ledger.id),
  settlement_id:text('settlement_id').notNull().references(()=>records.id),
},t=>[index('settlement_entries_parent').on(t.settlement_id)]);

export const statusLogs=sqliteTable('status_logs',{
  id: text('id').primaryKey(),
  booking_id: text('booking_id').notNull(),
  status: text('status').notNull(),
  note: text('note'),
  created_at: integer('created_at').notNull(),
},t=>[index('logs_business').on(t.booking_id,t.created_at)]);

export const audit=sqliteTable('audit',{
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  action: text('action').notNull(),
  entity_id: text('entity_id'),
  ip: text('ip'),
  created_at: integer('created_at').notNull(),
},t=>[index('audit_business').on(t.created_at)]);

export const uploads=sqliteTable('uploads',{
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  owner_token: text('owner_token').notNull(),
  mime: text('mime').notNull(),
  created_at: integer('created_at').notNull(),
  storage_key: text('storage_key'),
  storage_bucket: text('storage_bucket').notNull().default('private'),
},t=>[check('uploads_constraint_0',sql`storage_bucket IN('private','public')`),index('uploads_business').on(t.kind)]);

export const rateLimits=sqliteTable('rate_limits',{
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expires_at: integer('expires_at').notNull(),
});

export const operationKeys=sqliteTable('operation_keys',{
  key: text('key').primaryKey().notNull(),
});

export const sessions=sqliteTable('sessions',{
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(()=>users.id),
  token_hash: text('token_hash').notNull(),
  csrf_token: text('csrf_token').notNull(),
  expires_at: integer('expires_at').notNull(),
  created_at: integer('created_at').notNull(),
},t=>[index('sessions_expiry').on(t.expires_at),uniqueIndex('ux_sessions_token_hash').on(t.token_hash)]);

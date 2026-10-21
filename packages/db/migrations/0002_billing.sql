ALTER TABLE tenants ADD COLUMN period_end INTEGER;
CREATE TABLE plans(id TEXT PRIMARY KEY,name TEXT NOT NULL,price INTEGER,limits TEXT NOT NULL,features TEXT NOT NULL DEFAULT '{}');
CREATE TABLE billing_invoices(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,plan_id TEXT NOT NULL,number TEXT NOT NULL UNIQUE,amount INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'issued',proof TEXT,period_start INTEGER NOT NULL,period_end INTEGER NOT NULL,created_at INTEGER NOT NULL,confirmed_at INTEGER,reason TEXT);
CREATE INDEX billing_tenant ON billing_invoices(tenant_id,created_at);
CREATE TABLE platform_announcements(id TEXT PRIMARY KEY,title TEXT NOT NULL,message TEXT NOT NULL,created_at INTEGER NOT NULL);

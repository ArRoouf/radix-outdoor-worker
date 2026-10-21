ALTER TABLE items ADD COLUMN voided_at INTEGER;
CREATE INDEX items_active ON items(tenant_id,booking_id,voided_at);

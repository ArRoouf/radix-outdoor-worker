-- Additive migration approved by Owner: historical cash payments remain unassigned.
ALTER TABLE payments ADD COLUMN shift_id TEXT REFERENCES records(id);
CREATE INDEX payments_shift ON payments(shift_id,status);
-- Refuse a migration with ambiguous legacy active shifts rather than rewriting cash history.
CREATE UNIQUE INDEX shift_active_user ON records(json_extract(data,'$.user'))
WHERE kind='shift' AND deleted_at IS NULL AND json_extract(data,'$.closed_at') IS NULL;
CREATE UNIQUE INDEX settlement_idempotency ON records(json_extract(data,'$.idempotency_key')) WHERE kind='settlement';
CREATE TABLE settlement_entries (
  ledger_id TEXT PRIMARY KEY NOT NULL REFERENCES ledger(id),
  settlement_id TEXT NOT NULL REFERENCES records(id)
);
CREATE INDEX settlement_entries_parent ON settlement_entries(settlement_id);
-- Preserve claims belonging to already-paid settlements, with no second payout.
INSERT INTO settlement_entries(ledger_id,settlement_id)
SELECT j.value,r.id FROM records r,json_each(json_extract(r.data,'$.entries')) j WHERE r.kind='settlement';
CREATE TRIGGER settlement_entries_no_update BEFORE UPDATE ON settlement_entries BEGIN SELECT RAISE(ABORT,'SETTLEMENT_IMMUTABLE'); END;
CREATE TRIGGER settlement_entries_no_delete BEFORE DELETE ON settlement_entries BEGIN SELECT RAISE(ABORT,'SETTLEMENT_IMMUTABLE'); END;
CREATE TRIGGER settlement_entry_valid BEFORE INSERT ON settlement_entries
WHEN NOT EXISTS (
  SELECT 1 FROM records s JOIN ledger l ON l.id=NEW.ledger_id
  JOIN items i ON l.reference='partner-'||i.id JOIN units u ON u.id=i.unit_id
  WHERE s.id=NEW.settlement_id AND s.kind='settlement' AND s.deleted_at IS NULL
  AND json_extract(s.data,'$.status')='draft' AND l.account='partner_payable' AND l.direction='out'
  AND i.booking_id=l.booking_id AND u.partner_id=json_extract(s.data,'$.partner_id')
  AND l.created_at>=json_extract(s.data,'$.period_start') AND l.created_at<json_extract(s.data,'$.period_end')
) BEGIN SELECT RAISE(ABORT,'INVALID_SETTLEMENT_ENTRY'); END;
CREATE TRIGGER settlement_frozen BEFORE UPDATE ON records WHEN OLD.kind='settlement'
AND (json_extract(OLD.data,'$.status')='paid' OR NEW.kind<>'settlement' OR NEW.deleted_at IS NOT OLD.deleted_at
OR json_extract(NEW.data,'$.gross') IS NOT json_extract(OLD.data,'$.gross')
OR json_extract(NEW.data,'$.net') IS NOT json_extract(OLD.data,'$.net')
OR json_extract(NEW.data,'$.partner_id') IS NOT json_extract(OLD.data,'$.partner_id')
OR json_extract(NEW.data,'$.deductions') IS NOT json_extract(OLD.data,'$.deductions')
OR json_extract(NEW.data,'$.period_start') IS NOT json_extract(OLD.data,'$.period_start')
OR json_extract(NEW.data,'$.period_end') IS NOT json_extract(OLD.data,'$.period_end'))
BEGIN SELECT RAISE(ABORT,'SETTLEMENT_IMMUTABLE'); END;
CREATE TRIGGER settlement_pay_valid BEFORE UPDATE ON records WHEN OLD.kind='settlement' AND json_extract(NEW.data,'$.status')='paid'
AND (json_extract(NEW.data,'$.gross')<>(SELECT COALESCE(SUM(l.amount),0) FROM settlement_entries se JOIN ledger l ON l.id=se.ledger_id WHERE se.settlement_id=OLD.id)
OR json_extract(NEW.data,'$.net')<>json_extract(NEW.data,'$.gross')-json_extract(NEW.data,'$.deductions'))
BEGIN SELECT RAISE(ABORT,'INVALID_SETTLEMENT_TOTAL'); END;
CREATE TRIGGER payment_shift_insert BEFORE INSERT ON payments WHEN NEW.shift_id IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM records s JOIN bookings b ON b.id=NEW.booking_id WHERE s.id=NEW.shift_id AND s.kind='shift' AND s.deleted_at IS NULL
AND json_extract(s.data,'$.closed_at') IS NULL AND json_extract(s.data,'$.outlet_id')=b.outlet_id AND NEW.method='cash')
BEGIN SELECT RAISE(ABORT,'SHIFT_CLOSED'); END;
CREATE TRIGGER payment_shift_update BEFORE UPDATE ON payments WHEN NEW.shift_id IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM records s JOIN bookings b ON b.id=NEW.booking_id WHERE s.id=NEW.shift_id AND s.kind='shift' AND s.deleted_at IS NULL
AND json_extract(s.data,'$.closed_at') IS NULL AND json_extract(s.data,'$.outlet_id')=b.outlet_id AND NEW.method='cash')
BEGIN SELECT RAISE(ABORT,'SHIFT_CLOSED'); END;
CREATE TRIGGER expense_shift_insert BEFORE INSERT ON records WHEN NEW.kind='expense' AND json_extract(NEW.data,'$.shift_id') IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM records s WHERE s.id=json_extract(NEW.data,'$.shift_id') AND s.kind='shift' AND s.deleted_at IS NULL
AND json_extract(s.data,'$.closed_at') IS NULL AND json_extract(s.data,'$.outlet_id')=json_extract(NEW.data,'$.outlet_id'))
BEGIN SELECT RAISE(ABORT,'SHIFT_CLOSED'); END;
CREATE TRIGGER expense_shift_frozen BEFORE UPDATE ON records WHEN OLD.kind='expense' AND json_extract(OLD.data,'$.shift_id') IS NOT NULL
BEGIN SELECT RAISE(ABORT,'CASH_EXPENSE_IMMUTABLE'); END;
CREATE TRIGGER closed_shift_frozen BEFORE UPDATE ON records WHEN OLD.kind='shift' AND json_extract(OLD.data,'$.closed_at') IS NOT NULL
BEGIN SELECT RAISE(ABORT,'SHIFT_CLOSED'); END;

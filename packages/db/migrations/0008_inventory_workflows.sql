-- Approved additive guards. Inventory snapshots remain typed records.
CREATE TRIGGER opname_final_update BEFORE UPDATE ON records WHEN OLD.kind='opname' AND json_extract(OLD.data,'$.status')='final'
BEGIN SELECT RAISE(ABORT,'OPNAME_FINAL'); END;
CREATE TRIGGER opname_final_delete BEFORE DELETE ON records WHEN OLD.kind='opname' AND json_extract(OLD.data,'$.status')='final'
BEGIN SELECT RAISE(ABORT,'OPNAME_FINAL'); END;
CREATE TRIGGER withdrawal_final_update BEFORE UPDATE ON records WHEN OLD.kind='withdrawal'
BEGIN SELECT RAISE(ABORT,'WITHDRAWAL_FINAL'); END;
CREATE TRIGGER withdrawal_final_delete BEFORE DELETE ON records WHEN OLD.kind='withdrawal'
BEGIN SELECT RAISE(ABORT,'WITHDRAWAL_FINAL'); END;
CREATE TRIGGER withdrawal_unit_guard BEFORE INSERT ON records
WHEN NEW.kind='movement' AND json_extract(NEW.data,'$.kind')='withdrawal'
AND NOT EXISTS(SELECT 1 FROM units u WHERE u.id=json_extract(NEW.data,'$.unit_id') AND u.status='available' AND u.partner_id=json_extract(NEW.data,'$.partner_id'))
BEGIN SELECT RAISE(ABORT,'WITHDRAWAL_UNIT_CHANGED'); END;
CREATE TRIGGER reservation_unit_eligible BEFORE INSERT ON reservations WHEN NEW.kind='booking'
AND NOT EXISTS(SELECT 1 FROM units WHERE id=NEW.unit_id AND status='available')
BEGIN SELECT RAISE(ABORT,'UNIT_NOT_AVAILABLE'); END;
CREATE TRIGGER unit_reserved_retirement BEFORE UPDATE OF status,outlet_id ON units
WHEN (NEW.status='retired' OR NEW.outlet_id<>OLD.outlet_id) AND EXISTS(
 SELECT 1 FROM reservations r LEFT JOIN bookings b ON b.id=r.booking_id
 WHERE r.unit_id=OLD.id AND r.released_at IS NULL AND (r.end_at>CAST(strftime('%s','now') AS INTEGER)*1000
 OR (b.status='picked_up' AND EXISTS(SELECT 1 FROM items i WHERE i.booking_id=b.id AND i.unit_id=OLD.id AND i.returned_at IS NULL AND i.voided_at IS NULL)))
) BEGIN SELECT RAISE(ABORT,'UNIT_RESERVED'); END;
CREATE TRIGGER withdrawn_unit_frozen BEFORE UPDATE OF status,partner_id ON units
WHEN (NEW.status<>'retired' OR NEW.partner_id IS NOT OLD.partner_id) AND EXISTS(
 SELECT 1 FROM records w,json_each(json_extract(w.data,'$.units')) j WHERE w.kind='withdrawal' AND json_extract(j.value,'$.id')=OLD.id
) BEGIN SELECT RAISE(ABORT,'WITHDRAWAL_FINAL'); END;
CREATE TRIGGER opname_adjust_guard BEFORE INSERT ON records
WHEN NEW.kind='movement' AND json_extract(NEW.data,'$.source')='opname' AND json_extract(NEW.data,'$.adjusted')=1
AND (NOT EXISTS(SELECT 1 FROM units u WHERE u.id=json_extract(NEW.data,'$.unit_id') AND u.status=json_extract(NEW.data,'$.expected_status') AND u.outlet_id=json_extract(NEW.data,'$.outlet_id'))
OR EXISTS(SELECT 1 FROM reservations r LEFT JOIN bookings b ON b.id=r.booking_id WHERE r.unit_id=json_extract(NEW.data,'$.unit_id') AND r.released_at IS NULL AND (r.end_at>CAST(strftime('%s','now') AS INTEGER)*1000 OR (b.status='picked_up' AND EXISTS(SELECT 1 FROM items i WHERE i.booking_id=b.id AND i.unit_id=r.unit_id AND i.returned_at IS NULL AND i.voided_at IS NULL)))))
BEGIN SELECT RAISE(ABORT,'OPNAME_UNIT_CHANGED_OR_RESERVED'); END;

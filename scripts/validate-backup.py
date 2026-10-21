"""Restore a Radix Outdoor JSON backup into temporary SQLite; never connects remotely."""
import json
import pathlib
import sqlite3
import sys

backup = json.loads(pathlib.Path(sys.argv[1]).read_text())
assert backup['format'] == 'radix-outdoor-backup-v1'
db = sqlite3.connect(':memory:')
for file in sorted(pathlib.Path('packages/db/migrations').glob('*.sql')):
    db.executescript(file.read_text())
allowed = {'products','units','customers','bookings','items','reservations','payments','ledger','status_logs','records','audit','uploads','operation_keys','users','settlement_entries'}

def insert(table, row):
    columns = {c[1] for c in db.execute('PRAGMA table_info(' + table + ')')}
    assert set(row).issubset(columns)
    cols = list(row)
    db.execute('INSERT INTO ' + table + ' (' + ','.join(cols) + ') VALUES (' + ','.join('?' for _ in cols) + ')', [row[k] for k in cols])

assert backup['store']['id'] == 1
# Restore-only guards: historical receipts legitimately reference shifts now closed,
# and settlement claims may already be paid. Reinstall guards after importing.
restore_guards = ['payment_shift_insert', 'expense_shift_insert', 'settlement_entry_valid', 'reservation_unit_eligible', 'opname_adjust_guard', 'withdrawal_unit_guard']
triggers = [db.execute("SELECT sql FROM sqlite_master WHERE name=?", (name,)).fetchone()[0] for name in restore_guards]
for name in restore_guards:
    db.execute('DROP TRIGGER ' + name)
# The restore target is an empty, freshly migrated database.
db.execute('DELETE FROM store_profile')
insert('store_profile', backup['store'])
for table in ['users','records','products','units','customers','bookings','items','reservations','payments','ledger','status_logs','audit','uploads','operation_keys','settlement_entries']:
    assert table in allowed
    for row in backup['tables'].get(table, []):
        insert(table, row)
if 'settlement_entries' not in backup['tables']:
    db.execute("INSERT INTO settlement_entries(ledger_id,settlement_id) SELECT j.value,r.id FROM records r,json_each(json_extract(r.data,'$.entries')) j WHERE r.kind='settlement'")
for trigger in triggers:
    db.execute(trigger)
assert db.execute("SELECT COUNT(*) FROM payments p LEFT JOIN records s ON s.id=p.shift_id LEFT JOIN bookings b ON b.id=p.booking_id WHERE p.shift_id IS NOT NULL AND (s.id IS NULL OR s.kind<>'shift' OR p.method<>'cash' OR json_extract(s.data,'$.outlet_id')<>b.outlet_id)").fetchone()[0] == 0
assert db.execute('PRAGMA foreign_key_check').fetchall() == []
assert db.execute('SELECT COUNT(*) FROM reservations a JOIN reservations b ON a.id<b.id AND a.unit_id=b.unit_id AND a.released_at IS NULL AND b.released_at IS NULL AND a.start_at<b.end_at AND b.start_at<a.end_at').fetchone()[0] == 0
assert sum(r['amount'] for r in backup['tables']['ledger']) == db.execute('SELECT COALESCE(SUM(amount),0) FROM ledger').fetchone()[0]
print(json.dumps({'restore':'passed','tables':len(backup['tables']),'foreign_keys':'valid','active_overlaps':0}))

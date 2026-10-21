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
allowed = {'products','units','customers','bookings','items','reservations','payments','ledger','status_logs','records','audit','uploads','operation_keys','users'}

def insert(table, row):
    columns = {c[1] for c in db.execute('PRAGMA table_info(' + table + ')')}
    assert set(row).issubset(columns)
    cols = list(row)
    db.execute('INSERT INTO ' + table + ' (' + ','.join(cols) + ') VALUES (' + ','.join('?' for _ in cols) + ')', [row[k] for k in cols])

assert backup['store']['id'] == 1
# The restore target is an empty, freshly migrated database.
db.execute('DELETE FROM store_profile')
insert('store_profile', backup['store'])
for table in ['users','records','products','units','customers','bookings','items','reservations','payments','ledger','status_logs','audit','uploads','operation_keys']:
    assert table in allowed
    for row in backup['tables'].get(table, []):
        insert(table, row)
assert db.execute('PRAGMA foreign_key_check').fetchall() == []
assert db.execute('SELECT COUNT(*) FROM reservations a JOIN reservations b ON a.id<b.id AND a.unit_id=b.unit_id AND a.released_at IS NULL AND b.released_at IS NULL AND a.start_at<b.end_at AND b.start_at<a.end_at').fetchone()[0] == 0
assert sum(r['amount'] for r in backup['tables']['ledger']) == db.execute('SELECT COALESCE(SUM(amount),0) FROM ledger').fetchone()[0]
print(json.dumps({'restore':'passed','tables':len(backup['tables']),'foreign_keys':'valid','active_overlaps':0}))

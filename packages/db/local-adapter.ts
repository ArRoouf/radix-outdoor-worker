import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export class SQLiteD1 {
    db: DatabaseSync;
    constructor(path=":memory:", migrate=true) {
        this.db=new DatabaseSync(path);
        if(!migrate)return;
        for (const f of readdirSync('packages/db/migrations').filter(f=>f.endsWith('.sql')).sort())
            this.db.exec(readFileSync("packages/db/migrations/" + f, "utf8"));
    }
    prepare(sql: string) {
        return new Statement(this, sql);
    }
    async batch(stmts: Statement[]) {
        this.db.exec("BEGIN IMMEDIATE");
        try {
            const out = stmts.map((s) => s.runSync());
            this.db.exec("COMMIT");
            return out;
        }
        catch (e) {
            this.db.exec("ROLLBACK");
            throw e;
        }
    }
}
class Statement {
    args: any[] = [];
    constructor(public owner: SQLiteD1, public sql: string) { }
    bind(...args: any[]) {
        this.args = args;
        return this;
    }
    prepared() {
        let counter = 0;
        const args: any[] = [];
        const sql = this.sql.replace(/\?(\d+)?/g, (_, index) => {
            args.push(this.args[index ? Number(index) - 1 : counter++]);
            return "?";
        });
        return {
            stmt: this.owner.db.prepare(sql),
            args: args.map((a) => (a === undefined ? null : a)),
        };
    }
    runSync() {
        const { stmt, args } = this.prepared();
        return { success: true, meta: stmt.run(...args) };
    }
    async run() {
        return this.runSync();
    }
    async first() {
        const { stmt, args } = this.prepared();
        return stmt.get(...args) || null;
    }
    async all() {
        const { stmt, args } = this.prepared();
        return { results: stmt.all(...args) };
    }
}

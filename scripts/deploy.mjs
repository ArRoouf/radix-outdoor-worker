// Workers Builds entry point: provision named resources, migrate, then deploy.
// Never deploys with development credentials or a local-login bypass.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const wrangler=resolve('node_modules/wrangler/bin/wrangler.js');
function run(args) { return execFileSync(process.execPath,[wrangler,...args],{encoding:'utf8',env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']}); }
process.on('uncaughtException',error=>{console.error(error.stderr?String(error.stderr):error.message);process.exit(1);});
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const output=run(['d1','list','--json']);
const databases=JSON.parse(output.slice(output.indexOf('['),output.lastIndexOf(']')+1));
const name=config.d1_databases[0].database_name;
let db=databases.find(d=>d.name===name);
if(!db){
  const created=run(['d1','create',name,'--location','apac','--update-config=false']);
  const uuid=created.match(/"database_id"\s*:\s*"([a-f\d-]+)"/i)?.[1];
  if(!uuid)throw new Error('Database dibuat, tetapi ID tidak ditemukan. Masukkan database_id dari dashboard ke wrangler.jsonc.');
  db={uuid};
}
config.d1_databases[0].database_id=db.uuid;
const buckets=run(['r2','bucket','list']);
for(const {bucket_name} of config.r2_buckets) {
  if(!new RegExp('(?:^|\\s)'+bucket_name+'(?:\\s|$)').test(buckets))process.stdout.write(run(['r2','bucket','create',bucket_name]));
}
// Queue creation is explicit so repeated builds reuse the same queue.
const queueName=config.queues.producers[0].queue;
try { run(['queues','info',queueName]); }
catch(error) {
  if(!/not found|does not exist|does not match/i.test(String(error.stderr)))throw error;
  process.stdout.write(run(['queues','create',queueName]));
}
// Resolve paths because the deployment config lives in an ignored directory.
config.main=resolve(config.main);config.assets.directory=resolve(config.assets.directory);
config.d1_databases[0].migrations_dir=resolve(config.d1_databases[0].migrations_dir);
delete config.env;delete config.$schema;
mkdirSync('.wrangler',{recursive:true});
const path=resolve('.wrangler/deploy.json');writeFileSync(path,JSON.stringify(config,null,2));
process.stdout.write(run(['d1','migrations','apply','DB','--remote','--config',path]));
process.stdout.write(run(['deploy','--config',path]));

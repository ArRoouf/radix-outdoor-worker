import { build } from 'esbuild';
import { mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
async function find(path) {const out=[];for(const e of await readdir(path,{withFileTypes:true})){if(e.isDirectory())out.push(...await find(path+'/'+e.name));else if(e.name.endsWith('.sqlite') && e.name!=='metadata.sqlite')out.push(path+'/'+e.name);}return out;}
const databases=await find('.wrangler/state/v3/d1').catch(()=>[]);
if(databases.length!==1)throw new Error('Jalankan npm run db:migrate:local dahulu. Seed hanya untuk satu D1 lokal, tidak pernah remote.');
await mkdir('.wrangler',{recursive:true});
const entry=`import {SQLiteD1} from './packages/db/local-adapter.ts';import {seedDemo} from './packages/db/seed.ts';await seedDemo(new SQLiteD1(${JSON.stringify(resolve(databases[0]))},false));console.log('Data contoh Radix Outdoor ditambahkan ke database lokal.');`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'seed-local.ts'},outfile:'.wrangler/seed-local.mjs',bundle:true,platform:'node',format:'esm',target:'node22'});
await import(resolve('.wrangler/seed-local.mjs'));

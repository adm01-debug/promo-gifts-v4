import fs from 'fs';import path from 'path';
const repo=process.cwd();const raw=fs.readFileSync('e2e/routes/_catalog.ts','utf8');
function extractArray(name){
 const decl=`export const ${name}: RouteEntry[] = [`; const start=raw.indexOf(decl); if(start<0)return[];
 let i=raw.indexOf('[', start+decl.length-1); let d=0,e=i;
 for(;e<raw.length;e++){if(raw[e]=='[')d++; if(raw[e]==']'){d--; if(d===0){e++;break;}}}
 const slice=raw.slice(i,e); const entries=[];
 const regex=/\{\s*path:\s*([^,]+),([\s\S]*?)\}\s*,?/g; let m;
 while((m=regex.exec(slice))){const pathExpr=m[1].trim(); const rest=m[2];
 let p=pathExpr.replace(/[`"]+/g,'').replace(/\$\{SAMPLE_ID\}/g,'00000000-0000-0000-0000-000000000001').replace(/\$\{SAMPLE_TOKEN\}/g,'VALID_TOKEN');
 entries.push({path:p, area:(/area:\s*"([^"]+)"/.exec(rest)||[])[1]||'', feature:(/feature:\s*"([^"]+)"/.exec(rest)||[])[1]||'', smoke:/smoke:\s*true/.test(rest)});
 }
 return entries;
}
const critical=[...extractArray('APP_ROUTES').filter(r=>r.smoke),...extractArray('QUOTES_ROUTES').filter(r=>r.smoke),...extractArray('ADMIN_ROUTES'),...extractArray('PUBLIC_ROUTES').filter(r=>['/login','/reset-password'].includes(r.path))];
const testFiles=[]; const walk=d=>{for(const ent of fs.readdirSync(d,{withFileTypes:true})){const fp=path.join(d,ent.name); if(ent.isDirectory())walk(fp); else if(/\.(spec|test)\.(ts|tsx)$/.test(ent.name))testFiles.push(fp)}}; walk('e2e'); walk('tests');
const rows=critical.map(route=>{const hits=[]; for(const tf of testFiles){const rel=tf.replace(/\\/g,'/'); const t=fs.readFileSync(tf,'utf8'); if(t.includes(route.path)) hits.push(rel);} return {...route,hits,status:hits.length?'hit':'miss'};});
const total=rows.length,hit=rows.filter(r=>r.status==='hit').length,miss=total-hit,pct=((hit/total)*100).toFixed(1);
let md=`# Matriz rota↔teste (rotas críticas)\n\n- Cobertura por rota (hit/miss): **${hit}/${total} = ${pct}%**\n- Gaps (miss): **${miss}**\n\n| Rota | Área | Feature | Status | Testes que exercitam |\n|---|---|---|---|---|\n`;
for(const r of rows){md+=`| \`${r.path}\` | ${r.area} | ${r.feature||'-'} | ${r.status==='hit'?'✅ hit':'❌ miss'} | ${r.hits.slice(0,6).map(h=>`\`${h}\``).join('<br>')||'-'} |\n`;}
fs.mkdirSync('artifacts',{recursive:true}); fs.writeFileSync('artifacts/route-test-matrix.md',md); fs.writeFileSync('artifacts/route-test-matrix.json',JSON.stringify({summary:{total,hit,miss,coveragePct:Number(pct)},rows},null,2));
console.log(`Generated ${hit}/${total}`)

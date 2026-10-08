import fs from 'node:fs/promises';
const origin = process.env.VERIFY_ORIGIN ?? 'http://127.0.0.1:3211';
const oldCsv = await fs.readFile('docs/production/evidence/historical-seo-inventory.csv', 'utf8');
const oldPaths = oldCsv.split('\n').slice(1).filter(Boolean).map(row => row.split(',')[0].replaceAll('"',''));
const manifest = JSON.parse(await fs.readFile('.next/prerender-manifest.json','utf8'));
const routeCsv = await fs.readFile('docs/production/ROUTES.csv','utf8');
const sourcePaths = routeCsv.split('\n').slice(1).filter(Boolean).map(row => row.split(',')[0]).filter(p => !p.includes('[') && !p.startsWith('/api/'));
const paths = [...new Set([...oldPaths, ...Object.keys(manifest.routes), ...sourcePaths, '/non-esiste-qa', '/demo-venditore.html', '/robots.txt', '/sitemap.xml'])].sort();
const results = [];
for (const path of paths) {
  const response = await fetch(new URL(path,origin), { redirect:'manual' });
  const body = await response.text();
  const meta = [...body.matchAll(/<meta\s+([^>]+)>/g)].map(m=>m[1]);
  const robots = meta.find(x=>x.includes('name="robots"'))?.match(/content="([^"]*)"/)?.[1];
  const schemas = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=> { try { const value=JSON.parse(m[1]);return {valid:true,type:value['@type']}; } catch {return {valid:false};} });
  results.push({path,status:response.status,location:response.headers.get('location'),title:body.match(/<title>(.*?)<\/title>/)?.[1],h1:body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]*>/g,''),canonical:body.match(/<link rel="canonical" href="([^"]+)"/)?.[1],robots,schemas,csp:Boolean(response.headers.get('content-security-policy')),cache:response.headers.get('cache-control')});
}
const api = [];
for (const [path,method] of [['/api/platform/projects','GET'],['/api/auth/get-session','GET'],['/api/analisi','POST'],['/api/preventivo','POST'],['/api/contatto','POST'],['/api/agenzie','POST'],['/api/lista-attesa','POST'],['/api/checkout','POST'],['/api/webhooks/stripe','POST'],['/api/cron','GET']]) {
 const response=await fetch(new URL(path,origin),{method,headers:{origin,'content-type':'application/json'},...(method==='POST'?{body:'{}'}:{})});
 api.push({path,method,status:response.status,cache:response.headers.get('cache-control')});
 if(response.status!==503) throw new Error(`${path}: expected controlled dependency failure, got ${response.status}`);
}
const invalid = results.filter(r=>r.path==='/non-esiste-qa'||r.path==='/demo-venditore.html'||r.path.startsWith('/casi-studio/'));
if(invalid.some(r=>r.status!==404)) throw new Error('Invalid/case/demo URL must be 404');
if(results.some(r=>r.status>=500)) throw new Error('Public route failed');
if(results.filter(r=>r.status===200 && r.title).some(r=>!r.robots?.includes('noindex')||!r.canonical?.startsWith('https://proemios.it')||r.schemas.some(s=>!s.valid))) throw new Error('Preview metadata mismatch');
const evidence={date:new Date().toISOString(),origin,environment:'local production build, no configured providers',historicalPaths:oldPaths.length,routes:results,api,limitations:['HTTP/SSR verification, no JavaScript rendering or authenticated provider/browser flow','No Lighthouse/WCAG certification']};
await fs.writeFile('docs/production/evidence/runtime.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({paths:results.length,api:api.length,statuses:results.reduce((a,r)=>({...a,[r.status]:(a[r.status]??0)+1}),{}),metadata:'all public HTML noindex, canonical proemios.it, JSON-LD parseable',missingProviders:'all API dependencies fail 503'}));

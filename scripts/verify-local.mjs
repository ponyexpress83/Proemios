import { spawn } from 'node:child_process';
const server = spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3211'],{stdio:['ignore','pipe','pipe'],env:{...process.env,APP_URL:'http://127.0.0.1:3211',DEMO_MODE:'off'}});
try {
 await new Promise((resolve,reject)=>{ const timeout=setTimeout(()=>reject(new Error('server start timeout')),20000); server.stdout.on('data',chunk=>{if(String(chunk).includes('Ready')){clearTimeout(timeout);resolve();}});server.on('exit',code=>{clearTimeout(timeout);reject(new Error(`server exited ${code}`));});server.stderr.on('data',()=>{}); });
 await import('./verify-runtime.mjs');
} finally { server.kill('SIGTERM'); }

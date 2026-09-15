// Private bootstrap/reconnect only. No credential values enter argv or logs.
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {encryptAuth,validateAuth} from '../codex/vault.ts';
const privateDir=join(homedir(),'Library/Application Support/LearningThreads');
await mkdir(privateDir,{recursive:true,mode:0o700});
const keyPath=join(privateDir,'codex-vault-key'),envelopePath=join(privateDir,'codex-auth.enc');
let key;
try{key=await readFile(keyPath,'utf8')}catch(error){if(error.code!=='ENOENT')throw error;key=randomBytes(32).toString('base64url');await writeFile(keyPath,key,{mode:0o600})}
await chmod(keyPath,0o600);
const auth=await readFile(process.argv[2]||join(homedir(),'.codex/auth.json'),'utf8');validateAuth(auth);
await writeFile(envelopePath,await encryptAuth(auth,key),{mode:0o600});await chmod(envelopePath,0o600);
function wrangler(args,input){const result=spawnSync('npx',['wrangler',...args],{input,encoding:'utf8'});if(result.status!==0)throw new Error('Wrangler failed: '+result.stderr);process.stdout.write(result.stdout)}
wrangler(['secret','put','CODEX_AUTH_ENCRYPTION_KEY','--config','wrangler.codex.jsonc'],key);
wrangler(['r2','object','put','learning-threads-codex/credentials/auth.v1.enc','--file',envelopePath,'--remote','--config','wrangler.codex.jsonc']);
console.log('Encrypted OAuth login installed. No API key was used.');

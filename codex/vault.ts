const bytes=new TextEncoder();
const base64=(value:Uint8Array)=>btoa(String.fromCharCode(...value));
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function key(secret:string){
  if(secret.length<32)throw new Error('The Codex credential encryption key is missing.');
  return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',bytes.encode(secret)),'AES-GCM',false,['encrypt','decrypt']);
}
export function validateAuth(raw:string){
  const auth=JSON.parse(raw);
  if(auth.auth_mode!=='chatgpt'||auth.OPENAI_API_KEY||!auth.tokens?.access_token||!auth.tokens?.refresh_token)throw new Error('A ChatGPT OAuth login is required; no API-key fallback is allowed.');
  return auth;
}
export async function encryptAuth(raw:string,secret:string){
  validateAuth(raw);const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes.encode('learning-threads-codex-auth-v1')},await key(secret),bytes.encode(raw));
  return JSON.stringify({version:1,iv:base64(iv),ciphertext:base64(new Uint8Array(ciphertext))});
}
export async function decryptAuth(envelope:string,secret:string){
  const value=JSON.parse(envelope);if(value.version!==1)throw new Error('Unsupported Codex credential envelope.');
  const raw=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(value.iv),additionalData:bytes.encode('learning-threads-codex-auth-v1')},await key(secret),decode(value.ciphertext)));
  validateAuth(raw);return raw;
}

export async function persistRefreshedAuth(files:R2Bucket,secret:string,expectedEtag:string,raw:string){
  const auth=validateAuth(raw),path='credentials/auth.v1.enc';
  const prior=await files.get(path);
  const before=prior&&prior.etag===expectedEtag?validateAuth(await decryptAuth(await prior.text(),secret)):null;
  const encrypted=await encryptAuth(raw,secret);
  const replaced=await files.put(path,encrypted,{onlyIf:{etagMatches:expectedEtag}});
  // A fresh login or a completed write whose acknowledgement was lost wins.
  // Never overwrite it with credentials from an older running job.
  if(!replaced){
    const current=await files.get(path);
    if(!current)throw new Error('Refreshed OAuth credentials could not be stored.');
    await decryptAuth(await current.text(),secret);
    return {rotated:false};
  }
  return {rotated:!!before&&before.tokens.refresh_token!==auth.tokens.refresh_token};
}

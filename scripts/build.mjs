import {cp,mkdir,writeFile} from 'node:fs/promises';
const supabaseUrl=process.env.SUPABASE_URL||'';
const supabaseKey=process.env.SUPABASE_ANON_KEY||'';
const vapidPublicKey=process.env.VAPID_PUBLIC_KEY||'';
if(process.env.CI && (!supabaseUrl || !supabaseKey || !vapidPublicKey)) throw Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY repository variables before deployment.');
if(supabaseUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) throw Error('Invalid Supabase URL');
if(supabaseKey.startsWith('sb_secret_')) throw Error('Never put a secret key in the frontend');
if(supabaseKey.split('.').length===3){const payload=JSON.parse(Buffer.from(supabaseKey.split('.')[1],'base64url'));if(payload.role!=='anon')throw Error('Only anon keys may be published');}
await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
await writeFile('dist/config.js',`window.UYGUN_CONFIG = ${JSON.stringify({supabaseUrl,supabaseKey,vapidPublicKey})};\n`);
await writeFile('dist/.nojekyll','');console.log('Built dist/');
